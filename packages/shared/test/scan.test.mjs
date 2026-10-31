import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScanText } from "../dist/sms/scan.js";

test("telebirr confirmation screen: labeled transaction id + amount", () => {
  const text = [
    "Telebirr",
    "Transaction ID",
    "OUT9J4ND96T",
    "Amount",
    "ETB 120.00",
    "Date: 17/10/2026 14:32",
    "Receiver: Gemechu Girma",
  ].join("\n");
  const p = parseScanText(text);
  assert.equal(p.txnId, "OUT9J4ND96T");
  assert.equal(p.amount, 120);
  assert.equal(p.sender, "Gemechu Girma");
});

test("no hallucinated id when only phones/dates/amounts are visible", () => {
  const text =
    "Telebirr\nGemechu Girma sent you ETB 1.00 on 17/10/2026 at 14:32.\n0909112233";
  const p = parseScanText(text);
  assert.equal(p.txnId, undefined);
  assert.equal(p.amount, 1);
});

test("garbled label still anchors the id", () => {
  const text = "Telebirr\nTransacti0n No\nFT25184SXQZ0\nETB 45.50";
  const p = parseScanText(text);
  assert.equal(p.txnId, "FT25184SXQZ0");
  assert.equal(p.amount, 45.5);
});

test("standalone mixed-alnum id (no labeled row)", () => {
  const text = "Payment successful\nOUT8DJ4XG2\nBahir Dar branch";
  const p = parseScanText(text);
  assert.equal(p.txnId, "OUT8DJ4XG2");
});

test("currency codes and provider names are never ids", () => {
  const text = "Telebirr ETB USD\nAmount 10.00\nReceipt No 9J2K4L6M8A";
  const p = parseScanText(text);
  assert.equal(p.txnId, "9J2K4L6M8A");
  assert.equal(p.amount, 10);
  assert.equal(p.providerHint, "TELEBIRR");
});
