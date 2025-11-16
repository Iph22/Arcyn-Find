import { generateSitemapXML } from "@/lib/sitemap"

export const dynamic = "force-dynamic"
export const revalidate = 3600 // Revalidate every hour

export async function GET(
    request: Request,
    { params }: { params: Promise<{ page?: string[] }> }
) {
    try {
        const resolvedParams = await params
        // Extract page number from URL path (e.g., /sitemap-1.xml -> page = 1)
        const url = new URL(request.url)
        const pathMatch = url.pathname.match(/sitemap-(\d+)\.xml$/)
        const pageParam = pathMatch ? pathMatch[1] : resolvedParams.page?.[0]
        const page = pageParam ? parseInt(pageParam, 10) : 0

        if (page === 0 || isNaN(page)) {
            // Redirect page 0 or invalid pages to main sitemap
            return new Response(null, {
                status: 301,
                headers: {
                    Location: "/sitemap.xml",
                },
            })
        }

        const sitemap = await generateSitemapXML(page)

        return new Response(sitemap, {
            headers: {
                "Content-Type": "application/xml; charset=utf-8",
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
            },
        })
    } catch (error) {
        console.error("Error generating sitemap:", error)
        const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
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

