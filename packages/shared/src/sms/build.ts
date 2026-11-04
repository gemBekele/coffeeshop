import { buildTemplateFromSpans, detectFields } from "./detect.js";
import { matchTemplateBest } from "./compiler.js";
import { normalizeSmsText } from "./normalize.js";
import type { FieldName } from "./tokens.js";

interface Span {
  field: FieldName;
  start: number;
  end: number;
}

const overlaps = (a: Span, b: { start: number; end: number }) =>
  a.start < b.end && b.start < a.end;

const SENDER_RE =
  /\b(?:from|by|payer|sender|paid by)\s+(?!account\b)([A-Za-z][A-Za-z .'\-]{1,40}?)(?=\s*(?:\(|on\b|,|\.|\d|$))/gi;

/** Receipt links, e.g. CBE "…/v2-hfHCxNKQIuBLPB4kYVPV". */
const RECEIPT_RE = /\/v2-([A-Za-z0-9]{4,})/g;
/** Payer names written in parentheses, e.g. "… (Hayder Aman Temam)". */
const PAREN_NAME_RE = /\(([A-Za-z][A-Za-z .'\-]{1,40})\)/g;
/** Masked account numbers, e.g. "1**8483". */
const MASKED_ACCOUNT_RE = /\b\d[\d*]{2,}\d\b/g;

/**
 * Build a whole-message pattern from one real sample.
 *
 * Everything that can change between two messages of the same format is turned
 * into a token — amounts, balances, dates, phones, transaction/reference IDs,
 * account numbers and payer names — so the *next* message matches even though
 * its values differ. The visible literals (bank wording, footer, greeting of
 * the shop's own account) stay as-is.
 *
 * Returns null when the sample has no readable amount.
 */
export function buildTemplateFromSample(sample: string): string | null {
  const text = normalizeSmsText(sample);
  if (!text) return null;

  let spans: Span[] = detectFields(text).map((s) => ({
    field: s.field,
    start: s.start,
    end: s.end,
  }));

  // Generic ID detection often grabs receipt/feedback URLs; those are not the
  // transaction id. Drop them and use the explicit receipt code below.
  spans = spans.filter(
    (s) =>
      !(
        s.field === "txnId" &&
        /https?:\/\/|forms\.gle|mbreciept/i.test(text.slice(s.start, s.end))
      ),
  );

  const add = (field: FieldName, start: number, end: number) => {
    if (spans.some((s) => overlaps(s, { start, end }))) return;
    spans.push({ field, start, end });
  };

  // 1) Receipt code (CBE) is the transaction id.
  for (const m of text.matchAll(RECEIPT_RE)) {
    const value = m[1];
    const start = (m.index ?? 0) + m[0].length - value.length;
    add("txnId", start, start + value.length);
  }

  // 2) Payer names inside parentheses.
  for (const m of text.matchAll(PAREN_NAME_RE)) {
    const value = m[1];
    const start = (m.index ?? 0) + 1;
    add("senderName", start, start + value.length);
  }

  // 3) Masked account numbers (payer and payee).
  for (const m of text.matchAll(MASKED_ACCOUNT_RE)) {
    const start = m.index ?? 0;
    add("account", start, start + m[0].length);
  }

  // 4) Payer names after from/by/payer, even when the detector missed them.
  for (const m of text.matchAll(SENDER_RE)) {
    const value = m[1];
    const start = (m.index ?? 0) + m[0].lastIndexOf(value);
    add("sender", start, start + value.length);
  }

  // 5) Remaining mixed alphanumeric values are IDs (letters + digits).
  for (const m of text.matchAll(/[A-Za-z0-9][A-Za-z0-9\-_.\/]{3,}/g)) {
    const value = m[0];
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) continue;
    const start = m.index ?? 0;
    add("referenceTxnId", start, start + value.length);
  }

  // 6) Remaining long digit runs are account/reference numbers.
  for (const m of text.matchAll(/\b\d{4,}\b/g)) {
    const start = m.index ?? 0;
    add("account", start, start + m[0].length);
  }

  if (!spans.some((s) => s.field === "amount")) return null;

  // Order and drop overlaps (detected fields win, they were added first).
  spans.sort((a, b) => a.start - b.start);
  const kept: Span[] = [];
  let lastEnd = -1;
  for (const span of spans) {
    if (span.start < lastEnd) continue;
    kept.push(span);
    lastEnd = span.end;
  }

  const templateBody = buildTemplateFromSpans(
    text,
    kept.map((s) => ({ field: s.field, start: s.start, end: s.end })),
  );

  // The pattern must match the sample it was built from.
  try {
    const check = matchTemplateBest(templateBody, text);
    if (!check.matched || check.amount === undefined) return null;
  } catch {
    return null;
  }

  return templateBody;
}
