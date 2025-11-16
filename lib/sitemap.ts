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
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://arcyn-find.vercel.app"
  const aiEntries = await loadAiEntries()

  // Static pages (only include in first page)
  const staticPages = page === 0 ? [
    { url: `${baseUrl}/`, changefreq: "daily", priority: "1.0" },
    { url: `${baseUrl}/about`, changefreq: "monthly", priority: "0.8" },
    { url: `${baseUrl}/ai-tools`, changefreq: "daily", priority: "0.9" },
    { url: `${baseUrl}/compare`, changefreq: "weekly", priority: "0.7" },
    { url: `${baseUrl}/welcome`, changefreq: "monthly", priority: "0.5" },
    { url: `${baseUrl}/privacy`, changefreq: "yearly", priority: "0.3" },
    { url: `${baseUrl}/terms`, changefreq: "yearly", priority: "0.3" },
  ] : []

  // Calculate pagination
  const staticCount = staticPages.length
  const aiStart = Math.max(0, page * MAX_URLS_PER_SITEMAP - staticCount)
  const aiEnd = Math.min(aiEntries.length, (page + 1) * MAX_URLS_PER_SITEMAP - staticCount)
  const aiToolPages = aiEntries.slice(aiStart, aiEnd).map((ai) => ({
    url: `${baseUrl}/ai/${ai.id}`,
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
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://arcyn-find.vercel.app"
  const aiEntries = await loadAiEntries()

  // Calculate how many sitemaps we need
  const staticPagesCount = 7
  const totalUrls = staticPagesCount + aiEntries.length
  const sitemapCount = Math.ceil(totalUrls / MAX_URLS_PER_SITEMAP)

  const sitemaps = []
  for (let i = 0; i < sitemapCount; i++) {
    sitemaps.push({
      loc: `${baseUrl}/sitemap.xml${i === 0 ? '' : `?page=${i}`}`,
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
}
