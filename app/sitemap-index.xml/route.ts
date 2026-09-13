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

    // 503, not a fallback index -- see the note in app/sitemap.xml/route.ts.
    // Pointing Google at a sitemap we could not build is worse than admitting
    // we are temporarily unable to answer.
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!-- sitemap index temporarily unavailable -->`,
      {
        status: 503,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "no-store",
          "Retry-After": "600",
        },
      }
    )
  }
}
