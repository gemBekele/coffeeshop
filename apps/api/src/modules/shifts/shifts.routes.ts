import { Router } from "express";
import { closeShiftSchema, openShiftSchema } from "@coffeeshop/shared";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { recordAudit } from "../../lib/audit.js";

const router = Router();
router.use(requireAuth);

function serialize(shift: {
  openingFloat: unknown;
  closingCash: unknown;
  expectedCash: unknown;
  difference: unknown;
  [key: string]: unknown;
}) {
  return {
    ...shift,
    openingFloat: Number(shift.openingFloat),
    closingCash: shift.closingCash === null ? null : Number(shift.closingCash),
    expectedCash: shift.expectedCash === null ? null : Number(shift.expectedCash),
    difference: shift.difference === null ? null : Number(shift.difference),
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const shifts = await prisma.shift.findMany({
      where: { shopId: req.staff!.shopId },
      include: { staff: { select: { id: true, fullName: true } } },
      orderBy: { openedAt: "desc" },
      take: 100,
    });
    res.json(ok(shifts.map(serialize)));
  }),
);

router.get(
  "/current",
  asyncHandler(async (req, res) => {
    const shift = await prisma.shift.findFirst({
      where: { shopId: req.staff!.shopId, staffId: req.staff!.id, status: "OPEN" },
      include: { staff: { select: { id: true, fullName: true } } },
    });
    res.json(ok(shift ? serialize(shift) : null));
  }),
);

router.post(
  "/open",
  validate(openShiftSchema),
  asyncHandler(async (req, res) => {
    const { openingFloat, note } = req.body as {
      openingFloat: number;
      note?: string;
    };

    const existing = await prisma.shift.findFirst({
      where: { staffId: req.staff!.id, status: "OPEN" },
    });
    if (existing) {
      throw new AppError(409, "You already have an open shift");
    }

    const shift = await prisma.shift.create({
      data: {
        shopId: req.staff!.shopId,
        staffId: req.staff!.id,
        openingFloat,
        note,
      },
      include: { staff: { select: { id: true, fullName: true } } },
    });

    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "shift.open",
      entity: "Shift",
      entityId: shift.id,
      ip: req.ip,
    });

    res.status(201).json(ok(serialize(shift)));
  }),
);

router.post(
  "/:id/close",
  validate(closeShiftSchema),
  asyncHandler(async (req, res) => {
    const { closingCash, note } = req.body as {
      closingCash: number;
      note?: string;
    };

    const shift = await prisma.shift.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!shift) throw new AppError(404, "Shift not found");
    if (shift.status === "CLOSED") {
      throw new AppError(409, "Shift is already closed");
    }
    if (
      shift.staffId !== req.staff!.id &&
      !["OWNER", "MANAGER"].includes(req.staff!.role)
    ) {
      throw new AppError(403, "You can only close your own shift");
    }

    // Cash reconciliation: opening float + cash collected during the shift.
    const cashSales = await prisma.payment.aggregate({
      where: {
        shopId: req.staff!.shopId,
        status: { in: ["MATCHED", "VERIFIED"] },
        receivedAt: { gte: shift.openedAt },
        bank: "CASH",
      },
      _sum: { amount: true },
    });
    const expectedCash = Number(shift.openingFloat) + Number(cashSales._sum.amount ?? 0);
    const difference = closingCash - expectedCash;

    const closed = await prisma.shift.update({
      where: { id: shift.id },
      data: {
        status: "CLOSED",
        closingCash,
        expectedCash,
        difference,
        closedAt: new Date(),
        note: note ?? shift.note,
      },
      include: { staff: { select: { id: true, fullName: true } } },
    });

    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "shift.close",
      entity: "Shift",
      entityId: shift.id,
      metadata: { closingCash, expectedCash, difference },
      ip: req.ip,
    });

    res.json(ok(serialize(closed)));
  }),
);

export default router;
