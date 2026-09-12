import { deriveCategories, getPublishedTools, isIndexable, siteUrl } from '@/lib/seo/catalog'

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
    { url: `${baseUrl}/about`, changefreq: 'monthly', priority: '0.6' },
    { url: `${baseUrl}/contact`, changefreq: 'monthly', priority: '0.5' },
    { url: `${baseUrl}/community`, changefreq: 'daily', priority: '0.6' },
    { url: `${baseUrl}/privacy`, changefreq: 'yearly', priority: '0.3' },
    { url: `${baseUrl}/terms`, changefreq: 'yearly', priority: '0.3' },
  ]

  // One walk of the table, categories derived from the same array.
  const tools = await getPublishedTools()
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
