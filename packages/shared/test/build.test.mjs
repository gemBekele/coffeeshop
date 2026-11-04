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

const CBE_SAMPLE =
  "Dear Halid Aragie Mekonnen You have received ETB 1.00 from account 1**8483 (Hayder Aman Temam) to your account 1**6113. Your current balance is ETB 2,859.71. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-hfHCxNKQIuBLPB4kYVPV  for feedback: https://forms.gle/kGNGQpG3mQCCk3iD6";
const CBE_PRESET =
  "You have received ETB {amount} from account {account} ({senderName}) to your account {account}. Your current balance is ETB {balance}. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-{txnId}";

const CBE_NEXT =
  "Dear Halid Aragie Mekonnen You have received ETB 250.00 from account 1**9911 (Dawit Bekele) to your account 1**6113. Your current balance is ETB 3,109.71. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-abc123XYZ789  for feedback: https://forms.gle/kGNGQpG3mQCCk3iD6";

test("CBE account preset matches the real message and a later variant", () => {
  const first = matchTemplateBest(CBE_PRESET, CBE_SAMPLE);
  assert.equal(first.matched, true);
  assert.equal(first.amount, 1);
  assert.equal(first.txnId, "hfHCxNKQIuBLPB4kYVPV");
  assert.equal(first.senderName, "Hayder Aman Temam");
  assert.equal(first.balance, 2859.71);

  const next = matchTemplateBest(CBE_PRESET, CBE_NEXT);
  assert.equal(next.matched, true);
  assert.equal(next.amount, 250);
  assert.equal(next.txnId, "abc123XYZ789");
  assert.equal(next.senderName, "Dawit Bekele");
  assert.equal(next.balance, 3109.71);
});

test("pattern built from the CBE sample matches a later variant", () => {
  const pattern = buildTemplateFromSample(CBE_SAMPLE);
  assert.ok(pattern, "pattern built");
  const result = matchTemplateBest(pattern, CBE_NEXT, { anchor: "both" });
  assert.equal(result.matched, true, pattern);
  assert.equal(result.amount, 250);
  assert.equal(result.txnId, "abc123XYZ789");
  assert.equal(result.senderName, "Dawit Bekele");
});

const BOA_SAMPLE =
  "Dear Halid, your account 1*65 was credited with ETB 240.00 by Natnael Kibrom Habteab. Available Balance: ETB 1,067.82.\nReceipt: https://cs.bankofabyssinia.com/slip/?trx=FT26308GXLM346587\nFeedback: https://cs.bankofabyssinia.com/cs/?trx=CFT26308GXLM3\nLink your Fayda: https://cs.bankofabyssinia.com/fayda_connect \nFor help, call 8397 (24/7 Toll-Free). Bank of Abyssinia. ";
const BOA_BODY =
  "your account {account} was credited with ETB {amount} by {senderName}. Available Balance: ETB {balance}. Receipt: https://cs.bankofabyssinia.com/slip/?trx={txnId}";
const BOA_NEXT =
  "Dear Halid, your account 1*65 was credited with ETB 75.50 by Sara Bekele. Available Balance: ETB 1,143.32.\nReceipt: https://cs.bankofabyssinia.com/slip/?trx=FT26309ABCD123\nFeedback: https://cs.bankofabyssinia.com/cs/?trx=CFT26309ABCD1\nLink your Fayda: https://cs.bankofabyssinia.com/fayda_connect \nFor help, call 8397 (24/7 Toll-Free). Bank of Abyssinia. ";

test("Bank of Abyssinia preset matches the real message and a later one", () => {
  const first = matchTemplateBest(BOA_BODY, BOA_SAMPLE);
  assert.equal(first.matched, true);
  assert.equal(first.amount, 240);
  assert.equal(first.txnId, "FT26308GXLM346587");
  assert.equal(first.senderName, "Natnael Kibrom Habteab");
  assert.equal(first.balance, 1067.82);

  const next = matchTemplateBest(BOA_BODY, BOA_NEXT);
  assert.equal(next.matched, true);
  assert.equal(next.amount, 75.5);
  assert.equal(next.txnId, "FT26309ABCD123");
  assert.equal(next.senderName, "Sara Bekele");
  assert.equal(next.balance, 1143.32);
});

test("builder handles the Bank of Abyssinia receipt param", () => {
  const pattern = buildTemplateFromSample(BOA_SAMPLE);
  assert.ok(pattern);
  const result = matchTemplateBest(pattern, BOA_NEXT, { anchor: "both" });
  assert.equal(result.matched, true, pattern);
  assert.equal(result.amount, 75.5);
  assert.equal(result.txnId, "FT26309ABCD123");
});
