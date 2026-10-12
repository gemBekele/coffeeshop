import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compileTemplate,
  matchTemplate,
  matchTemplateBest,
  detectFields,
  buildTemplateFromSpans,
  normalizeDirection,
} from "../dist/index.js";

const SAMPLE =
  "Dear customer, you have received ETB 250.00 from 0912345678 Abebe on 11/10/2026 14:32. Transaction ID is TB1234567890. Your balance is ETB 1,250.00.";

const TEMPLATE =
  "Dear customer, you have received ETB {amount} from {sender} on {date}. Transaction ID is {txnId}. Your balance is ETB {balance}.";

test("compileTemplate finds fields and has no warnings", () => {
  const compiled = compileTemplate(TEMPLATE);
  assert.deepEqual(compiled.fields, ["amount", "sender", "date", "txnId", "balance"]);
  assert.deepEqual(compiled.warnings, []);
});

test("compileTemplate warns when amount is missing", () => {
  const compiled = compileTemplate("You received money from {sender}");
  assert.ok(compiled.warnings.some((w) => w.includes("amount")));
});

test("matchTemplate extracts and normalizes the sample", () => {
  const res = matchTemplate(TEMPLATE, SAMPLE);
  assert.equal(res.matched, true);
  assert.equal(res.amount, 250);
  assert.equal(res.balance, 1250);
  assert.equal(res.txnId, "TB1234567890");
  assert.deepEqual(res.missingRequired, []);
});

test("matchTemplate handles different amounts and senders", () => {
  const other =
    "Dear customer, you have received ETB 1,000.50 from 0922222222 Sara on 12/10/2026 09:10. Transaction ID is TB9998887776. Your balance is ETB 2,251.50.";
  const res = matchTemplate(TEMPLATE, other);
  assert.equal(res.matched, true);
  assert.equal(res.amount, 1000.5);
  assert.equal(res.txnId, "TB9998887776");
});

test("matchTemplate does not match an unrelated debit SMS", () => {
  const res = matchTemplate(
    TEMPLATE,
    "You have sent ETB 50 to X. Transaction ID is ZZ11223344.",
  );
  assert.equal(res.matched, false);
});

test("template without amount token reports no match", () => {
  const res = matchTemplate("Received from {sender}", SAMPLE);
  assert.equal(res.matched, false);
  assert.ok(res.missingRequired.includes("amount"));
});

test("detectFields picks the right fields and drops plain words", () => {
  const spans = detectFields(SAMPLE);
  const values = spans.map((s) => `${s.field}=${s.value}`);
  assert.ok(values.includes("amount=250.00"));
  assert.ok(values.includes("txnId=TB1234567890"));
  assert.ok(values.includes("senderPhone=0912345678"));
  assert.ok(!spans.some((s) => s.value === "customer"));
  assert.ok(!spans.some((s) => s.value === "received"));
});

test("buildTemplateFromSpans round-trips through the compiler", () => {
  const spans = detectFields(SAMPLE);
  const amount = spans.find((s) => s.field === "amount" && s.value === "250.00");
  const txn = spans.find((s) => s.field === "txnId" && s.value === "TB1234567890");
  assert.ok(amount && txn);

  const built = buildTemplateFromSpans(SAMPLE, [
    { field: "amount", start: amount.start, end: amount.end },
    { field: "txnId", start: txn.start, end: txn.end },
  ]);
  const res = matchTemplate(built, SAMPLE);
  assert.equal(res.matched, true);
  assert.equal(res.amount, 250);
  assert.equal(res.txnId, "TB1234567890");
});

test("optional blocks match with or without their content", () => {
  const body = "Received ETB {amount}[[ from {sender}]]";
  assert.equal(matchTemplate(body, "Received ETB 100 from Abebe").amount, 100);
  assert.equal(matchTemplate(body, "Received ETB 100").amount, 100);
});

test("normalizeDirection classifies words", () => {
  assert.equal(normalizeDirection("received"), "CREDIT");
  assert.equal(normalizeDirection("credited"), "CREDIT");
  assert.equal(normalizeDirection("sent"), "DEBIT");
  assert.equal(normalizeDirection("withdrawn"), "DEBIT");
  assert.equal(normalizeDirection("banana"), undefined);
});

test("matchTemplateBest tolerates an app-name prefix (notifications)", () => {
  const notification = `Telebirr\n${SAMPLE}`;
  // Strict anchored match fails because of the leading app name.
  assert.equal(matchTemplate(TEMPLATE, notification).matched, false);
  // Best-effort match still extracts the fields.
  const res = matchTemplateBest(TEMPLATE, notification);
  assert.equal(res.matched, true);
  assert.equal(res.amount, 250);
  assert.equal(res.txnId, "TB1234567890");
});

test("matchTemplateBest does not match unrelated text", () => {
  const res = matchTemplateBest(
    TEMPLATE,
    "Your OTP is 123456. Do not share it with anyone.",
  );
  assert.equal(res.matched, false);
});
