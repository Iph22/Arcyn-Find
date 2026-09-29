/**
 * Which `ai_tools.image` values are real logos.
 *
 * The column is not nullable in practice: rows whose logo was never fetched
 * carry the SITE'S OWN og-image instead of null, so a naive `src ?? fallback`
 * renders the Arcyn Find banner as the logo of an unrelated product — at
 * avatar size, a dark smear that reads as a broken image, and at card size,
 * every unbranded tool apparently branded Arcyn Find.
 *
 * The rule lived inside components/tools/tool-image.tsx, which renders a
 * large gradient tile. The hero's card stack needs the same question answered
 * at 24px, where that tile is far too loud, so the predicate moved here and
 * both callers share it. Keep it that way: two copies of this list drifting
 * apart is how one surface starts showing placeholders the other filters.
 */

/** Substrings that mark a stored image as a stand-in rather than a logo. */
const PLACEHOLDER_MARKERS = ['og-image', 'placeholder', 'r-synth', 'rsynth']

/** Exact paths that are known stand-ins. */
const PLACEHOLDER_PATHS = ['/og-image.png', '/assets/default.png']

/**
 * True when `src` is missing or is one of the known stand-ins, i.e. when the
 * caller should render its own fallback instead.
 */
export function isPlaceholderImage(src: string | null | undefined): boolean {
  if (!src) return true

  const value = src.trim()
  if (!value) return true
  if (PLACEHOLDER_PATHS.includes(value)) return true

  const lower = value.toLowerCase()
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker))
}
