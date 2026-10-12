import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { recordAudit } from "../../lib/audit.js";
import { issueRefreshToken, signAccessToken } from "../../lib/tokens.js";
import { emitToShop } from "../../realtime/socket.js";

const router = Router();

const requestSchema = z.object({
  employeeCode: z.string().min(2).max(40),
});

const approveSchema = z.object({
  token: z.string().min(10),
});

const PAIRING_TTL_MINUTES = 10;

function randomCode(len = 6): string {
  return crypto.randomBytes(len).toString("hex").toUpperCase();
}

function isExpired(p: { expiresAt: Date }): boolean {
  return p.expiresAt.getTime() < Date.now();
}

/**
 * Step 1 (employee phone): request a pairing code. The employee shows the QR
 * containing `token`; the owner scans it to approve.
 */
router.post(
  "/request",
  validate(requestSchema),
  asyncHandler(async (req, res) => {
    const { employeeCode } = req.body as { employeeCode: string };

    const staff = await prisma.staff.findFirst({
      where: { employeeCode: employeeCode.trim().toUpperCase() },
      include: { shop: { select: { id: true, name: true } } },
    });

    if (!staff) throw new AppError(404, "No account for that code");
    if (!staff.isActive) {
      throw new AppError(403, "That account is disabled. Ask the owner.");
    }
    if (staff.role === "OWNER") {
      throw new AppError(400, "Owner accounts sign in with a PIN");
    }

    // Only one live request per staff member.
    await prisma.staffPairing.updateMany({
      where: { staffId: staff.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });

    const pairing = await prisma.staffPairing.create({
      data: {
        shopId: staff.shopId,
        staffId: staff.id,
        code: randomCode(),
        token: crypto.randomBytes(24).toString("base64url"),
        expiresAt: new Date(Date.now() + PAIRING_TTL_MINUTES * 60 * 1000),
      },
    });

    emitToShop(staff.shopId, "pairing:requested", {
      pairingId: pairing.id,
      code: pairing.code,
      staffName: staff.fullName,
    });

    res.status(201).json(
      ok({
        pairingId: pairing.id,
        code: pairing.code,
        token: pairing.token,
        staffName: staff.fullName,
        role: staff.role,
        shopName: staff.shop.name,
        expiresAt: pairing.expiresAt,
      }),
    );
  }),
);

/**
 * Step 2 (owner phone): approve after scanning the QR code.
 */
router.post(
  "/approve",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  validate(approveSchema),
  asyncHandler(async (req, res) => {
    const { token } = req.body as { token: string };

    const pairing = await prisma.staffPairing.findUnique({
      where: { token },
      include: { staff: { select: { id: true, fullName: true, shopId: true } } },
    });
    if (!pairing) throw new AppError(404, "Unknown pairing code");
    if (pairing.shopId !== req.staff!.shopId) {
      throw new AppError(403, "That account belongs to another shop");
    }
    if (pairing.status === "APPROVED") {
      throw new AppError(409, "Already approved");
    }
    if (pairing.status !== "PENDING") {
      throw new AppError(409, "That request is no longer valid");
    }
    if (isExpired(pairing)) {
      await prisma.staffPairing.update({
        where: { id: pairing.id },
        data: { status: "EXPIRED" },
      });
      throw new AppError(410, "That request expired — ask the employee to retry");
    }

    const updated = await prisma.staffPairing.update({
      where: { id: pairing.id },
      data: { status: "APPROVED", approvedAt: new Date() },
    });

    recordAudit({
      shopId: pairing.shopId,
      staffId: req.staff!.id,
      action: "pairing.approve",
      entity: "Staff",
      entityId: pairing.staffId,
      metadata: { pairingId: pairing.id },
      ip: req.ip,
    });

    emitToShop(pairing.shopId, "pairing:approved", {
      pairingId: updated.id,
      staffName: pairing.staff.fullName,
    });

    res.json(
      ok({
        pairingId: updated.id,
        code: updated.code,
        staffId: pairing.staff.id,
        staffName: pairing.staff.fullName,
        approved: true,
      }),
    );
  }),
);

/**
 * Step 3 (employee phone): poll until approved, then receive a session so the
 * account becomes usable on this device.
 */
router.get(
  "/status",
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, string | undefined>;
    const token = query.token ?? "";
    if (token.length < 10) throw new AppError(400, "Missing token");

    const pairing = await prisma.staffPairing.findUnique({
      where: { token },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            role: true,
            shopId: true,
            isActive: true,
            shop: { select: { name: true } },
          },
        },
      },
    });
    if (!pairing) throw new AppError(404, "Unknown pairing code");

    if (pairing.status === "PENDING") {
      res.json(
        ok({
          approved: false,
          expired: isExpired(pairing),
          staffName: pairing.staff.fullName,
          shopName: pairing.staff.shop.name,
          expiresAt: pairing.expiresAt,
        }),
      );
      return;
    }

    if (pairing.status === "DENIED") {
      res.json(ok({ approved: false, denied: true }));
      return;
    }

    if (pairing.status === "EXPIRED" || isExpired(pairing)) {
      res.json(ok({ approved: false, expired: true }));
      return;
    }

    if (!pairing.staff.isActive) {
      throw new AppError(403, "That account is disabled");
    }

    // Approved: hand the employee a session for this device.
    const base = {
      sub: pairing.staff.id,
      role: pairing.staff.role as never,
      shopId: pairing.staff.shopId,
    };
    const accessToken = signAccessToken(base);
    const refreshToken = await issueRefreshToken(base);

    res.json(
      ok({
        approved: true,
        accessToken,
        refreshToken,
        staff: {
          id: pairing.staff.id,
          fullName: pairing.staff.fullName,
          role: pairing.staff.role,
          shopId: pairing.staff.shopId,
        },
      }),
    );
  }),
);

/** Owner-facing list of recent pairing activity. */
router.get(
  "/",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const pairings = await prisma.staffPairing.findMany({
      where: { shopId: req.staff!.shopId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { staff: { select: { fullName: true, role: true } } },
    });
    res.json(ok(pairings));
  }),
);

export default router;