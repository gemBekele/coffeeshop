/**
 * Helpers for matching an OCR scan of a payer's screen against the payments
 * the shop received by SMS. OCR routinely confuses visually similar glyphs, so
 * values are normalized before an approximate comparison.
 */

export function normalizeTxn(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/G/g, "6")
    .replace(/Z/g, "2");
}

export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

export function txnMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = normalizeTxn(a);
  const nb = normalizeTxn(b);
  if (na.length < 4 || nb.length < 4) return na === nb;
  if (na === nb) return true;
  return Math.abs(na.length - nb.length) <= 1 && editDistance(na, nb) <= 1;
}

export function amountsMatch(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) < 0.01;
}
