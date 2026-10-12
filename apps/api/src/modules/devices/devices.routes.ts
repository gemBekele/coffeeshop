import { Router } from "express";
import {
  compileTemplate,
  registerDeviceSchema,
  type FieldName,
} from "@coffeeshop/shared";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../../lib/http.js";
import { generateDeviceKey } from "../../lib/security.js";
import { requireAuth, requireRole, authenticateDevice } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { recordAudit } from "../../lib/audit.js";

const router = Router();

router.get(
  "/me/config",
  authenticateDevice,
  asyncHandler(async (req, res) => {
    const shop = await prisma.shop.findUniqueOrThrow({
      where: { id: req.device!.shopId },
      select: { id: true, name: true, currency: true, timezone: true },
    });

    const templates = await prisma.smsTemplate.findMany({
      where: { shopId: req.device!.shopId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
    });

    const compiledTemplates = templates.map((t) => {
      const compiled = compileTemplate(t.templateBody);
      return {
        id: t.id,
        name: t.name,
        provider: t.provider,
        direction: t.direction,
        senderAllowlist: t.senderAllowlist,
        version: t.version,
        templateBody: t.templateBody,
        fields: compiled.fields as FieldName[],
        regex: compiled.regex,
        flags: compiled.flags,
        warnings: compiled.warnings,
      };
    });

    res.json(ok({ device: req.device, shop, templates: compiledTemplates }));
  }),
);

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const devices = await prisma.device.findMany({
      where: { shopId: req.staff!.shopId },
      select: {
        id: true,
        label: true,
        role: true,
        platform: true,
        apiKeyPrefix: true,
        lastSeenAt: true,
        isActive: true,
        createdAt: true,
        staff: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(ok(devices));
  }),
);

router.post(
  "/",
  requireRole("OWNER", "MANAGER"),
  validate(registerDeviceSchema),
  asyncHandler(async (req, res) => {
    const { label, role, platform } = req.body as {
      label: string;
      role: "OWNER" | "MANAGER" | "CASHIER" | "BARISTA";
      platform: "android" | "ios";
    };

    const { plaintext, hash, prefix } = generateDeviceKey();
    const device = await prisma.device.create({
      data: {
        shopId: req.staff!.shopId,
        staffId: req.staff!.id,
        label,
        role,
        platform: platform.toUpperCase() as "ANDROID" | "IOS",
        apiKeyHash: hash,
        apiKeyPrefix: prefix,
      },
      select: {
        id: true,
        label: true,
        role: true,
        platform: true,
        apiKeyPrefix: true,
        isActive: true,
        createdAt: true,
      },
    });

    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "device.register",
      entity: "Device",
      entityId: device.id,
      ip: req.ip,
    });

    // The plaintext key is returned exactly once.
    res.status(201).json(ok({ device, apiKey: plaintext }));
  }),
);

router.delete(
  "/:id",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const device = await prisma.device.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!device) throw new AppError(404, "Device not found");
    await prisma.device.update({
      where: { id: device.id },
      data: { isActive: false },
    });
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "device.revoke",
      entity: "Device",
      entityId: device.id,
      ip: req.ip,
    });
    res.json(ok({ revoked: true }));
  }),
);

export default router;
