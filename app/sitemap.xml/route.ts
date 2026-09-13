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

    // Deliberately a 503 with no cache, not a minimal 200 sitemap.
    //
    // This used to answer failures with a valid-looking sitemap containing
    // only the static pages. Google reads that as "the site has 8 pages" and
    // starts dropping everything else -- and Vercel cached the lie for an
    // hour. It happened on 2026-09-13, when a crawler hit this route during a
    // VACUUM ANALYZE and the query timed out.
    //
    // A 5xx makes a crawler retry later and change nothing in the meantime,
    // which is the correct behaviour when we genuinely do not know the answer.
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!-- sitemap temporarily unavailable -->`,
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
