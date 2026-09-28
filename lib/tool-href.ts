/**
 * Where a tool or category link points.
 *
 * One module because the in-app surfaces (/home, /browse) and the public SEO
 * surfaces (/tools, /tools/category) had drifted into two different answers:
 * the SEO pages linked by slug, while the app linked by id -- or, more often,
 * did not link at all and opened a modal instead. That cost every in-app
 * listing its URL, and cost the tool pages the internal links that make them
 * reachable.
 *
 * Pure and dependency-free so a client component can import it without
 * pulling in the Supabase admin client that lives in lib/seo/catalog.ts.
 */

import { slugify } from './seo/slug'

/** The shape any listing row has, whatever endpoint produced it. */
export interface LinkableTool {
  id: string
  slug?: string | null
}

/**
 * The canonical URL for a tool.
 *
 * Prefers the slug and falls back to the id. Both resolve -- resolveToolRoute()
 * accepts either -- but the id form costs a 308 redirect on every click, so it
 * is the fallback rather than the default. Rows without a slug are the ones
 * below the publish floor, plus anything ingested since the last slug
 * backfill; those render on demand and `noindex`, which is the correct
 * outcome for a real tool that has not earned a public page.
 */
export function toolHref(tool: LinkableTool): string {
  const segment = tool.slug?.trim() || tool.id
  return `/tools/${encodeURIComponent(segment)}`
}

/**
 * The URL for a category page, or null when that category has no page.
 *
 * Category pages exist only above MIN_CATEGORY_SIZE (20 published tools) and
 * `notFound()` below it, so a link cannot be built from a category name alone
 * -- it has to be checked against the categories that actually have pages.
 * Callers pass that set; returning null is the signal to render plain text
 * instead of a link.
 *
 * The category column is also ~2% wrong outright (docs/CORPUS_AND_CONSTRAINTS
 * §1), so a correct-looking link can still land on a page the tool does not
 * belong on. Nothing here can detect that.
 */
export function categoryHref(
  category: string | null | undefined,
  known: ReadonlySet<string>
): string | null {
  const slug = slugify(category || '')
  if (!slug || !known.has(slug)) return null
  return `/tools/category/${slug}`
}

/**
 * The query parameter the tool browser reads.
 *
 * Named once because it was written three ways: /home pushed `?search=` at
 * /tools (which parses no parameters at all), while the homepage's JSON-LD
 * SearchAction advertised `?q=` at /browse. ToolsBrowser reads `search`.
 */
export const SEARCH_PARAM = 'search'

/** The browse URL for a free-text query. */
export function searchHref(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return '/browse'
  return `/browse?${SEARCH_PARAM}=${encodeURIComponent(trimmed)}`
}
