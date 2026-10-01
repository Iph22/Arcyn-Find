import type { Metadata } from 'next'

import {
  LandingPage,
  type LandingCategory,
  type LandingStats,
} from '@/components/landing/landing-page'
import { getCatalogStats } from '@/lib/seo/catalog-stats'
import { getCategoriesSafe } from '@/lib/seo/catalog'
import { TESTIMONIALS, testimonialStats } from '@/lib/landing/testimonials'
import { AboutArcyn } from '@/components/landing/about-arcyn'
import { getLandingSearchDemo } from '@/lib/landing/search-demo'
import { siteUrl } from '@/lib/seo/site'
import { SEARCH_PARAM } from '@/lib/tool-href'

/**
 * The homepage.
 *
 * A server component wrapping the (client) landing page, for two reasons:
 *
 *   1. The catalog figures are fetched here and passed down, so they appear in
 *      the server-rendered HTML. Previously the page fetched them on mount,
 *      which meant a crawler saw no number at all — while the meta description
 *      below is what Google actually quoted.
 *   2. A `"use client"` page cannot export `metadata`. The homepage therefore
 *      inherited the root description and had no title or canonical of its
 *      own.
 */

// 24 hours. The landing page states catalogue figures that come from
// catalog_stats_current(), which itself recomputes at most once a day --
// so regenerating hourly re-rendered the same numbers 23 extra times.
export const revalidate = 86400 // 24 hours

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getCatalogStats()
  const canonical = siteUrl()

  // The headline figure goes in the description because that string is what
  // shows up in search results. It is generated from the live count rather
  // than written by hand, so it cannot drift from the site the way "Over
  // 25,000 AI tools" did — a number with no basis in the data, on a directory
  // that could show 2,913.
  const description =
    stats.toolCount > 0
      ? `Search ${stats.toolCount.toLocaleString()} AI tools across ${stats.categories} categories. ` +
        `Compare features, pricing and alternatives, with ${stats.published.toLocaleString()} ` +
        `on an in-depth page of their own and new tools added daily.`
      : 'Discover, compare and master the right AI tools for your problems. ' +
        'Search by category, pricing and use case.'

  return {
    title: {
      absolute: 'Arcyn Find — Search and Compare AI Tools',
    },
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: 'Arcyn Find',
      title: 'Arcyn Find — Search and Compare AI Tools',
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Arcyn Find — Search and Compare AI Tools',
      description,
    },
  }
}

export default async function HomePage() {
  // Both are catalog reads and independent of each other. The search demo is
  // the hero animation's content — real tools for a real query, fetched here
  // for the same reason the figures are: so the page never shows anything the
  // product would not.
  const [stats, searchDemo, allCategories] = await Promise.all([
    getCatalogStats(),
    getLandingSearchDemo(),
    getCategoriesSafe(),
  ])
  const landingStats: LandingStats = stats

  // The hero's category chips.
  //
  // getCategoriesSafe() has already applied MIN_CATEGORY_SIZE, so every slug
  // here resolves to a page that renders -- which is the whole reason this
  // list is built on the server rather than by slugifying names on the
  // client, where "Research & Open Source" -- a real category value with
  // only 11 published tools -- would produce a confident link to a 404.
  // It also degrades to [] rather than throwing, and the hero simply omits
  // the chip row in that case.
  //
  // Ordered by catalog size, largest first, with a name tiebreak so equal
  // categories do not reorder between renders -- the ordering
  // /api/categories already uses. NOT by popularity: docs/ROUTING.md records
  // that there is no engagement signal on this site to rank on.
  const categories: LandingCategory[] = [...allCategories]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 6)
    .map((c) => ({ slug: c.slug, name: c.name, count: c.count }))

  const origin = siteUrl()
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'Arcyn Find',
        url: origin,
        description: 'A searchable directory of AI tools.',
        // The parameter name has to be the one ToolsBrowser actually reads.
        // This advertised `?q=` while the browser reads `?search=`, so a
        // sitelinks searchbox would have landed every visitor on an empty
        // result list. SEARCH_PARAM is the single definition of that name.
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${origin}/browse?${SEARCH_PARAM}={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      // Only asserted when the number is real. Structured data repeating an
      // invented figure is worse than omitting it.
      ...(stats.published > 0
        ? [
            {
              '@type': 'CollectionPage',
              name: 'AI Tools Directory',
              url: `${origin}/tools`,
              mainEntity: {
                '@type': 'ItemList',
                numberOfItems: stats.published,
                name: 'AI tools with public profiles',
              },
            },
          ]
        : []),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <LandingPage
        stats={landingStats}
        searchDemo={searchDemo}
        categories={categories}
        testimonials={TESTIMONIALS}
        testimonialStats={testimonialStats()}
        about={<AboutArcyn />}
      />
    </>
  )
}
