import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { localDay } from "../../lib/time.js";

const router = Router();
router.use(requireAuth);

function rangeFromQuery(query: Record<string, string | undefined>) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, string | undefined>;
    const { from, to } = rangeFromQuery(query);
    const shopId = req.staff!.shopId;

    const [paidOrders, paymentAgg, lowStockCount, openOrderCount] =
      await Promise.all([
        prisma.order.aggregate({
          where: {
            shopId,
            status: "PAID",
            paidAt: { gte: from, lte: to },
          },
          _count: { _all: true },
          _sum: { total: true, tax: true, subtotal: true },
        }),
        prisma.payment.groupBy({
          by: ["status"],
          where: { shopId, receivedAt: { gte: from, lte: to } },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::int AS count FROM "InventoryItem"
          WHERE "shopId" = ${shopId} AND "isActive" = true
            AND "stockOnHand" <= "reorderLevel"
        `,
        prisma.order.count({
          where: {
            shopId,
            status: { in: ["OPEN", "CONFIRMED", "PREPARING", "READY", "SERVED"] },
          },
        }),
      ]);

    const orderCount = paidOrders._count._all;
    const grossSales = Number(paidOrders._sum.total ?? 0);

    res.json(
      ok({
        range: { from, to },
        orders: {
          paidCount: orderCount,
          openCount: openOrderCount,
          grossSales,
          taxCollected: Number(paidOrders._sum.tax ?? 0),
          netSales: Number(paidOrders._sum.subtotal ?? 0),
          averageOrderValue: orderCount ? grossSales / orderCount : 0,
        },
        payments: paymentAgg.map((p) => ({
          status: p.status,
          count: p._count._all,
          amount: Number(p._sum.amount ?? 0),
        })),
        lowStockCount: Number(lowStockCount[0]?.count ?? 0),
      }),
    );
  }),
);

router.get(
  "/daily",
  asyncHandler(async (req, res) => {
    const shopId = req.staff!.shopId;
    const shop = await prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      select: { timezone: true },
    });
    const { start, end, date } = localDay(shop.timezone);

    const orders = await prisma.order.findMany({
      where: {
        shopId,
        status: "PAID",
        paidAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        total: true,
        items: {
          select: {
            productId: true,
            nameSnapshot: true,
            quantity: true,
            lineTotal: true,
          },
        },
      },
    });

    let totalSales = 0;
    let totalItems = 0;
    const map = new Map<
      string,
      { productId: string; name: string; quantity: number; revenue: number }
    >();
    for (const order of orders) {
      totalSales += Number(order.total);
      for (const item of order.items) {
        totalItems += item.quantity;
        const key = item.productId ?? item.nameSnapshot;
        const entry =
          map.get(key) ??
          { productId: key, name: item.nameSnapshot, quantity: 0, revenue: 0 };
        entry.quantity += item.quantity;
        entry.revenue += Number(item.lineTotal);
        map.set(key, entry);
      }
    }

    res.json(
      ok({
        date,
        totalSales,
        totalItems,
        orderCount: orders.length,
        items: [...map.values()].sort((a, b) => b.quantity - a.quantity),
      }),
    );
  }),
);

router.get(
  "/sales",
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, string | undefined>;
    const { from, to } = rangeFromQuery(query);
    const orders = await prisma.order.findMany({
      where: {
        shopId: req.staff!.shopId,
        status: "PAID",
        paidAt: { gte: from, lte: to },
      },
      select: { paidAt: true, total: true },
      orderBy: { paidAt: "asc" },
    });

    const byDay = new Map<string, { date: string; orders: number; sales: number }>();
    for (const o of orders) {
      const day = (o.paidAt ?? new Date()).toISOString().slice(0, 10);
      const entry = byDay.get(day) ?? { date: day, orders: 0, sales: 0 };
      entry.orders += 1;
      entry.sales += Number(o.total);
      byDay.set(day, entry);
    }
    res.json(ok([...byDay.values()]));
  }),
);

router.get(
  "/top-products",
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, string | undefined>;
    const { from, to } = rangeFromQuery(query);
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 10)));

    const grouped = await prisma.orderItem.groupBy({
      by: ["nameSnapshot"],
      where: {
        order: {
          shopId: req.staff!.shopId,
          status: "PAID",
          paidAt: { gte: from, lte: to },
        },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: limit,
    });

    res.json(
      ok(
        grouped.map((g) => ({
          name: g.nameSnapshot,
          quantity: g._sum.quantity ?? 0,
          revenue: Number(g._sum.lineTotal ?? 0),
        })),
      ),
    );
  }),
);

router.get(
  "/payments",
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, string | undefined>;
    const { from, to } = rangeFromQuery(query);
    const shopId = req.staff!.shopId;

    const [byMethod, byStatus, unmatched] = await Promise.all([
      prisma.payment.groupBy({
        by: ["bank"],
        where: {
          shopId,
          receivedAt: { gte: from, lte: to },
          status: { in: ["MATCHED", "VERIFIED"] },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.payment.groupBy({
        by: ["status"],
        where: { shopId, receivedAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      prisma.payment.count({
        where: { shopId, status: "UNMATCHED" },
      }),
    ]);

    res.json(
      ok({
        byMethod: byMethod.map((m) => ({
          bank: m.bank ?? "unknown",
          count: m._count._all,
          amount: Number(m._sum.amount ?? 0),
        })),
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
        unmatchedCount: unmatched,
      }),
    );
  }),
);

router.get(
  "/inventory",
  asyncHandler(async (req, res) => {
    const items = await prisma.inventoryItem.findMany({
      where: { shopId: req.staff!.shopId, isActive: true },
      orderBy: { name: "asc" },
    });
    const valued = items.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      stockOnHand: Number(i.stockOnHand),
      reorderLevel: Number(i.reorderLevel),
      cost: Number(i.cost),
      value: Number(i.stockOnHand) * Number(i.cost),
      lowStock: Number(i.stockOnHand) <= Number(i.reorderLevel),
    }));
    res.json(
      ok({
        items: valued,
        totalValue: valued.reduce((sum, i) => sum + i.value, 0),
        lowStockCount: valued.filter((i) => i.lowStock).length,
      }),
    );
  }),
);

/* ------------------------------ Day close -------------------------------- */

async function buildDayClose(shopId: string) {
  const shop = await prisma.shop.findUniqueOrThrow({
    where: { id: shopId },
    select: { timezone: true },
  });
  const { start, end, date } = localDay(shop.timezone);

  const [payments, paidOrders, closedAudit] = await Promise.all([
    prisma.payment.findMany({
      where: { shopId, receivedAt: { gte: start, lte: end } },
      select: {
        id: true,
        amount: true,
        status: true,
        source: true,
        bank: true,
        sender: true,
        txnId: true,
        receivedAt: true,
      },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.order.count({
      where: { shopId, status: "PAID", paidAt: { gte: start, lte: end } },
    }),
    prisma.auditLog.findFirst({
      where: {
        shopId,
        action: "report.dayClose",
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const settled = ["VERIFIED", "MATCHED"];
  const isCash = (p: (typeof payments)[number]) =>
    p.source === "MANUAL" || (p.bank ?? "").toUpperCase() === "CASH";

  const cash = payments.filter((p) => isCash(p) && settled.includes(p.status));
  const transfers = payments.filter((p) => !isCash(p) && settled.includes(p.status));
  const pending = payments.filter((p) => !settled.includes(p.status));

  const sum = (list: typeof payments) =>
    Math.round(list.reduce((acc, p) => acc + Number(p.amount), 0) * 100) / 100;

  const cashAmount = sum(cash);
  const transferAmount = sum(transfers);

  return {
    date,
    cash: { count: cash.length, amount: cashAmount },
    transfers: { count: transfers.length, amount: transferAmount },
    pending: {
      count: pending.length,
      amount: sum(pending),
      items: pending.slice(0, 10).map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        sender: p.sender,
        txnId: p.txnId,
        receivedAt: p.receivedAt,
      })),
    },
    total: Math.round((cashAmount + transferAmount) * 100) / 100,
    paidOrders,
    closedAt: closedAudit?.createdAt ?? null,
  };
}

/** Today's cash and transfer totals in one place. */
router.get(
  "/day-close",
  asyncHandler(async (req, res) => {
    res.json(ok(await buildDayClose(req.staff!.shopId)));
  }),
);

/** Record the close of the day (idempotent; keeps the first close time). */
router.post(
  "/day-close",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const summary = await buildDayClose(req.staff!.shopId);
    let closedAt = summary.closedAt;
    if (!closedAt) {
      // Await the record so a double tap cannot close the day twice.
      const logged = await prisma.auditLog.create({
        data: {
          shopId: req.staff!.shopId,
          staffId: req.staff!.id,
          action: "report.dayClose",
          entity: "Shop",
          entityId: req.staff!.shopId,
          metadata: {
            date: summary.date,
            cash: summary.cash.amount,
            transfers: summary.transfers.amount,
            total: summary.total,
          },
          ip: req.ip,
        },
        select: { createdAt: true },
      });
      closedAt = logged.createdAt;
    }
    res.json(ok({ ...summary, closedAt }));
  }),
);

export default router;
