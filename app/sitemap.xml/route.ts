import { generateSitemapXML } from "@/lib/sitemap"

// Allow dynamic generation to fetch from Supabase
export const dynamic = "force-dynamic"
export const revalidate = 3600 // Revalidate every hour

export async function GET(request: Request) {
  try {
    // The page number arrives one of two ways, and the path has to be read as
    // well as the query. `/sitemap-1.xml` is rewritten here by next.config.ts,
    // but a rewrite masks the URL: `request.url` is still what the client
    // asked for, so `?page=` is empty and every file would render page 0 --
    // five identical sitemaps, which is the duplicate-content problem this
    // whole layer was built to fix.
    const url = new URL(request.url)
    const fromPath = url.pathname.match(/sitemap-(\d+)\.xml$/)?.[1]
    const pageParam = url.searchParams.get("page") ?? fromPath
    const parsed = pageParam ? parseInt(pageParam, 10) : 0
    const page = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0

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
