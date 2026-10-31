import {
  buildTemplateFromSpans,
  detectFields,
  type FieldName,
} from "@coffeeshop/shared";

export interface AutoRule {
  name: string;
  provider: "TELEBIRR" | "CBE_BIRR" | "AMOLE" | "AWASH" | "OTHER";
  senderAllowlist: string[];
  templateBody: string;
}

const PROVIDERS: Array<{
  re: RegExp;
  provider: AutoRule["provider"];
  label: string;
  allowlist: string[];
}> = [
  { re: /telebirr|ethio\s*telecom/i, provider: "TELEBIRR", label: "Telebirr", allowlist: ["127"] },
  { re: /cbe\s*birr|commercial\s*bank/i, provider: "CBE_BIRR", label: "CBE Birr", allowlist: ["CBE"] },
  { re: /\bamole\b/i, provider: "AMOLE", label: "Amole", allowlist: ["Amole"] },
  { re: /\bawash\b/i, provider: "AWASH", label: "Awash", allowlist: ["Awash"] },
];

/** Field priority: the order the tokens appear in the generated template. */
const FIELD_ORDER: FieldName[] = [
  "txnId",
  "amount",
  "senderName",
  "senderPhone",
  "sender",
  "date",
  "balance",
  "account",
];

/**
 * Build an active payment rule straight from a bank message. One tap, no
 * editor: the result can still be reviewed/edited afterwards.
 *
 * Returns null when the message has no readable amount.
 */
export function buildAutoRule(sample: string): AutoRule | null {
  const spans = detectFields(sample);
  const byField = new Map<FieldName, (typeof spans)[number]>();
  for (const span of spans) {
    if (!byField.has(span.field)) byField.set(span.field, span);
  }
  if (!byField.get("amount")) return null;

  const chosen = FIELD_ORDER.map((field) => byField.get(field)).filter(
    (span): span is (typeof spans)[number] => !!span,
  );
  if (chosen.length === 0) return null;

  const templateBody = buildTemplateFromSpans(
    sample,
    chosen.map((span) => ({
      field: span.field,
      start: span.start,
      end: span.end,
    })),
  );

  const hit = PROVIDERS.find((p) => p.re.test(sample));
  return {
    name: `${hit?.label ?? "Auto"} rule`,
    provider: hit?.provider ?? "OTHER",
    senderAllowlist: hit?.allowlist ?? [],
    templateBody,
  };
}
