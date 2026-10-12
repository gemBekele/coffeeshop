import { Router } from "express";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  stockMovementSchema,
} from "@coffeeshop/shared";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../../lib/http.js";
import { serializeDecimals } from "../../lib/decimal.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { recordAudit } from "../../lib/audit.js";
import { applyMovement } from "./inventory.service.js";

const router = Router();
router.use(requireAuth);

function withLowStockFlag<
  T extends { stockOnHand: unknown; reorderLevel: unknown },
>(item: T) {
  const stock = Number(item.stockOnHand);
  const reorder = Number(item.reorderLevel);
  return { ...item, lowStock: stock <= reorder };
}

router.get(
  "/items",
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, string | undefined>;
    const lowOnly = query.lowOnly === "true";
    const items = await prisma.inventoryItem.findMany({
      where: { shopId: req.staff!.shopId, ...(lowOnly ? {} : {}) },
      orderBy: { name: "asc" },
    });
    let result = items.map((item) => withLowStockFlag(item));
    if (lowOnly) result = result.filter((item) => item.lowStock);
    res.json(ok(serializeDecimals(result)));
  }),
);

router.get(
  "/low-stock",
  asyncHandler(async (req, res) => {
    const items = await prisma.inventoryItem.findMany({
      where: { shopId: req.staff!.shopId, isActive: true },
      orderBy: { name: "asc" },
    });
    const low = items
      .map((item) => withLowStockFlag(item))
      .filter((item) => item.lowStock);
    res.json(ok(serializeDecimals(low)));
  }),
);

router.get(
  "/items/:id",
  asyncHandler(async (req, res) => {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!item) throw new AppError(404, "Inventory item not found");
    res.json(ok(serializeDecimals(withLowStockFlag(item))));
  }),
);

router.post(
  "/items",
  requireRole("OWNER", "MANAGER"),
  validate(createInventoryItemSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as {
      name: string;
      unit: string;
      stockOnHand?: number;
      reorderLevel?: number;
      cost?: number;
      isActive?: boolean;
    };
    const dupe = await prisma.inventoryItem.findFirst({
      where: { shopId: req.staff!.shopId, name: input.name },
      select: { id: true },
    });
    if (dupe) throw new AppError(409, "An item with that name already exists");

    const item = await prisma.inventoryItem.create({
      data: {
        shopId: req.staff!.shopId,
        name: input.name,
        unit: input.unit,
        stockOnHand: input.stockOnHand ?? 0,
        reorderLevel: input.reorderLevel ?? 0,
        cost: input.cost ?? 0,
        isActive: input.isActive ?? true,
      },
    });

    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "inventory.create",
      entity: "InventoryItem",
      entityId: item.id,
      ip: req.ip,
    });
    res.status(201).json(ok(serializeDecimals(withLowStockFlag(item))));
  }),
);

router.patch(
  "/items/:id",
  requireRole("OWNER", "MANAGER"),
  validate(updateInventoryItemSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.inventoryItem.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!existing) throw new AppError(404, "Inventory item not found");

    const { stockOnHand: _ignored, ...rest } = req.body as Record<string, unknown>;
    const item = await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: rest as never,
    });
    res.json(ok(serializeDecimals(withLowStockFlag(item))));
  }),
);

router.get(
  "/items/:id/movements",
  asyncHandler(async (req, res) => {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
      select: { id: true },
    });
    if (!item) throw new AppError(404, "Inventory item not found");

    const movements = await prisma.stockMovement.findMany({
      where: { inventoryItemId: item.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { createdBy: { select: { id: true, fullName: true } } },
    });
    res.json(ok(serializeDecimals(movements)));
  }),
);

router.post(
  "/items/:id/movements",
  requireRole("OWNER", "MANAGER", "CASHIER"),
  validate(stockMovementSchema),
  asyncHandler(async (req, res) => {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
      select: { id: true },
    });
    if (!item) throw new AppError(404, "Inventory item not found");

    const input = req.body as {
      type: "IN" | "OUT" | "ADJUST" | "WASTE" | "SALE";
      quantity: number;
      reason?: string;
    };

    const movement = await applyMovement({
      shopId: req.staff!.shopId,
      inventoryItemId: item.id,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason,
      createdById: req.staff!.id,
    });

    const updated = await prisma.inventoryItem.findUnique({
      where: { id: item.id },
    });

    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "inventory.movement",
      entity: "InventoryItem",
      entityId: item.id,
      metadata: { type: input.type, quantity: input.quantity },
      ip: req.ip,
    });

    res.status(201).json(
      ok(
        serializeDecimals({
          movement,
          item: updated ? withLowStockFlag(updated) : null,
        }),
      ),
    );
  }),
);

export default router;
