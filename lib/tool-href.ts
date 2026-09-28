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
 * Open a category inside the app's tool browser, filtered and ready to refine.
 *
 * NOT `/tools/category/<slug>`. That page is the SEO surface: a static,
 * hourly-revalidated list built for a crawler, with no filters, no sort and no
 * search box. Sending a signed-in user there from an in-app tile drops them
 * out of the product and into a dead end -- they wanted to browse that
 * category, and the page they land on cannot browse.
 *
 * This costs nothing in search terms. /home is `noindex, nofollow`, so its
 * links were never passing crawl value; the SEO category pages are reached
 * from /tools, the footer and individual tool pages, which are untouched.
 *
 * Returns null when the category has no page-worthy size. Category identity is
 * still checked against the published set, because a category too small to
 * have an SEO page is also too small to be worth a tile -- and the caller
 * needs a signal to render plain text instead of a link.
 *
 * The category column is ~2% wrong outright (docs/CORPUS_AND_CONSTRAINTS §1),
 * so a correct-looking link can still open a filter the tool does not belong
 * in. Nothing here can detect that.
 */
export function browseCategoryHref(
  category: string | null | undefined,
  known: ReadonlySet<string>
): string | null {
  const slug = slugify(category || '')
  if (!slug || !known.has(slug)) return null
  return `/browse?category=${encodeURIComponent(slug)}`
}

/** The in-app browser URL for a category slug that is already known good. */
export function browseCategorySlugHref(slug: string): string {
  return `/browse?category=${encodeURIComponent(slug)}`
}

/** The public, crawlable category page. Used by the SEO surfaces only. */
export function seoCategoryHref(slug: string): string {
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
