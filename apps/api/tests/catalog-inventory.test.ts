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
});
after(async () => {
  await server.close();
  await disconnectDb();
});

async function makeItem(overrides: Record<string, unknown> = {}) {
  const res = await c.post<{ id: string; name: string; lowStock: boolean }>("/api/inventory/items", {
    name: unique("Item"),
    unit: "g",
    stockOnHand: 1000,
    reorderLevel: 100,
    cost: 2,
    ...overrides,
  });
  assert.equal(res.status, 201);
  return res.body.data!;
}

describe("catalog: categories", () => {
  test("create, duplicate, patch, archive", async () => {
    const name = unique("Cat");
    const created = await c.post<{ id: string }>("/api/catalog/categories", { name });
    assert.equal(created.status, 201);

    const dup = await c.post("/api/catalog/categories", { name });
    assert.equal(dup.status, 409);

    const patched = await c.patch<{ name: string }>(`/api/catalog/categories/${created.body.data!.id}`, {
      name: `${name}-x`,
    });
    assert.equal(patched.status, 200);

    const archived = await c.del(`/api/catalog/categories/${created.body.data!.id}`);
    assert.equal(archived.status, 200);
  });

  test("create requires a name (422)", async () => {
    const res = await c.post("/api/catalog/categories", {});
    assert.equal(res.status, 422);
  });
});

describe("catalog: products & recipes", () => {
  test("create with variants and recipe, decimal price is a number", async () => {
    const item = await makeItem();
    const cat = await c.post<{ id: string }>("/api/catalog/categories", { name: unique("Cat") });
    const res = await c.post<{
      id: string;
      price: number;
      variants: unknown[];
      recipeIngredients: unknown[];
    }>("/api/catalog/products", {
      name: unique("Product"),
      categoryId: cat.body.data!.id,
      price: 123.45,
      trackInventory: true,
      variants: [
        { name: "Small", priceDelta: 0 },
        { name: "Large", priceDelta: 20 },
      ],
      recipe: [{ inventoryItemId: item.id, quantity: 18 }],
    });
    assert.equal(res.status, 201);
    assert.equal(typeof res.body.data!.price, "number");
    assert.equal(res.body.data!.price, 123.45);
    assert.equal(res.body.data!.variants.length, 2);
    assert.equal(res.body.data!.recipeIngredients.length, 1);
  });

  test("rejects unknown category (400)", async () => {
    const res = await c.post("/api/catalog/products", {
      name: unique("P"),
      categoryId: "does-not-exist",
      price: 10,
    });
    assert.equal(res.status, 400);
  });

  test("rejects unknown inventory item in recipe (400)", async () => {
    const res = await c.post("/api/catalog/products", {
      name: unique("P"),
      price: 10,
      recipe: [{ inventoryItemId: "nope", quantity: 1 }],
    });
    assert.equal(res.status, 400);
  });

  test("missing price is a 422", async () => {
    const res = await c.post("/api/catalog/products", { name: unique("P") });
    assert.equal(res.status, 422);
  });

  test("patch replaces variants and recipe", async () => {
    const itemA = await makeItem();
    const itemB = await makeItem();
    const created = await c.post<{ id: string }>("/api/catalog/products", {
      name: unique("P"),
      price: 50,
      trackInventory: true,
      variants: [{ name: "S", priceDelta: 0 }],
      recipe: [{ inventoryItemId: itemA.id, quantity: 5 }],
    });
    const id = created.body.data!.id;

    const patched = await c.patch<{
      price: number;
      variants: Array<{ name: string }>;
      recipeIngredients: Array<{ inventoryItem: { id: string } }>;
    }>(`/api/catalog/products/${id}`, {
      price: 60,
      variants: [{ name: "M", priceDelta: 10 }, { name: "L", priceDelta: 20 }],
      recipe: [{ inventoryItemId: itemB.id, quantity: 9 }],
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.data!.price, 60);
    assert.equal(patched.body.data!.variants.length, 2);
    assert.equal(patched.body.data!.recipeIngredients[0]!.inventoryItem.id, itemB.id);
  });

  test("PUT recipe sets ingredients", async () => {
    const item = await makeItem();
    const created = await c.post<{ id: string }>("/api/catalog/products", {
      name: unique("P"),
      price: 10,
    });
    const res = await c.put<{ recipeIngredients: unknown[] }>(
      `/api/catalog/products/${created.body.data!.id}/recipe`,
      { ingredients: [{ inventoryItemId: item.id, quantity: 3 }] },
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.recipeIngredients.length, 1);
  });

  test("archive product hides it from the active list", async () => {
    const created = await c.post<{ id: string }>("/api/catalog/products", {
      name: unique("P"),
      price: 10,
    });
    const id = created.body.data!.id;
    assert.equal((await c.del(`/api/catalog/products/${id}`)).status, 200);
    const list = await c.get<Array<{ id: string }>>("/api/catalog/products");
    assert.ok(!list.body.data!.some((p) => p.id === id));
  });
});

describe("inventory: stock movements & low stock", () => {
  test("IN, OUT, ADJUST, WASTE adjust stock correctly", async () => {
    const item = await makeItem({ stockOnHand: 100, reorderLevel: 10 });

    const inRes = await c.post<{ item: { stockOnHand: number } }>(
      `/api/inventory/items/${item.id}/movements`,
      { type: "IN", quantity: 50 },
    );
    assert.equal(inRes.body.data!.item.stockOnHand, 150);

    const outRes = await c.post<{ item: { stockOnHand: number } }>(
      `/api/inventory/items/${item.id}/movements`,
      { type: "OUT", quantity: 30 },
    );
    assert.equal(outRes.body.data!.item.stockOnHand, 120);

    const wasteRes = await c.post<{ item: { stockOnHand: number } }>(
      `/api/inventory/items/${item.id}/movements`,
      { type: "WASTE", quantity: 20 },
    );
    assert.equal(wasteRes.body.data!.item.stockOnHand, 100);

    const adjustRes = await c.post<{ item: { stockOnHand: number } }>(
      `/api/inventory/items/${item.id}/movements`,
      { type: "ADJUST", quantity: -40 },
    );
    assert.equal(adjustRes.body.data!.item.stockOnHand, 60);
  });

  test("zero quantity is rejected (422)", async () => {
    const item = await makeItem();
    const res = await c.post(`/api/inventory/items/${item.id}/movements`, {
      type: "IN",
      quantity: 0,
    });
    assert.equal(res.status, 422);
  });

  test("low-stock flag and endpoint", async () => {
    const item = await makeItem({ stockOnHand: 5, reorderLevel: 100 });
    const detail = await c.get<{ lowStock: boolean }>(`/api/inventory/items/${item.id}`);
    assert.equal(detail.body.data!.lowStock, true);

    const low = await c.get<Array<{ id: string }>>("/api/inventory/low-stock");
    assert.ok(low.body.data!.some((i) => i.id === item.id));
  });

  test("movement history is recorded", async () => {
    const item = await makeItem({ stockOnHand: 0 });
    await c.post(`/api/inventory/items/${item.id}/movements`, { type: "IN", quantity: 10, reason: "restock" });
    const history = await c.get<Array<{ type: string; quantity: number }>>(
      `/api/inventory/items/${item.id}/movements`,
    );
    assert.equal(history.body.data!.length, 1);
    assert.equal(history.body.data![0]!.type, "IN");
    assert.equal(history.body.data![0]!.quantity, 10);
  });

  test("duplicate item name is a 409", async () => {
    const item = await makeItem();
    const dup = await c.post("/api/inventory/items", { name: item.name, unit: "g" });
    assert.equal(dup.status, 409);
  });
});
