#!/usr/bin/env node
/**
 * Fill the generated profile fields that Ask Arcyn reasons over.
 *
 *   npm run enrich:estimate      what it would cost, no API calls
 *   npm run enrich:submit        create a batch job
 *   npm run enrich:collect       write finished results back
 *
 * WHY A BATCH JOB AND NOT A LOOP
 *
 * long_description, best_for, limitations, learning_curve and
 * free_tier_details do not exist in the scraped data — they have to be
 * generated. There are 15,210 distinct products (measured 2026-09-21), so this
 * is a metered, paid backfill. The Message Batches API runs it asynchronously
 * at 50% of standard rates, which is the right trade for work nothing is
 * waiting on.
 *
 * It also sidesteps the constraint in docs/CORPUS_AND_CONSTRAINTS.md §4: the
 * Gemini free tier allows roughly one generation call before 429, so the
 * provider the rest of the app uses cannot do bulk work at all.
 *
 * SCOPE DEFAULTS TO PUBLISHED TOOLS
 *
 * 2,913 of the 15,210 have public pages. Those are the ones a visitor can
 * reach and Google can index, so they are enriched first — about a fifth of
 * the cost for all of the visible benefit. `--all` widens it.
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'

// --- configuration ---------------------------------------------------------

/**
 * Default model.
 *
 * Opus 5 unless you say otherwise: this text is the product — it is what the
 * recommender reasons over and what Google indexes — and choosing a cheaper
 * model is a call for you to make knowingly, not for a script to make quietly.
 * `npm run enrich:estimate` prints every tier's cost so the decision is
 * informed. Override with --model=claude-sonnet-5 (or haiku).
 */
const DEFAULT_MODEL = 'claude-opus-5'

/** Per 1M tokens, Anthropic first-party rates. Batch API halves both. */
const PRICING = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}

/** Measured from the prompt below against real rows. */
const EST_INPUT_TOKENS = 280
const EST_OUTPUT_TOKENS = 450

/** The Batches API accepts up to 100k requests; stay well inside it. */
const MAX_BATCH = 10_000

const STATE_DIR = path.join('scripts', 'enrich', '.state')

// --- argument parsing ------------------------------------------------------

const argv = process.argv.slice(2)
const command = argv.find((a) => !a.startsWith('--')) ?? 'estimate'
const flag = (name, fallback = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const has = (name) => argv.includes(`--${name}`)

const MODEL = flag('model', DEFAULT_MODEL)
const LIMIT = Number(flag('limit', String(MAX_BATCH)))
const ALL = has('all')

if (!PRICING[MODEL]) {
  console.error(`Unknown model "${MODEL}". Known: ${Object.keys(PRICING).join(', ')}`)
  process.exit(1)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// --- the prompt ------------------------------------------------------------

/**
 * Stable across every request so it caches, and every rule in it exists to
 * stop a specific failure:
 *
 *  - The scraped description is cut mid-word at 200 characters, so the model
 *    must be told the input is truncated or it will treat the fragment as the
 *    whole truth and invent an ending.
 *  - `limitations` is the field most likely to be fabricated, so it is
 *    explicitly allowed to be empty.
 *  - Saying "unknown" has to be cheaper than guessing, or the backfill fills
 *    the catalog with confident fiction — which is the failure this whole
 *    line of work has been correcting.
 */
const SYSTEM = `You write factual catalog entries for a directory of AI tools.

You will be given the scraped metadata for one tool. Produce a profile of it.

CRITICAL RULES

1. The "description" you are given is scraped and truncated at exactly 200
   characters, usually mid-word. Treat it as a fragment. Do NOT invent an
   ending for a sentence that was cut off.
2. Write only what the input supports, plus widely-known public facts about
   this specific named product if you are confident of them. If you are not
   confident the tool is what its name suggests, stay close to the input.
3. Never invent pricing, limits, integrations, or company facts.
4. "limitations" must contain real trade-offs, not filler. If the input does
   not support any, return an empty array. An empty array is a correct and
   expected answer — it is far better than a plausible guess.
5. "free_tier_details" only when there is genuine evidence of a free tier.
   Otherwise null.
6. No marketing language. No "powerful", "seamless", "revolutionary",
   "game-changing", "cutting-edge". Write plainly, as a reference entry.
7. best_for entries are phrased as the problem a user would describe, in their
   words — "turn long videos into short clips with captions", not "video
   content optimization".`

const SCHEMA = {
  type: 'object',
  properties: {
    short_description: {
      type: 'string',
      description: 'One or two plain sentences. No marketing language.',
    },
    long_description: {
      type: 'string',
      description:
        '2-3 short paragraphs: what it does, who it suits, how it is typically used. Plain text, no markdown headings.',
    },
    best_for: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 concrete use cases phrased as a user would describe the problem.',
    },
    limitations: {
      type: 'array',
      items: { type: 'string' },
      description: '0-3 real trade-offs. Empty array if the input supports none.',
    },
    learning_curve: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced'],
    },
    free_tier_details: {
      type: ['string', 'null'],
      description: 'What the free tier includes, or null if there is no evidence of one.',
    },
    categories: {
      type: 'array',
      items: { type: 'string' },
      description: '1-3 categories. The given category first if it is correct.',
    },
  },
  required: [
    'short_description',
    'long_description',
    'best_for',
    'limitations',
    'learning_curve',
    'free_tier_details',
    'categories',
  ],
  additionalProperties: false,
}

function userPrompt(tool) {
  return [
    `name: ${tool.name}`,
    `category: ${tool.category || 'unknown'}`,
    `tags: ${(tool.tags || []).join(', ') || 'none'}`,
    `pricing (scraped): ${tool.pricing || 'unknown'}`,
    `website: ${tool.platform || 'unknown'}`,
    '',
    'description (scraped, truncated at 200 chars):',
    tool.description || '(none)',
  ].join('\n')
}

// --- data ------------------------------------------------------------------

/** Identical to normalizeName() in lib/seo/slug.ts — keep them in step. */
const normalizeName = (name) =>
  (name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()


/**
 * Whether the profile columns exist yet.
 *
 * `estimate` deliberately works before the migration is applied — the cost is
 * the thing you want to know when deciding whether to apply it.
 */
async function hasProfileColumns() {
  const { error } = await db.from('ai_tools').select('long_description').limit(1)
  return !error
}

/** Rows still missing generated fields, cheapest-to-reach first. */
async function loadCandidates(limit, { assumeAllUnenriched = false } = {}) {
  const rows = []
  let cursor = null

  // The published set is ~3 pages; the whole catalog is ~273 (272,755 rows at
  // 1000 a page, which is PostgREST's silent cap). Sizing this for the small
  // case made `--all` stop at 40,000 rows and report FEWER products than the
  // published scope — a superset returning a smaller number.
  const maxPages = ALL ? 300 : 40

  for (let page = 0; page < maxPages && rows.length < limit; page++) {
    let q = db
      .from('ai_tools')
      .select('id, name, category, description, tags, pricing, platform, slug')
      .order('id', { ascending: true })
      .limit(1000)

    // Before the migration nothing is enriched, so the filter cannot be
    // applied and every candidate counts.
    if (!assumeAllUnenriched) q = q.is('long_description', null)
    // Published tools are the ones a visitor can reach; enrich them first.
    if (!ALL) q = q.not('slug', 'is', null)
    if (cursor) q = q.gt('id', cursor)

    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data.length) break

    rows.push(...data)
    cursor = data[data.length - 1].id
    if (data.length < 1000) break
  }

  // Dedupe by normalized name before spending anything.
  //
  // 94.4% of ai_tools rows are duplicate re-ingests of the same product
  // (docs/CORPUS_AND_CONSTRAINTS.md §1). Enriching per row would pay roughly
  // eighteen times over to write the same profile for the same tool. One
  // profile per product, on the best row of each group — the one with a public
  // page if there is one, else the longest description.
  const best = new Map()
  for (const row of rows) {
    const key = normalizeName(row.name)
    if (!key) continue
    const held = best.get(key)
    if (!held) {
      best.set(key, row)
      continue
    }
    const rowScore = (row.slug ? 1e6 : 0) + (row.description || '').length
    const heldScore = (held.slug ? 1e6 : 0) + (held.description || '').length
    if (rowScore > heldScore) best.set(key, row)
  }

  return [...best.values()].slice(0, limit)
}

function money(n) {
  return `$${n.toFixed(2)}`
}

function estimateFor(model, count) {
  const p = PRICING[model]
  const inputM = (count * EST_INPUT_TOKENS) / 1e6
  const outputM = (count * EST_OUTPUT_TOKENS) / 1e6
  const standard = inputM * p.input + outputM * p.output
  return { standard, batch: standard / 2 }
}

// --- commands --------------------------------------------------------------

async function estimate() {
  const migrated = await hasProfileColumns()
  const candidates = await loadCandidates(Number.POSITIVE_INFINITY, {
    assumeAllUnenriched: !migrated,
  })
  const n = candidates.length

  if (!migrated) {
    console.log(
      '\n  note: add_tool_profile_fields.sql is not applied yet, so this counts' +
        '\n  every tool in scope rather than only the unenriched ones.'
    )
  }

  console.log(`\nTools missing generated fields: ${n.toLocaleString()}`)
  console.log(ALL ? '  scope: the whole catalog (--all)' : '  scope: published tools only (default)')
  console.log(`  ~${EST_INPUT_TOKENS} input + ~${EST_OUTPUT_TOKENS} output tokens each\n`)

  console.log('  model                standard        batch (50% off)')
  console.log('  ' + '-'.repeat(52))
  for (const model of Object.keys(PRICING)) {
    const e = estimateFor(model, n)
    const mark = model === MODEL ? ' <- default' : ''
    console.log(
      `  ${model.padEnd(20)} ${money(e.standard).padStart(9)}      ${money(e.batch).padStart(9)}${mark}`
    )
  }
  console.log(
    '\n  Estimates only — actual token counts vary with description length.' +
      '\n  Batch results are typically ready well inside the 24h SLA.\n'
  )
}

async function submit() {
  const candidates = await loadCandidates(Math.min(LIMIT, MAX_BATCH))
  if (!candidates.length) {
    console.log('Nothing to enrich.')
    return
  }

  const est = estimateFor(MODEL, candidates.length)
  console.log(`Submitting ${candidates.length.toLocaleString()} tools on ${MODEL}`)
  console.log(`Estimated batch cost: ${money(est.batch)}\n`)

  if (!has('yes')) {
    console.log('Re-run with --yes to actually submit. Nothing sent.')
    return
  }

  const anthropic = new Anthropic()

  const requests = candidates.map((tool) => ({
    custom_id: tool.id,
    params: {
      model: MODEL,
      max_tokens: 2000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: userPrompt(tool) }],
    },
  }))

  const batch = await anthropic.messages.batches.create({ requests })

  fs.mkdirSync(STATE_DIR, { recursive: true })
  const statePath = path.join(STATE_DIR, `${batch.id}.json`)
  fs.writeFileSync(
    statePath,
    JSON.stringify({ id: batch.id, model: MODEL, count: candidates.length }, null, 2)
  )

  console.log(`batch id: ${batch.id}`)
  console.log(`state:    ${statePath}`)
  console.log('\nRun `npm run enrich:collect` once it has finished.')
}

async function collect() {
  const anthropic = new Anthropic()

  if (!fs.existsSync(STATE_DIR)) {
    console.log('No batches submitted yet.')
    return
  }
  const files = fs.readdirSync(STATE_DIR).filter((f) => f.endsWith('.json'))
  if (!files.length) {
    console.log('No batches submitted yet.')
    return
  }

  for (const file of files) {
    const state = JSON.parse(fs.readFileSync(path.join(STATE_DIR, file), 'utf8'))
    const batch = await anthropic.messages.batches.retrieve(state.id)

    console.log(`\n${state.id}: ${batch.processing_status}`)
    if (batch.processing_status !== 'ended') {
      console.log('  not finished yet — try again later.')
      continue
    }

    let written = 0
    let failed = 0
    let refused = 0

    // Results stream back in ANY order — keyed by custom_id, never position.
    for await (const entry of await anthropic.messages.batches.results(state.id)) {
      if (entry.result.type !== 'succeeded') {
        failed++
        continue
      }

      const message = entry.result.message
      if (message.stop_reason === 'refusal') {
        refused++
        continue
      }

      const text = message.content.find((b) => b.type === 'text')?.text
      if (!text) {
        failed++
        continue
      }

      let profile
      try {
        profile = JSON.parse(text)
      } catch {
        failed++
        continue
      }

      const { error } = await db
        .from('ai_tools')
        .update({
          short_description: profile.short_description ?? null,
          long_description: profile.long_description ?? null,
          best_for: profile.best_for ?? [],
          limitations: profile.limitations ?? [],
          learning_curve: profile.learning_curve ?? null,
          free_tier_details: profile.free_tier_details ?? null,
          categories: profile.categories ?? [],
        })
        .eq('id', entry.custom_id)

      if (error) {
        console.error(`  ${entry.custom_id}: ${error.message}`)
        failed++
      } else {
        written++
      }
    }

    console.log(`  wrote ${written}, refused ${refused}, failed ${failed}`)
    if (written > 0) {
      console.log('  Run `VACUUM ANALYZE ai_tools;` after a large write (§2).')
    }
    fs.unlinkSync(path.join(STATE_DIR, file))
  }
}

const commands = { estimate, submit, collect }
const run = commands[command]
if (!run) {
  console.error(`Unknown command "${command}". Use: estimate | submit | collect`)
  process.exit(1)
}

run().catch((error) => {
  console.error('\nFailed:', error.message)
  process.exit(1)
})
