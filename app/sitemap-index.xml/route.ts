import { generateSitemapIndex } from "@/lib/sitemap"

export const dynamic = "force-dynamic"
export const revalidate = 3600 // Revalidate every hour

export async function GET() {
  try {
    const sitemapIndex = await generateSitemapIndex()

    return new Response(sitemapIndex, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    })
  } catch (error) {
    console.error("Error generating sitemap index:", error)
    // Return minimal valid sitemap index on error
    const fallbackIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${process.env.NEXT_PUBLIC_SITE_URL || "https://arcyn-find.vercel.app"}/sitemap.xml</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>
</sitemapindex>`
    
    return new Response(fallbackIndex, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=60",
      },
    })
  }
}

