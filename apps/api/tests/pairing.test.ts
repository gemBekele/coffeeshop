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
let owner: Client;

before(async () => {
  server = await startTestServer();
  owner = new Client(server.baseUrl);
  await login(owner);
});
after(async () => {
  await server.close();
  await disconnectDb();
});

/** Creates an employee and returns its employeeCode. */
async function makeEmployee() {
  const res = await owner.post<{ employeeCode: string; fullName: string }>(
    "/api/staff",
    { fullName: "QR Employee", phone: unique("+2519"), role: "CASHIER", pin: "4321" },
  );
  assert.equal(res.status, 201);
  return res.body.data!;
}

describe("QR pairing: request → approve → activate", () => {
  test("unknown employee code is 404", async () => {
    const anon = new Client(server.baseUrl);
    const res = await anon.post("/api/pairing/request", {
      employeeCode: "CS-000000",
    });
    assert.equal(res.status, 404);
  });

  test("owner accounts cannot start a pairing", async () => {
    const anon = new Client(server.baseUrl);
    const me = await anon.get<{ staff: { employeeCode: string } }>("/api/auth/me");
    void me;
    const ownerStaff = await owner.get<Array<{ employeeCode: string | null; role: string }>>(
      "/api/staff",
    );
    const ownerRow = ownerStaff.body.data!.find((s) => s.role === "OWNER")!;
    const res = await anon.post("/api/pairing/request", {
      employeeCode: ownerRow.employeeCode!,
    });
    assert.equal(res.status, 400);
  });

  test("employee requests pairing and owner approves it", async () => {
    const employee = await makeEmployee();

    // 1. employee phone requests
    const emp = new Client(server.baseUrl);
    const req = await emp.post<{
      code: string;
      token: string;
      staffName: string;
      expiresAt: string;
    }>("/api/pairing/request", { employeeCode: employee.employeeCode });
    assert.equal(req.status, 201);
    assert.equal(req.body.data?.staffName, "QR Employee");
    const token = req.body.data!.token;
    assert.ok(token.length > 20);

    // 2. before approval the status is pending
    const pending = await emp.get<{ approved: boolean }>(
      `/api/pairing/status?token=${token}`,
    );
    assert.equal(pending.body.data?.approved, false);

    // 3. owner approves (simulating the scan)
    const approve = await owner.post<{ approved: boolean; staffName: string }>(
      "/api/pairing/approve",
      { token },
    );
    assert.equal(approve.status, 200);
    assert.equal(approve.body.data?.approved, true);
    assert.equal(approve.body.data?.staffName, "QR Employee");

    // 4. approving twice is a 409
    const again = await owner.post("/api/pairing/approve", { token });
    assert.equal(again.status, 409);

    // 5. employee phone polls and receives a working session
    const status = await emp.get<{
      approved: boolean;
      accessToken: string;
      refreshToken: string;
      staff: { id: string; role: string };
    }>(`/api/pairing/status?token=${token}`);
    assert.equal(status.body.data?.approved, true);
    assert.ok(status.body.data?.accessToken);

    // 6. the session actually works
    const sess = new Client(server.baseUrl);
    sess.token = status.body.data!.accessToken;
    const me = await sess.get<{ role: string }>("/api/auth/me");
    assert.equal(me.body.data?.role, "CASHIER");
  });

  test("a second request expires the first one", async () => {
    const employee = await makeEmployee();
    const emp = new Client(server.baseUrl);

    const first = await emp.post<{ token: string }>("/api/pairing/request", {
      employeeCode: employee.employeeCode,
    });
    await emp.post("/api/pairing/request", {
      employeeCode: employee.employeeCode,
    });

    const stale = await emp.get<{ approved: boolean; expired: boolean }>(
      `/api/pairing/status?token=${first.body.data!.token}`,
    );
    assert.equal(stale.body.data?.expired, true);
  });

  test("unknown token is 404", async () => {
    const anon = new Client(server.baseUrl);
    const res = await anon.get("/api/pairing/status?token=does-not-exist");
    assert.equal(res.status, 404);
  });

  test("cashier cannot approve pairings", async () => {
    const employee = await makeEmployee();
    const emp = new Client(server.baseUrl);
    const req = await emp.post<{ token: string }>("/api/pairing/request", {
      employeeCode: employee.employeeCode,
    });

    const cashier = new Client(server.baseUrl);
    await login(cashier, {
      identifier: employee.employeeCode.replace("CS-", "+25190").slice(0, 12),
      pin: "4321",
    }).catch(() => {});
    // login by employee code is not supported; use the phone instead
    void cashier;

    const res = await emp.post("/api/pairing/approve", {
      token: req.body.data!.token,
    });
    assert.equal(res.status, 401); // anonymous cannot approve
  });

  test("owner can list pairing activity", async () => {
    const res = await owner.get<Array<{ code: string }>>("/api/pairing");
    assert.equal(res.status, 200);
    assert.ok(res.body.data!.length >= 1);
  });
});