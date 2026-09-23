#!/usr/bin/env node
/**
 * Verify the content rating keeps adult material out of the index and
 * non-consensual imagery off the site entirely.
 *
 * Run: npm run test:content-rating
 *
 * WHAT THIS IS GUARDING
 *
 * Two different failures, and they pull in opposite directions:
 *
 *   FALSE NEGATIVE  an adult page lands in the sitemap. Google classifies
 *                   domains rather than pages, so a handful can get the whole
 *                   site filtered out of default results.
 *   FALSE POSITIVE  a legitimate tool is delisted. The scraper stamps a
 *                   source-site category slug onto every row, and it is wrong
 *                   often enough that rating on tags alone deindexed Tiledesk
 *                   (customer-support chatbot), DeepFaceLab (open-source
 *                   face-swap research) and Deep Dream Generator (a mainstream
 *                   image model). Of 27 rows tagged `nsfw-chatbot`, only 10
 *                   had any adult signal in their own name or description.
 *
 * The named fixtures below are the specific rows that got this wrong during
 * development. They are the point of the file -- a rating that passes the
 * counts but fails these is not working.
 */

import { createClient } from '@supabase/supabase-js'
import { rateContent, type ContentRating } from '../../lib/seo/content-rating'
import { isIndexable } from '../../lib/seo/catalog'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing env. Run: npm run test:content-rating')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}   ${label}${detail ? '  (' + detail + ')' : ''}`)
  if (!ok) failures++
}

interface Row {
  id: string
  name: string
  description: string | null
  tags: string[] | null
  slug: string | null
  image: string | null
  platform: string | null
}

const rate = (r: Row): ContentRating =>
  rateContent({ name: r.name ?? '', rawDescription: r.description ?? '', tags: r.tags ?? [] })

console.log('content rating — end to end\n')

// ---------------------------------------------------------------------------
// 1. The classifier, on wording rather than on rows, so it holds if the
//    catalog changes underneath.
// ---------------------------------------------------------------------------
const fixtures: Array<[string, ContentRating, { name: string; rawDescription: string; tags: string[] }]> = [
  [
    'a detector is not a generator',
    'general',
    { name: 'Is This Image NSFW?', rawDescription: 'Upload an image and this classifier will detect whether it is NSFW.', tags: [] },
  ],
  [
    'a category slug alone does not condemn a row',
    'general',
    { name: 'Tiledesk', rawDescription: 'Proactive chatbot template for customer support and sales.', tags: ['chatbot', 'customer support', 'nsfw-chatbot'] },
  ],
  [
    'a natural-language tag does count',
    'adult',
    { name: 'SomeChat', rawDescription: 'Create AI characters and chat with them.', tags: ['roleplay scenarios', 'NSFW chats'] },
  ],
  [
    'undress tooling is prohibited, even compounded into a name',
    'prohibited',
    { name: 'Undressbaby AI', rawDescription: 'Tools to manipulate images including dressing and undressing images and facial swaps.', tags: [] },
  ],
  [
    'nudify is prohibited',
    'prohibited',
    { name: 'Nudify-AI', rawDescription: 'Generate images with our nudifier.', tags: [] },
  ],
  [
    'research into detecting nudified images is not itself prohibited',
    'adult',
    { name: 'NudifyDetector', rawDescription: 'A classifier that will detect whether a photo was produced by an undress app.', tags: [] },
  ],
  [
    'plain tools are untouched',
    'general',
    { name: 'Notion AI', rawDescription: 'Writing assistant built into Notion for drafting and summarising documents.', tags: ['writing', 'productivity'] },
  ],
]
for (const [label, expected, tool] of fixtures) {
  const got = rateContent(tool)
  check(label, got === expected, `expected ${expected}, got ${got}`)
}

// ---------------------------------------------------------------------------
// 2. The live catalog.
// ---------------------------------------------------------------------------
const rows: Row[] = []
{
  let cursor: string | null = null
  for (let page = 0; page < 40; page++) {
    let q = db
      .from('ai_tools')
      .select('id, name, description, tags, slug, image, platform')
      .order('id', { ascending: true })
      .limit(1000)
    if (cursor) q = q.gt('id', cursor)
    const { data, error } = await q
    if (error) {
      console.error('\nCatalog walk failed:', error.message)
      process.exit(1)
    }
    rows.push(...(data as Row[]))
    if (data.length < 1000) break
    cursor = (data as Row[])[data.length - 1].id
  }
}
console.log(`\n  walked ${rows.length.toLocaleString()} rows`)

const rated = { general: [] as Row[], adult: [] as Row[], prohibited: [] as Row[] }
for (const r of rows) rated[rate(r)].push(r)
console.log(
  `  general ${rated.general.length.toLocaleString()} · ` +
    `adult ${rated.adult.length} · prohibited ${rated.prohibited.length}\n`
)

// Nothing rated adult or prohibited may pass the indexability gate, because
// that gate is what the sitemap and the pages' robots meta are built from.
{
  const leaked = [...rated.adult, ...rated.prohibited].filter((r) =>
    isIndexable({
      name: r.name ?? '',
      rawDescription: r.description ?? '',
      tags: r.tags ?? [],
      image: r.image,
      platform: r.platform,
    })
  )
  check(
    'no adult or prohibited row passes isIndexable',
    leaked.length === 0,
    leaked.length ? `${leaked.length} leaked, e.g. "${leaked[0].name}"` : `${rated.adult.length + rated.prohibited.length} checked`
  )
}

// A rating that condemns a large slice of the catalog is miscalibrated, not
// thorough. Measured 2026-09-23: 79 adult, 13 prohibited out of 15,270.
{
  const flagged = rated.adult.length + rated.prohibited.length
  const pct = (flagged / rows.length) * 100
  check('flagged share stays plausible (< 2%)', pct < 2, `${pct.toFixed(2)}% (${flagged} rows)`)
}

// The specific rows that were misclassified during development.
{
  const mustBeGeneral = [
    'Tiledesk',
    'DeepFaceLab',
    'Deep Dream Generator',
    'Deepfakes.lol',
    'DeepfakeVFX.com',
    'Is This Image NSFW?',
    'Hive Moderation AI Detector',
    'Support Guy',
    'Tars Prime',
    'GPTService',
  ]
  const wrong = mustBeGeneral
    .map((name) => rows.find((r) => r.name === name))
    .filter((r): r is Row => !!r)
    .filter((r) => rate(r) !== 'general')
  check(
    'legitimate tools carrying a junk category tag stay general',
    wrong.length === 0,
    wrong.length ? wrong.map((r) => `${r.name}=${rate(r)}`).join(', ') : `${mustBeGeneral.length} checked`
  )
}

{
  const mustNotBeGeneral = ['Undressbaby AI', 'Nudify-AI', 'Spicychat', 'SmutGPT', 'Character AI (NSFW)']
  const wrong = mustNotBeGeneral
    .map((name) => rows.find((r) => r.name === name))
    .filter((r): r is Row => !!r)
    .filter((r) => rate(r) === 'general')
  check(
    'known adult and NCII rows are caught',
    wrong.length === 0,
    wrong.length ? wrong.map((r) => r.name).join(', ') : `${mustNotBeGeneral.length} checked`
  )
}

if (rated.prohibited.length) {
  console.log('\n  prohibited (removed from the public site entirely):')
  for (const r of rated.prohibited) console.log(`    ${r.slug ? '[was live] ' : '           '}${r.name}`)
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
