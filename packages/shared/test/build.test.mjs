import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTemplateFromSample, matchTemplateBest, normalizeSmsText } from "../dist/index.js";

const SAMPLE = `Dear GEMEHU
You have received ETB 2.00 from Gemechu Girma(2519****4345)  on 12/10/2026 01:17:07. Your transaction number is DJC6OX8QZA. Your current E-Money Account balance is ETB 3.50.
Thank you for using telebirr
Ethio telecom`;

test("builds a whole-message pattern that matches the next message with new values", () => {
  const pattern = buildTemplateFromSample(SAMPLE);
  assert.ok(pattern, "pattern built");
  const next = `Dear GEMEHU
You have received ETB 45.00 from Dawit Bekele(2519****9911)  on 20/10/2026 09:41:11. Your transaction number is OUT9J4ND96T. Your current E-Money Account balance is ETB 480.00.
Thank you for using telebirr
Ethio telecom`;
  const result = matchTemplateBest(pattern, next, { anchor: "both" });
  assert.equal(result.matched, true);
  assert.equal(result.amount, 45);
  assert.equal(result.txnId, "OUT9J4ND96T");
  assert.equal(result.balance, 480);
});

test("whole-message patterns do not match when extra text is added", () => {
  const pattern = buildTemplateFromSample(SAMPLE);
  const withHeader = `Bank alert\n${SAMPLE}`;
  const result = matchTemplateBest(pattern, withHeader, { anchor: "both" });
  assert.equal(result.matched, false);
});

test("tokenizes a second reference id so it can change", () => {
  const sample =
    "CBE: You received ETB 300.00 from Abebe Kebede(0911223344) on 01/11/2026. Ref No: FT26011ABC. Second Ref: 99887766. Balance: ETB 5300.00.";
  const pattern = buildTemplateFromSample(sample);
  assert.ok(pattern);
  const next =
    "CBE: You received ETB 120.00 from Sara Bekele(0911998877) on 02/11/2026. Ref No: FT26011XYZ. Second Ref: 11223344. Balance: ETB 4200.00.";
  const result = matchTemplateBest(pattern, next, { anchor: "both" });
  assert.equal(result.matched, true, pattern);
  assert.equal(result.amount, 120);
});

test("invisible characters and smart punctuation do not break the match", () => {
  const pattern = buildTemplateFromSample(SAMPLE);
  const noisy = SAMPLE.replace(/ /g, "\u00A0")
    .replace("You have", "\u201CYou\u201D have")
    .replace(/\n/g, "\n \n");
  const result = matchTemplateBest(pattern, noisy, { anchor: "both" });
  assert.equal(result.matched, true);
});

test("normalize collapses whitespace and trims", () => {
  assert.equal(normalizeSmsText("  a\u00A0 b\n\nc \u2013 d  "), "a b c - d");
});
