import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { PublicFooter, PublicHeader } from '@/components/seo/public-chrome'
import { CategoryCard, SeoToolCard } from '@/components/seo/tool-card'
import { deriveCategories, getPublishedTools, isIndexable, siteUrl } from '@/lib/seo/catalog'

export const revalidate = 3600 // 1 hour

/**
 * The public directory.
 *
 * This is the doorway a crawler is supposed to come through: server-rendered,
 * no authentication, and every link on it is a real `<a href>` to another
 * public page. The interactive filter UI lives at /browse, which is noindex --
 * §6 warns against letting a crawler into an unbounded filter-combination
 * space, and a 2,700-card dump is not a landing page either.
 */
export async function generateMetadata(): Promise<Metadata> {
  const canonical = `${siteUrl()}/tools`
  return {
    title: 'AI Tools Directory — Compare Features, Pricing & Alternatives',
    description:
      'Browse the Arcyn Find directory of AI tools by category. Compare features, pricing and ' +
      'free tiers, and find alternatives to the tools you already use.',
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      title: 'AI Tools Directory | Arcyn Find',
      description: 'Browse and compare AI tools by category, pricing and use case.',
      siteName: 'Arcyn Find',
    },
  }
}

export default async function ToolsDirectoryPage() {
  // One walk, categories derived from the same array.
  const tools = await getPublishedTools()
  const categories = deriveCategories(tools)
  const origin = siteUrl()

  // Lead with pages that are worth a click: the quality gate that decides
  // indexability also decides what gets promoted here.
  const featured = tools
    .filter(isIndexable)
    .sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name))
    .slice(0, 24)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'AI Tools Directory',
        url: `${origin}/tools`,
        description: 'A directory of AI tools, organised by category and use case.',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: origin },
          { '@type': 'ListItem', position: 2, name: 'AI Tools', item: `${origin}/tools` },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <PublicHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-10 max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">AI tools directory</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Discover, compare and master the right AI tools for your problems. Every listing covers
            what the tool does, how it is priced, and what you could use instead.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/tools/category"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Browse categories
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Search and filter
            </Link>
          </div>
        </header>

        <section className="mb-12" aria-labelledby="categories">
          <h2 id="categories" className="text-2xl font-semibold tracking-tight">
            Browse by category
          </h2>
          <p className="mt-1 text-muted-foreground">
            {categories.length} categories covering{' '}
            {categories.reduce((sum, c) => sum + c.count, 0).toLocaleString()} tools.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <CategoryCard key={category.slug} category={category} />
            ))}
          </div>
        </section>

        {featured.length > 0 && (
          <section aria-labelledby="popular">
            <h2 id="popular" className="text-2xl font-semibold tracking-tight">
              Popular AI tools
            </h2>
            <p className="mt-1 text-muted-foreground">
              The most widely used tools in the directory right now.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((tool) => (
                <SeoToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </section>
        )}
      </main>

      <PublicFooter categories={categories} />
    </div>
  )
}
