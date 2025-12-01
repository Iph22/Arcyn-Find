import type { AIEntry } from "@/lib/ai-data"
import { getSupabaseAdmin, transformToAIEntry } from '@/lib/supabase'

// Load AI entries from Supabase for sitemap generation
async function loadAiEntries(): Promise<AIEntry[]> {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('ai_tools')
      .select('*')
      .order('popularity', { ascending: false })
      .limit(10000) // Limit for sitemap size

    if (error || !data) {
      console.error('Error loading AI entries from Supabase:', error)
      return []
    }

    return data.map(transformToAIEntry)
  } catch (error) {
    console.error('Error loading AI entries for sitemap:', error)
    return []
  }
}

/**
 * Escape XML special characters to prevent parsing errors
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

// Maximum URLs per sitemap (Google recommends max 50,000, but smaller is better for performance)
const MAX_URLS_PER_SITEMAP = 5000

export async function generateSitemapXML(page: number = 0): Promise<string> {
  // Use consistent base URL (match your actual domain)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://arcynfind.com"
  const aiEntries = await loadAiEntries()

  // Static pages (only include public, indexable pages - exclude user-specific pages)
  const staticPages = page === 0 ? [
    { url: `${baseUrl}/`, changefreq: "daily", priority: "1.0" },
    { url: `${baseUrl}/tools`, changefreq: "daily", priority: "0.9" },
    { url: `${baseUrl}/about`, changefreq: "monthly", priority: "0.7" },
    { url: `${baseUrl}/contact`, changefreq: "monthly", priority: "0.7" },
    { url: `${baseUrl}/community`, changefreq: "daily", priority: "0.8" },
    { url: `${baseUrl}/privacy`, changefreq: "yearly", priority: "0.3" },
    { url: `${baseUrl}/terms`, changefreq: "yearly", priority: "0.3" },
  ] : []

  // Calculate pagination - FIXED LOGIC
  const staticCount = staticPages.length
  let aiStart: number
  let aiEnd: number

  if (page === 0) {
    // First page: include static pages + first batch of AI tools
    aiStart = 0
    aiEnd = Math.min(aiEntries.length, MAX_URLS_PER_SITEMAP - staticCount)
  } else {
    // Subsequent pages: only AI tools, accounting for static pages in page 0
    const aiToolsInFirstPage = MAX_URLS_PER_SITEMAP - staticCount
    aiStart = aiToolsInFirstPage + (page - 1) * MAX_URLS_PER_SITEMAP
    aiEnd = Math.min(aiEntries.length, aiStart + MAX_URLS_PER_SITEMAP)
  }

  const aiToolPages = aiEntries.slice(aiStart, aiEnd).map((ai) => ({
    url: `${baseUrl}/tools?id=${ai.id}`,
    changefreq: "weekly",
    priority: "0.8",
  }))

  const allPages = [...staticPages, ...aiToolPages]
  const lastmod = new Date().toISOString().split('T')[0]

  // Return empty sitemap if no pages
  if (allPages.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`
  }

  // Generate properly formatted XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
      .map(
        (page) => `  <url>
    <loc>${escapeXml(page.url)}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <lastmod>${lastmod}</lastmod>
  </url>`
      )
      .join("\n")}
</urlset>`

  return xml
}

export async function generateSitemapIndex(): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://arcynfind.com"

  // Get count only to avoid loading all entries (faster, less memory)
  try {
    const supabase = getSupabaseAdmin()
    const { count, error } = await supabase
      .from('ai_tools')
      .select('*', { count: 'exact', head: true })
      .limit(1)

    if (error) {
      console.error('Error getting AI tools count:', error)
      // Fallback: return just the main sitemap
      return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap.xml</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>
</sitemapindex>`
    }

    const aiToolsCount = count || 0
    const staticPagesCount = 7
    const totalUrls = staticPagesCount + aiToolsCount
    const sitemapCount = Math.max(1, Math.ceil(totalUrls / MAX_URLS_PER_SITEMAP))

    const sitemaps = []
    for (let i = 0; i < sitemapCount; i++) {
      // Use clean URLs without query parameters for better Google compatibility
      const sitemapUrl = i === 0
        ? `${baseUrl}/sitemap.xml`
        : `${baseUrl}/sitemap-${i}.xml`

      sitemaps.push({
        loc: sitemapUrl,
        lastmod: new Date().toISOString().split('T')[0],
      })
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
        .map(
          (sitemap) => `  <sitemap>
    <loc>${escapeXml(sitemap.loc)}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`
        )
        .join("\n")}
</sitemapindex>`

    return xml
  } catch (error) {
    console.error('Error generating sitemap index:', error)
    // Fallback
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap.xml</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>
</sitemapindex>`
  }
}
