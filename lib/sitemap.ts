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

export async function generateSitemapXML() {
  // Use consistent base URL (match your actual domain)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://arcyn-find.vercel.app"
  const aiEntries = await loadAiEntries()

  // Static pages - include all important pages
  const staticPages = [
    { url: `${baseUrl}/`, changefreq: "daily", priority: "1.0" },
    { url: `${baseUrl}/about`, changefreq: "monthly", priority: "0.8" },
    { url: `${baseUrl}/ai-tools`, changefreq: "daily", priority: "0.9" },
    { url: `${baseUrl}/compare`, changefreq: "weekly", priority: "0.7" },
    { url: `${baseUrl}/welcome`, changefreq: "monthly", priority: "0.5" },
    { url: `${baseUrl}/privacy`, changefreq: "yearly", priority: "0.3" },
    { url: `${baseUrl}/terms`, changefreq: "yearly", priority: "0.3" },
  ]

  // Dynamic AI tool pages - use correct URL format /ai/[id]
  const aiToolPages = aiEntries.map((ai) => ({
    url: `${baseUrl}/ai/${ai.id}`,
    changefreq: "weekly",
    priority: "0.8",
  }))

  const allPages = [...staticPages, ...aiToolPages]
  const lastmod = new Date().toISOString().split('T')[0]

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

export function generateSitemapIndex() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://arcyn-find.vercel.app"

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap.xml</loc>
  </sitemap>
</sitemapindex>`

  return xml
}
