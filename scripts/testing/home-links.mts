/**
 * Every link the signed-in home page can render must resolve.
 *
 * This exists because the failure it checks for is silent in every other
 * signal. The block it covers previously rendered <button>s with no onClick,
 * counts from Math.random(), and a Tailwind class interpolated at runtime that
 * therefore never existed -- and it type-checked, linted and screenshotted
 * fine. Nothing that ran in CI could tell the difference between a working
 * category tile and a decorative one.
 *
 * What it asserts, against the live catalog rather than a fixture:
 *
 *   1. Every onboarding interest resolves to a category that HAS a page.
 *      Category pages notFound() below MIN_CATEGORY_SIZE, so a mapping to a
 *      real-sounding name is not enough -- `Research & Open Source` and
 *      `Computer Vision` are both real category values with no page.
 *   2. Every category /api/categories advertises really renders.
 *   3. A trending tool's link resolves, by the same href helper the page uses.
 *
 * Run: npx tsx scripts/testing/home-links.mts [baseUrl]
 */

import { categoriesForInterests, INTEREST_CATEGORY_NAMES } from '../../lib/interest-categories'
import { displayCategoryForSlug } from '../../lib/categories'
import { toolHref } from '../../lib/tool-href'

const BASE = process.argv[2] || process.env.SITE_URL || 'http://localhost:3000'

interface PublicCategory {
  slug: string
  name: string
  count: number
}

let failures = 0

function check(ok: boolean, label: string, detail = '') {
  if (ok) {
    console.log(`  OK   ${label}`)
  } else {
    failures++
    console.log(`  FAIL ${label}${detail ? ` -- ${detail}` : ''}`)
  }
}

/**
 * The status of one route. We care whether it 404s, not what it renders.
 *
 * Retried once, because a dropped connection is not a routing failure and the
 * two are easy to confuse. Against a cold dev server every one of these pages
 * compiles on demand, and on a memory-constrained box that is enough to reset
 * a connection: one run reported nlp-text-analysis as failed and the same URL
 * returned 200 three times immediately afterwards. Only a real status is
 * worth failing on.
 */
async function status(path: string, attempt = 1): Promise<number> {
  try {
    const response = await fetch(`${BASE}${path}`, { redirect: 'manual' })
    return response.status
  } catch (error) {
    if (attempt === 1) return status(path, 2)
    console.log(`  (request failed twice for ${path}: ${(error as Error).message})`)
    return 0
  }
}

async function main() {
  console.log(`Checking home-page links against ${BASE}\n`)

  let response: Response
  try {
    response = await fetch(`${BASE}/api/categories`)
  } catch (error) {
    // Most often "no server running on that port", which deserves a sentence
    // rather than an uncaught AggregateError and a stack trace.
    console.error(`Could not reach ${BASE} -- ${(error as Error).message}.`)
    console.error('Start the app first, or pass a base URL as the first argument.')
    process.exitCode = 1
    return
  }
  if (!response.ok) {
    console.error(`/api/categories returned ${response.status} -- cannot continue.`)
    process.exitCode = 1
    return
  }
  const categories: PublicCategory[] = (await response.json()).categories ?? []
  console.log(`/api/categories advertises ${categories.length} categories\n`)

  if (categories.length === 0) {
    console.error('No categories returned. Either the catalog is unreachable or every')
    console.error('category is below MIN_CATEGORY_SIZE. Both make the panel render empty.')
    process.exitCode = 1
    return
  }

  console.log('1. Onboarding interests resolve to a category with a page')
  for (const interest of Object.keys(INTEREST_CATEGORY_NAMES)) {
    const resolved = categoriesForInterests([interest], categories)
    check(
      resolved.length > 0,
      `interest "${interest}"`,
      `none of ${INTEREST_CATEGORY_NAMES[interest].join(', ')} has a page`
    )
  }

  console.log('\n2. Advertised category pages render')
  for (const category of categories) {
    const code = await status(`/tools/category/${category.slug}`)
    check(code === 200, `/tools/category/${category.slug} -> ${code}`)
  }

  console.log('\n3. Every advertised category resolves to a browser filter')
  // The failure this catches is silent. In-app tiles link to
  // /browse?category=<slug>; if the browser cannot resolve that slug it falls
  // back to "All" and shows the unfiltered list, with nothing in the UI
  // admitting the filter was dropped. /browse returns 200 either way, so a
  // status check cannot see it.
  for (const category of categories) {
    const display = displayCategoryForSlug(category.slug)
    check(
      display !== 'All',
      `${category.slug} -> ${display}`,
      'falls back to All, so the tile would open an unfiltered list'
    )
  }

  console.log('\n4. A trending tool links somewhere real')
  const trending = await fetch(`${BASE}/api/tools/trending?limit=3`)
  if (trending.ok) {
    const tools = (await trending.json()).tools ?? []
    if (tools.length === 0) {
      console.log('  (no trending tools returned -- nothing to check)')
    }
    for (const tool of tools) {
      const href = toolHref(tool)
      const code = await status(href)
      // 200 renders; 3xx is the id-to-slug redirect, which is also correct.
      check(code === 200 || (code >= 300 && code < 400), `${tool.name}: ${href} -> ${code}`)
      if (!tool.slug) {
        console.log(`       note: "${tool.name}" has no slug, so this link costs a redirect`)
      }
    }
  } else {
    console.log(`  (trending returned ${trending.status})`)
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
