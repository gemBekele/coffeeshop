import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  Client,
  disconnectDb,
  login,
  startTestServer,
  unique,
  type TestServer,
} from "./helpers.js";

let server: TestServer;
let c: Client;
let deviceKey = "";
let templateId = "";

const TEMPLATE_BODY =
  "PAYTEST received ETB {amount} from {sender}. Ref {txnId}. Bal ETB {balance}.";
const sms = (amount: string, txn: string, sender = "Mimi") =>
  `PAYTEST received ETB ${amount} from ${sender}. Ref ${txn}. Bal ETB 1,000.00.`;

before(async () => {
  server = await startTestServer();
  c = new Client(server.baseUrl);
  await login(c);
  await c.patch("/api/settings", { taxRate: 0 });

  // A single active template controls matching deterministically.
  const created = await c.post<{ id: string }>("/api/templates", {
    name: unique("Paytest template"),
    provider: "TELEBIRR",
    direction: "CREDIT",
    status: "ACTIVE",
    senderAllowlist: ["PAYTEST"],
    templateBody: TEMPLATE_BODY,
    sampleSms: sms("90.00", "PTX-SAMPLE-1"),
  });
  templateId = created.body.data!.id;

  const dev = await c.post<{ apiKey: string }>("/api/devices", {
    label: "Owner phone",
    role: "OWNER",
    platform: "android",
  });
  deviceKey = dev.body.data!.apiKey;
});
after(async () => {
  await server.close();
  await disconnectDb();
});

async function makeOrderWithTotal(total: number, customerTxnId?: string) {
  const product = await c.post<{ id: string }>("/api/catalog/products", {
    name: unique("Priced"),
    price: total,
  });
  const order = await c.post<{ id: string; orderNumber: number; total: number }>("/api/orders", {
    type: "TAKEAWAY",
    customerTxnId,
    items: [{ productId: product.body.data!.id, quantity: 1 }],
  });
  assert.equal(order.body.data!.total, total);
  return order.body.data!;
}

describe("templates", () => {
  test("test endpoint extracts fields", async () => {
    const res = await c.post<{
      fields: string[];
      hasAmount: boolean;
      extraction: { matched: boolean; amount?: number; txnId?: string };
    }>("/api/templates/test", {
      templateBody: TEMPLATE_BODY,
      smsText: sms("90.00", "PTX-1"),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.hasAmount, true);
    assert.equal(res.body.data!.extraction.matched, true);
    assert.equal(res.body.data!.extraction.amount, 90);
    assert.equal(res.body.data!.extraction.txnId, "PTX-1");
  });

  test("from-sms builds a template and extracts", async () => {
    const text = "CBE: credited ETB 300.00. Ref FT1AB.";
    const amountStart = text.indexOf("300.00");
    const refStart = text.indexOf("FT1AB");
    const res = await c.post<{
      templateBody: string;
      fields: string[];
      extraction: { amount?: number };
    }>("/api/templates/from-sms", {
      smsText: text,
      spans: [
        { field: "amount", start: amountStart, end: amountStart + "300.00".length },
        { field: "txnId", start: refStart, end: refStart + "FT1AB".length },
      ],
    });
    assert.equal(res.status, 200);
    assert.match(res.body.data!.templateBody, /\{amount\}/);
    assert.match(res.body.data!.templateBody, /\{txnId\}/);
    assert.equal(res.body.data!.extraction.amount, 300);
  });

  test("update bumps version and records a revision", async () => {
    const before = await c.get<{ version: number }>(`/api/templates/${templateId}`);
    const patched = await c.patch<{ version: number }>(`/api/templates/${templateId}`, {
      templateBody: `${TEMPLATE_BODY} Thanks.`,
    });
    assert.equal(patched.body.data!.version, before.body.data!.version + 1);
    const revisions = await c.get<Array<unknown>>(`/api/templates/${templateId}/revisions`);
    assert.ok(revisions.body.data!.length >= 2);

    // restore original body
    await c.patch(`/api/templates/${templateId}`, { templateBody: TEMPLATE_BODY });
  });

  test("activating a template without an amount is rejected", async () => {
    const created = await c.post<{ id: string }>("/api/templates", {
      name: unique("No amount"),
      templateBody: "You received money from {sender}",
      status: "DRAFT",
    });
    const res = await c.post(`/api/templates/${created.body.data!.id}/activate`);
    assert.equal(res.status, 400);
  });

  test("archiving removes it from active use", async () => {
    const created = await c.post<{ id: string }>("/api/templates", {
      name: unique("Archivable"),
      templateBody: "X {amount}",
      status: "ACTIVE",
    });
    const res = await c.post(`/api/templates/${created.body.data!.id}/archive`);
    assert.equal(res.status, 200);
    assert.equal((res.body.data as { status: string }).status, "ARCHIVED");
  });
});

describe("devices", () => {
  test("device config returns active templates with compiled regex", async () => {
    const res = await c.request("GET", "/api/devices/me/config", undefined, {
      "X-Device-Key": deviceKey,
    });
    assert.equal(res.status, 200);
    const data = res.body.data as {
      templates: Array<{ templateBody: string; regex: string }>;
      shop: { name: string; currency: string };
    };
    assert.equal(data.shop.currency, "ETB");
    assert.ok(data.templates.some((t) => t.templateBody === TEMPLATE_BODY && t.regex.length > 0));
  });

  test("invalid device key is 401", async () => {
    const res = await c.request("GET", "/api/devices/me/config", undefined, {
      "X-Device-Key": "csd_wrong",
    });
    assert.equal(res.status, 401);
  });

  test("list devices then revoke", async () => {
    const list = await c.get<Array<{ id: string; apiKeyPrefix: string }>>("/api/devices");
    assert.equal(list.status, 200);
    assert.ok(list.body.data!.some((d) => d.apiKeyPrefix.startsWith("csd_")));

    const target = list.body.data!.find((d) => d.apiKeyPrefix.startsWith("csd_"))!;
    // create a throwaway device so we don't revoke the one used by other tests
    const temp = await c.post<{ device: { id: string }; apiKey: string }>("/api/devices", {
      label: unique("Temp"),
      role: "CASHIER",
      platform: "android",
    });
    const revoked = await c.del(`/api/devices/${temp.body.data!.device.id}`);
    assert.equal(revoked.status, 200);
    void target;
  });
});

describe("payments: ingest & matching", () => {
  test("exact match pays the order", async () => {
    const order = await makeOrderWithTotal(90, "PTX-EXACT-1");
    const res = await c.request(
      "POST",
      "/api/payments/ingest",
      { txnId: "PTX-EXACT-1", amount: 90, rawSms: sms("90.00", "PTX-EXACT-1"), source: "SMS" },
      { "X-Device-Key": deviceKey },
    );
    assert.equal(res.status, 201);
    const data = res.body.data as { matched: boolean; matchType: string; payment: { status: string; source: string } };
    assert.equal(data.matched, true);
    assert.equal(data.matchType, "exact");
    assert.equal(data.payment.status, "VERIFIED");

    const after = await c.get<{ status: string }>(`/api/orders/${order.id}`);
    assert.equal(after.body.data!.status, "PAID");
  });

  test("server re-validates: client amount is ignored in favor of the parsed amount", async () => {
    const total = 123;
    await makeOrderWithTotal(total, "PTX-RECHECK-1");
    const res = await c.request(
      "POST",
      "/api/payments/ingest",
      { txnId: "PTX-RECHECK-1", amount: 999999, rawSms: sms("123.00", "PTX-RECHECK-1"), source: "SMS" },
      { "X-Device-Key": deviceKey },
    );
    assert.equal(res.status, 201);
    const data = res.body.data as { payment: { amount: number } };
    assert.equal(data.payment.amount, 123);
  });

  test("heuristic match for a unique amount", async () => {
    const total = 411;
    await makeOrderWithTotal(total);
    const res = await c.request(
      "POST",
      "/api/payments/ingest",
      { txnId: "PTX-HEUR-1", amount: total, rawSms: sms(`${total}.00`, "PTX-HEUR-1"), source: "SMS" },
      { "X-Device-Key": deviceKey },
    );
    const data = res.body.data as { matched: boolean; matchType: string };
    assert.equal(data.matched, true);
    assert.equal(data.matchType, "heuristic");
  });

  test("ambiguous amount is left unmatched", async () => {
    const total = 777;
    await makeOrderWithTotal(total);
    await makeOrderWithTotal(total);
    const res = await c.request(
      "POST",
      "/api/payments/ingest",
      { txnId: "PTX-AMB-1", amount: total, rawSms: sms(`${total}.00`, "PTX-AMB-1"), source: "SMS" },
      { "X-Device-Key": deviceKey },
    );
    const data = res.body.data as { matched: boolean; payment: { status: string } };
    assert.equal(data.matched, false);
    assert.equal(data.payment.status, "UNMATCHED");
  });

  test("duplicate txnId is detected", async () => {
    const res = await c.request(
      "POST",
      "/api/payments/ingest",
      { txnId: "PTX-EXACT-1", amount: 90, rawSms: sms("90.00", "PTX-EXACT-1"), source: "SMS" },
      { "X-Device-Key": deviceKey },
    );
    assert.equal(res.status, 200);
    assert.equal((res.body.data as { duplicate: boolean }).duplicate, true);
  });

  test("unparseable SMS goes to the inbox (202)", async () => {
    const res = await c.request(
      "POST",
      "/api/payments/ingest",
      { txnId: "ZZ-1", amount: 5, rawSms: "Your OTP is 123456. Do not share.", source: "SMS" },
      { "X-Device-Key": deviceKey },
    );
    assert.equal(res.status, 202);
    assert.equal((res.body.data as { unmatched: boolean }).unmatched, true);
    const inbox = await c.get<Array<{ body: string }>>("/api/payments/sms-inbox");
    assert.ok(inbox.body.data!.some((i) => i.body.includes("OTP")));
  });

  test("notification body with app-name prefix matches (NOTIFICATION source)", async () => {
    const total = 258;
    await makeOrderWithTotal(total, "PTX-NOTIF-1");
    const res = await c.request(
      "POST",
      "/api/payments/ingest",
      {
        txnId: "PTX-NOTIF-1",
        amount: total,
        rawSms: `Telebirr\n${sms(`${total}.00`, "PTX-NOTIF-1")}`,
        source: "NOTIFICATION",
        bank: "TELEBIRR",
      },
      { "X-Device-Key": deviceKey },
    );
    assert.equal(res.status, 201);
    const data = res.body.data as { matched: boolean; payment: { source: string } };
    assert.equal(data.matched, true);
    assert.equal(data.payment.source, "NOTIFICATION");
  });

  test("missing device key is 401", async () => {
    const res = await c.post("/api/payments/ingest", {
      txnId: "X",
      amount: 1,
      rawSms: "x",
    });
    assert.equal(res.status, 401);
  });
});

describe("payments: verify, match, unmatch, inbox", () => {
  test("verify finds a known payment, and reports unknown ids", async () => {
    const found = await c.post<{ found: boolean; source: string }>("/api/payments/verify", {
      txnId: "PTX-EXACT-1",
    });
    assert.equal(found.body.data!.found, true);
    assert.equal(found.body.data!.source, "payment");

    const missing = await c.post<{ found: boolean }>("/api/payments/verify", {
      txnId: unique("unknown"),
    });
    assert.equal(missing.body.data!.found, false);
  });

  test("unmatched payment can be matched to an order, then unmatched", async () => {
    const total = 654;
    await makeOrderWithTotal(total);
    await makeOrderWithTotal(total); // force ambiguity -> unmatched
    const ingest = await c.request<{ payment: { id: string } }>(
      "POST",
      "/api/payments/ingest",
      { txnId: unique("PTX-MANUAL"), amount: total, rawSms: sms(`${total}.00`, "PTX-MANUAL"), source: "SMS" },
      { "X-Device-Key": deviceKey },
    );
    const paymentId = (ingest.body.data as { payment: { id: string } }).payment.id;

    const unmatched = await c.get<Array<{ id: string }>>("/api/payments/unmatched");
    assert.ok(unmatched.body.data!.some((p) => p.id === paymentId));

    // match to a specific order
    const orders = await c.get<{ items: Array<{ id: string; orderNumber: number; status: string; total: number }> }>(
      "/api/orders?pageSize=100",
    );
    const target = orders.body.data!.items.find((o) => o.status !== "PAID" && o.status !== "VOID" && o.total === total)!;
    const matched = await c.post<{ payment: { status: string }; orderId: string }>(
      `/api/payments/${paymentId}/match`,
      { orderId: target.id },
    );
    assert.equal(matched.status, 200);
    assert.equal(matched.body.data!.orderId, target.id);

    const unmatch = await c.post<{ status: string; orderId: string | null }>(
      `/api/payments/${paymentId}/unmatch`,
    );
    assert.equal(unmatch.body.data!.status, "UNMATCHED");
    assert.equal(unmatch.body.data!.orderId, null);
  });

  test("dismiss an inbox item", async () => {
    const inbox = await c.get<Array<{ id: string; resolvedAt: string | null }>>("/api/payments/sms-inbox");
    const open = inbox.body.data!.find((i) => !i.resolvedAt)!;
    const res = await c.post(`/api/payments/sms-inbox/${open.id}/dismiss`);
    assert.equal(res.status, 200);
  });
});
