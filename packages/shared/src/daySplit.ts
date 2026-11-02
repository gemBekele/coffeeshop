/**
 * Day reconciliation used by closing: sales are authoritative, confirmed bank
 * transfers are subtracted, and the remainder is the cash the shop took.
 */
export interface DaySplit {
  sales: number;
  bank: number;
  cash: number;
  /** Bank money received above the recorded sales. */
  surplus: number;
  total: number;
}

const round2 = (n: number): number =>
  Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function splitDayTotals(sales: number, bank: number): DaySplit {
  const s = round2(Math.max(0, sales));
  const b = round2(Math.max(0, bank));
  return {
    sales: s,
    bank: b,
    cash: round2(Math.max(0, s - b)),
    surplus: round2(Math.max(0, b - s)),
    total: s,
  };
}
