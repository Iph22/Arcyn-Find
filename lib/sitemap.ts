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

export async function generateSitemapXML() {
  const baseUrl = "https://arcyn-find.com"
  const aiEntries = await loadAiEntries()

  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      changefreq: "daily",
      priority: "1.0",
    },
  ]

  // Dynamic AI tool pages
  const aiToolPages = aiEntries.map((ai) => ({
    url: `${baseUrl}?ai=${ai.id}`,
    changefreq: "weekly",
    priority: "0.8",
  }))

  const allPages = [...staticPages, ...aiToolPages]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allPages
  .map(
    (page) => `  <url>
    <loc>${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>`

  return xml
}

export function generateSitemapIndex() {
  const baseUrl = "https://arcyn-find.com"

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-ai-tools.xml</loc>
  </sitemap>
</sitemapindex>`

  return xml
}
