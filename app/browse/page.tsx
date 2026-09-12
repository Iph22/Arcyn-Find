import type { Metadata } from 'next'

import { ToolsBrowser } from '@/components/tools/tools-browser'

/**
 * The interactive tool browser.
 *
 * This is an application surface, not a landing page: its state lives in query
 * parameters, so it can produce an unbounded number of near-identical URLs
 * (`?category=x&pricing=y&sort=z`). docs/CORPUS_AND_CONSTRAINTS.md §6 and
 * standard practice both say not to let a crawler index that space -- the
 * indexable equivalents are the curated /tools and /tools/category pages,
 * which this page links back to.
 *
 * `follow` is deliberate: crawlers should still walk out of here into the
 * individual tool pages.
 */
export const metadata: Metadata = {
  title: 'Browse AI Tools',
  description:
    'Search and filter the full Arcyn Find AI tool directory by category, pricing and platform.',
  robots: { index: false, follow: true },
}

export default function BrowsePage() {
  return <ToolsBrowser />
}
