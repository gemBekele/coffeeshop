/**
 * Parser for OCR captures of a payer's payment-confirmation screen.
 *
 * Different from SMS parsing: the text comes from ML Kit on a noisy phone
 * screen (stacked UI, labels split across lines, glyph confusions like 0/O,
 * and visible prices for unrelated rows). Every accepted transaction ID must
 * therefore pass strict validation — we prefer returning no ID over
 * returning a hallucinated one, because the server can still confirm the
 * scan later from the matching SMS.
 */

import { detectFields } from "./detect.js";

export interface ScanParse {
  amount?: number;
  txnId?: string;
  sender?: string;
  providerHint?: string;
}

interface Claim {
  value: string;
  score: number;
}

/** Currency/unit codes that regularly OCR like plausible IDs. */
const CURRENCY_CODES = new Set([
  "ETB",
  "USD",
  "EUR",
  "GBP",
  "KES",
  "SAR",
  "AED",
  "DJF",
  "SSP",
  "SDG",
  "NGN",
]);

/** Words that look like IDs on payment screens but never are. */
const COMMON_NOISE = new Set([
  "TELEBIRR",
  "CBEBIRR",
  "AMOLE",
  "AWASH",
  "MPESA",
  "MPES2A",
  "ETSWITCH",
  "CHAPA",
  "ARIFPAY",
  "COLLABPAY",
]);

const LABEL_TXN_RE =
  /\b(?:trans[a-z0-9\u00df-\u024f]{0,7}|trx|t\.?r\.?x|ref(?:erence)?|receipt|invoice|req(?:uest)?|t\.?i\.?d\.?|tracking|hash|payment\s*id)\b[^A-Za-z0-9#]{0,10}(?:id|no\.?|num(?:ber)?|#|is)?[^A-Za-z0-9#]{0,4}([A-Za-z0-9][A-Za-z0-9/]{3,22}[A-Za-z0-9])/gi;

const LABEL_AMOUNT_RE =
  /(?:amount|total|paid|sent|transfer(?:red)?|receiving|received|credit(?:ed)?|debit(?:ed)?|charge|fee|etb|birr|br\.?|kes|usd|ghs|ksh)[^0-9]{0,14}(?:etb|birr|br\.?|kes|usd|ghs|ksh)?[^0-9]{0,3}([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;

const FALLBACK_AMOUNT_RE =
  /(?:etb|birr|br\.?|kes|usd|ghs|ksh)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;

const SENDER_PATTERNS: RegExp[] = [
  /^([A-Za-z][A-Za-z .'\u2019-]{1,38})\s+sent\s+you/im,
  /\b(?:payer|sender|receiver|paid\s+by|from|name)\s*[:\-\u2013]\s*([A-Za-z][A-Za-z .'\u2019-]{1,38})/im,
  /\bsent\s+by\s+([A-Za-z][A-Za-z .'\u2019-]{1,38})/im,
];

const TIMEOUT_PATTERY = /^(19|20)\d{6,10}$/;

function toNumber(raw: string): number | undefined {
  const flat = raw.replace(/[,\s]/g, "");
  const n = Number(flat);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return undefined;
  return n;
}

function cleanToken(value: string): string {
  return value
    .replace(/[.,;:req#\-/]+$/g, "")
    .replace(/^[#:\-]+/, "")
    .trim();
}

interface Candidate {
  value: string;
  score: number;
}

function validTxnToken(value: string): boolean {
  const upper = value.toUpperCase();
  if (upper.length < 5 || upper.length > 20) return false;
  if (!/[A-Z]/.test(upper) || !/[0-9]/.test(upper)) return false;
  if (/[.,]/.test(upper)) return false;
  if (CURRENCY_CODES.has(upper) || COMMON_NOISE.has(upper)) return false;
  if (TIMEOUT_PATTERY.test(upper)) return false;
  if (/^[0-9]+$/.test(upper)) return false;
  // Phone-like blocks (10+ digits with separators are caught elsewhere).
  return true;
}

function gatherTxnCandidates(raw: string): Candidate[] {
  const text = raw.replace(/\u00A0/g, " ");
  const out: Candidate[] = [];
  const seenLower = new Set<string>();

  const push = (claim: Claim) => {
    const value = cleanToken(claim.value);
    if (!validTxnToken(value)) return;
    const key = value.toUpperCase();
    if (seenLower.has(key)) return;
    seenLower.add(key);
    out.push({ value, score: claim.score });
  };

  // 1) Label-anchored ("Transaction ID", "Receipt No", "Req", …) — even when
  //    the keyword itself is garbled ("Transacti0n") the prefix still matches.
  for (const m of text.matchAll(LABEL_TXN_RE)) {
    push({ value: m[1], score: 3 });
  }

  // 2) Standalone mixed alnum tokens (payment screens often print the ID on
  //    its own row with no OCR-visible label).
  for (const m of text.toUpperCase().matchAll(/[A-Z0-9]{5,20}/g)) {
    if (!validTxnToken(m[0])) continue;
    let score = 1;
    if (m[0].length >= 8 && m[0].length <= 14) score += 1.2;
    const letters = (m[0].match(/[A-Z]/g) ?? []).length;
    const digits = m[0].length - letters;
    // Payment IDs are usually mostly digits with a letter prefix/inner body.
    if (digits >= letters * 1.5) score += 0.6;
    if (/[0-9][A-Z]|[A-Z][0-9]/.test(m[0])) score += 0.4;
    push({ value: m[0], score });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

export function parseScanText(raw: string): ScanParse {
  const text = raw.replace(/\u00A0/g, " ").replace(/\u2022|\u2023/g, " ");
  const result: ScanParse = {};

  /* ------------------------------- txn ID -------------------------------- */
  const txnCandidate = gatherTxnCandidates(text)[0];
  if (txnCandidate) result.txnId = txnCandidate.value;

  /* -------------------------------- amount -------------------------------- */
  const amounts: Array<{ n: number; score: number }> = [];
  for (const m of text.matchAll(LABEL_AMOUNT_RE)) {
    const n = toNumber(m[1]);
    if (n === undefined) continue;
    amounts.push({ n, score: 2 + (/\./.test(m[1]) ? 1 : 0) });
  }
  if (amounts.length === 0) {
    for (const m of text.matchAll(FALLBACK_AMOUNT_RE)) {
      const n = toNumber(m[1]);
      if (n === undefined) continue;
      amounts.push({ n, score: 1 });
    }
  }
  if (amounts.length === 0) {
    const span = detectFields(text).find((s) => s.field === "amount");
    if (span) {
      const n = toNumber(span.value);
      if (n !== undefined) amounts.push({ n, score: 0.5 });
    }
  }
  amounts.sort((a, b) => b.score - a.score);
  if (amounts.length > 0) result.amount = amounts[0].n;

  /* -------------------------------- sender -------------------------------- */
  for (const re of SENDER_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) {
      const name = m[1].trim().replace(/\s{2,}/g, " ");
      if (name.length >= 3) {
        result.sender = name;
        break;
      }
    }
  }

  /* ------------------------------ provider -------------------------------- */
  const provider = text
    .toUpperCase()
    .match(/TELEBIRR|CBEBIRR|CBE\s*BIRR|AMOLE|AWASH|MP?ESA|MPESA|ETHIO\s*TELECOM/);
  if (provider) result.providerHint = provider[0];

  return result;
}
