import type { FieldName } from "./tokens.js";

export interface FieldSpan {
  field: FieldName;
  value: string;
  start: number;
  end: number;
  /** 0..1 heuristic confidence. */
  confidence: number;
}

interface Candidate extends FieldSpan {}

const MONEY_RE = /(?<![\w.,:/\-])\d[\d,]*(?:\.\d{1,2})?(?!\d)/g;
const PHONE_RE = /(?<![A-Za-z0-9])\+?\d[\d\s\-*]{6,}\d(?![A-Za-z0-9])/g;
const DATE_RE =
  /(?<!\d)\d{1,4}[-/]\d{1,2}[-/]\d{1,4}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?(?!\d)/g;
const CURRENCY_RE = /\b(ETB|KES|USD|EUR|GBP|SAR|AED|DJF|SSP|SDG)\b/gi;
const ID_RE = /(?<![A-Za-z0-9])[A-Za-z0-9](?:[A-Za-z0-9\-_/.]*[A-Za-z0-9])?(?![A-Za-z0-9])/g;
const ID_KEYWORD_RE =
  /\b(?:transaction|txn|trx|reference|ref|receipt)\b\s*(?:id|no|number|#)?\s*(?:is|:|-|#|=)?\s*([A-Za-z0-9](?:[A-Za-z0-9\-_/.]*[A-Za-z0-9])?)/gi;
const FROM_NAME_RE =
  /\bfrom\s+([A-Za-z][A-Za-z .'\-]{1,40}?)(?=\s*\(|\s+on\b)/gi;

function overlaps(a: FieldSpan, b: FieldSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

const SINGLETON_FIELDS = new Set<FieldName>([
  "amount",
  "balance",
  "txnId",
  "referenceTxnId",
  "sender",
  "senderName",
  "senderPhone",
  "date",
  "account",
  "direction",
]);

/**
 * Heuristically detect fields inside a raw SMS so the owner can tap-to-tokenize.
 * Returns spans sorted by position, with overlaps resolved in favor of the
 * highest-confidence candidate.
 */
export function detectFields(smsText: string): FieldSpan[] {
  const candidates: Candidate[] = [];

  const add = (
    field: FieldName,
    value: string,
    start: number,
    end: number,
    confidence: number,
  ) => {
    if (!value.trim()) return;
    candidates.push({ field, value, start, end, confidence });
  };

  // Amounts & balances (context-aware).
  for (const m of smsText.matchAll(MONEY_RE)) {
    const value = m[0];
    const start = m.index ?? 0;
    const hasDecimals = /\.\d{1,2}$/.test(value);
    const before = smsText.slice(Math.max(0, start - 36), start).toLowerCase();
    if (/\bbalance\b/.test(before)) {
      add("balance", value, start, start + value.length, hasDecimals ? 0.92 : 0.72);
    } else if (/\b(etb|birr|kes|usd|eur|received|credited|transferred|paid)\b/.test(before)) {
      add("amount", value, start, start + value.length, hasDecimals ? 0.94 : 0.78);
    } else {
      add("amount", value, start, start + value.length, hasDecimals ? 0.75 : 0.45);
    }
  }

  for (const m of smsText.matchAll(PHONE_RE)) {
    const value = m[0];
    const start = m.index ?? 0;
    add("senderPhone", value, start, start + value.length, 0.85);
  }

  for (const m of smsText.matchAll(FROM_NAME_RE)) {
    const value = m[1];
    const start = (m.index ?? 0) + m[0].lastIndexOf(value);
    add("senderName", value, start, start + value.length, 0.88);
  }

  for (const m of smsText.matchAll(DATE_RE)) {
    const value = m[0];
    const start = m.index ?? 0;
    add("date", value, start, start + value.length, 0.75);
  }

  for (const m of smsText.matchAll(CURRENCY_RE)) {
    const value = m[0];
    const start = m.index ?? 0;
    add("currency", value, start, start + value.length, 0.9);
  }

  // Transaction IDs mentioned after a keyword.
  for (const m of smsText.matchAll(ID_KEYWORD_RE)) {
    const value = m[1].replace(/[.,;:]+$/, "");
    if (value.length < 5) continue;
    const start = (m.index ?? 0) + m[0].lastIndexOf(value);
    add("txnId", value, start, start + value.length, 0.96);
  }

  // Generic long alphanumeric IDs.
  for (const m of smsText.matchAll(ID_RE)) {
    const value = m[0];
    const start = m.index ?? 0;
    const digits = (value.match(/\d/g) ?? []).length;
    const hasLetter = /[A-Za-z]/.test(value);
    if (!hasLetter || digits < 2 || value.includes("@")) continue;
    add("txnId", value, start, start + value.length, 0.5);
  }

  // Resolve overlaps: greedily keep highest confidence, then leftmost, and only
  // one span per singleton field so `{amount}` or `{txnId}` is never duplicated.
  candidates.sort(
    (a, b) => b.confidence - a.confidence || a.start - b.start,
  );
  const chosen: FieldSpan[] = [];
  const usedFields = new Set<FieldName>();
  for (const c of candidates) {
    if (SINGLETON_FIELDS.has(c.field) && usedFields.has(c.field)) continue;
    if (!chosen.some((existing) => overlaps(existing, c))) {
      chosen.push(c);
      if (SINGLETON_FIELDS.has(c.field)) usedFields.add(c.field);
    }
  }

  chosen.sort((a, b) => a.start - b.start);
  return chosen;
}

function escapeBrace(text: string): string {
  return text.replace(/([{}])/g, "\\$1");
}

/**
 * Build a token template from owner-selected spans over the original SMS.
 *
 * `spans` are 0-indexed, half-open ranges. Overlapping spans are ignored
 * (first wins after sorting by start).
 */
export function buildTemplateFromSpans(
  smsText: string,
  spans: Array<{ field: FieldName; start: number; end: number }>,
): string {
  const sorted = [...spans]
    .filter((s) => s.start >= 0 && s.end <= smsText.length && s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const kept: typeof sorted = [];
  let lastEnd = -1;
  for (const span of sorted) {
    if (span.start < lastEnd) continue;
    kept.push(span);
    lastEnd = span.end;
  }

  let out = "";
  let cursor = 0;
  for (const span of kept) {
    out += escapeBrace(smsText.slice(cursor, span.start));
    out += `{${span.field}}`;
    cursor = span.end;
  }
  out += escapeBrace(smsText.slice(cursor));
  return out;
}
