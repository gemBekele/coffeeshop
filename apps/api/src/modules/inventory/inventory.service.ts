import type { StockMovementType } from "@coffeeshop/shared";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/http.js";

export interface ApplyMovementInput {
  shopId: string;
  inventoryItemId: string;
  type: StockMovementType;
  /** Positive magnitude for IN/OUT/WASTE/SALE; signed delta for ADJUST. */
  quantity: number;
  reason?: string;
  refOrderId?: string;
  createdById?: string;
}

/** Sign of the stock change applied for each movement type. */
export function movementDelta(type: StockMovementType, quantity: number): number {
  switch (type) {
    case "IN":
      return Math.abs(quantity);
    case "OUT":
    case "WASTE":
    case "SALE":
      return -Math.abs(quantity);
    case "ADJUST":
      return quantity;
  }
}

/**
 * Apply a stock movement and update the item's stock-on-hand atomically.
 */
export async function applyMovement(input: ApplyMovementInput) {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: input.inventoryItemId, shopId: input.shopId },
  });
  if (!item) throw new AppError(404, "Inventory item not found");

  const delta = movementDelta(input.type, input.quantity);
  const newStock = Number(item.stockOnHand) + delta;

  const [, movement] = await prisma.$transaction([
    prisma.inventoryItem.update({
      where: { id: item.id },
      data: { stockOnHand: newStock },
    }),
    prisma.stockMovement.create({
      data: {
        shopId: input.shopId,
        inventoryItemId: item.id,
        type: input.type,
        quantity: delta,
        reason: input.reason,
        refOrderId: input.refOrderId,
        createdById: input.createdById,
      },
    }),
  ]);

  return movement;
}

/**
 * Deduct recipe ingredients for an order (used when an order is paid).
 * Returns the movements created. Items are matched by shop.
 */
export async function consumeRecipeForOrder(params: {
  shopId: string;
  orderId: string;
  createdById?: string;
}): Promise<void> {
  const { shopId, orderId, createdById } = params;

  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              trackInventory: true,
              recipeIngredients: true,
            },
          },
        },
      },
    },
  });
  if (!order) throw new AppError(404, "Order not found");

  // Aggregate ingredient usage across all order items.
  const usage = new Map<string, number>();
  for (const line of order.items) {
    if (!line.product.trackInventory) continue;
    for (const ingredient of line.product.recipeIngredients) {
      const current = usage.get(ingredient.inventoryItemId) ?? 0;
      usage.set(
        ingredient.inventoryItemId,
        current + Number(ingredient.quantity) * line.quantity,
      );
    }
  }

  if (usage.size === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const [inventoryItemId, quantity] of usage) {
      const item = await tx.inventoryItem.findFirst({
        where: { id: inventoryItemId, shopId },
      });
      if (!item) continue;
      const newStock = Number(item.stockOnHand) - quantity;
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { stockOnHand: newStock },
      });
      await tx.stockMovement.create({
        data: {
          shopId,
          inventoryItemId: item.id,
          type: "SALE",
          quantity: -quantity,
          reason: `Order #${order.orderNumber}`,
          refOrderId: orderId,
          createdById,
        },
      });
    }
  });
}
