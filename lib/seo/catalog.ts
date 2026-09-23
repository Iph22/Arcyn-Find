import { cache } from 'react'
import { getSupabaseAdmin } from '@/lib/supabase'
import { isPubliclyListable, isSearchEngineSafe } from './content-rating'
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

/**
 * Rows below this popularity are excluded from the public layer entirely.
 * Defined in its own dependency-free module so the standalone scripts that
 * assign and audit slugs can read the same number; re-exported here because
 * this is where callers already import it from.
 */
export { PUBLISH_MIN_POPULARITY } from './publish-policy'

/** A category needs this many distinct products before it earns a landing page. */
const MIN_CATEGORY_SIZE = 20

const PAGE_SIZE = 1000

/**
 * How long a full-catalog read may be reused across requests.
 *
 * React's `cache()` memoises only within a single render. That is the right
 * scope for correctness but the wrong one for cost: every ISR revalidation of
 * every tool page was paying for its own full walk of ~2,929 rows (~3-4MB).
 * This cache is module scope, so it is shared by every request a server
 * instance handles until the TTL expires.
 *
 * Ten minutes is chosen against what actually changes the published set: the
 * ingest cron (daily) and the slug backfill (manual). Ten minutes of staleness
 * on a directory listing is invisible; the egress difference is not.
 */
const CATALOG_TTL_MS = 10 * 60 * 1000

/**
 * Memoise an async loader across requests, with a TTL and single-flight.
 *
 * Single-flight matters more than the TTL here. Without it, N concurrent cold
 * requests each start their own full walk and the cache only helps the ones
 * that arrive after the first finishes -- which is precisely the burst a
 * crawler produces. With it, they share one.
 *
 * A rejected load is not cached: `value` is only assigned on success, so the
 * next caller retries rather than being served a failure for ten minutes.
 * That preserves the "throw, never return []" contract below.
 */
function sharedWithTtl<T>(ttlMs: number, load: () => Promise<T>): () => Promise<T> {
  let cached: { at: number; data: T } | null = null
  let inflight: Promise<T> | null = null

  return () => {
    if (cached && Date.now() - cached.at < ttlMs) return Promise.resolve(cached.data)
    if (inflight) return inflight

    inflight = load()
      .then((data) => {
        cached = { at: Date.now(), data }
        return data
      })
      .finally(() => {
        inflight = null
      })

    return inflight
  }
}

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
export function isIndexable(
  // A structural subset rather than the full CatalogTool, so callers holding
  // raw search-RPC rows can apply the identical gate instead of copying it.
  // Every existing caller passes a whole CatalogTool and is unaffected.
  tool: Pick<CatalogTool, 'name' | 'rawDescription' | 'tags' | 'image' | 'platform'>
): boolean {
  // Content rating first: it is the one criterion here that is not about page
  // quality. Google classifies domains, not pages, so a handful of adult URLs
  // in the sitemap can get the whole site filtered out of default results --
  // which would cost more traffic than every thin page this gate rejects.
  // See lib/seo/content-rating.ts.
  if (!isSearchEngineSafe(tool)) return false

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
 * THIS IS EXPENSIVE: ~2,929 rows over three round trips, roughly 3-4MB. Call
 * it only when you genuinely need every published row -- which, after the
 * egress pass, means the sitemap and nothing else. Everything that used to
 * call it and then reduce the array in JavaScript now asks the database for
 * the reduced answer instead:
 *
 *   getRelatedTools()    two bounded probes (category, tag overlap)
 *   getCategories()      published_category_stats() aggregate
 *   getCategoryBySlug()  one bounded query for that category
 *   getDirectoryData()   categories + a bounded "featured" query
 *
 * Wrapped twice on purpose. `sharedWithTtl` is the one that matters -- it
 * spans requests, so a crawler sweeping the sitemap pays once per instance per
 * TTL. `cache()` still dedupes within a single render, which keeps the
 * behaviour unchanged for anything that calls this more than once per request.
 */
const loadPublishedTools = sharedWithTtl(CATALOG_TTL_MS, async (): Promise<CatalogTool[]> => {
  const all: CatalogTool[] = []
  let cursor: string | null = null

  // Bounded so a pagination bug cannot spin forever against the database.
  for (let page = 0; page < 40; page++) {
    const batch: CatalogTool[] = await fetchPublishedPage(cursor)
    // Drop `prohibited` rows here rather than at each call site. This is the
    // widest read in the layer, so filtering it covers the sitemap and the
    // directory in one place. The cursor still advances on the UNFILTERED
    // batch below -- paginating on the filtered array would skip rows.
    all.push(...batch.filter(isPubliclyListable))
    if (batch.length < PAGE_SIZE) break
    cursor = batch[batch.length - 1].id
  }

  return all
})

export const getPublishedTools = cache(async (): Promise<CatalogTool[]> => loadPublishedTools())

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

/**
 * The published slug for a product name, for resolving a duplicate re-ingest
 * to the row that owns the public page (§1: 55% of the corpus is duplicates).
 *
 * This used to walk the entire published catalog and `.find()` through it --
 * 3-4MB to answer a question about one name, on a path that only runs for
 * legacy `/tools/<opaque-id>` URLs. It is now an indexed equality lookup via
 * find_published_slug_by_name().
 *
 * Falls back to the old walk when the function is missing, so the route still
 * resolves before supabase/migrations/add_seo_catalog_rpcs.sql is applied.
 */
async function findCanonicalSlug(name: string): Promise<string | null> {
  const normalized = normalizeName(name)
  if (!normalized) return null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('find_published_slug_by_name', { p_name: name })

  if (!error) return (data as string | null) || null

  if (!isMissingFunction(error)) {
    console.error('[seo/catalog] find_published_slug_by_name failed:', error.message)
    return null
  }

  console.warn(
    '[seo/catalog] find_published_slug_by_name() is missing -- falling back to a ' +
      'full catalog walk. Apply supabase/migrations/add_seo_catalog_rpcs.sql.'
  )
  const all = await getPublishedTools()
  return all.find((tool) => normalizeName(tool.name) === normalized)?.slug ?? null
}

/** A PostgREST error meaning "that function does not exist on this database". */
function isMissingFunction(error: { message?: string; code?: string }): boolean {
  const message = error?.message ?? ''
  return (
    error?.code === 'PGRST202' ||
    message.includes('Could not find the function') ||
    message.includes('does not exist')
  )
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
  if (published) {
    // `prohibited` resolves to nothing, so the page 404s. Deindexing is not
    // enough for this category: the URL has to stop serving, or it stays
    // reachable from anything that already links to it. Two such pages were
    // live and indexed before this landed.
    return isPubliclyListable(published) ? { kind: 'published', tool: published } : null
  }

  const byId = await getToolById(segment)
  if (!byId) return null
  if (!isPubliclyListable(byId)) return null

  // The row itself is published under a different segment.
  if (byId.slug && byId.slug !== segment) return { kind: 'redirect', slug: byId.slug }

  // A duplicate re-ingest whose canonical sibling holds the slug (§1).
  const canonicalSlug = await findCanonicalSlug(byId.name)
  if (canonicalSlug) return { kind: 'redirect', slug: canonicalSlug }

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
 *
 * Counted in SQL by published_category_stats(). It used to be counted in
 * JavaScript from the full catalog, which meant the footer's category links --
 * present on every public page -- cost a 3-4MB read to produce ~30 names.
 */
interface CategoryIndex {
  categories: CatalogCategory[]
  /**
   * The raw `ai_tools.category` values behind each slug.
   *
   * Usually one, but slugify() is lossy -- "AI & Design" and "AI / Design"
   * both become `ai-design` -- and the page routes on the slug. Keeping the
   * originals is what lets getCategoryBySlug() query for every row the
   * category page claims to list, rather than only the first spelling.
   */
  namesBySlug: Map<string, string[]>
}

const loadCategoryIndex = sharedWithTtl(CATALOG_TTL_MS, async (): Promise<CategoryIndex> => {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('published_category_stats')

  if (error) {
    if (!isMissingFunction(error)) throw new Error(`published_category_stats: ${error.message}`)

    console.warn(
      '[seo/catalog] published_category_stats() is missing -- falling back to a full ' +
        'catalog walk. Apply supabase/migrations/add_seo_catalog_rpcs.sql.'
    )
    const tools = await getPublishedTools()
    const namesBySlug = new Map<string, string[]>()
    for (const tool of tools) {
      if (!tool.category) continue
      const slug = slugify(tool.category)
      if (!slug) continue
      const names = namesBySlug.get(slug) ?? []
      if (!names.includes(tool.category)) names.push(tool.category)
      namesBySlug.set(slug, names)
    }
    return { categories: deriveCategories(tools), namesBySlug }
  }

  type StatRow = { category: string; total_count: number | string; indexable_count: number | string }

  // §2: PostgREST returns numeric columns as strings. count() is bigint, so
  // these arrive as strings and would sort lexicographically if passed through.
  const buckets = new Map<string, CatalogCategory>()
  const namesBySlug = new Map<string, string[]>()

  for (const row of (data ?? []) as StatRow[]) {
    const name = String(row.category ?? '')
    const slug = slugify(name)
    if (!slug) continue

    const names = namesBySlug.get(slug) ?? []
    if (!names.includes(name)) names.push(name)
    namesBySlug.set(slug, names)

    const existing = buckets.get(slug)
    const count = Number(row.total_count) || 0
    const indexableCount = Number(row.indexable_count) || 0

    if (existing) {
      existing.count += count
      existing.indexableCount += indexableCount
    } else {
      buckets.set(slug, { slug, name, count, indexableCount })
    }
  }

  const categories = [...buckets.values()]
    .filter((c) => c.count >= MIN_CATEGORY_SIZE)
    .sort((a, b) => b.count - a.count)

  return { categories, namesBySlug }
})

export const getCategories = cache(
  async (): Promise<CatalogCategory[]> => (await loadCategoryIndex()).categories
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
async function forPrerender<T>(load: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (!isBuildPhase()) throw error
    console.warn(
      '[seo/catalog] no database during build -- prerendering an empty directory. ' +
        'Set SUPABASE_SERVICE_ROLE_KEY in the build environment to prerender it populated.',
      error
    )
    return empty
  }
}

/** Directory page data: tools plus the categories derived from them. */
/**
 * Directory page data: the categories, plus the handful of tools the page
 * actually promotes.
 *
 * /tools renders exactly two things from the catalog -- the category grid, and
 * 24 "popular" cards. It used to get both by reading all ~2,929 published rows
 * and reducing them in JavaScript, which is 3-4MB to render ~30 links and 24
 * cards, once an hour on the ISR revalidate.
 *
 * `featured` replaces the old `tools` array in the return shape deliberately:
 * the page never wanted the whole catalog, and a name that says so stops the
 * full read being reintroduced by someone reaching for `tools` later.
 */
export async function getDirectoryData(): Promise<{
  featured: CatalogTool[]
  categories: CatalogCategory[]
}> {
  const [featured, categories] = await Promise.all([
    forPrerender(() => getFeaturedTools(24), [] as CatalogTool[]),
    forPrerender(async () => (await loadCategoryIndex()).categories, [] as CatalogCategory[]),
  ])
  return { featured, categories }
}

/**
 * The most popular published tools that pass the quality gate.
 *
 * Over-fetches because `isIndexable` is applied in JavaScript -- it reads
 * description word counts and tag richness, which the popularity ordering
 * knows nothing about. Measured pass rate in this band is ~89% (2,603 of
 * 2,929), so 4x the requested count leaves a wide margin without ever
 * approaching the cost of the full walk this replaced.
 */
export async function getFeaturedTools(limit: number): Promise<CatalogTool[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('ai_tools')
    .select(PAGE_COLUMNS)
    .not('slug', 'is', null)
    .order('popularity', { ascending: false })
    .limit(limit * 4)

  if (error) throw new Error(`getFeaturedTools: ${error.message}`)

  return (data ?? [])
    .map((row) => toTool(row as Row))
    .filter(isIndexable)
    .sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name))
    .slice(0, limit)
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

/**
 * How many tools a category page renders.
 *
 * The page used to render every member, which for the largest categories meant
 * several hundred cards -- a large HTML document as well as a large read. With
 * ~2,600 indexable tools across ~30 categories the average category is around
 * 100, so this cap only bites on the few biggest ones.
 *
 * Capping costs some internal links on those pages. That is an acceptable
 * trade because the sitemap lists every indexable tool independently
 * (lib/sitemap.ts), so nothing becomes undiscoverable -- it just loses one
 * path to being found. The heading still reports the true total from
 * `category.count`, which is counted in SQL over the whole category.
 */
const CATEGORY_PAGE_MAX = 300

export const getCategoryBySlug = cache(
  async (slug: string): Promise<{ category: CatalogCategory; tools: CatalogTool[] } | null> => {
    const { categories, namesBySlug } = await loadCategoryIndex()
    const category = categories.find((c) => c.slug === slug)
    if (!category) return null

    // Query by the raw category values rather than re-deriving the slug in
    // SQL: `category` is an indexed plain column
    // (ai_tools_published_category_popularity_idx) and slugify() is not
    // expressible as an index-matching expression.
    const names = namesBySlug.get(slug) ?? [category.name]

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('ai_tools')
      .select(PAGE_COLUMNS)
      .not('slug', 'is', null)
      .in('category', names)
      .order('popularity', { ascending: false })
      .limit(CATEGORY_PAGE_MAX)

    if (error) throw new Error(`getCategoryBySlug(${slug}): ${error.message}`)

    const tools = (data ?? [])
      .map((row) => toTool(row as Row))
      .filter(isPubliclyListable)
      // The DB orders by popularity alone; the name tiebreak is applied here
      // so the page is stable between renders for equal-popularity rows.
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
/**
 * Candidates pulled per probe in getRelatedTools.
 *
 * 60 per probe against an 8-item result leaves room for the popularity
 * ordering to differ from the score ordering.
 *
 * Note this does NOT capture the whole of the old candidate set. The scoring
 * below awards 3 for a category match and 1 per shared tag, but it also awards
 * 0.5 for `isIndexable` *unconditionally* -- so under the previous
 * full-catalog implementation every indexable published tool scored 0.5, clear
 * of the `score > 0` filter. In effect the section was padded with arbitrary
 * popular tools whenever genuine matches ran short. `topUpRelated` below
 * reproduces that, so the rendered page is unchanged.
 */
const RELATED_CANDIDATES = 60

export async function getRelatedTools(tool: CatalogTool, limit = 8): Promise<CatalogTool[]> {
  // Deliberately tolerant: related tools enrich a tool page but are not what
  // the visitor came for. A transient database error should cost the section,
  // not the page. The sitemap makes the opposite trade.
  try {
    const supabase = getSupabaseAdmin()

    // Tag overlap is capped because the array goes into the query string as an
    // `ov.{...}` filter; the corpus carries 9-15 tags per row and the most
    // significant ones come first.
    const probeTags = tool.tags.slice(0, 12)

    const [sameCategory, sharedTags] = await Promise.all([
      tool.category
        ? supabase
            .from('ai_tools')
            .select(PAGE_COLUMNS)
            .not('slug', 'is', null)
            .eq('category', tool.category)
            .order('popularity', { ascending: false })
            .limit(RELATED_CANDIDATES)
        : Promise.resolve({ data: [] as unknown[], error: null }),
      probeTags.length > 0
        ? supabase
            .from('ai_tools')
            .select(PAGE_COLUMNS)
            .not('slug', 'is', null)
            .overlaps('tags', probeTags)
            .order('popularity', { ascending: false })
            .limit(RELATED_CANDIDATES)
        : Promise.resolve({ data: [] as unknown[], error: null }),
    ])

    if (sameCategory.error) throw new Error(sameCategory.error.message)
    if (sharedTags.error) throw new Error(sharedTags.error.message)

    // The two probes overlap heavily -- same-category tools usually share tags
    // too -- so dedupe on id before scoring or a row counts twice.
    const byId = new Map<string, CatalogTool>()
    for (const row of [...(sameCategory.data ?? []), ...(sharedTags.data ?? [])]) {
      const candidate = toTool(row as Row)
      if (candidate.id === tool.id || candidate.slug === tool.slug) continue
      if (!isPubliclyListable(candidate)) continue
      byId.set(candidate.id, candidate)
    }

    const tags = new Set(tool.tags.map((t) => t.toLowerCase()))

    const scored = [...byId.values()]
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

    const related = scored.slice(0, limit).map((entry) => entry.candidate)

    // Genuine matches come first; only a shortfall costs a third query, which
    // for a tool with 9-15 tags in a populated category is rare.
    if (related.length < limit) {
      return topUpRelated(related, tool, limit)
    }

    return related
  } catch (error) {
    console.error('[seo/catalog] getRelatedTools degraded:', error)
    return []
  }
}

/**
 * Pad a short related-tools list with popular indexable tools.
 *
 * This looks arbitrary because it is -- but it is what the previous
 * implementation did (see the note on RELATED_CANDIDATES), and changing what
 * the "alternatives" section renders is a product decision, not an egress one.
 * Reproduced here so this change is purely about how the data is fetched.
 *
 * Worth revisiting separately: a section headed "<tool> alternatives" that
 * falls back to unrelated tools is the kind of padding §6 warns gets a
 * directory classified as thin content. Returning four real alternatives
 * instead of eight padded ones is probably the better page. That is a
 * deliberate call for someone to make, not a side effect of this pass.
 */
async function topUpRelated(
  related: CatalogTool[],
  tool: CatalogTool,
  limit: number
): Promise<CatalogTool[]> {
  try {
    const have = new Set(related.map((t) => t.id))
    have.add(tool.id)

    const filler = await getFeaturedTools(limit * 2)
    for (const candidate of filler) {
      if (related.length >= limit) break
      if (have.has(candidate.id) || candidate.slug === tool.slug) continue
      have.add(candidate.id)
      related.push(candidate)
    }
  } catch (error) {
    // A short list is a fine outcome; this is padding, not content.
    console.error('[seo/catalog] topUpRelated degraded:', error)
  }

  return related
}

export { siteUrl } from './site'
export { clampForMeta, isTruncated, normalizeName, slugify, tidyDescription }

/**
 * Re-exported for the notification digest, which needs the same row shape and
 * the same quality gate but not the same access pattern: `getPublishedTools()`
 * walks the entire published set, and the digest cron runs a narrow query
 * inside a 60s budget it shares with sending. Shared so the numeric-string
 * coercion in `toTool` (§2) has exactly one implementation.
 */
export { PAGE_COLUMNS as CATALOG_COLUMNS, toTool as rowToCatalogTool }
