/**
 * Where a tool or category link points.
 *
 * One module because the in-app surfaces (/home, /discover) and the public SEO
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
 * A category's own page: `/tools/category/<slug>`.
 *
 * This is where a category link goes, from anywhere -- the home page's
 * shortcuts, a trending row's category label, the footer, a tool page. A
 * category is a destination with a curated list, so naming one should land on
 * it.
 *
 * Note the distinction from `/tools/category` with no slug, which is the index
 * of every category. Landing there after clicking a specific category is the
 * bug this replaced, and the two URLs are one path segment apart.
 *
 * Free-text search goes somewhere else -- see searchHref(). A query needs
 * filtering and refining, so it belongs in the browser; a category does not.
 *
 * Returns null when the category is below MIN_CATEGORY_SIZE and therefore has
 * no page, which is the caller's signal to render plain text instead of a
 * link. Callers pass the published set, usually from GET /api/categories.
 *
 * The category column is ~2% wrong outright (docs/CORPUS_AND_CONSTRAINTS §1),
 * so a correct-looking link can still land on a page the tool does not belong
 * on. Nothing here can detect that.
 */
export function categoryPageHref(
  category: string | null | undefined,
  known: ReadonlySet<string>
): string | null {
  const slug = slugify(category || '')
  if (!slug || !known.has(slug)) return null
  return categoryPageSlugHref(slug)
}

/** The same, for a slug already known to be published. */
export function categoryPageSlugHref(slug: string): string {
  return `/tools/category/${encodeURIComponent(slug)}`
}

/**
 * The tool browser, pre-filtered to a category.
 *
 * Nothing links here today -- category links go to the category's own page
 * above. It is kept because `/discover` is an application surface whose state
 * lives in its query string (see the comment on app/discover/page.tsx), so the
 * filter has to be expressible as a URL for that state to be shareable at all,
 * and ToolsBrowser reads the parameter either way.
 */
export function browseCategorySlugHref(slug: string): string {
  return `/discover?category=${encodeURIComponent(slug)}`
}

/**
 * The query parameter the tool browser reads.
 *
 * Named once because it was written three ways: /home pushed `?search=` at
 * /tools (which parses no parameters at all), while the homepage's JSON-LD
 * SearchAction advertised `?q=` at /discover. ToolsBrowser reads `search`.
 */
export const SEARCH_PARAM = 'search'

/** The browse URL for a free-text query. */
export function searchHref(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return '/discover'
  return `/discover?${SEARCH_PARAM}=${encodeURIComponent(trimmed)}`
}
