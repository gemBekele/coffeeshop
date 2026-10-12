import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  Client,
  disconnectDb,
  login,
  OWNER,
  startTestServer,
  unique,
  type TestServer,
} from "./helpers.js";

let server: TestServer;

before(async () => {
  server = await startTestServer();
});
after(async () => {
  await server.close();
  await disconnectDb();
});

describe("health & auth", () => {
  test("health endpoint responds", async () => {
    const c = new Client(server.baseUrl);
    const res = await c.get("/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  test("login with PIN returns tokens and staff", async () => {
    const c = new Client(server.baseUrl);
    const res = await c.post("/api/auth/login", { identifier: OWNER.identifier, pin: OWNER.pin });
    assert.equal(res.status, 200);
    assert.ok(res.body.data);
    const data = res.body.data as { accessToken: string; refreshToken: string; staff: { role: string } };
    assert.ok(data.accessToken);
    assert.ok(data.refreshToken);
    assert.equal(data.staff.role, "OWNER");
  });

  test("login with password works", async () => {
    const c = new Client(server.baseUrl);
    const res = await c.post("/api/auth/login", {
      identifier: OWNER.identifier,
      password: OWNER.password,
    });
    assert.equal(res.status, 200);
  });

  test("wrong PIN is rejected", async () => {
    const c = new Client(server.baseUrl);
    const res = await c.post("/api/auth/login", { identifier: OWNER.identifier, pin: "0000" });
    assert.equal(res.status, 401);
  });

  test("unknown user is rejected", async () => {
    const c = new Client(server.baseUrl);
    const res = await c.post("/api/auth/login", { identifier: "nobody@nowhere.test", pin: "1234" });
    assert.equal(res.status, 401);
  });

  test("unauthenticated request is 401", async () => {
    const c = new Client(server.baseUrl);
    const res = await c.get("/api/staff");
    assert.equal(res.status, 401);
  });

  test("/me returns the shop", async () => {
    const c = new Client(server.baseUrl);
    await login(c);
    const res = await c.get<{ shop: { publicMenuSlug: string } }>("/api/auth/me");
    assert.equal(res.status, 200);
    assert.equal(res.body.data?.shop.publicMenuSlug, "demo-cafe");
  });

  test("refresh rotates and revokes the old token", async () => {
    const c = new Client(server.baseUrl);
    const res = await c.post<{ refreshToken: string }>("/api/auth/login", {
      identifier: OWNER.identifier,
      pin: OWNER.pin,
    });
    const refreshToken = res.body.data!.refreshToken;

    const rotated = await c.post("/api/auth/refresh", { refreshToken });
    assert.equal(rotated.status, 200);

    const reuse = await c.post("/api/auth/refresh", { refreshToken });
    assert.equal(reuse.status, 401);
  });
});

describe("staff management & roles", () => {
  test("owner creates staff, gets employee code", async () => {
    const c = new Client(server.baseUrl);
    await login(c);
    const res = await c.post<{ id: string; employeeCode: string; role: string }>("/api/staff", {
      fullName: "Test Cashier",
      phone: unique("+2519"),
      role: "CASHIER",
      pin: "4321",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data?.role, "CASHIER");
    assert.match(res.body.data!.employeeCode, /^CS-/);
  });

  test("invalid PIN format is a 422", async () => {
    const c = new Client(server.baseUrl);
    await login(c);
    const res = await c.post("/api/staff", { fullName: "Bad", role: "BARISTA", pin: "12" });
    assert.equal(res.status, 422);
  });

  test("duplicate email is a 409", async () => {
    const c = new Client(server.baseUrl);
    await login(c);
    const email = `${unique("dup")}@test.local`;
    const first = await c.post("/api/staff", { fullName: "Alpha", email, role: "BARISTA", pin: "1111" });
    assert.equal(first.status, 201);
    const second = await c.post("/api/staff", { fullName: "Beta", email, role: "BARISTA", pin: "2222" });
    assert.equal(second.status, 409);
  });

  test("cashier cannot create staff", async () => {
    const owner = new Client(server.baseUrl);
    await login(owner);
    const phone = unique("+2519");
    await owner.post("/api/staff", { fullName: "Cashier2", phone, role: "CASHIER", pin: "1234" });

    const cashier = new Client(server.baseUrl);
    await login(cashier, { identifier: phone, pin: "1234" });
    const res = await cashier.post("/api/staff", { fullName: "Nope", role: "BARISTA", pin: "1234" });
    assert.equal(res.status, 403);

    // ...but can list
    const list = await cashier.get("/api/staff");
    assert.equal(list.status, 200);
  });

  test("manager cannot assign OWNER role", async () => {
    const owner = new Client(server.baseUrl);
    await login(owner);
    const phone = unique("+2519");
    await owner.post("/api/staff", { fullName: "Manager", phone, role: "MANAGER", password: "manager123" });

    const manager = new Client(server.baseUrl);
    await login(manager, { identifier: phone, password: "manager123" });
    const res = await manager.post("/api/staff", { fullName: "Sneaky", role: "OWNER", pin: "9999" });
    assert.equal(res.status, 403);
  });

  test("owner can deactivate a staff member", async () => {
    const owner = new Client(server.baseUrl);
    await login(owner);
    const created = await owner.post<{ id: string }>("/api/staff", {
      fullName: "Temp",
      phone: unique("+2519"),
      role: "BARISTA",
      pin: "1234",
    });
    const id = created.body.data!.id;
    const res = await owner.patch(`/api/staff/${id}`, { isActive: false });
    assert.equal(res.status, 200);
    assert.equal((res.body.data as { isActive: boolean }).isActive, false);
  });
});

describe("shifts", () => {
  test("open, current, close lifecycle", async () => {
    const c = new Client(server.baseUrl);
    await login(c);
    // ensure no stale open shift
    const current = await c.get<{ id: string } | null>("/api/shifts/current");
    if (current.body.data) {
      await c.post(`/api/shifts/${current.body.data.id}/close`, { closingCash: 0 });
    }

    const open = await c.post<{ id: string; status: string; openingFloat: number }>(
      "/api/shifts/open",
      { openingFloat: 300 },
    );
    assert.equal(open.status, 201);
    assert.equal(open.body.data?.status, "OPEN");
    assert.equal(open.body.data?.openingFloat, 300);

    const dup = await c.post("/api/shifts/open", { openingFloat: 10 });
    assert.equal(dup.status, 409);

    const close = await c.post<{ status: string; expectedCash: number; difference: number }>(
      `/api/shifts/${open.body.data!.id}/close`,
      { closingCash: 300 },
    );
    assert.equal(close.status, 200);
    assert.equal(close.body.data?.status, "CLOSED");
    assert.equal(close.body.data?.difference, 0);

    const again = await c.post(`/api/shifts/${open.body.data!.id}/close`, { closingCash: 1 });
    assert.equal(again.status, 409);
  });
});

describe("shop settings", () => {
  test("get and patch", async () => {
    const c = new Client(server.baseUrl);
    await login(c);
    const get = await c.get<{ name: string }>("/api/settings");
    assert.equal(get.status, 200);

    const patch = await c.patch<{ taxRate: number; address: string }>("/api/settings", {
      taxRate: 15,
      address: "Bole, Addis Ababa",
    });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.data?.taxRate, 15);

    // restore
    await c.patch("/api/settings", { taxRate: 0 });
  });

  test("invalid slug is a 422", async () => {
    const c = new Client(server.baseUrl);
    await login(c);
    const res = await c.patch("/api/settings", { publicMenuSlug: "Bad Slug!" });
    assert.equal(res.status, 422);
  });
});
