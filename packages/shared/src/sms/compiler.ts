import {
  FIELD_TOKENS,
  isFieldName,
  REQUIRED_FIELDS,
  type FieldGroup,
  type FieldName,
} from "./tokens.js";

export type Direction = "CREDIT" | "DEBIT";

export interface CompileOptions {
  /** Anchor the pattern. Defaults to "both". */
  anchor?: "both" | "start" | "none";
  /** Case-insensitive matching. Defaults to true. */
  caseInsensitive?: boolean;
}

export interface CompiledTemplate {
  templateBody: string;
  regex: string;
  flags: string;
  /** Distinct fields used, in order of first appearance. */
  fields: FieldName[];
  /** Mapping from regex group name -> field. */
  groups: Array<{ groupName: string; field: FieldName }>;
  warnings: string[];
}

export interface ExtractedSms {
  matched: boolean;
  /** Raw captured strings, keyed by field. */
  fields: Partial<Record<FieldName, string>>;
  /** Normalized values ready for the API. */
  amount?: number;
  balance?: number;
  currency?: string;
  direction?: Direction;
  txnId?: string;
  referenceTxnId?: string;
  sender?: string;
  senderPhone?: string;
  senderName?: string;
  account?: string;
  date?: string;
  missingRequired: FieldName[];
}

const NORMALIZERS: Record<FieldGroup, (value: string) => unknown> = {
  money: (value) => normalizeMoney(value),
  id: (value) => value.trim(),
  text: (value) => value.trim(),
  phone: (value) => normalizePhone(value),
  date: (value) => value.trim(),
  currency: (value) => value.trim().toUpperCase(),
  direction: (value) => normalizeDirection(value),
};

export function normalizeMoney(value: string): number | undefined {
  const cleaned = value.replace(/[,\s]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export function normalizeDirection(value: string): Direction | undefined {
  const v = value.toLowerCase();
  if (/(credit|credited|received|receive|deposit|deposited|inflow)/.test(v)) {
    return "CREDIT";
  }
  if (/(debit|debited|sent|send|withdraw|withdrawn|paid|payment|outflow)/.test(v)) {
    return "DEBIT";
  }
  return undefined;
}

function escapeLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Segment {
  kind: "literal" | "token" | "group";
  value?: string;
  field?: FieldName;
  children?: Segment[];
  optional?: boolean;
}

/**
 * Parse a template body into segments.
 *
 * - `{field}`  -> token
 * - `[[ ... ]]` -> optional block
 * - `\{` / `\}` -> literal brace
 */
function parseTemplate(body: string): { segments: Segment[]; warnings: string[] } {
  const warnings: string[] = [];
  const root: Segment[] = [];
  const stack: Array<{ optional: boolean; segments: Segment[] }> = [
    { optional: false, segments: root },
  ];

  const push = (seg: Segment) => stack[stack.length - 1].segments.push(seg);

  let literal = "";
  const flushLiteral = () => {
    if (literal) {
      push({ kind: "literal", value: literal });
      literal = "";
    }
  };

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

    // Escaped brace
    if (ch === "\\" && (body[i + 1] === "{" || body[i + 1] === "}")) {
      literal += body[i + 1];
      i++;
      continue;
    }

    // Optional block delimiter
    if (ch === "[" && body[i + 1] === "[") {
      flushLiteral();
      const node: Segment = { kind: "group", children: [], optional: true };
      push(node);
      stack.push({ optional: true, segments: node.children! });
      i++;
      continue;
    }
    if (ch === "]" && body[i + 1] === "]") {
      flushLiteral();
      if (stack.length <= 1) {
        warnings.push("Unmatched ']]' in template.");
      } else {
        stack.pop();
      }
      i++;
      continue;
    }

    // Token
    if (ch === "{") {
      const end = body.indexOf("}", i + 1);
      if (end === -1) {
        warnings.push("Unmatched '{' in template.");
        literal += ch;
        continue;
      }
      const name = body.slice(i + 1, end).trim();
      if (!isFieldName(name)) {
        warnings.push(`Unknown token '{${name}}'.`);
        literal += body.slice(i, end + 1);
        continue;
      }
      flushLiteral();
      push({ kind: "token", field: name });
      i = end;
      continue;
    }

    literal += ch;
  }

  flushLiteral();
  if (stack.length > 1) {
    warnings.push("Unclosed optional block '[[' in template.");
  }

  return { segments: root, warnings };
}

interface BuildState {
  fields: FieldName[];
  groups: Array<{ groupName: string; field: FieldName }>;
  seen: Map<FieldName, number>;
}

function buildSegments(segments: Segment[], state: BuildState): string {
  let out = "";
  for (const seg of segments) {
    if (seg.kind === "literal") {
      out += escapeLiteral(seg.value ?? "").replace(/\s+/g, "\\s+");
    } else if (seg.kind === "group") {
      const inner = buildSegments(seg.children ?? [], state);
      out += `(?:${inner})?`;
    } else if (seg.kind === "token" && seg.field) {
      const def = FIELD_TOKENS[seg.field];
      const count = state.seen.get(seg.field) ?? 0;
      state.seen.set(seg.field, count + 1);
      const groupName = count === 0 ? seg.field : `${seg.field}_${count + 1}`;
      if (count === 0) {
        state.fields.push(seg.field);
      }
      state.groups.push({ groupName, field: seg.field });
      out += `(?<${groupName}>${def.pattern})`;
    }
  }
  return out;
}

export function compileTemplate(
  templateBody: string,
  options: CompileOptions = {},
): CompiledTemplate {
  const { anchor = "both", caseInsensitive = true } = options;
  const { segments, warnings } = parseTemplate(templateBody);

  const state: BuildState = { fields: [], groups: [], seen: new Map() };
  let source = buildSegments(segments, state);

  if (anchor === "both" || anchor === "start") source = `^${source}`;
  if (anchor === "both") source = `${source}$`;

  let flags = "";
  if (caseInsensitive) flags += "i";
  flags += "s"; // dotall

  const missing = REQUIRED_FIELDS.filter((f) => !state.fields.includes(f));
  if (missing.length > 0) {
    warnings.push(
      `Template does not include required field(s): ${missing.join(", ")}.`,
    );
  }

  return {
    templateBody: templateBody.trim(),
    regex: source,
    flags,
    fields: state.fields,
    groups: state.groups,
    warnings,
  };
}

function applyValue(target: ExtractedSms, field: FieldName, raw: string): void {
  const def = FIELD_TOKENS[field];
  const normalized = NORMALIZERS[def.group](raw);
  (target.fields as Record<string, string>)[field] = raw;

  switch (field) {
    case "amount":
      target.amount = normalized as number;
      break;
    case "balance":
      target.balance = normalized as number;
      break;
    case "currency":
      target.currency = normalized as string;
      break;
    case "direction":
      target.direction = normalized as Direction;
      break;
    case "senderPhone":
      target.senderPhone = normalized as string;
      break;
    case "txnId":
      target.txnId = normalized as string;
      break;
    case "referenceTxnId":
      target.referenceTxnId = normalized as string;
      break;
    case "sender":
      target.sender = normalized as string;
      break;
    case "senderName":
      target.senderName = normalized as string;
      break;
    case "account":
      target.account = normalized as string;
      break;
    case "date":
      target.date = normalized as string;
      break;
  }
}

export function extractWithCompiled(
  compiled: CompiledTemplate,
  smsText: string,
): ExtractedSms {
  const result: ExtractedSms = {
    matched: false,
    fields: {},
    missingRequired: [],
  };

  let regex: RegExp;
  try {
    regex = new RegExp(compiled.regex, compiled.flags);
  } catch {
    result.missingRequired = [...REQUIRED_FIELDS];
    return result;
  }

  const match = regex.exec(smsText);
  if (!match || !match.groups) {
    result.missingRequired = [...REQUIRED_FIELDS];
    return result;
  }

  result.matched = true;
  for (const { groupName, field } of compiled.groups) {
    const raw = match.groups[groupName];
    if (raw !== undefined) applyValue(result, field, raw);
  }

  result.missingRequired = REQUIRED_FIELDS.filter(
    (f) => f === "amount" && result.amount === undefined,
  );

  // If the template did not include a direction token, infer nothing here; the
  // template's own direction (CREDIT/DEBIT) is applied by the caller.
  return result;
}

export function matchTemplate(
  templateBody: string,
  smsText: string,
  options?: CompileOptions,
): ExtractedSms {
  return extractWithCompiled(compileTemplate(templateBody, options), smsText);
}

/**
 * Match a template against text, first requiring the whole message to match
 * (anchored), then falling back to a substring match. The fallback handles
 * notifications and messages that carry an app-name or extra header/footer
 * around the payment text.
 */
export function matchTemplateBest(
  templateBody: string,
  smsText: string,
  options?: CompileOptions,
): ExtractedSms {
  const strict = matchTemplate(templateBody, smsText, { anchor: "both", ...options });
  if (strict.matched) return strict;
  return matchTemplate(templateBody, smsText, { anchor: "none", ...options });
}
