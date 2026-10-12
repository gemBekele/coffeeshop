import { Router } from "express";
import {
  matchTemplateBest,
  ingestPaymentSchema,
  verifyPaymentSchema,
  matchPaymentSchema,
} from "@coffeeshop/shared";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../../lib/http.js";
import { serializeDecimals } from "../../lib/decimal.js";
import {
  requireAuth,
  requireRole,
  authenticateDevice,
} from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { recordAudit } from "../../lib/audit.js";
import { emitToShop } from "../../realtime/socket.js";
import { findOrderMatch } from "./payments.matching.js";
import { settleOrderAsPaid } from "./payments.service.js";

const router = Router();

/* -------------------------------- Ingest --------------------------------- */
/* Owner phone posts a raw payment SMS; the server re-parses and validates it. */

router.post(
  "/ingest",
  authenticateDevice,
  validate(ingestPaymentSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      txnId: string;
      referenceTxnId?: string;
      amount: number;
      sender?: string;
      senderPhone?: string;
      bank?: string;
      direction: "CREDIT" | "DEBIT";
      rawSms: string;
      templateId?: string;
      provider?: "TELEBIRR" | "CBE_BIRR" | "AMOLE" | "AWASH" | "OTHER";
      receivedAt?: Date;
      source: "SMS" | "MANUAL" | "OCR";
    };

    const shopId = req.device!.shopId;

    // Server-side re-validation: never trust the client's parsed values.
    const templates = await prisma.smsTemplate.findMany({
      where: {
        shopId,
        status: "ACTIVE",
        ...(body.templateId ? { id: body.templateId } : {}),
        ...(body.provider ? { provider: body.provider } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    let matchedTemplate:
      | (typeof templates)[number]
      | null = null;
    let extraction: ReturnType<typeof matchTemplateBest> | null = null;
    for (const template of templates) {
      const result = matchTemplateBest(template.templateBody, body.rawSms);
      if (result.matched && result.amount !== undefined) {
        matchedTemplate = template;
        extraction = result;
        break;
      }
    }

    if (!matchedTemplate || !extraction || extraction.amount === undefined) {
      // No template could parse this SMS -> surface it in the owner's inbox.
      const unmatched = await prisma.unmatchedSms.create({
        data: {
          shopId,
          deviceId: req.device!.id,
          sender: body.sender ?? body.senderPhone ?? null,
          body: body.rawSms,
          receivedAt: body.receivedAt ?? new Date(),
        },
      });
      emitToShop(shopId, "sms:unmatched", serializeDecimals(unmatched));
      res.status(202).json(
        ok({
          unmatched: true,
          message:
            "SMS did not match any active template. It was added to the inbox.",
          unmatchedSmsId: unmatched.id,
        }),
      );
      return;
    }

    const txnId = extraction.txnId ?? body.txnId;
    const amount = extraction.amount;
    const referenceTxnId = extraction.referenceTxnId ?? body.referenceTxnId ?? null;

    const existing = await prisma.payment.findFirst({
      where: { shopId, OR: [{ txnId }, { referenceTxnId: txnId }] },
    });
    if (existing) {
      res.status(200).json(
        ok({ duplicate: true, payment: serializeDecimals(existing) }),
      );
      return;
    }

    const match = await findOrderMatch({
      shopId,
      txnId,
      amount,
      receivedAt: body.receivedAt,
    });

    const status = match
      ? match.matchType === "exact"
        ? "VERIFIED"
        : "MATCHED"
      : "UNMATCHED";

    const payment = await prisma.payment.create({
      data: {
        shopId,
        orderId: match?.order.id ?? null,
        txnId,
        referenceTxnId,
        amount,
        currency: extraction.currency ?? undefined,
        sender: extraction.sender ?? body.sender ?? null,
        senderPhone: extraction.senderPhone ?? body.senderPhone ?? null,
        bank: matchedTemplate.provider,
        provider: matchedTemplate.provider,
        direction: matchedTemplate.direction,
        rawSms: body.rawSms,
        source: body.source,
        status,
        deviceId: req.device!.id,
        templateId: matchedTemplate.id,
        receivedAt: body.receivedAt ?? new Date(),
        matchedAt: match ? new Date() : null,
        verifiedAt: status === "VERIFIED" ? new Date() : null,
      },
    });

    if (match) {
      await settleOrderAsPaid({
        shopId,
        orderId: match.order.id,
        note: `${match.matchType} match ${txnId}`,
      });
      const updatedOrder = await prisma.order.findUnique({
        where: { id: match.order.id },
      });
      emitToShop(shopId, "order:updated", serializeDecimals(updatedOrder));
    }

    prisma.smsTemplate
      .update({
        where: { id: matchedTemplate.id },
        data: { lastTestedAt: new Date() },
      })
      .catch(() => {});

    emitToShop(shopId, "payment:received", serializeDecimals(payment));
    recordAudit({
      shopId,
      action: "payment.ingest",
      entity: "Payment",
      entityId: payment.id,
      metadata: { txnId, amount, matched: !!match, matchType: match?.matchType },
      ip: req.ip,
    });

    res.status(201).json(
      ok({
        payment: serializeDecimals(payment),
        matched: !!match,
        matchType: match?.matchType ?? null,
        orderId: match?.order.id ?? null,
      }),
    );
  }),
);

/* ------------------------------- Authenticated --------------------------- */

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));

    const where = {
      shopId: req.staff!.shopId,
      ...(query.status ? { status: query.status as never } : {}),
    };
    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          order: {
            select: { id: true, orderNumber: true, status: true, total: true },
          },
        },
      }),
    ]);
    res.json(
      ok({
        items: serializeDecimals(payments),
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      }),
    );
  }),
);

router.get(
  "/unmatched",
  asyncHandler(async (req, res) => {
    const payments = await prisma.payment.findMany({
      where: { shopId: req.staff!.shopId, status: "UNMATCHED" },
      orderBy: { receivedAt: "desc" },
      take: 200,
    });
    res.json(ok(serializeDecimals(payments)));
  }),
);

router.get(
  "/sms-inbox",
  asyncHandler(async (req, res) => {
    const items = await prisma.unmatchedSms.findMany({
      where: { shopId: req.staff!.shopId },
      orderBy: { receivedAt: "desc" },
      take: 200,
    });
    res.json(ok(serializeDecimals(items)));
  }),
);

router.post(
  "/sms-inbox/:id/dismiss",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const item = await prisma.unmatchedSms.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!item) throw new AppError(404, "Inbox item not found");
    await prisma.unmatchedSms.update({
      where: { id: item.id },
      data: { resolvedAt: new Date() },
    });
    res.json(ok({ dismissed: true }));
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
      include: {
        order: {
          select: { id: true, orderNumber: true, status: true, total: true },
        },
        template: { select: { id: true, name: true } },
      },
    });
    if (!payment) throw new AppError(404, "Payment not found");
    res.json(ok(serializeDecimals(payment)));
  }),
);

router.post(
  "/verify",
  validate(verifyPaymentSchema),
  asyncHandler(async (req, res) => {
    const { txnId } = req.body as { txnId: string };

    const payment = await prisma.payment.findFirst({
      where: {
        shopId: req.staff!.shopId,
        OR: [{ txnId }, { referenceTxnId: txnId }],
      },
      include: {
        order: {
          select: { id: true, orderNumber: true, status: true, total: true },
        },
      },
    });

    if (payment) {
      res.json(
        ok({
          found: true,
          source: "payment",
          payment: serializeDecimals(payment),
          order: serializeDecimals(payment.order),
        }),
      );
      return;
    }

    const order = await prisma.order.findFirst({
      where: { shopId: req.staff!.shopId, customerTxnId: txnId },
      select: { id: true, orderNumber: true, status: true, total: true },
    });

    res.json(
      ok({
        found: !!order,
        source: order ? "order" : null,
        order: serializeDecimals(order),
      }),
    );
  }),
);

router.post(
  "/:id/match",
  validate(matchPaymentSchema),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!payment) throw new AppError(404, "Payment not found");

    const { orderId } = req.body as { orderId: string };
    const order = await prisma.order.findFirst({
      where: { id: orderId, shopId: req.staff!.shopId },
    });
    if (!order) throw new AppError(404, "Order not found");
    if (order.status === "VOID") throw new AppError(409, "Cannot match to a voided order");

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        orderId: order.id,
        status: order.status === "PAID" ? "VERIFIED" : "MATCHED",
        matchedAt: new Date(),
        verifiedAt: order.status === "PAID" ? new Date() : null,
      },
    });

    await settleOrderAsPaid({
      shopId: req.staff!.shopId,
      orderId: order.id,
      actorId: req.staff!.id,
      note: `Manual match ${payment.txnId}`,
    });

    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    emitToShop(req.staff!.shopId, "order:updated", serializeDecimals(updatedOrder));
    emitToShop(req.staff!.shopId, "payment:received", serializeDecimals(updated));
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "payment.match",
      entity: "Payment",
      entityId: payment.id,
      metadata: { orderId: order.id },
      ip: req.ip,
    });
    res.json(ok({ payment: serializeDecimals(updated), orderId: order.id }));
  }),
);

router.post(
  "/:id/unmatch",
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!payment) throw new AppError(404, "Payment not found");
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { orderId: null, status: "UNMATCHED", matchedAt: null, verifiedAt: null },
    });
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "payment.unmatch",
      entity: "Payment",
      entityId: payment.id,
      ip: req.ip,
    });
    res.json(ok(serializeDecimals(updated)));
  }),
);

export default router;
