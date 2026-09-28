/**
 * Onboarding interests -> real catalog categories.
 *
 * The onboarding step stores abstract tags -- `text`, `vision`, `coding`,
 * `agents`, `automation`, `knowledge`, `research`, `productivity` (see
 * app/onboarding/page.tsx) -- into `preferences.categories`. The name is
 * misleading: none of those strings is an `ai_tools.category` value, so
 * slugifying one and linking to /tools/category/<slug> lands on a 404 every
 * time. The home page previously papered over that by not linking at all.
 *
 * The right-hand values are the category names as the database actually
 * spells them (see the mapping tables in components/tools/tools-browser.tsx,
 * derived from the live corpus). They are resolved against the categories that
 * really have pages before anything is rendered, so a renamed or shrunken
 * category degrades to "not shown" rather than to a broken link.
 */

import { slugify } from './seo/slug'

export interface ResolvableCategory {
  slug: string
  name: string
  count: number
}

/**
 * Ordered by how well the category fits the interest; first match wins.
 *
 * The lists carry fallbacks because the best-fitting name does not always have
 * a page. Measured against the live catalog (2026-09-28, 21 categories above
 * the size floor): `Research & Open Source` and `Computer Vision` are both
 * below it and resolve to nothing, so `research` and `vision` would otherwise
 * render no tile at all. Ordering the preferred name first means each picks up
 * its true category automatically if that category later crosses the floor.
 */
export const INTEREST_CATEGORY_NAMES: Record<string, string[]> = {
  text: ['Writing & Content', 'NLP & Text Analysis'],
  vision: ['Image Generation', 'Computer Vision'],
  coding: ['Code & Development'],
  agents: ['AI Agents'],
  automation: ['Productivity', 'AI Agents'],
  knowledge: ['Learning & Education', 'Research & Open Source'],
  research: ['Research & Open Source', 'Data & Analytics', 'Learning & Education'],
  productivity: ['Productivity'],
}

/**
 * The categories to show for a set of interests, de-duplicated and in the
 * order the interests were chosen.
 *
 * Returns only categories present in `available`, which is the list of
 * categories that have a public page. An interest that maps to nothing
 * resolvable is simply dropped -- better a shorter grid than a link to a page
 * that `notFound()`s.
 */
export function categoriesForInterests(
  interests: readonly string[] | null | undefined,
  available: readonly ResolvableCategory[]
): ResolvableCategory[] {
  if (!interests?.length || !available.length) return []

  const bySlug = new Map(available.map((c) => [c.slug, c]))
  const picked: ResolvableCategory[] = []
  const seen = new Set<string>()

  for (const interest of interests) {
    const names = INTEREST_CATEGORY_NAMES[interest.toLowerCase().trim()]
    if (!names) continue

    for (const name of names) {
      const match = bySlug.get(slugify(name))
      if (!match || seen.has(match.slug)) continue
      seen.add(match.slug)
      picked.push(match)
      // One category per interest keeps the grid representative rather than
      // letting a single broad interest fill it.
      break
    }
  }

  return picked
}
