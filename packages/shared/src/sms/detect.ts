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

const MONEY_RE = /(?<![\w.,])\d[\d,]*(?:\.\d{1,2})?(?![\w.,])/g;
const PHONE_RE = /(?<![A-Za-z0-9])\+?\d[\d\s-]{7,}\d(?![A-Za-z0-9])/g;
const DATE_RE =
  /(?<!\d)\d{1,4}[-/]\d{1,2}[-/]\d{1,4}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?(?!\d)/g;
const CURRENCY_RE = /\b(ETB|KES|USD|EUR|GBP|SAR|AED|DJF|SSP|SDG)\b/gi;
const ID_RE = /(?<![A-Za-z0-9])[A-Za-z0-9](?:[A-Za-z0-9\-_/.]*[A-Za-z0-9])?(?![A-Za-z0-9])/g;
const ID_KEYWORD_RE =
  /\b(?:transaction|txn|trx|reference|ref|receipt)\b\s*(?:id|no|number|#)?\s*(?:is|:|-|#|=)?\s*([A-Za-z0-9](?:[A-Za-z0-9\-_/.]*[A-Za-z0-9])?)/gi;

function overlaps(a: FieldSpan, b: FieldSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

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

  // Amounts (decimal money is the strongest amount signal).
  for (const m of smsText.matchAll(MONEY_RE)) {
    const value = m[0];
    const start = m.index ?? 0;
    const hasDecimals = /\.\d{1,2}$/.test(value);
    add("amount", value, start, start + value.length, hasDecimals ? 0.75 : 0.45);
  }

  for (const m of smsText.matchAll(PHONE_RE)) {
    const value = m[0];
    const start = m.index ?? 0;
    add("senderPhone", value, start, start + value.length, 0.8);
  }

  for (const m of smsText.matchAll(DATE_RE)) {
    const value = m[0];
    const start = m.index ?? 0;
    add("date", value, start, start + value.length, 0.6);
  }

  for (const m of smsText.matchAll(CURRENCY_RE)) {
    const value = m[0];
    const start = m.index ?? 0;
    add("currency", value, start, start + value.length, 0.9);
  }

  // Transaction IDs mentioned after a keyword.
  for (const m of smsText.matchAll(ID_KEYWORD_RE)) {
    const value = m[1];
    if (value.length < 5) continue;
    const start = (m.index ?? 0) + m[0].lastIndexOf(value);
    add("txnId", value, start, start + value.length, 0.95);
  }

  // Generic long alphanumeric IDs. Only mixed letter+digit tokens are
  // considered, since plain words and pure numbers are not transaction ids.
  for (const m of smsText.matchAll(ID_RE)) {
    const value = m[0];
    const start = m.index ?? 0;
    const digits = (value.match(/\d/g) ?? []).length;
    const hasLetter = /[A-Za-z]/.test(value);
    if (!hasLetter || digits < 2) continue;
    add("txnId", value, start, start + value.length, 0.5);
  }

  // Resolve overlaps: greedily keep highest confidence, then leftmost.
  candidates.sort(
    (a, b) => b.confidence - a.confidence || a.start - b.start,
  );
  const chosen: FieldSpan[] = [];
  for (const c of candidates) {
    if (!chosen.some((existing) => overlaps(existing, c))) {
      chosen.push(c);
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
