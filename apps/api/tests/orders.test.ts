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

before(async () => {
  server = await startTestServer();
  c = new Client(server.baseUrl);
  await login(c);
  await c.patch("/api/settings", { taxRate: 0 });
});
after(async () => {
  await server.close();
  await disconnectDb();
});

async function makeProduct(opts: { recipeQty?: number; price?: number } = {}) {
  const beans = await c.post<{ id: string }>("/api/inventory/items", {
    name: unique("Beans"),
    unit: "g",
    stockOnHand: 10000,
    reorderLevel: 0,
  });
  const product = await c.post<{
    id: string;
    variants: Array<{ id: string; name: string }>;
  }>("/api/catalog/products", {
    name: unique("Drink"),
    price: opts.price ?? 100,
    trackInventory: true,
    variants: [
      { name: "Small", priceDelta: 0 },
      { name: "Large", priceDelta: 25 },
    ],
    recipe: [{ inventoryItemId: beans.body.data!.id, quantity: opts.recipeQty ?? 18 }],
  });
  return {
    productId: product.body.data!.id,
    beansId: beans.body.data!.id,
    variants: product.body.data!.variants,
  };
}

async function stockOf(itemId: string): Promise<number> {
  const res = await c.get<{ stockOnHand: number }>(`/api/inventory/items/${itemId}`);
  return res.body.data!.stockOnHand;
}

describe("orders: creation & totals", () => {
  test("computes subtotal, variant pricing and snapshots", async () => {
    const { productId, variants } = await makeProduct({ price: 100 });
    const large = variants.find((v) => v.name === "Large")!;
    const res = await c.post<{
      orderNumber: number;
      subtotal: number;
      tax: number;
      total: number;
      items: Array<{ nameSnapshot: string; unitPrice: number; lineTotal: number }>;
    }>("/api/orders", {
      type: "DINE_IN",
      tableLabel: "T1",
      items: [
        { productId, variantId: large.id, quantity: 1 },
        { productId, quantity: 2 },
      ],
    });
    assert.equal(res.status, 201);
    // Large = 125, plus 2 x 100 = 200 -> subtotal 325
    assert.equal(res.body.data!.subtotal, 325);
    assert.equal(res.body.data!.tax, 0);
    assert.equal(res.body.data!.total, 325);
    assert.equal(res.body.data!.items[0]!.unitPrice, 125);
    assert.match(res.body.data!.items[0]!.nameSnapshot, /\(Large\)/);
  });

  test("applies shop tax rate", async () => {
    await c.patch("/api/settings", { taxRate: 10 });
    const { productId } = await makeProduct({ price: 100 });
    const res = await c.post<{ subtotal: number; tax: number; total: number }>("/api/orders", {
      items: [{ productId, quantity: 1 }],
    });
    assert.equal(res.body.data!.subtotal, 100);
    assert.equal(res.body.data!.tax, 10);
    assert.equal(res.body.data!.total, 110);
    await c.patch("/api/settings", { taxRate: 0 });
  });

  test("order numbers increase", async () => {
    const { productId } = await makeProduct();
    const a = await c.post<{ orderNumber: number }>("/api/orders", { items: [{ productId, quantity: 1 }] });
    const b = await c.post<{ orderNumber: number }>("/api/orders", { items: [{ productId, quantity: 1 }] });
    assert.equal(b.body.data!.orderNumber, a.body.data!.orderNumber + 1);
  });

  test("unknown product is a 400", async () => {
    const res = await c.post("/api/orders", { items: [{ productId: "nope", quantity: 1 }] });
    assert.equal(res.status, 400);
  });

  test("empty items is a 422", async () => {
    const res = await c.post("/api/orders", { items: [] });
    assert.equal(res.status, 422);
  });

  test("board groups orders by status", async () => {
    const { productId } = await makeProduct();
    const order = await c.post<{ id: string }>("/api/orders", { items: [{ productId, quantity: 1 }] });
    const board = await c.get<Record<string, Array<{ id: string }>>>("/api/orders/board");
    assert.equal(board.status, 200);
    assert.ok(board.body.data!.OPEN.some((o) => o.id === order.body.data!.id));
  });
});

describe("orders: lifecycle", () => {
  test("invalid transition OPEN -> PAID is a 409", async () => {
    const { productId } = await makeProduct();
    const order = await c.post<{ id: string }>("/api/orders", { items: [{ productId, quantity: 1 }] });
    const res = await c.patch(`/api/orders/${order.body.data!.id}/status`, { status: "PAID" });
    assert.equal(res.status, 409);
  });

  test("walk to PAID deducts recipe stock once", async () => {
    const { productId, beansId } = await makeProduct({ recipeQty: 18 });
    const before = await stockOf(beansId);
    const order = await c.post<{ id: string }>("/api/orders", {
      items: [{ productId, quantity: 2 }],
    });
    const id = order.body.data!.id;
    for (const status of ["CONFIRMED", "PREPARING", "READY", "SERVED", "PAID"]) {
      const res = await c.patch(`/api/orders/${id}/status`, { status });
      assert.equal(res.status, 200, `transition to ${status}`);
    }
    // 2 x 18 = 36 deducted
    assert.equal(await stockOf(beansId), before - 36);
  });

  test("void from OPEN, then cannot void a paid order", async () => {
    const { productId } = await makeProduct();
    const order = await c.post<{ id: string }>("/api/orders", { items: [{ productId, quantity: 1 }] });
    const voided = await c.post(`/api/orders/${order.body.data!.id}/void`);
    assert.equal(voided.status, 200);
    assert.equal((voided.body.data as { status: string }).status, "VOID");

    const { productId: p2 } = await makeProduct();
    const paidOrder = await c.post<{ id: string }>("/api/orders", { items: [{ productId: p2, quantity: 1 }] });
    await c.post(`/api/orders/${paidOrder.body.data!.id}/pay-cash`);
    const res = await c.post(`/api/orders/${paidOrder.body.data!.id}/void`);
    assert.equal(res.status, 409);
  });
});

describe("orders: cash payment & shift reconciliation", () => {
  test("pay-cash creates a CASH payment, pays the order, deducts stock", async () => {
    const { productId, beansId } = await makeProduct({ recipeQty: 18, price: 100 });
    const before = await stockOf(beansId);
    const order = await c.post<{ id: string; total: number }>("/api/orders", {
      items: [{ productId, quantity: 1 }],
    });
    const res = await c.post<{
      status: string;
      payments: Array<{ bank: string; amount: number; status: string }>;
    }>(`/api/orders/${order.body.data!.id}/pay-cash`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.status, "PAID");
    assert.equal(res.body.data!.payments[0]!.bank, "CASH");
    assert.equal(res.body.data!.payments[0]!.amount, 100);
    assert.equal(await stockOf(beansId), before - 18);

    // idempotency guard
    const again = await c.post(`/api/orders/${order.body.data!.id}/pay-cash`);
    assert.equal(again.status, 409);
  });

  test("shift close includes cash collected", async () => {
    // ensure a fresh shift for this cashier
    const current = await c.get<{ id: string } | null>("/api/shifts/current");
    if (current.body.data) await c.post(`/api/shifts/${current.body.data.id}/close`, { closingCash: 0 });

    const open = await c.post<{ id: string }>("/api/shifts/open", { openingFloat: 500 });

    const { productId } = await makeProduct({ price: 100 });
    const order = await c.post<{ id: string }>("/api/orders", { items: [{ productId, quantity: 1 }] });
    await c.post(`/api/orders/${order.body.data!.id}/pay-cash`);

    const close = await c.post<{ expectedCash: number; difference: number }>(
      `/api/shifts/${open.body.data!.id}/close`,
      { closingCash: 600 },
    );
    assert.equal(close.body.data!.expectedCash, 600);
    assert.equal(close.body.data!.difference, 0);
  });
});
