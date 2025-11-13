import { aiEntries } from "@/lib/ai-data"

export function generateSitemapXML() {
  const baseUrl = "https://arcyn-find.com"

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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
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
