import { Router } from "express";
import {
  createOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  type OrderStatus,
} from "@coffeeshop/shared";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../../lib/http.js";
import { serializeDecimals } from "../../lib/decimal.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { recordAudit } from "../../lib/audit.js";
import { consumeRecipeForOrder } from "../inventory/inventory.service.js";
import { emitToShop } from "../../realtime/socket.js";

const router = Router();
router.use(requireAuth);

const orderInclude = {
  items: {
    include: {
      product: { select: { id: true, name: true } },
      variant: { select: { id: true, name: true } },
    },
  },
  statusEvents: { orderBy: { createdAt: "asc" as const } },
  createdBy: { select: { id: true, fullName: true } },
  payments: true,
};

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  OPEN: ["CONFIRMED", "PREPARING", "VOID"],
  CONFIRMED: ["PREPARING", "READY", "VOID"],
  PREPARING: ["READY", "SERVED", "VOID"],
  READY: ["SERVED", "PAID", "VOID"],
  SERVED: ["PAID", "VOID"],
  PAID: [],
  VOID: [],
};

function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) return;
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AppError(409, `Cannot change order from ${from} to ${to}`);
  }
}

router.get(
  "/board",
  asyncHandler(async (req, res) => {
    const statuses: OrderStatus[] = [
      "OPEN",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "SERVED",
    ];
    const orders = await prisma.order.findMany({
      where: {
        shopId: req.staff!.shopId,
        status: { in: statuses },
      },
      include: orderInclude,
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    const board: Record<string, unknown[]> = {};
    for (const status of statuses) board[status] = [];
    for (const order of orders) {
      (board[order.status] ??= []).push(serializeDecimals(order));
    }
    res.json(ok(board));
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));

    const where = {
      shopId: req.staff!.shopId,
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.paid === "true" ? { status: "PAID" as never } : {}),
    };

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json(
      ok({
        items: serializeDecimals(orders),
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      }),
    );
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
      include: orderInclude,
    });
    if (!order) throw new AppError(404, "Order not found");
    res.json(ok(serializeDecimals(order)));
  }),
);

router.post(
  "/",
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as {
      type: "DINE_IN" | "TAKEAWAY";
      tableLabel?: string;
      customerName?: string;
      customerPhone?: string;
      customerTxnId?: string;
      note?: string;
      items: Array<{
        productId: string;
        variantId?: string;
        quantity: number;
        note?: string;
      }>;
    };

    const shop = await prisma.shop.findUniqueOrThrow({
      where: { id: req.staff!.shopId },
    });

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId: req.staff!.shopId, isActive: true },
      include: { variants: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const itemData = input.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new AppError(400, "Product not found or inactive");

      let unitPrice = Number(product.price);
      let nameSnapshot = product.name;
      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) throw new AppError(400, "Variant not found for product");
        unitPrice += Number(variant.priceDelta);
        nameSnapshot = `${product.name} (${variant.name})`;
      }
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      return {
        productId: product.id,
        variantId: item.variantId ?? null,
        nameSnapshot,
        unitPrice,
        quantity: item.quantity,
        lineTotal,
        note: item.note,
      };
    });

    const tax = Math.round(subtotal * (Number(shop.taxRate) / 100) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    const openShift = await prisma.shift.findFirst({
      where: { staffId: req.staff!.id, status: "OPEN" },
      select: { id: true },
    });

    let created;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const last = await tx.order.findFirst({
            where: { shopId: req.staff!.shopId },
            orderBy: { orderNumber: "desc" },
            select: { orderNumber: true },
          });
          const orderNumber = (last?.orderNumber ?? 0) + 1;

          return tx.order.create({
            data: {
              shopId: req.staff!.shopId,
              orderNumber,
              type: input.type,
              status: "OPEN",
              tableLabel: input.tableLabel,
              customerName: input.customerName,
              customerPhone: input.customerPhone,
              customerTxnId: input.customerTxnId,
              note: input.note,
              subtotal,
              tax,
              total,
              shiftId: openShift?.id ?? null,
              createdById: req.staff!.id,
              items: { create: itemData },
              statusEvents: {
                create: { status: "OPEN", createdById: req.staff!.id },
              },
            },
            include: orderInclude,
          });
        });
        break;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "P2002" && attempt < 4) continue;
        throw err;
      }
    }

    emitToShop(req.staff!.shopId, "order:created", serializeDecimals(created));
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "order.create",
      entity: "Order",
      entityId: created!.id,
      ip: req.ip,
    });

    res.status(201).json(ok(serializeDecimals(created)));
  }),
);

router.post(
  "/quick-sale",
  asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body as {
      productId?: string;
      quantity?: number;
    };
    if (!productId) throw new AppError(400, "productId is required");
    const qty = Math.max(1, Math.min(100, Math.floor(Number(quantity ?? 1)) || 1));

    const shop = await prisma.shop.findUniqueOrThrow({
      where: { id: req.staff!.shopId },
    });
    const product = await prisma.product.findFirst({
      where: { id: productId, shopId: req.staff!.shopId, isActive: true },
    });
    if (!product) throw new AppError(400, "Product not found or inactive");

    const unitPrice = Number(product.price);
    const subtotal = Math.round(unitPrice * qty * 100) / 100;
    const tax = Math.round(subtotal * (Number(shop.taxRate) / 100) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    const openShift = await prisma.shift.findFirst({
      where: { staffId: req.staff!.id, status: "OPEN" },
      select: { id: true },
    });

    let created;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const last = await tx.order.findFirst({
            where: { shopId: req.staff!.shopId },
            orderBy: { orderNumber: "desc" },
            select: { orderNumber: true },
          });
          const orderNumber = (last?.orderNumber ?? 0) + 1;
          return tx.order.create({
            data: {
              shopId: req.staff!.shopId,
              orderNumber,
              type: "TAKEAWAY",
              status: "PAID",
              subtotal,
              tax,
              total,
              paidAt: new Date(),
              shiftId: openShift?.id ?? null,
              createdById: req.staff!.id,
              items: {
                create: {
                  productId: product.id,
                  nameSnapshot: product.name,
                  unitPrice,
                  quantity: qty,
                  lineTotal: subtotal,
                },
              },
              statusEvents: {
                create: [
                  { status: "OPEN", createdById: req.staff!.id },
                  {
                    status: "PAID",
                    note: "Quick sale",
                    createdById: req.staff!.id,
                  },
                ],
              },
            },
            include: orderInclude,
          });
        });
        break;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "P2002" && attempt < 4) continue;
        throw err;
      }
    }

    await prisma.payment.create({
      data: {
        shopId: req.staff!.shopId,
        orderId: created!.id,
        txnId: `SALE-${created!.orderNumber}-${Date.now()}`,
        amount: total,
        currency: shop.currency,
        bank: "CASH",
        source: "MANUAL",
        status: "VERIFIED",
        direction: "CREDIT",
        rawSms: "Quick sale at POS",
        verifiedAt: new Date(),
        matchedAt: new Date(),
      },
    });

    await consumeRecipeForOrder({
      shopId: req.staff!.shopId,
      orderId: created!.id,
      createdById: req.staff!.id,
    });

    emitToShop(req.staff!.shopId, "order:updated", serializeDecimals(created));
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "order.quickSale",
      entity: "Order",
      entityId: created!.id,
      ip: req.ip,
    });

    res.status(201).json(ok(serializeDecimals(created)));
  }),
);

router.patch(
  "/:id",
  validate(updateOrderSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!existing) throw new AppError(404, "Order not found");
    if (existing.status === "PAID" || existing.status === "VOID") {
      throw new AppError(409, "Cannot edit a closed order");
    }

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: req.body as never,
      include: orderInclude,
    });
    emitToShop(req.staff!.shopId, "order:updated", serializeDecimals(updated));
    res.json(ok(serializeDecimals(updated)));
  }),
);

router.patch(
  "/:id/status",
  validate(updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const { status, note } = req.body as { status: OrderStatus; note?: string };

    const existing = await prisma.order.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!existing) throw new AppError(404, "Order not found");

    assertTransition(existing.status as OrderStatus, status);

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status,
        ...(status === "PAID" ? { paidAt: new Date() } : {}),
        statusEvents: {
          create: { status, note, createdById: req.staff!.id },
        },
      },
      include: orderInclude,
    });

    if (status === "PAID") {
      await consumeRecipeForOrder({
        shopId: req.staff!.shopId,
        orderId: existing.id,
        createdById: req.staff!.id,
      });
    }

    emitToShop(req.staff!.shopId, "order:updated", serializeDecimals(updated));
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "order.status",
      entity: "Order",
      entityId: existing.id,
      metadata: { from: existing.status, to: status },
      ip: req.ip,
    });

    res.json(ok(serializeDecimals(updated)));
  }),
);

router.post(
  "/:id/void",
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!existing) throw new AppError(404, "Order not found");
    if (existing.status === "PAID") {
      throw new AppError(409, "A paid order cannot be voided");
    }

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status: "VOID",
        statusEvents: {
          create: { status: "VOID", createdById: req.staff!.id },
        },
      },
      include: orderInclude,
    });
    emitToShop(req.staff!.shopId, "order:updated", serializeDecimals(updated));
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "order.void",
      entity: "Order",
      entityId: existing.id,
      ip: req.ip,
    });
    res.json(ok(serializeDecimals(updated)));
  }),
);

router.post(
  "/:id/pay-cash",
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
      include: { payments: true },
    });
    if (!existing) throw new AppError(404, "Order not found");
    if (existing.status === "PAID") throw new AppError(409, "Order is already paid");
    if (existing.status === "VOID") throw new AppError(409, "Order is voided");

    const txnId = `CASH-${existing.orderNumber}-${Date.now()}`;
    const shop = await prisma.shop.findUniqueOrThrow({
      where: { id: req.staff!.shopId },
      select: { currency: true },
    });

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          shopId: req.staff!.shopId,
          orderId: existing.id,
          txnId,
          amount: existing.total,
          currency: shop.currency,
          bank: "CASH",
          source: "MANUAL",
          status: "VERIFIED",
          direction: "CREDIT",
          rawSms: "Cash payment recorded at POS",
          verifiedAt: new Date(),
          matchedAt: new Date(),
        },
      }),
      prisma.order.update({
        where: { id: existing.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          statusEvents: {
            create: {
              status: "PAID",
              note: "Cash payment",
              createdById: req.staff!.id,
            },
          },
        },
      }),
    ]);

    await consumeRecipeForOrder({
      shopId: req.staff!.shopId,
      orderId: existing.id,
      createdById: req.staff!.id,
    });

    const updated = await prisma.order.findUnique({
      where: { id: existing.id },
      include: orderInclude,
    });
    emitToShop(req.staff!.shopId, "order:updated", serializeDecimals(updated));
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "order.payCash",
      entity: "Order",
      entityId: existing.id,
      ip: req.ip,
    });
    res.json(ok(serializeDecimals(updated)));
  }),
);

export default router;
