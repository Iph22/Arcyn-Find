import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { ToolsBrowser } from '@/components/tools/tools-browser'
import { getCategoriesSafe } from '@/lib/seo/catalog'
import { siteUrl } from '@/lib/seo/site'

/**
 * The interactive tool browser, at the site's own name for it.
 *
 * WAS /browse. next.config.ts 308s the old path, which is why the rename does
 * not cost the URL whatever ranking it had.
 *
 * WHY THE BARE URL IS INDEXED AND THE FILTERED ONES ARE NOT
 *
 * This page's state lives in query parameters, so it can produce an unbounded
 * number of near-identical URLs (`?category=x&pricing=y&sort=z`). That is what
 * docs/CORPUS_AND_CONSTRAINTS.md §6 and SEO_ARCHITECTURE §5 rule out, and it
 * still holds -- but it was being enforced by making the WHOLE page noindex,
 * which also excluded the one URL that is stable, canonical and worth having:
 * `/discover` with no parameters at all.
 *
 * So the rule is now per-URL rather than per-page. Bare `/discover` asks to be
 * indexed; any parameterised variant is `noindex, follow` and canonicalises
 * back to the bare page, so the filter space stays out of the index while the
 * landing page can rank.
 *
 * WHY THE HEADER IS SERVER-RENDERED
 *
 * Indexing an empty page is worse than not indexing it. Measured 2026-09-30,
 * this route served 37 words, no `h1` and zero internal links to a crawler --
 * ToolsBrowser is a client component, so Google saw an empty shell. Flipping
 * the robots tag without fixing that would have put a blank page in the index.
 * The header below is server-rendered on purpose: a heading, a sentence that
 * says what the page is, and real links into the curated surfaces.
 */

const DESCRIPTION =
  'Search and filter the full Arcyn Find directory by category, pricing and platform, ' +
  'or start from a curated category page.'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams
  const isFiltered = Object.keys(params).length > 0

  return {
    title: isFiltered ? 'Search AI tools' : 'Discover AI tools',
    description: DESCRIPTION,
    // Always the bare page. A filtered view is a state of this page, not a
    // page of its own, and saying so is what keeps the permutations out of
    // the index without also hiding the page itself.
    alternates: { canonical: `${siteUrl()}/discover` },
    robots: isFiltered ? { index: false, follow: true } : { index: true, follow: true },
  }
}

export default async function DiscoverPage() {
  // Degrades to an empty list rather than throwing: a transient database error
  // should cost the category shortcuts, not the whole browser.
  const categories = await getCategoriesSafe()

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Discover AI tools</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Search the whole directory by what you are trying to do, then narrow it by category,
          pricing or platform. Every result links to a page covering what the tool does, how it
          is priced, and what you could use instead.
        </p>

        {categories.length > 0 && (
          <nav aria-label="Browse by category" className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Browse by category
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/tools/category/${category.slug}`}
                    className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                  >
                    {category.name}
                    <span className="ml-2 text-xs text-muted-foreground">{category.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          Prefer to start from a list?{' '}
          <Link href="/tools" className="inline-flex items-center gap-1 text-primary hover:underline">
            The curated directory
            <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
      </header>

      <ToolsBrowser />
    </div>
  )
}
