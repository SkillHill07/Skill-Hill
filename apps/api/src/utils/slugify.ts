/**
 * Generate a URL-safe slug from any string.
 * Lowercase, alphanumeric + hyphens, collapse separators, trim hyphens.
 * Never returns an empty string — all-punctuation input falls back to "x".
 */
export function makeSlug(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
  return slug || "x"
}
