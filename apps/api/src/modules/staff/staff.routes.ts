import { Router } from "express";
import { createStaffSchema, updateStaffSchema } from "@coffeeshop/shared";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../../lib/http.js";
import { hashPassword, hashPin } from "../../lib/security.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { recordAudit } from "../../lib/audit.js";

const router = Router();
router.use(requireAuth);

async function generateEmployeeCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `CS-${Math.floor(1000 + Math.random() * 9000)}`;
    const existing = await prisma.staff.findUnique({
      where: { employeeCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  return `CS-${Date.now().toString().slice(-6)}`;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const staff = await prisma.staff.findMany({
      where: { shopId: req.staff!.shopId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        employeeCode: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(ok(staff));
  }),
);

router.post(
  "/",
  requireRole("OWNER", "MANAGER"),
  validate(createStaffSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as {
      fullName: string;
      email?: string;
      phone?: string;
      role: "OWNER" | "MANAGER" | "CASHIER" | "BARISTA";
      password?: string;
      pin?: string;
    };

    if (input.role === "OWNER" && req.staff!.role !== "OWNER") {
      throw new AppError(403, "Only an owner can create another owner");
    }
    if (input.email) {
      const dupe = await prisma.staff.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (dupe) throw new AppError(409, "Email already in use");
    }
    if (input.phone) {
      const dupe = await prisma.staff.findUnique({
        where: { phone: input.phone },
        select: { id: true },
      });
      if (dupe) throw new AppError(409, "Phone already in use");
    }

    const created = await prisma.staff.create({
      data: {
        shopId: req.staff!.shopId,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        role: input.role,
        employeeCode: await generateEmployeeCode(),
        passwordHash: input.password
          ? await hashPassword(input.password)
          : null,
        pinHash: input.pin ? await hashPin(input.pin) : null,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        employeeCode: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "staff.create",
      entity: "Staff",
      entityId: created.id,
      ip: req.ip,
    });

    res.status(201).json(ok(created));
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const staff = await prisma.staff.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        employeeCode: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!staff) throw new AppError(404, "Staff not found");
    res.json(ok(staff));
  }),
);

router.patch(
  "/:id",
  requireRole("OWNER", "MANAGER"),
  validate(updateStaffSchema),
  asyncHandler(async (req, res) => {
    const target = await prisma.staff.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!target) throw new AppError(404, "Staff not found");

    const input = req.body as {
      fullName?: string;
      email?: string;
      phone?: string;
      role?: "OWNER" | "MANAGER" | "CASHIER" | "BARISTA";
      password?: string;
      pin?: string;
      isActive?: boolean;
    };

    if (input.role === "OWNER" && req.staff!.role !== "OWNER") {
      throw new AppError(403, "Only an owner can assign the owner role");
    }

    const data: Record<string, unknown> = {};
    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.role !== undefined) data.role = input.role;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.password) data.passwordHash = await hashPassword(input.password);
    if (input.pin) data.pinHash = await hashPin(input.pin);

    const updated = await prisma.staff.update({
      where: { id: target.id },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        employeeCode: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "staff.update",
      entity: "Staff",
      entityId: target.id,
      ip: req.ip,
    });

    res.json(ok(updated));
  }),
);

export default router;
