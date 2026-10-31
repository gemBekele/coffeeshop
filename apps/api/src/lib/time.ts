/**
 * Shop-local day boundaries. Payments are "today" for the shop, not for the
 * server: without this, a shop in UTC+3 would see its day flip at 03:00.
 */

function tzOffsetMs(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

export function localDay(
  timeZone: string,
  now: Date = new Date(),
): { start: Date; end: Date; date: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get("year");
  const month = get("month");
  const day = get("day");

  const guess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const start = new Date(guess - tzOffsetMs(timeZone, new Date(guess)));
  // Re-check once in case the guess landed on the wrong side of a DST change.
  const corrected = new Date(guess - tzOffsetMs(timeZone, start));
  const finalStart = corrected;
  const end = new Date(finalStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  return {
    start: finalStart,
    end,
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}
