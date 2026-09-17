/**
 * Slug and normalisation helpers for the public SEO layer.
 *
 * Kept dependency-free and pure so the backfill script, the sitemap and the
 * page components all derive identical strings. If these ever diverge, URLs in
 * the sitemap stop resolving.
 */

/**
 * Normalised product identity.
 *
 * docs/CORPUS_AND_CONSTRAINTS.md §1: 55% of the corpus is duplicate re-ingests
 * of the same product, and `search_tools_advanced` hides that at query time
 * with `DISTINCT ON (normalized name)`. Anything that walks the table directly
 * -- sitemaps, page generation -- sees all of them, so it has to dedupe the
 * same way or it publishes the same product 356 times.
 */
export function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** URL segment for a tool or category name. */
export function slugify(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

/**
 * Descriptions are scraped and hard-capped at exactly 200 characters, cut
 * mid-word (measured: 946 of 1000 sampled rows in the popularity>=90 band are
 * exactly 200 chars). Rendering that raw puts "...a solo projec" in a meta
 * description, so trim back to the last clean boundary.
 */
export function tidyDescription(description: string | null | undefined): string {
  const text = (description || '').trim().replace(/\s+/g, ' ')
  if (!text) return ''

  // Already ends on a sentence or clause boundary: nothing to do.
  if (/[.!?]$/.test(text)) return text

  const lastStop = Math.max(
    text.lastIndexOf('. '),
    text.lastIndexOf('! '),
    text.lastIndexOf('? ')
  )
  // Prefer cutting at the last complete sentence, but only if that keeps
  // enough of the text to still be a description.
  if (lastStop > 80) return text.slice(0, lastStop + 1)

  // Otherwise drop the partial final word and mark the truncation honestly.
  const lastSpace = text.lastIndexOf(' ')
  const trimmed = lastSpace > 40 ? text.slice(0, lastSpace) : text
  return trimmed.replace(/[,;:\-–—]$/, '') + '…'
}

/** True when the scraped description was cut off by the 200-char ingest cap. */
export function isTruncated(description: string | null | undefined): boolean {
  const text = (description || '').trim()
  return text.length >= 150 && !/[.!?]$/.test(text)
}

/** Clamp to a meta-description-safe length without cutting a word in half. */
export function clampForMeta(text: string, max = 155): string {
  const clean = (text || '').trim().replace(/\s+/g, ' ')
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:-]$/, '') + '…'
}
