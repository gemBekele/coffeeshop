/**
 * Normalize SMS/notification text before matching and building patterns.
 *
 * Two messages from the same bank can differ in invisible ways (non-breaking
 * spaces, smart quotes, extra newlines). Normalizing both sides makes a
 * pattern reliable without loosening the match itself.
 */
export function normalizeSmsText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u00A0\u2007\u202F]/g, " ") // NBSP variants
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
