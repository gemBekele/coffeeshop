import { prisma } from "../../lib/prisma.js";
import { consumeRecipeForOrder } from "../inventory/inventory.service.js";

/**
 * Mark an order PAID (idempotent) and deduct recipe ingredients once.
 */
export async function settleOrderAsPaid(params: {
  shopId: string;
  orderId: string;
  actorId?: string;
  note?: string;
}): Promise<void> {
  const { shopId, orderId, actorId, note } = params;

  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId },
    select: { id: true, status: true },
  });
  if (!order) return;
  if (order.status === "PAID") return;
  if (order.status === "VOID") return;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      statusEvents: {
        create: {
          status: "PAID",
          note: note ?? "Payment matched",
          createdById: actorId ?? null,
        },
      },
    },
  });

  await consumeRecipeForOrder({ shopId, orderId, createdById: actorId });
}
