import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PublicFooter, PublicHeader } from '@/components/seo/public-chrome'
import { SeoToolCard } from '@/components/seo/tool-card'
import {
  getCategories,
  getCategoryBySlug,
  isIndexable,
  siteUrl,
} from '@/lib/seo/catalog'

export const revalidate = 7200 // 2 hours
export const dynamicParams = true

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  try {
    const categories = await getCategories()
    return categories.map((category) => ({ slug: category.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const result = await getCategoryBySlug(slug)
  if (!result) return { title: 'Category not found' }

  const { category } = result
  const canonical = `${siteUrl()}/tools/category/${category.slug}`
  const title = `Best ${category.name} AI Tools (${category.count}+ Compared)`
  const description =
    `Browse ${category.count} ${category.name.toLowerCase()} AI tools. ` +
    `Compare features, pricing and free tiers to find the right one for your problem.`

  return {
    title,
    description,
    alternates: { canonical },
    // A category page is only worth indexing if enough of its members are.
    // Otherwise it is a list of pages we have already told Google to skip.
    robots:
      category.indexableCount >= 5
        ? { index: true, follow: true }
        : { index: false, follow: true },
    openGraph: {
      type: 'website',
      url: canonical,
      title,
      description,
      siteName: 'Arcyn Find',
    },
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const result = await getCategoryBySlug(slug)
  if (!result) notFound()

  const { category, tools } = result
  const categories = await getCategories()
  const origin = siteUrl()
  const canonical = `${origin}/tools/category/${category.slug}`

  // Only the tools we would actually stand behind get listed in the structured
  // data, even though every one of them is rendered and linked below.
  const featured = tools.filter(isIndexable).slice(0, 25)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${category.name} AI Tools`,
        url: canonical,
        description: `A directory of ${category.count} ${category.name.toLowerCase()} AI tools.`,
      },
      {
        '@type': 'ItemList',
        itemListElement: featured.map((tool, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: tool.name,
          url: `${origin}/tools/${tool.slug}`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: origin },
          { '@type': 'ListItem', position: 2, name: 'AI Tools', item: `${origin}/tools` },
          { '@type': 'ListItem', position: 3, name: category.name, item: canonical },
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
            <li className="text-foreground">{category.name}</li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {category.name} AI Tools
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            {category.count.toLocaleString()} {category.name.toLowerCase()} tools in the Arcyn Find
            directory, ordered by how widely they are used. Every listing links through to features,
            pricing and alternatives.
          </p>
        </header>

        <section aria-label={`${category.name} tools`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <SeoToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="other-categories">
          <h2 id="other-categories" className="text-xl font-semibold">
            Other categories
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories
              .filter((c) => c.slug !== category.slug)
              .map((c) => (
                <Link
                  key={c.slug}
                  href={`/tools/category/${c.slug}`}
                  className="rounded-full border border-border/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {c.name}
                </Link>
              ))}
          </div>
        </section>
      </main>

      <PublicFooter categories={categories} />
    </div>
  )
}
