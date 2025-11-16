import { generateSitemapXML } from "@/lib/sitemap"

// Allow dynamic generation to fetch from Supabase
export const dynamic = "force-dynamic"
export const revalidate = 3600 // Revalidate every hour

export async function GET(request: Request) {
  try {
    // Get page number from query parameter (defaults to 0)
    const url = new URL(request.url)
    const pageParam = url.searchParams.get("page")
    const page = pageParam ? parseInt(pageParam, 10) : 0
    
    const sitemap = await generateSitemapXML(page)

    return new Response(sitemap, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    })
  } catch (error) {
    console.error("Error generating sitemap:", error)
    // Return minimal valid sitemap on error
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${process.env.NEXT_PUBLIC_SITE_URL || "https://arcyn-find.vercel.app"}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`
    
    return new Response(fallbackSitemap, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=60",
      },
    })
  }
}
