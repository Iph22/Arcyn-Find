import { cache } from 'react'
import { getSupabaseAdmin } from '@/lib/supabase'
import { clampForMeta, isTruncated, normalizeName, slugify, tidyDescription } from './slug'

/**
 * Server-side reads for the public SEO layer.
 *
 * Every query here is shaped by docs/CORPUS_AND_CONSTRAINTS.md §2:
 *   - never `select('*')`  -> that pulls the 768-float `embedding` column
 *   - never `count: 'exact'` on a wide set -> times out
 *   - never a deep `.range()` offset -> timed out at ~87k rows
 *   - PostgREST silently caps a response at 1000 rows, so a 1000 is a
 *     truncation and pagination must be keyset, not offset
 */

/** Explicit column list. Adding `embedding` here would be a multi-MB payload. */
const PAGE_COLUMNS =
  'id, slug, name, category, description, platform, access_type, pricing, tags, popularity, last_updated, image, pricing_model, price_monthly_min_usd, price_monthly_max_usd, has_free_tier, has_free_trial'

/** Rows below this popularity are excluded from the public layer entirely. */
export const PUBLISH_MIN_POPULARITY = 90

/** A category needs this many distinct products before it earns a landing page. */
const MIN_CATEGORY_SIZE = 20

const PAGE_SIZE = 1000

export interface CatalogTool {
  id: string
  slug: string
  name: string
  category: string
  /** Cleaned for display: the raw column is cut mid-word at 200 chars. */
  description: string
  rawDescription: string
  platform: string | null
  accessType: string | null
  pricing: string | null
  tags: string[]
  popularity: number
  lastUpdated: string | null
  image: string | null
  pricingModel: string | null
  priceMonthlyMinUsd: number | null
  priceMonthlyMaxUsd: number | null
  hasFreeTier: boolean | null
  hasFreeTrial: boolean | null
}

type Row = Record<string, unknown>

/** PostgREST returns numeric columns as strings to preserve precision (§2). */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function toTool(row: Row): CatalogTool {
  const rawDescription = String(row.description ?? '')
  return {
    id: String(row.id),
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    category: String(row.category ?? ''),
    description: tidyDescription(rawDescription),
    rawDescription,
    platform: (row.platform as string) ?? null,
    accessType: (row.access_type as string) ?? null,
    pricing: (row.pricing as string) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    popularity: toNumber(row.popularity) ?? 0,
    lastUpdated: (row.last_updated as string) ?? null,
    image: (row.image as string) ?? null,
    pricingModel: (row.pricing_model as string) ?? null,
    priceMonthlyMinUsd: toNumber(row.price_monthly_min_usd),
    priceMonthlyMaxUsd: toNumber(row.price_monthly_max_usd),
    hasFreeTier: (row.has_free_tier as boolean) ?? null,
    hasFreeTrial: (row.has_free_trial as boolean) ?? null,
  }
}

/**
 * Whether a page is good enough to ask Google to index it.
 *
 * The decision (2026-09-12) was to render and link every published tool but to
 * only *index* the ones carrying real content. 90% of descriptions are cut
 * mid-word at the 200-char ingest cap; mass-publishing those as indexable
 * pages is what gets a directory classified as scraped thin content, and that
 * judgement lands on the whole domain rather than the individual page.
 *
 * Pages that fail this still render, still carry internal links, and still get
 * crawled -- they are `noindex, follow`. Enriching a description flips it.
 */
export function isIndexable(tool: CatalogTool): boolean {
  const description = tool.rawDescription.trim()

  // Measured 2026-09-12 over the 2,913 distinct products in the band:
  //
  //   >=120ch + tags + not a stub                    2,704
  //   + >=2 tags + image                             2,701
  //   + >=25 words                                   2,603   <- this gate
  //   + outbound URL                                 2,603
  //
  // Rejecting truncated descriptions was tried first and admitted only 66
  // pages. That gate was measuring the wrong thing: the ingest caps every
  // description at exactly 200 characters, so *nearly every good one* is also
  // truncated. Truncation says nothing about whether the ~70 words before the
  // cut are substantive. What separates a real page from a stub here is word
  // count, tag richness and having something to link to -- and on those the
  // corpus is bimodal, so this gate is not finely balanced on a threshold.
  if (description.length < 120) return false
  if (/^AI tool mentioned in:/i.test(description)) return false
  if (description.split(/\s+/).filter(Boolean).length < 25) return false
  if (tool.tags.length < 2) return false
  if (!tool.image) return false
  // A tool page with nowhere to send the visitor is not a useful result.
  if (!tool.platform) return false
  return true
}

/**
 * One page of published tools, keyed off `id` for keyset pagination.
 *
 * Throws rather than returning `[]` on error, and that is the whole point.
 * Swallowing the error here made a failed query indistinguishable from "there
 * are no tools", and the sitemap then published that emptiness with a 200 and
 * an hour of cache -- which tells Google the site has 8 pages. Observed in
 * production on 2026-09-13, when a crawler hit /sitemap.xml during a
 * `VACUUM ANALYZE` and the query timed out.
 *
 * Callers that can genuinely tolerate missing data catch this explicitly.
 */
async function fetchPublishedPage(afterId: string | null): Promise<CatalogTool[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('ai_tools')
    .select(PAGE_COLUMNS)
    .not('slug', 'is', null)
    .order('id', { ascending: true })
    .limit(PAGE_SIZE)

  if (afterId) query = query.gt('id', afterId)

  const { data, error } = await query
  if (error) {
    throw new Error(`fetchPublishedPage(after=${afterId ?? 'start'}): ${error.message}`)
  }
  return (data ?? []).map((row) => toTool(row as Row))
}

/**
 * Every published tool.
 *
 * Walks with keyset pagination rather than offsets, and stops on a short page
 * -- a full 1000 is PostgREST's cap, not the end of the data.
 *
 * `cache()` memoises this for the lifetime of a single server render, so a
 * page that needs both metadata and body content pays for it once.
 */
export const getPublishedTools = cache(async (): Promise<CatalogTool[]> => {
  const all: CatalogTool[] = []
  let cursor: string | null = null

  // Bounded so a pagination bug cannot spin forever against the database.
  for (let page = 0; page < 40; page++) {
    const batch: CatalogTool[] = await fetchPublishedPage(cursor)
    all.push(...batch)
    if (batch.length < PAGE_SIZE) break
    cursor = batch[batch.length - 1].id
  }

  return all
})

/**
 * Resolve one tool by its public slug.
 *
 * Single equality hit on the partial unique index from
 * `supabase/migrations/add_tool_slugs.sql`. This is the reason the slug is a
 * real column: §2 measured ILIKE on this table at 8.5s-to-timeout, so matching
 * a URL against `name` was never viable.
 */
export const getToolBySlug = cache(async (slug: string): Promise<CatalogTool | null> => {
  if (!slug) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('ai_tools')
    .select(PAGE_COLUMNS)
    .eq('slug', slug)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[seo/catalog] getToolBySlug failed:', error.message)
    return null
  }
  return data ? toTool(data as Row) : null
})

/** Any row by its primary key, published or not. */
export const getToolById = cache(async (id: string): Promise<CatalogTool | null> => {
  if (!id) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('ai_tools')
    .select(PAGE_COLUMNS)
    .eq('id', id)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[seo/catalog] getToolById failed:', error.message)
    return null
  }
  return data ? toTool(data as Row) : null
})

async function getToolByNormalizedName(normalized: string): Promise<CatalogTool | null> {
  if (!normalized) return null
  const all = await getPublishedTools()
  return all.find((tool) => normalizeName(tool.name) === normalized) ?? null
}

export type ToolRoute =
  /** The URL segment is a published slug: render the public page. */
  | { kind: 'published'; tool: CatalogTool }
  /** A legacy id, or a duplicate that lost its slug: 308 to the real URL. */
  | { kind: 'redirect'; slug: string }
  /**
   * A real tool that never earned a public page -- below the popularity band,
   * or a duplicate with no published sibling. The in-app UI links to these by
   * id (`router.push('/tools/' + tool.id)`), so the page must still render.
   * It is served `noindex`: it is a valid destination, not a search result.
   */
  | { kind: 'unpublished'; tool: CatalogTool }
  | null

/**
 * Resolve one `/tools/<segment>` URL.
 *
 * Shared by the page and its `generateMetadata` and memoised with `cache()`,
 * so a request resolves the route once rather than querying twice.
 */
export const resolveToolRoute = cache(async (segment: string): Promise<ToolRoute> => {
  const published = await getToolBySlug(segment)
  if (published) return { kind: 'published', tool: published }

  const byId = await getToolById(segment)
  if (!byId) return null

  // The row itself is published under a different segment.
  if (byId.slug && byId.slug !== segment) return { kind: 'redirect', slug: byId.slug }

  // A duplicate re-ingest whose canonical sibling holds the slug (§1).
  const canonical = await getToolByNormalizedName(normalizeName(byId.name))
  if (canonical) return { kind: 'redirect', slug: canonical.slug }

  return { kind: 'unpublished', tool: byId }
})

export interface CatalogCategory {
  slug: string
  name: string
  count: number
  indexableCount: number
}

/**
 * Categories that are large enough to deserve a landing page.
 *
 * §1 warns the category column is ~2% wrong outright (`Klap`, a video tool,
 * sits under "Code & Development"). Nothing here can fix that -- these pages
 * inherit it. The size floor at least keeps a miscategorised row from being
 * most of a page.
 */
export const getCategories = cache(async (): Promise<CatalogCategory[]> =>
  deriveCategories(await getPublishedTools())
)

/**
 * True while `next build` is prerendering, matching the detection in
 * lib/supabase.ts.
 */
function isBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-export' ||
    process.env.npm_lifecycle_event === 'build'
  )
}

/**
 * Published tools for a page that Next prerenders at build time.
 *
 * Two different failures need two different answers, and conflating them broke
 * CI:
 *
 *   At runtime, a failed read must throw. Returning [] would render an empty
 *   directory and ISR would cache it -- the same mistake that served Google an
 *   8-URL sitemap.
 *
 *   At build time it must not throw. `getSupabaseAdmin()` deliberately hands
 *   back a placeholder client when the env vars are absent, on the stated
 *   assumption that "the build process evaluates modules but doesn't actually
 *   call APIs". That held while /tools was a client component; it stopped
 *   holding when /tools became a server component that reads the database
 *   during prerender. A CI build with no SUPABASE_SERVICE_ROLE_KEY secret then
 *   fails outright.
 *
 * So: degrade during the build, be strict at runtime. The empty prerender is
 * only ever produced by a build that had no database, and the first
 * revalidation replaces it.
 */
async function getPublishedToolsForPrerender(): Promise<CatalogTool[]> {
  try {
    return await getPublishedTools()
  } catch (error) {
    if (!isBuildPhase()) throw error
    console.warn(
      '[seo/catalog] no database during build -- prerendering an empty directory. ' +
        'Set SUPABASE_SERVICE_ROLE_KEY in the build environment to prerender it populated.',
      error
    )
    return []
  }
}

/** Directory page data: tools plus the categories derived from them. */
export async function getDirectoryData(): Promise<{
  tools: CatalogTool[]
  categories: CatalogCategory[]
}> {
  const tools = await getPublishedToolsForPrerender()
  return { tools, categories: deriveCategories(tools) }
}

/**
 * Categories for page chrome (the public footer's link block).
 *
 * Tolerant, for the same reason as `getRelatedTools`: on a tool page the
 * category list is navigation, not content, and losing it is better than
 * losing the page. Pages where the categories *are* the content call
 * `getCategories()` and are allowed to fail.
 */
export async function getCategoriesSafe(): Promise<CatalogCategory[]> {
  try {
    return await getCategories()
  } catch (error) {
    console.error('[seo/catalog] getCategoriesSafe degraded:', error)
    return []
  }
}

/**
 * The pure half of `getCategories`.
 *
 * Callers that already hold the full tool list use this directly rather than
 * calling `getCategories()`, which would depend on `cache()` deduplicating the
 * second walk. Inside a React render it does; the sitemap route should not
 * have to rely on that to avoid a second full pass over ~2,900 rows.
 */
export function deriveCategories(tools: CatalogTool[]): CatalogCategory[] {
  const buckets = new Map<string, { name: string; count: number; indexableCount: number }>()

  for (const tool of tools) {
    if (!tool.category) continue
    const slug = slugify(tool.category)
    if (!slug) continue
    const bucket = buckets.get(slug) ?? { name: tool.category, count: 0, indexableCount: 0 }
    bucket.count += 1
    if (isIndexable(tool)) bucket.indexableCount += 1
    buckets.set(slug, bucket)
  }

  return [...buckets.entries()]
    .filter(([, b]) => b.count >= MIN_CATEGORY_SIZE)
    .map(([slug, b]) => ({ slug, name: b.name, count: b.count, indexableCount: b.indexableCount }))
    .sort((a, b) => b.count - a.count)
}

export const getCategoryBySlug = cache(
  async (slug: string): Promise<{ category: CatalogCategory; tools: CatalogTool[] } | null> => {
    const categories = await getCategories()
    const category = categories.find((c) => c.slug === slug)
    if (!category) return null

    const tools = (await getPublishedTools())
      .filter((tool) => slugify(tool.category) === slug)
      .sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name))

    return { category, tools }
  }
)

/**
 * Other tools a visitor on this page plausibly wants.
 *
 * Deliberately simple and deterministic: same category, then shared tags. This
 * is the main source of genuinely page-specific content on a tool page, and it
 * is what turns ~2,700 orphan pages into a crawlable graph.
 */
export async function getRelatedTools(tool: CatalogTool, limit = 8): Promise<CatalogTool[]> {
  // Deliberately tolerant: related tools enrich a tool page but are not what
  // the visitor came for. A transient database error should cost the section,
  // not the page. The sitemap makes the opposite trade.
  let all: CatalogTool[]
  try {
    all = await getPublishedTools()
  } catch (error) {
    console.error('[seo/catalog] getRelatedTools degraded:', error)
    return []
  }
  const tags = new Set(tool.tags.map((t) => t.toLowerCase()))

  const scored = all
    .filter((candidate) => candidate.slug !== tool.slug)
    .map((candidate) => {
      let score = 0
      if (candidate.category === tool.category) score += 3
      for (const tag of candidate.tags) if (tags.has(tag.toLowerCase())) score += 1
      // Nudge toward tools that will render a useful card.
      if (isIndexable(candidate)) score += 0.5
      return { candidate, score }
    })
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.candidate.popularity - a.candidate.popularity ||
        a.candidate.name.localeCompare(b.candidate.name)
    )

  return scored.slice(0, limit).map((entry) => entry.candidate)
}

export { siteUrl } from './site'
export { clampForMeta, isTruncated, normalizeName, slugify, tidyDescription }
