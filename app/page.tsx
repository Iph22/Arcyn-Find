import type { Metadata } from 'next'

import { LandingPage, type LandingStats } from '@/components/landing/landing-page'
import { getCatalogStats } from '@/lib/seo/catalog-stats'
import { getLandingSearchDemo } from '@/lib/landing/search-demo'
import { siteUrl } from '@/lib/seo/site'

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

export const revalidate = 3600 // 1 hour

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
        `full profiles and new tools added daily.`
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
  const [stats, searchDemo] = await Promise.all([getCatalogStats(), getLandingSearchDemo()])
  const landingStats: LandingStats = stats

  const origin = siteUrl()
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'Arcyn Find',
        url: origin,
        description: 'A searchable directory of AI tools.',
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${origin}/browse?q={search_term_string}` },
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
      <LandingPage stats={landingStats} searchDemo={searchDemo} />
    </>
  )
}
