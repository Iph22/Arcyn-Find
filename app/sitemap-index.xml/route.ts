import { generateSitemapIndex, SITEMAP_CACHE_CONTROL } from "@/lib/sitemap"

export const dynamic = "force-dynamic"

// 24 hours (86400). This route is the worst value of the three:
// countSitemapPages() walks the entire published catalog (4.1 MB) purely to
// divide a length by 5,000 and emit two <loc> lines. Same TTL as the files it
// advertises, so the index can never promise a page count the sitemaps have
// stopped agreeing to.
//
// A literal, not the shared constant -- see the note in app/sitemap.xml.
export const revalidate = 86400

export async function GET() {
  try {
    const sitemapIndex = await generateSitemapIndex()

    return new Response(sitemapIndex, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": SITEMAP_CACHE_CONTROL,
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
