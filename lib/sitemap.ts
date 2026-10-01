import type { CatalogTool } from '@/lib/seo/catalog'
import { deriveCategories, getPublishedTools, isIndexable, siteUrl } from '@/lib/seo/catalog'
import { isPlaceholderImage } from '@/lib/tool-image'

/**
 * Sitemap generation for the public layer.
 *
 * The previous version had four faults that together made the sitemap worse
 * than useless, all of them predicted by docs/CORPUS_AND_CONSTRAINTS.md:
 *
 *   1. It emitted `/tools?id=<id>` -- a query parameter on a client-rendered
 *      page, so every "tool page" in the sitemap was the same document with
 *      the same title.
 *   2. `select('*')` pulled the 768-float `embedding` column for every row
 *      (§2: "Never SELECT the embedding column to test for null").
 *   3. `.limit(10000)` looked like 10,000 URLs but PostgREST silently caps a
 *      response at 1000 (§2), while the index advertised ~52 sitemaps -- so
 *      51 of them were empty.
 *   4. No deduplication, though 55% of the corpus is duplicate re-ingests (§1).
 *
 * It now walks published rows only (one slug per distinct product, assigned by
 * scripts/seo/backfill-slugs.mjs) and emits real, unique, crawlable paths.
 */

/** Google's hard limit is 50,000; smaller files are faster to fetch and parse. */
const MAX_URLS_PER_SITEMAP = 5000

/**
 * Which tool pages the sitemap asks Google to index.
 *
 * NOT all of them. 5,236 tool pages are indexable and every one still renders,
 * still says `index, follow`, and is still reachable by crawling. This decides
 * the size of the *request*, and it is deliberately far smaller than the
 * catalog.
 *
 * WHY, MEASURED 2026-10-01 FROM SEARCH CONSOLE
 *
 *     Indexed                                 3
 *     Discovered - currently not indexed  2,621
 *     Crawled - currently not indexed         1
 *
 * Google discovered ~2,635 URLs on 2026-09-05 and indexed three of them in the
 * sixteen days to 09-21. "Discovered - currently not indexed" is not a backlog
 * being worked through: it is Google saying it knows these URLs exist and has
 * decided they are not worth crawling. That is a judgement about the domain,
 * not about any page.
 *
 * On 09-23 the publish floor dropped and the sitemap went from 2,598 URLs to
 * 5,265 -- doubling the queue of a crawler already declining to work through
 * the first half. The pages were good; the ask was wrong.
 *
 * A PREDICATE, NOT A COUNT
 *
 * A count cap was tried first and is the wrong instrument. Popularity is a
 * bucket label rather than a score -- 2,765 tools share the value 100 (§1) --
 * and scraped descriptions are nearly all truncated to exactly 200 characters,
 * so neither can order the catalog finely enough to pick "the top 500". Doing
 * it anyway took the alphabetically-first 500 of one bucket and left ChatGPT
 * out.
 *
 * So inclusion is a quality test every member passes for a stated reason:
 * top popularity bucket, and a real logo rather than the site's own og-image
 * standing in for one. 1,518 pages qualify, against 5,236 indexable -- a 3.5x
 * concentration where each page earned its place.
 *
 * TIGHTEN OR WIDEN ON EVIDENCE. If "Indexed" climbs toward this number there
 * is budget to spend and it can widen; if it stays flat, tighten further. Not
 * on the grounds that the catalog grew.
 */
const sitemapWorthy = (tool: CatalogTool): boolean =>
  tool.popularity >= 100 && !isPlaceholderImage(tool.image)

/**
 * How long the CDN may serve a sitemap before regenerating it.
 *
 * MEASURED 2026-09-24, while the project was 217% over its Supabase egress
 * quota (11.93 GB against 5.5 GB) with restriction three days out.
 *
 * Every sitemap response costs one full walk of the published catalog:
 * `collectUrls()` -> `getPublishedTools()` -> 5,877 rows at 726 bytes =
 * **4.1 MB of database egress**, measured against the live table, to produce
 * an 853 KB XML file.
 *
 * Three separate URLs each pay it and each hold their own CDN entry:
 *
 *     /sitemap-index.xml   countSitemapPages() -> collectUrls()
 *     /sitemap.xml         page 0
 *     /sitemap-1.xml       page 1, rewritten to the same route (next.config.ts)
 *
 * At the previous 3600s that was up to 3 walks an hour -- 72 a day, ~295 MB --
 * which accounted for roughly 80% of the project's entire daily egress burn.
 *
 * A sitemap does not need hourly freshness. The ingest adds rows daily at
 * most, `lastmod` is a real per-row date so Google re-crawls individual pages
 * on its own schedule regardless, and a crawler that wants a fresher copy is
 * not served one by us expiring the cache -- it is served one when it asks
 * after the TTL. 24 hours takes this to 3 walks a day, ~12 MB.
 *
 * CAUTION: the routes CANNOT import this for their `revalidate` export. Route
 * segment config is read by Next's static analysis at build time rather than
 * evaluated, so an imported constant fails the build with "Invalid segment
 * configuration export detected". Each route therefore repeats `86400` as a
 * literal and points back here. If you change this number, change those two.
 * (Their `Cache-Control` header is a normal runtime value and does use
 * SITEMAP_CACHE_CONTROL below, which is the directive that actually caches --
 * both routes are `force-dynamic`, so `revalidate` drives nothing.)
 */
export const SITEMAP_MAX_AGE_SECONDS = 86400 // 24 hours

/** `Cache-Control` for every sitemap response. See SITEMAP_MAX_AGE_SECONDS. */
export const SITEMAP_CACHE_CONTROL =
  `public, s-maxage=${SITEMAP_MAX_AGE_SECONDS}, stale-while-revalidate=604800`

interface SitemapUrl {
  url: string
  changefreq: string
  priority: string
  lastmod?: string
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function render(urls: SitemapUrl[]): string {
  if (urls.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>`
  }

  const body = urls
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.url)}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>${entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''}
  </url>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`
}

function isoDate(value: string | null): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString().split('T')[0]
}

/**
 * Every URL the sitemap should contain, in a stable order so that page N of
 * the sitemap holds the same URLs between requests.
 */
async function collectUrls(): Promise<SitemapUrl[]> {
  const baseUrl = siteUrl()

  const staticPages: SitemapUrl[] = [
    { url: `${baseUrl}/`, changefreq: 'daily', priority: '1.0' },
    { url: `${baseUrl}/tools`, changefreq: 'daily', priority: '0.9' },
    { url: `${baseUrl}/tools/category`, changefreq: 'weekly', priority: '0.8' },
    // The bare URLs only. Both pages hold their state in the query string and
    // serve `noindex` the moment there is any, canonicalising back to these --
    // so listing a filtered or assembled variant here would contradict the
    // page's own robots tag. See app/browse/page.tsx.
    { url: `${baseUrl}/browse`, changefreq: 'daily', priority: '0.8' },
    { url: `${baseUrl}/compare`, changefreq: 'weekly', priority: '0.6' },
    // Listed only now that it has something to rank with. It has been
    // `index, follow` all along -- a client component cannot set its own
    // robots tag, so it inherited the root layout's -- while serving 36 words
    // and no heading. Advertising that in a sitemap would have been asking
    // Google to spend crawl budget on an empty page.
    { url: `${baseUrl}/submit`, changefreq: 'monthly', priority: '0.6' },
    { url: `${baseUrl}/about`, changefreq: 'monthly', priority: '0.6' },
    { url: `${baseUrl}/contact`, changefreq: 'monthly', priority: '0.5' },
    { url: `${baseUrl}/community`, changefreq: 'daily', priority: '0.6' },
    { url: `${baseUrl}/privacy`, changefreq: 'yearly', priority: '0.3' },
    { url: `${baseUrl}/terms`, changefreq: 'yearly', priority: '0.3' },
  ]

  // One walk of the table, categories derived from the same array.
  const tools = await getPublishedTools()

  // A successful query that returns nothing is still not a sitemap worth
  // publishing. This site has ~2,900 published tools; zero means the slug
  // backfill has not run, the wrong database is configured, or the walk was
  // cut short -- and emitting the 8 static pages as if they were the whole
  // site asks Google to drop everything else. Refuse, and let the route
  // answer 503 so a crawler retries instead of acting on it.
  if (tools.length === 0) {
    throw new Error(
      'refusing to build a sitemap with 0 published tools: run `npm run seo:slugs` ' +
        'or check SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  const categories = deriveCategories(tools)

  const categoryPages: SitemapUrl[] = categories.map((category) => ({
    url: `${baseUrl}/tools/category/${category.slug}`,
    changefreq: 'weekly',
    priority: '0.8',
  }))

  // Only pages we are actually asking Google to index belong in a sitemap.
  // Listing a `noindex` URL here sends contradictory signals: the sitemap says
  // "please index this", the page says "do not". The rest are still reachable
  // by crawling the directory and category pages.
  const toolPages: SitemapUrl[] = tools
    .filter(isIndexable)
    // The rest keep their pages and their `index, follow`; they are simply not
    // what a crawl-starved budget should be asked to spend itself on.
    .filter(sitemapWorthy)
    .sort((a, b) => b.popularity - a.popularity || a.slug.localeCompare(b.slug))
    .map((tool) => ({
      url: `${baseUrl}/tools/${tool.slug}`,
      changefreq: 'weekly',
      priority: '0.7',
      // A real per-row date. Stamping every URL with today's date, as the
      // previous version did, is a signal Google learns to discount.
      lastmod: isoDate(tool.lastUpdated),
    }))

  return [...staticPages, ...categoryPages, ...toolPages]
}

export async function generateSitemapXML(page = 0): Promise<string> {
  const all = await collectUrls()
  const start = page * MAX_URLS_PER_SITEMAP
  return render(all.slice(start, start + MAX_URLS_PER_SITEMAP))
}

/** How many sitemap files `collectUrls` actually fills. */
export async function countSitemapPages(): Promise<number> {
  const all = await collectUrls()
  return Math.max(1, Math.ceil(all.length / MAX_URLS_PER_SITEMAP))
}

export async function generateSitemapIndex(): Promise<string> {
  const baseUrl = siteUrl()
  const lastmod = new Date().toISOString().split('T')[0]

  // Derived from the URLs that exist, not from a row count. The old version
  // used `count: 'exact'` over ~257k rows -- which §2 measured as timing out --
  // and then advertised one sitemap per 5,000 rows regardless of how many the
  // generator could actually produce.
  let pages = 1
  try {
    pages = await countSitemapPages()
  } catch (error) {
    console.error('[sitemap] falling back to a single sitemap:', error)
  }

  const entries = Array.from({ length: pages }, (_, i) =>
    i === 0 ? `${baseUrl}/sitemap.xml` : `${baseUrl}/sitemap-${i}.xml`
  )

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (loc) => `  <sitemap>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`
  )
  .join('\n')}
</sitemapindex>`
}
