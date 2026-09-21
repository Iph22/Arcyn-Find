import type { Metadata } from 'next'
import Link from 'next/link'

import { PublicFooter, PublicHeader } from '@/components/seo/public-chrome'
import { CategoryCard } from '@/components/seo/tool-card'
import { getDirectoryData, siteUrl } from '@/lib/seo/catalog'

export const revalidate = 7200 // 2 hours

export async function generateMetadata(): Promise<Metadata> {
  const canonical = `${siteUrl()}/tools/category`
  return {
    title: 'AI Tool Categories — Browse by Use Case',
    description:
      'Every AI tool category in the Arcyn Find directory, from coding and image generation to ' +
      'research and customer service. Pick a category to compare the tools in it.',
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      title: 'AI Tool Categories | Arcyn Find',
      description: 'Browse AI tools by category on Arcyn Find.',
      siteName: 'Arcyn Find',
    },
  }
}

export default async function CategoryIndexPage() {
  // Degrades to empty during `next build` rather than failing the build when
  // the database is unreachable; strict at runtime. See getDirectoryData.
  const { categories } = await getDirectoryData()
  const origin = siteUrl()
  const total = categories.reduce((sum, category) => sum + category.count, 0)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: origin },
      { '@type': 'ListItem', position: 2, name: 'AI Tools', item: `${origin}/tools` },
      { '@type': 'ListItem', position: 3, name: 'Categories', item: `${origin}/tools/category` },
    ],
  }

  return (
    <div className="min-h-dvh bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <PublicHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/tools" className="transition-colors hover:text-foreground">
                AI Tools
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground">Categories</li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">AI tool categories</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            {total.toLocaleString()} tools across {categories.length} categories. Start with the
            problem you are trying to solve.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>
      </main>

      <PublicFooter categories={categories} />
    </div>
  )
}
