import { test } from "node:test";
import assert from "node:assert/strict";
import { splitDayTotals } from "../dist/daySplit.js";

test("normal day: cash is the remainder after confirmed bank", () => {
  const r = splitDayTotals(1000, 400);
  assert.deepEqual(r, { sales: 1000, bank: 400, cash: 600, surplus: 0, total: 1000 });
});

test("no transfers: all sales are cash", () => {
  const r = splitDayTotals(480, 0);
  assert.equal(r.cash, 480);
  assert.equal(r.total, 480);
});

test("more bank than sales: cash floors at zero and surplus is shown", () => {
  const r = splitDayTotals(200, 350);
  assert.equal(r.cash, 0);
  assert.equal(r.surplus, 150);
  assert.equal(r.total, 200);
});

test("rounding stays in cents", () => {
  const r = splitDayTotals(100.005, 33.333);
  assert.equal(r.sales, 100.01);
  assert.equal(r.bank, 33.33);
  assert.equal(r.cash, 66.68);
});

test("empty day", () => {
  assert.deepEqual(splitDayTotals(0, 0), {
    sales: 0,
    bank: 0,
    cash: 0,
    surplus: 0,
    total: 0,
  });
});
