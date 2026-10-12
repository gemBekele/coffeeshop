import { Prisma } from "@prisma/client";

function isDecimal(value: unknown): value is Prisma.Decimal {
  return Prisma.Decimal.isDecimal(value);
}

/**
 * Recursively convert Prisma.Decimal instances to plain numbers so API
 * responses are JSON-friendly. Dates and other values are left untouched.
 */
export function serializeDecimals<T>(value: T): T {
  if (isDecimal(value)) {
    return value.toNumber() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeDecimals(item)) as unknown as T;
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = serializeDecimals(val);
    }
    return out as T;
  }
  return value;
}
