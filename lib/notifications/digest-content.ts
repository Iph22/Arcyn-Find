import { getSupabaseAdmin } from '@/lib/supabase'
import {
  CATALOG_COLUMNS,
  PUBLISH_MIN_POPULARITY,
  normalizeName,
  rowToCatalogTool,
  type CatalogTool,
} from '@/lib/seo/catalog'

/**
 * What goes in the digest.
 *
 * Shaped by docs/CORPUS_AND_CONSTRAINTS.md throughout -- this table punishes
 * the obvious query. In particular:
 *
 *   §1  55% of rows are duplicate re-ingests. Without deduplication a digest
 *       would happily recommend tensorflow six times.
 *   §2  Never select `embedding`; no `count: 'exact'`; no deep `.range()`
 *       offsets; a 1000-row response is PostgREST truncating, not an answer.
 *   §6  The publishable band is `popularity >= 90` (~2,900 rows). Below it
 *       there is no public page to link to, so a digest entry would be a
 *       dead end.
 *   §7  `is_trending` is true for ~25% of the catalog and carries no signal.
 *       `trending_score` does not carry one yet either -- see the ordering
 *       comment in `fetchCandidates`, which measured it.
 *
 * Everything the digest links to must survive `isDigestWorthy` below, which is
 * a different bar from the SEO layer's `isIndexable` and deliberately so.
 */

/** How many tools a single digest features. */
export const DIGEST_TOOL_COUNT = 6

/**
 * Over-fetch factor for deduplication headroom.
 *
 * §6.1 measured only 16 duplicates among the 2,913 products in the publishable
 * band, so deduplication alone would need almost no headroom. `isDigestWorthy`
 * is what actually needs it: measured 2026-09-17 it admits 266 of the top 300,
 * but the rejects are not evenly spread and the ones it drops cluster near the
 * top of the ordering. 8x keeps a full digest comfortably reachable.
 */
const OVERFETCH = 8

/**
 * Repo hosts. A row whose outbound link points at one is a codebase, not a
 * product someone can sign up for.
 */
const REPO_HOST = /github\.com|gitlab\.com|huggingface\.co/i

/**
 * Whether a tool belongs in an email.
 *
 * Deliberately **not** `isIndexable` from the SEO layer, and the difference is
 * the point. That gate asks "does this page carry enough text that Google will
 * not call it thin content", so it demands >=120 characters and >=25 words.
 * Measured against the top 300 of the publishable band on 2026-09-17, that is
 * close to inverted for this purpose:
 *
 *   Cursor              107 chars, 15 words  -> rejected
 *   Notion AI            83 chars, 11 words  -> rejected
 *   Replit Ghostwriter   84 chars, 10 words  -> rejected
 *   mcp-n8n-workflow-builder                 -> admitted
 *
 * 167 of those 300 failed on description length alone, and what survived was
 * disproportionately scraped GitHub READMEs -- long, and exactly the
 * developer-repo noise `/api/tools/trending` documents as unpresentable. A
 * curated product with one crisp sentence is a *good* digest entry and a
 * marginal SEO page; the two gates are measuring different things and should
 * not be shared.
 *
 * So: a readable sentence, real tags, an image, somewhere to click, and not a
 * repo. Measured yield 266 of 300, leading with Cursor, Replit Ghostwriter,
 * SurferSEO, Notion AI, Leonardo.ai -- which is the same character of result
 * the trending route was measured to produce.
 */
export function isDigestWorthy(tool: CatalogTool): boolean {
  const description = tool.rawDescription.trim()

  // Enough for one readable line in an email, without demanding the essay that
  // only scraped READMEs satisfy.
  if (description.length < 40) return false
  if (/^AI tool mentioned in:/i.test(description)) return false
  if (tool.tags.length < 2) return false
  // §7: the single highest-leverage quality filter on this corpus.
  if (!tool.image) return false
  // Nowhere to send the reader is not a recommendation.
  if (!tool.platform) return false
  if (REPO_HOST.test(tool.platform)) return false
  return true
}

export interface DigestTool {
  name: string
  slug: string
  description: string
  category: string
  image: string | null
  url: string
}

export interface DigestContent {
  tools: DigestTool[]
  /** True when the selection is "new since you last heard from us". */
  isNew: boolean
}

function toDigestTool(tool: CatalogTool, siteUrl: string): DigestTool {
  return {
    name: tool.name,
    slug: tool.slug,
    description: tool.description,
    category: tool.category,
    image: tool.image,
    url: `${siteUrl}/tools/${tool.slug}`,
  }
}

/** At most this many tools from any one category in a single digest. */
const MAX_PER_CATEGORY = 2

/**
 * Spread the selection across categories.
 *
 * Ranking by popularity alone clusters hard: the first measured run returned
 * Cursor, Replit Ghostwriter, SurferSEO, MarketMuse, Notion AI, Mem AI -- three
 * writing tools and two code editors, which reads as a narrower product than
 * the catalog actually is.
 *
 * Order within the result is preserved, so the strongest tool still leads. The
 * cap is relaxed rather than enforced if it would leave the digest short: a
 * full digest of six matters more than a perfectly even one, and §1's
 * miscategorisation (~2% of rows contradict their own category outright) means
 * this is a presentation heuristic, not a guarantee worth starving the email
 * over.
 */
function spreadByCategory(tools: CatalogTool[], wanted: number): CatalogTool[] {
  const counts = new Map<string, number>()
  const picked: CatalogTool[] = []
  const overflow: CatalogTool[] = []

  for (const tool of tools) {
    const key = (tool.category || 'uncategorised').toLowerCase()
    const seen = counts.get(key) ?? 0
    if (seen < MAX_PER_CATEGORY && picked.length < wanted) {
      counts.set(key, seen + 1)
      picked.push(tool)
    } else {
      overflow.push(tool)
    }
  }

  // Top up from what the cap displaced, keeping rank order.
  for (const tool of overflow) {
    if (picked.length >= wanted) break
    picked.push(tool)
  }

  return picked
}

/**
 * Collapse duplicate products, keeping the highest-ranked of each.
 *
 * Same normalisation the search RPC and `/api/tools/trending` use, via the
 * shared `normalizeName` -- three different spellings of this would drift.
 */
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
 * One page of digest candidates.
 *
 * `since` restricts to rows created after the caller's watermark. Note this is
 * an indexed band filter plus an equality-ish range on `created_at`, never a
 * sparse filter combined with `ORDER BY popularity` -- §2 records that shape
 * degrading from 5.2s to a timeout as the matching set thinned out.
 */
async function fetchCandidates(since: string | null, limit: number): Promise<CatalogTool[]> {
  const supabase = getSupabaseAdmin()

  let query = supabase
    .from('ai_tools')
    .select(CATALOG_COLUMNS)
    .gte('popularity', PUBLISH_MIN_POPULARITY)
    .not('slug', 'is', null)
    // Pushed into SQL because `isDigestWorthy` requires it anyway, and filtering
    // here keeps the over-fetch from being spent on rows that cannot qualify.
    // Note this does *not* exclude repo rows on its own -- measured, 33 of the
    // top 300 were repo-hosted and all had images -- so the gate still has to
    // check the outbound host.
    .not('image', 'is', null)
    .neq('image', '')

  if (since) query = query.gte('created_at', since)

  const { data, error } = await query
    // Ordering measured 2026-09-17, and it is not the one §7 suggests.
    //
    // "Rank on trending_score" assumes that column carries engagement. It does
    // not yet: measured across the publishable band it holds exactly two
    // values, 0 and 20, with view_count_7d = 0 everywhere. 20 is
    // `popularity * 0.2` for a row at popularity 100 -- so the column currently
    // encodes "did refresh_trending_stats touch this row", not "is this
    // trending". Leading with it ranked a stray test row named `Tetst` and a
    // row named `Elephant` above Cursor.
    //
    // So: popularity, then `priority`, which is the curation signal the
    // trending route was measured on (Cursor 100, Replit Ghostwriter 95,
    // default 50). Then `id`, because popularity saturates -- 46 of the top 48
    // rows sit at popularity 100 / priority 50, and without an explicit
    // tiebreak Postgres resolves that tie however it likes. §3 records
    // retrieval that returned six disjoint result sets for six identical calls;
    // an unstable digest would be the same bug, and it would make this
    // impossible to test.
    //
    // Revisit when view data is real: at that point trending_score leads.
    .order('popularity', { ascending: false })
    .order('priority', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(limit)

  if (error) {
    // Thrown, not swallowed. `lib/seo/catalog.ts` records what swallowing cost
    // last time: a failed query became indistinguishable from "no tools" and
    // the sitemap published that emptiness with a 200. Here it would mean
    // mailing everyone an empty digest, which is worse than mailing nobody.
    throw new Error(`digest candidates (since=${since ?? 'any'}): ${error.message}`)
  }

  return (data ?? []).map((row) => rowToCatalogTool(row as Record<string, unknown>))
}

/**
 * Build the digest payload.
 *
 * Prefers tools added since `since`, and falls back to the best of the whole
 * publishable band when there are not enough new ones. The fallback is the
 * point: a directory that only ingests a handful of qualifying tools some
 * weeks would otherwise send a near-empty email or, worse, skip silently and
 * look broken.
 *
 * Returns fewer than `DIGEST_TOOL_COUNT` only if the catalog genuinely cannot
 * fill it; callers treat an empty result as "do not send".
 */
export async function buildDigestContent(
  since: string | null,
  siteUrl: string
): Promise<DigestContent> {
  const wanted = DIGEST_TOOL_COUNT
  const limit = wanted * OVERFETCH

  if (since) {
    const fresh = dedupe(await fetchCandidates(since, limit)).filter(isDigestWorthy)
    if (fresh.length >= wanted) {
      return {
        tools: spreadByCategory(fresh, wanted).map((t) => toDigestTool(t, siteUrl)),
        isNew: true,
      }
    }
  }

  const best = dedupe(await fetchCandidates(null, limit)).filter(isDigestWorthy)
  return {
    tools: spreadByCategory(best, wanted).map((t) => toDigestTool(t, siteUrl)),
    isNew: false,
  }
}
