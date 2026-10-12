import type { Order } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

const HEURISTIC_WINDOW_MINUTES = 30;

export type MatchType = "exact" | "heuristic";

export interface OrderMatch {
  order: Order;
  matchType: MatchType;
}

/**
 * Find an open order that a fresh payment belongs to.
 *
 * 1. Exact: the order carries the customer-provided transaction id.
 * 2. Heuristic: exactly one open order matches the amount within the recent
 *    time window (ambiguous when multiple candidates exist).
 */
export async function findOrderMatch(params: {
  shopId: string;
  txnId: string;
  amount: number;
  receivedAt?: Date;
  withinMinutes?: number;
}): Promise<OrderMatch | null> {
  const { shopId, txnId, amount } = params;
  const openStatuses = ["OPEN", "CONFIRMED", "PREPARING", "READY", "SERVED"];

  const exact = await prisma.order.findFirst({
    where: {
      shopId,
      customerTxnId: txnId,
      status: { in: openStatuses as never },
    },
    orderBy: { createdAt: "desc" },
  });
  if (exact) return { order: exact, matchType: "exact" };

  const since = new Date(
    (params.receivedAt ?? new Date()).getTime() -
      (params.withinMinutes ?? HEURISTIC_WINDOW_MINUTES) * 60 * 1000,
  );

  const candidates = await prisma.order.findMany({
    where: {
      shopId,
      total: amount,
      status: { in: openStatuses as never },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 2,
  });

  if (candidates.length === 1) {
    return { order: candidates[0], matchType: "heuristic" };
  }
  return null;
}
