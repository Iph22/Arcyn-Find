import type { Metadata } from 'next'
import Link from 'next/link'
import { GitCompare, Search } from 'lucide-react'

import { CompareExport } from '@/components/compare/compare-export'
import { CompareSync } from '@/components/compare/compare-sync'
import { ComparisonTable } from '@/components/compare/comparison-table'
import { PublicFooter, PublicHeader } from '@/components/seo/public-chrome'
import { COMPARE_PARAM, MAX_COMPARE, parseCompareSegments } from '@/lib/compare'
import { getCategoriesSafe, getToolsBySegments } from '@/lib/seo/catalog'

/**
 * Side-by-side comparison of up to four tools.
 *
 * WHY THIS IS A ROUTE AND NOT A MODAL. docs/ROUTING.md: "a click handler is
 * not a link". A comparison you assembled is the single most shareable thing
 * this site can produce -- it is the artefact somebody pastes into a team
 * channel -- and behind a modal it would have no URL to paste. So the set
 * being compared lives in the query string, exactly as /browse's filters do.
 *
 * WHY IT IS `noindex, follow`. docs/SEO_ARCHITECTURE.md §5 rejected
 * `/compare/a-vs-b` pages, for two reasons that are worth separating:
 * combinatorial URL explosion, and pricing data too unreliable to anchor a
 * comparison. This page is not that proposal. It generates no URLs of its own
 * -- a reader has to assemble one -- it asks for none of them to be indexed,
 * and it is honest about the pricing rather than presenting it as settled.
 * What §5 ruled out was publishing ~4 million machine-generated pages into the
 * index; what it did not rule out is letting a visitor compare four tools they
 * chose. `follow` is deliberate for the same reason /browse uses it: crawlers
 * should still walk out of here into the tool pages.
 *
 * Dynamic by construction: reading `searchParams` opts a page into request-time
 * rendering, which is right here -- the set of tools is different on every
 * visit, so there is nothing to cache.
 */

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const segments = parseCompareSegments((await searchParams)[COMPARE_PARAM])
  const tools = segments.length > 0 ? await getToolsBySegments(segments) : []

  const title =
    tools.length >= 2
      ? `${tools.map((t) => t.name).join(' vs ')} — Compared`
      : 'Compare AI Tools'

  return {
    title,
    description:
      'Put AI tools side by side on pricing, free tiers, platform and capabilities, ' +
      'from the Arcyn Find directory.',
    robots: { index: false, follow: true },
  }
}

export default async function ComparePage({ searchParams }: Props) {
  const segments = parseCompareSegments((await searchParams)[COMPARE_PARAM])

  // getCategoriesSafe is cached and feeds the footer on every public page; the
  // two run together rather than in sequence.
  const [tools, categories] = await Promise.all([
    segments.length > 0 ? getToolsBySegments(segments) : Promise.resolve([]),
    getCategoriesSafe(),
  ])

  // Segments in the URL that resolved to nothing: a tool removed since the
  // link was shared, a typo, or a row that failed the public-listing gate.
  // Said out loud, because a column quietly missing from a comparison someone
  // sent you is worse than a sentence explaining it.
  //
  // Counted by checking each segment against what came back, NOT as
  // `segments.length - tools.length`. That subtraction also counts the
  // duplicates getToolsBySegments collapses -- `?tools=cursor,216` is one tool
  // named twice, by slug and by id, and reporting "1 tool could not be found"
  // for a link that resolved perfectly well is its own small lie.
  const resolved = new Set(tools.flatMap((tool) => [tool.slug, tool.id]).filter(Boolean))
  const missing = segments.filter((segment) => !resolved.has(segment)).length

  const syncItems = tools.map((tool) => ({ id: tool.id, slug: tool.slug, name: tool.name }))

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <CompareSync items={syncItems} />

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {tools.length >= 2 ? tools.map((t) => t.name).join(' vs ') : 'Compare AI tools'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tools.length >= 2
                ? 'Side by side on everything the catalog actually knows about them.'
                : `Pick up to ${MAX_COMPARE} tools while you browse and they show up here.`}
            </p>
          </div>

          {tools.length > 0 && <CompareExport tools={tools} />}
        </div>

        {missing > 0 && (
          <p className="mb-4 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {missing === 1
              ? 'One tool in this link could not be found and is not shown.'
              : `${missing} tools in this link could not be found and are not shown.`}
          </p>
        )}

        {tools.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <ComparisonTable tools={tools} />

            {tools.length === 1 && (
              <div className="mt-6 rounded-xl border border-dashed border-border/70 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  One tool is not a comparison yet. Add at least one more from the directory.
                </p>
                <Link
                  href="/browse"
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Search className="h-4 w-4" />
                  Find another tool
                </Link>
              </div>
            )}

            {/* The same caveat the recommendation panel carries, for the same
                reason. docs/CORPUS_AND_CONSTRAINTS.md §1: pricing is parsed out
                of scraped copy, ~1.4% of it is unclassified, and an annual plan
                is stored as its monthly equivalent -- so a real "$6/year" reads
                here as "$0.50/mo", which is the right number for comparing and
                the wrong number to expect on an invoice. Saying so costs a
                sentence; being quietly wrong about somebody's budget costs
                more. */}
            <div className="mt-8 space-y-2 border-t border-border/50 pt-4 text-xs text-muted-foreground">
              <p>
                Prices are the cheapest published tier shown per month. Annual plans are
                converted and may require yearly billing; usage-based and quote-only tools
                have no monthly figure and are marked as such rather than guessed at.
              </p>
              <p>
                Descriptions, categories and pricing are collected automatically from each
                tool&apos;s own site and can be out of date or, occasionally, filed under the
                wrong category. Check the vendor&apos;s page before you commit to anything.
              </p>
            </div>
          </>
        )}
      </main>

      <PublicFooter categories={categories} />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border/70 px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
        <GitCompare className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">Nothing to compare yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Browse the directory and hit the compare icon on any tool. Once you have picked two,
        the compare bar at the bottom brings you back here.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Search className="h-4 w-4" />
          Browse tools
        </Link>
        <Link
          href="/tools/category"
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          Browse by category
        </Link>
      </div>
    </div>
  )
}
