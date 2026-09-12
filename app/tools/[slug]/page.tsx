import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { ExternalLink } from 'lucide-react'

import { PublicFooter, PublicHeader } from '@/components/seo/public-chrome'
import { SeoToolCard } from '@/components/seo/tool-card'
import { ToolImage } from '@/components/tools/tool-image'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  clampForMeta,
  getCategories,
  getPublishedTools,
  getRelatedTools,
  isIndexable,
  resolveToolRoute,
  siteUrl,
  slugify,
  type CatalogTool,
} from '@/lib/seo/catalog'
import { priceLabel } from '@/lib/pricing-display'

import { ToolActions } from './tool-actions'

export const revalidate = 7200 // 2 hours

/**
 * Tools outside `generateStaticParams` still render, on demand, and are then
 * cached. Prerendering all ~2,700 at build time would make every deploy walk
 * the whole band; the long tail is cheap to generate on first request.
 */
export const dynamicParams = true

type Props = { params: Promise<{ slug: string }> }

/** Prerender the pages most likely to be hit cold from search. */
export async function generateStaticParams() {
  try {
    const tools = await getPublishedTools()
    return tools
      .filter(isIndexable)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 300)
      .map((tool) => ({ slug: tool.slug }))
  } catch {
    // A build must not fail because the database was briefly unreachable;
    // every page is still reachable via dynamicParams.
    return []
  }
}

function metaDescription(tool: CatalogTool): string {
  const base = tool.description || `${tool.name} is an AI tool listed on Arcyn Find.`
  const suffix = tool.category ? ` ${tool.category} tool.` : ''
  return clampForMeta(`${base}${suffix}`, 155)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const route = await resolveToolRoute(slug)

  if (!route) return { title: 'Tool not found' }
  // The page will redirect; metadata for it is never shown.
  if (route.kind === 'redirect') return { title: 'Arcyn Find' }

  const { tool } = route
  const isPublished = route.kind === 'published'
  const canonical = `${siteUrl()}/tools/${isPublished ? tool.slug : tool.id}`
  const description = metaDescription(tool)
  const title = `${tool.name}: Features, Pricing & Alternatives`

  return {
    title,
    description,
    alternates: { canonical },
    // The quality gate from lib/seo/catalog.ts. A page that is mostly a
    // truncated scraped blurb is still crawled and still passes link equity
    // onward, it just does not ask to be indexed until it has real content.
    // An unpublished row never asks to be indexed at all.
    robots:
      isPublished && isIndexable(tool)
        ? { index: true, follow: true }
        : { index: false, follow: true },
    openGraph: {
      type: 'website',
      url: canonical,
      title: `${tool.name} — ${tool.category || 'AI tool'}`,
      description,
      siteName: 'Arcyn Find',
      images: tool.image ? [{ url: tool.image, alt: `${tool.name} logo` }] : undefined,
    },
    twitter: {
      card: 'summary',
      title: `${tool.name} — ${tool.category || 'AI tool'}`,
      description,
      images: tool.image ? [tool.image] : undefined,
    },
  }
}

export default async function ToolPage({ params }: Props) {
  const { slug } = await params
  const route = await resolveToolRoute(slug)

  if (!route) notFound()

  // A legacy `/tools/<opaque-id>` link, or a duplicate re-ingest whose
  // canonical sibling holds the slug. Redirect rather than 404 so the old URL
  // keeps working and its ranking signal lands on the surviving page.
  if (route.kind === 'redirect') permanentRedirect(`/tools/${route.slug}`)

  const tool = route.tool
  const isPublished = route.kind === 'published'

  const [related, categories] = await Promise.all([getRelatedTools(tool), getCategories()])
  const categorySlug = tool.category ? slugify(tool.category) : ''
  const categoryIsLinkable = categories.some((c) => c.slug === categorySlug)
  const origin = siteUrl()
  const canonical = `${origin}/tools/${isPublished ? tool.slug : tool.id}`

  // Returns null whenever the scraped pricing could not be trusted, which is
  // the common case. A missing row beats a fabricated one.
  const price = priceLabel(tool)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: tool.name,
        description: tool.description,
        applicationCategory: tool.category || 'AI tool',
        url: canonical,
        ...(tool.image ? { image: tool.image } : {}),
        ...(tool.platform ? { sameAs: tool.platform } : {}),
        ...(tool.tags.length ? { keywords: tool.tags.join(', ') } : {}),
        // Pricing is only asserted when the ingest actually classified it.
        // docs/CORPUS_AND_CONSTRAINTS.md §1: ~1.4% is unclassified and annual
        // plans are stored as their monthly equivalent, so a confident
        // structured-data price would often be a lie to Google.
        ...(tool.hasFreeTier === true
          ? {
              offers: {
                '@type': 'Offer',
                price: 0,
                priceCurrency: 'USD',
                availability: 'https://schema.org/InStock',
              },
            }
          : tool.priceMonthlyMinUsd !== null && tool.pricingModel
            ? {
                offers: {
                  '@type': 'Offer',
                  price: tool.priceMonthlyMinUsd,
                  priceCurrency: 'USD',
                  availability: 'https://schema.org/InStock',
                },
              }
            : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: origin },
          { '@type': 'ListItem', position: 2, name: 'AI Tools', item: `${origin}/tools` },
          ...(categoryIsLinkable
            ? [
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: tool.category,
                  item: `${origin}/tools/category/${categorySlug}`,
                },
                { '@type': 'ListItem', position: 4, name: tool.name, item: canonical },
              ]
            : [{ '@type': 'ListItem', position: 3, name: tool.name, item: canonical }]),
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

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
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
            {categoryIsLinkable && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    href={`/tools/category/${categorySlug}`}
                    className="transition-colors hover:text-foreground"
                  >
                    {tool.category}
                  </Link>
                </li>
              </>
            )}
            <li aria-hidden="true">/</li>
            <li className="text-foreground">{tool.name}</li>
          </ol>
        </nav>

        <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted">
            <ToolImage
              src={tool.image}
              alt={`${tool.name} logo`}
              className="object-cover"
              sizes="80px"
              fallbackText={tool.name}
            />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{tool.name}</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              {tool.category ? `${tool.category} · ` : ''}
              {tool.accessType || 'AI tool'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {categoryIsLinkable ? (
                <Link href={`/tools/category/${categorySlug}`}>
                  <Badge variant="outline" className="transition-colors hover:bg-accent">
                    {tool.category}
                  </Badge>
                </Link>
              ) : (
                tool.category && <Badge variant="outline">{tool.category}</Badge>
              )}
              {tool.accessType && <Badge variant="secondary">{tool.accessType}</Badge>}
              {tool.hasFreeTier && <Badge variant="secondary">Free tier</Badge>}
              {tool.hasFreeTrial && <Badge variant="secondary">Free trial</Badge>}
            </div>
          </div>
        </header>

        <ToolActions toolId={tool.id} name={tool.name} platform={tool.platform} url={canonical} />

        <section className="mt-8" aria-labelledby="what-is">
          <h2 id="what-is" className="text-xl font-semibold">
            What is {tool.name}?
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            {tool.description || `${tool.name} is listed in the Arcyn Find AI tool directory.`}
          </p>
        </section>

        <Separator className="my-8" />

        <section aria-labelledby="details">
          <h2 id="details" className="text-xl font-semibold">
            {tool.name} at a glance
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Detail label="Category" value={tool.category} />
            <Detail label="Access" value={tool.accessType} />
            <Detail label="Pricing" value={price || tool.pricing} />
            <Detail label="Platform" value={tool.platform ? hostOf(tool.platform) : null} />
            <Detail label="Last verified" value={formatDate(tool.lastUpdated)} />
          </dl>
        </section>

        {tool.tags.length > 0 && (
          <section className="mt-8" aria-labelledby="tags">
            <h2 id="tags" className="text-xl font-semibold">
              What {tool.name} is used for
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {tool.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-10" aria-labelledby="alternatives">
            <h2 id="alternatives" className="text-xl font-semibold">
              {tool.name} alternatives
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Other {tool.category ? tool.category.toLowerCase() : 'AI'} tools in the Arcyn Find
              directory.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((item) => (
                <SeoToolCard key={item.slug} tool={item} />
              ))}
            </div>
          </section>
        )}

        {tool.platform && (
          <section className="mt-10 rounded-xl border border-border/60 bg-muted/30 p-6">
            <h2 className="text-lg font-semibold">Try {tool.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Opens the official {tool.name} website.
            </p>
            <a
              href={tool.platform}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Visit {hostOf(tool.platform)}
              <ExternalLink className="h-4 w-4" />
            </a>
          </section>
        )}
      </main>

      <PublicFooter categories={categories} />
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
