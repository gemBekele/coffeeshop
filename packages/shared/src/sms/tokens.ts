/**
 * Field tokens that owners can embed in an SMS template.
 *
 * A token looks like `{amount}` in the template body. The compiler replaces it
 * with a named capture group built from `pattern` below, then normalizes the
 * captured value.
 */

export type FieldName =
  | "amount"
  | "balance"
  | "txnId"
  | "referenceTxnId"
  | "sender"
  | "senderName"
  | "senderPhone"
  | "currency"
  | "date"
  | "account"
  | "direction";

export type FieldGroup =
  | "money"
  | "id"
  | "text"
  | "phone"
  | "date"
  | "currency"
  | "direction";

export interface FieldTokenDef {
  name: FieldName;
  label: string;
  description: string;
  group: FieldGroup;
  /** Regex source fragment (must not contain capturing groups). */
  pattern: string;
  required?: boolean;
}

export const FIELD_TOKENS: Record<FieldName, FieldTokenDef> = {
  amount: {
    name: "amount",
    label: "Amount",
    description: "Transaction amount, e.g. the money received.",
    group: "money",
    pattern: "[0-9][0-9,]*(?:\\.[0-9]{1,2})?",
    required: true,
  },
  balance: {
    name: "balance",
    label: "Balance",
    description: "Account balance after the transaction.",
    group: "money",
    pattern: "[0-9][0-9,]*(?:\\.[0-9]{1,2})?",
  },
  txnId: {
    name: "txnId",
    label: "Transaction ID",
    description: "Unique reference for the transaction.",
    group: "id",
    pattern: "[A-Za-z0-9][A-Za-z0-9\\-_.\\/]{3,}",
  },
  referenceTxnId: {
    name: "referenceTxnId",
    label: "Reference ID",
    description: "Secondary / bank reference number, when present.",
    group: "id",
    pattern: "[A-Za-z0-9][A-Za-z0-9\\-_.\\/]{3,}",
  },
  sender: {
    name: "sender",
    label: "Sender",
    description: "Payer name and/or number as they appear.",
    group: "text",
    pattern: "[^\\r\\n]+?",
  },
  senderName: {
    name: "senderName",
    label: "Sender name",
    description: "Name of the payer.",
    group: "text",
    pattern: "[A-Za-z][A-Za-z .'\\-]+",
  },
  senderPhone: {
    name: "senderPhone",
    label: "Sender phone",
    description: "Phone number of the payer.",
    group: "phone",
    pattern: "\\+?[0-9][0-9\\s\\-*]{6,}[0-9]",
  },
  currency: {
    name: "currency",
    label: "Currency",
    description: "ISO currency code, e.g. ETB, KES.",
    group: "currency",
    pattern: "[A-Za-z]{3}",
  },
  date: {
    name: "date",
    label: "Date",
    description: "Transaction date/time.",
    group: "date",
    pattern:
      "[0-9]{1,4}[-/][0-9]{1,2}[-/][0-9]{1,4}(?:[ T][0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)?",
  },
  account: {
    name: "account",
    label: "Account",
    description: "Account or wallet number.",
    group: "id",
    pattern: "[A-Za-z0-9*]{4,}",
  },
  direction: {
    name: "direction",
    label: "Direction word",
    description: "The word indicating credit or debit, e.g. received/sent.",
    group: "direction",
    pattern:
      "(?:credit|credited|debit|debited|received|receive|received from|sent|deposit|deposited|withdraw|withdrawn|paid|payment)",
  },
};

export const FIELD_NAMES = Object.keys(FIELD_TOKENS) as FieldName[];

export function isFieldName(value: string): value is FieldName {
  return Object.prototype.hasOwnProperty.call(FIELD_TOKENS, value);
}

export const REQUIRED_FIELDS: FieldName[] = FIELD_NAMES.filter(
  (name) => FIELD_TOKENS[name].required,
);
