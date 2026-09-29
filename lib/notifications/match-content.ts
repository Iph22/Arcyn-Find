import { getSupabaseAdmin } from '@/lib/supabase'
import {
  CATALOG_COLUMNS,
  PUBLISH_MIN_POPULARITY,
  normalizeName,
  rowToCatalogTool,
  type CatalogTool,
} from '@/lib/seo/catalog'
import { categoriesForInterests, type ResolvableCategory } from '@/lib/interest-categories'
import { isDigestWorthy, type DigestTool } from './digest-content'
import { toolHref } from '@/lib/tool-href'

/**
 * Tools matched to one person's stated interests.
 *
 * The weekly digest sends everyone the same six tools, which is the right
 * trade when the content is "what is good right now". This is the other
 * thing: what is good *for you*, which cannot be built once and mailed to
 * everyone.
 *
 * The matching runs through `categoriesForInterests()` rather than using
 * `preferences.categories` directly, and that indirection is the whole point.
 * Onboarding stores abstract tags -- `text`, `vision`, `coding`, `agents`,
 * `automation`, `knowledge`, `research`, `productivity` -- and **none of them
 * is an `ai_tools.category` value** (docs/ROUTING.md). Filtering the catalog
 * on `category IN ('coding','vision')` matches zero rows and returns an empty
 * digest that looks like a quiet week rather than a bug.
 */

/** How many tools one matched email carries. */
export const MATCH_TOOL_COUNT = 5

/**
 * Over-fetch factor per category.
 *
 * `isDigestWorthy` rejects roughly one candidate in nine, and duplicates
 * survive the popularity band, so the pool has to be wider than the target.
 */
const OVERFETCH = 6

export interface MatchedContent {
  tools: DigestTool[]
  /** Category names the tools came from, for the subject line and the body. */
  categoryNames: string[]
  /** True when these are tools added since the reader last heard from us. */
  isNew: boolean
}

function toDigestTool(tool: CatalogTool, siteUrl: string): DigestTool {
  return {
    name: tool.name,
    slug: tool.slug,
    description: tool.description,
    category: tool.category,
    image: tool.image,
    // `toolHref` prefers the slug and falls back to the id. The id form works
    // but costs a 308 on every click (docs/ROUTING.md), and a redirect inside
    // an email is worse than on the site: some clients resolve links ahead of
    // the reader, and every hop is a chance to be rewritten or blocked.
    url: `${siteUrl}${toolHref(tool)}`,
  }
}

function dedupe(tools: CatalogTool[]): CatalogTool[] {
  const seen = new Set<string>()
  return tools.filter((tool) => {
    const key = normalizeName(tool.name)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Candidates from a set of category names.
 *
 * Shaped by docs/CORPUS_AND_CONSTRAINTS.md §2 like every other read here: no
 * `embedding` in the column list, no `count: 'exact'`, no deep `.range()`
 * offsets, and an indexed popularity band rather than a sparse filter combined
 * with `ORDER BY popularity`.
 */
async function fetchForCategories(
  categoryNames: string[],
  since: string | null,
  limit: number
): Promise<CatalogTool[]> {
  if (categoryNames.length === 0) return []

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('ai_tools')
    .select(CATALOG_COLUMNS)
    .in('category', categoryNames)
    .gte('popularity', PUBLISH_MIN_POPULARITY)
    .not('slug', 'is', null)
    .not('image', 'is', null)
    .neq('image', '')

  if (since) query = query.gte('created_at', since)

  const { data, error } = await query
    // Same ordering as the digest, and for the same measured reason:
    // `trending_score` holds only 0 or 20 with no view data behind it, so
    // leading with it ranks whichever rows the refresh job happened to touch.
    // `id` is the tiebreak because popularity saturates at 100 across most of
    // the band and Postgres would otherwise resolve the tie differently run to
    // run.
    .order('popularity', { ascending: false })
    .order('priority', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(limit)

  if (error) {
    // Thrown rather than swallowed. An empty result and a failed query look
    // identical downstream, and the difference is "this reader has nothing new
    // this week" versus "we are silently mailing nobody".
    throw new Error(`matched candidates (${categoryNames.join(', ')}): ${error.message}`)
  }

  return (data ?? []).map((row) => rowToCatalogTool(row as Record<string, unknown>))
}

/**
 * Build the matched selection for one reader.
 *
 * Returns an empty `tools` array when the reader has no usable interests, or
 * when nothing in their categories qualifies. Callers treat that as "do not
 * send", which is deliberate: a personalised email that falls back to generic
 * content is a worse thing to receive than no email, because it teaches the
 * reader that the personalisation is not real.
 */
export async function buildMatchedContent(
  interests: readonly string[] | null | undefined,
  availableCategories: readonly ResolvableCategory[],
  since: string | null,
  siteUrl: string
): Promise<MatchedContent> {
  const categories = categoriesForInterests(interests, availableCategories)
  if (categories.length === 0) {
    return { tools: [], categoryNames: [], isNew: false }
  }

  const names = categories.map((c) => c.name)
  const limit = MATCH_TOOL_COUNT * OVERFETCH

  // Prefer tools added since they last heard from us; fall back to the best in
  // their categories when the week was quiet. Unlike the generic digest this
  // fallback is still personal -- it is their categories either way.
  if (since) {
    const fresh = dedupe(await fetchForCategories(names, since, limit)).filter(isDigestWorthy)
    if (fresh.length >= MATCH_TOOL_COUNT) {
      return {
        tools: fresh.slice(0, MATCH_TOOL_COUNT).map((t) => toDigestTool(t, siteUrl)),
        categoryNames: names,
        isNew: true,
      }
    }
  }

  const best = dedupe(await fetchForCategories(names, null, limit)).filter(isDigestWorthy)
  return {
    tools: best.slice(0, MATCH_TOOL_COUNT).map((t) => toDigestTool(t, siteUrl)),
    categoryNames: names,
    isNew: false,
  }
}
