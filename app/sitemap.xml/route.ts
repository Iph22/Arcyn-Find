import { generateSitemapXML } from "@/lib/sitemap"

export const dynamic = "force-static"

export async function GET() {
  const sitemap = generateSitemapXML()

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
