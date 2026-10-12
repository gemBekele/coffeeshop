import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compileTemplate,
  matchTemplate,
  matchTemplateBest,
  detectFields,
  buildTemplateFromSpans,
  normalizeMoney,
  normalizeDirection,
} from "../dist/index.js";

const PROVIDERS = [
  {
    name: "Telebirr",
    template:
      "Dear customer, you have received ETB {amount} from {sender} on {date}. Transaction ID is {txnId}. Your balance is ETB {balance}.",
    sms: "Dear customer, you have received ETB 250.00 from 0912345678 Abebe on 11/10/2026 14:32. Transaction ID is TB1234567890. Your balance is ETB 1,250.00.",
    amount: 250,
    txnId: "TB1234567890",
  },
  {
    name: "CBE Birr",
    template:
      "Dear Customer, your account has been credited with ETB {amount} from {sender}. Ref No: {txnId}. Balance: ETB {balance}.",
    sms: "Dear Customer, your account has been credited with ETB 300.00 from 0912345678 (Abebe). Ref No: FT26011ABC. Balance: ETB 5,300.00.",
    amount: 300,
    txnId: "FT26011ABC",
  },
  {
    name: "Amole",
    template:
      "Amole: You have received ETB {amount} from {senderPhone}. Transaction number: {txnId}. Date: {date}.",
    sms: "Amole: You have received ETB 150.00 from 0911223344. Transaction number: AM26011XY. Date: 11/10/2026.",
    amount: 150,
    txnId: "AM26011XY",
  },
  {
    name: "Awash",
    template:
      "Awash Bank: Your account {account} is credited ETB {amount} by {senderPhone}. Txn ID {txnId}.",
    sms: "Awash Bank: Your account 0132011234567 is credited ETB 500.00 by 0912345678. Txn ID AWB123456.",
    amount: 500,
    txnId: "AWB123456",
  },
];

for (const p of PROVIDERS) {
  test(`${p.name}: template matches its own sample`, () => {
    const res = matchTemplate(p.template, p.sms);
    assert.equal(res.matched, true, `${p.name} did not match`);
    assert.equal(res.amount, p.amount);
    assert.equal(res.txnId, p.txnId);
    assert.deepEqual(res.missingRequired, []);
  });

  test(`${p.name}: rejects an unrelated message`, () => {
    const res = matchTemplate(p.template, "Your OTP is 123456. Do not share.");
    assert.equal(res.matched, false);
  });

  test(`${p.name}: fields are discoverable by the detector`, () => {
    const fields = detectFields(p.sms).map((s) => s.field);
    assert.ok(fields.includes("amount"));
    assert.ok(fields.includes("txnId"));
  });
}

test("normalizeMoney handles commas, spaces and no decimals", () => {
  assert.equal(normalizeMoney("1,250.50"), 1250.5);
  assert.equal(normalizeMoney("1 250.50"), 1250.5);
  assert.equal(normalizeMoney("300"), 300);
  assert.equal(normalizeMoney("12,000,000.99"), 12000000.99);
});

test("currency token is extracted and upper-cased", () => {
  const res = matchTemplate("Paid {amount} {currency}", "Paid 50 etb");
  assert.equal(res.currency, "ETB");
});

test("sender phone token normalizes formatting", () => {
  const res = matchTemplate("From {senderPhone}", "From +251 911 000 111");
  assert.equal(res.senderPhone, "+251911000111");
});

test("optional blocks are optional", () => {
  const template = "Received ETB {amount}[[ from {sender}]]";
  assert.equal(matchTemplate(template, "Received ETB 100 from Abebe").matched, true);
  assert.equal(matchTemplate(template, "Received ETB 100").matched, true);
});

test("unknown tokens produce a warning and are treated literally", () => {
  const compiled = compileTemplate("Received {amount} {bogus}");
  assert.ok(compiled.warnings.some((w) => w.includes("bogus")));
});

test("a token used twice captures both occurrences", () => {
  const res = matchTemplate("Amount {amount}. Confirmed amount {amount}.", "Amount 40. Confirmed amount 40.");
  assert.equal(res.matched, true);
  assert.equal(res.amount, 40);
});

test("multi-line bodies still match (dotall/whitespace)", () => {
  const template = "You received ETB {amount} from {sender}. Ref {txnId}.";
  const body = "You received ETB\n250.00 from\nAbebe. Ref\nABC123.";
  const res = matchTemplate(template, body);
  assert.equal(res.matched, true);
  assert.equal(res.amount, 250);
  assert.equal(res.txnId, "ABC123");
});

test("direction is inferred from a direction token", () => {
  const credit = matchTemplate("You have {direction} ETB {amount}", "You have received ETB 10");
  assert.equal(credit.direction, "CREDIT");
  const debit = matchTemplate("You have {direction} ETB {amount}", "You have sent ETB 10");
  assert.equal(debit.direction, "DEBIT");
});

test("buildTemplateFromSpans ignores overlapping spans", () => {
  const text = "ETB 250.00 ref TB123";
  const built = buildTemplateFromSpans(text, [
    { field: "amount", start: 4, end: 10 }, // 250.00
    { field: "txnId", start: 8, end: 16 }, // overlaps -> ignored
    { field: "txnId", start: 15, end: 20 }, // TB123
  ]);
  assert.match(built, /\{amount\}/);
  assert.match(built, /\{txnId\}/);
  const res = matchTemplate(built, text);
  assert.equal(res.matched, true);
  assert.equal(res.amount, 250);
});

test("best-effort matching tolerates a suffix as well as a prefix", () => {
  const template = "You received ETB {amount} from {sender}. Ref {txnId}.";
  const withSuffix = "You received ETB 90.00 from Mimi. Ref AB123. Sent from your Telebirr wallet.";
  assert.equal(matchTemplate(template, withSuffix).matched, false);
  assert.equal(matchTemplateBest(template, withSuffix).matched, true);
});

test("empty template has no fields and warns about amount", () => {
  const compiled = compileTemplate("");
  assert.deepEqual(compiled.fields, []);
  assert.ok(compiled.warnings.some((w) => w.includes("amount")));
});

test("normalizeDirection is case-insensitive", () => {
  assert.equal(normalizeDirection("RECEIVED"), "CREDIT");
  assert.equal(normalizeDirection("Withdrawn"), "DEBIT");
});
