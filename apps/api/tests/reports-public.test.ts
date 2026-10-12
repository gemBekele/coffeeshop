import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  Client,
  disconnectDb,
  login,
  startTestServer,
  type TestServer,
} from "./helpers.js";

let server: TestServer;
let c: Client;

before(async () => {
  server = await startTestServer();
  c = new Client(server.baseUrl);
  await login(c);
});
after(async () => {
  await server.close();
  await disconnectDb();
});

describe("public menu", () => {
  test("returns shop and categories without auth", async () => {
    const anon = new Client(server.baseUrl);
    const res = await anon.get<{
      shop: { name: string; currency: string };
      categories: Array<{ name: string; products: unknown[] }>;
    }>("/api/public/menu/demo-cafe");
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.shop.currency, "ETB");
    assert.ok(res.body.data!.categories.some((cat) => cat.name === "Espresso Bar"));
    assert.ok(res.body.data!.categories.every((cat) => cat.products.length > 0));
  });

  test("unknown slug is 404", async () => {
    const anon = new Client(server.baseUrl);
    const res = await anon.get("/api/public/menu/does-not-exist");
    assert.equal(res.status, 404);
  });
});

describe("reports", () => {
  test("require authentication", async () => {
    const anon = new Client(server.baseUrl);
    const res = await anon.get("/api/reports/summary");
    assert.equal(res.status, 401);
  });

  test("summary has the expected shape", async () => {
    const res = await c.get<{
      orders: { paidCount: number; grossSales: number; averageOrderValue: number };
      payments: Array<{ status: string; count: number; amount: number }>;
      lowStockCount: number;
    }>("/api/reports/summary");
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.data!.orders.paidCount, "number");
    assert.ok(res.body.data!.orders.paidCount >= 1);
    assert.ok(res.body.data!.orders.grossSales > 0);
    assert.ok(Array.isArray(res.body.data!.payments));
  });

  test("sales series and top products", async () => {
    const sales = await c.get<Array<{ date: string; sales: number }>>("/api/reports/sales");
    assert.equal(sales.status, 200);
    assert.ok(sales.body.data!.length >= 1);
    assert.match(sales.body.data![0]!.date, /^\d{4}-\d{2}-\d{2}$/);

    const top = await c.get<Array<{ name: string; quantity: number; revenue: number }>>(
      "/api/reports/top-products",
    );
    assert.equal(top.status, 200);
    assert.ok(top.body.data!.length >= 1);
    assert.ok(top.body.data![0]!.revenue > 0);
  });

  test("payments reconciliation includes methods", async () => {
    const res = await c.get<{
      byMethod: Array<{ bank: string; amount: number }>;
      byStatus: Array<{ status: string; count: number }>;
      unmatchedCount: number;
    }>("/api/reports/payments");
    assert.equal(res.status, 200);
    assert.ok(res.body.data!.byMethod.some((m) => m.bank === "CASH"));
    assert.ok(res.body.data!.byStatus.length >= 1);
  });

  test("inventory valuation", async () => {
    const res = await c.get<{ items: unknown[]; totalValue: number; lowStockCount: number }>(
      "/api/reports/inventory",
    );
    assert.equal(res.status, 200);
    assert.ok(res.body.data!.items.length >= 1);
    assert.ok(res.body.data!.totalValue >= 0);
  });
});
