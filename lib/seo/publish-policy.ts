/**
 * Who gets a public page.
 *
 * Its own module, with no imports, because three separate things need this
 * number and two of them are standalone scripts that cannot pull in
 * `lib/seo/catalog.ts` (React's `cache`, the Supabase admin client). It was
 * previously written out three times -- catalog.ts, backfill-slugs, audit --
 * and a drift between them means the backfill assigns slugs at one threshold
 * while the layer filters at another, which is silent and produces pages that
 * exist but are never linked.
 *
 * POPULARITY IS A BUCKET LABEL, NOT A SCORE
 *
 * Measured 2026-09-23 across 15,275 rows: only 76 distinct values exist, and
 * the mass sits in a handful of them.
 *
 *   popularity 100   2,765 rows   published
 *   popularity  95     107 rows   published
 *   popularity  75   2,826 rows   <- this tier
 *   popularity  25   1,719 rows
 *
 * So this constant does not select a quality level; it selects which buckets
 * get pages. At 90 it meant "bucket 100 and bucket 95". Nothing lives between
 * 76 and 89, which is why lowering it to 80 published nine pages.
 *
 * WHY 75
 *
 * Bucket 75 is indistinguishable from bucket 100 on every measure that page
 * quality depends on:
 *
 *                        pop 100      pop 75
 *   has an image            99%        100%
 *   median description   200 ch      200 ch
 *   median tag count          9           9
 *   platform is github.com    1%          0%
 *   examples          SurferSEO,   Synthesia,
 *                     Notion AI    AWS Kendra, Readwise Reader
 *
 * A sample of 200 rows in bucket 75 put 196 through the full `isIndexable`
 * gate and the content rating. The old floor was not holding back thin pages;
 * it was holding back roughly 2,662 real ones.
 *
 * This is the coarse filter. Every candidate still has to pass `isIndexable`
 * (description length, word count, tag richness, an image, an outbound URL)
 * and `isSearchEngineSafe` individually -- see catalog.ts and
 * content-rating.ts. Lowering this widens the pool, it does not lower the bar.
 */
export const PUBLISH_MIN_POPULARITY = 75
