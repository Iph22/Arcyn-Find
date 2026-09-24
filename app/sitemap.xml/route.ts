import { generateSitemapXML, SITEMAP_CACHE_CONTROL } from "@/lib/sitemap"

// Allow dynamic generation to fetch from Supabase
export const dynamic = "force-dynamic"

// 24 hours (86400), not 1 hour. Each response costs a 4.1 MB full catalog
// walk -- see the measurement on SITEMAP_MAX_AGE_SECONDS in lib/sitemap.ts.
//
// Written as a literal on purpose. Route segment config exports are read by
// Next's static analysis at build time, not evaluated, so importing the shared
// constant here fails the build outright:
//
//     ⨯ Invalid segment configuration export detected
//
// Keep this number in step with SITEMAP_MAX_AGE_SECONDS by hand. The operative
// value is the CDN s-maxage in the response below anyway -- `force-dynamic`
// means this export does not drive ISR.
export const revalidate = 86400

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
        "Cache-Control": SITEMAP_CACHE_CONTROL,
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
