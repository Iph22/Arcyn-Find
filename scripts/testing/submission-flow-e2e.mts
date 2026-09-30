/**
 * The whole submission round trip, against a running server and the real
 * database: submit, screen, open the review link, approve, publish, clean up.
 *
 * It writes. Everything it creates carries an `__e2e__` marker and is removed
 * at the end, including on failure -- a test that leaves a fake tool in the
 * live catalog is worse than no test.
 *
 * Run: npx tsx --env-file=.env.local scripts/testing/submission-flow-e2e.mts [baseUrl]
 */

import { createClient } from '@supabase/supabase-js'

const BASE = process.argv[2] || 'http://localhost:3000'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env. Run with --env-file=.env.local')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const MARK = `__e2e__ ${Date.now()}`
let failures = 0
const created: { submissions: string[]; tools: string[] } = { submissions: [], tools: [] }

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let json: Record<string, unknown> = {}
  try {
    json = await res.json()
  } catch {
    /* some failures answer with no body */
  }
  return { status: res.status, json }
}

async function cleanup() {
  if (created.tools.length) await db.from('ai_tools').delete().in('id', created.tools)
  if (created.submissions.length) await db.from('tool_submissions').delete().in('id', created.submissions)
  await db.from('tool_submissions').delete().like('name', '__e2e__%')
  console.log('\ncleaned up')
}

async function main() {
  console.log('1. Email is required\n')
  const noEmail = await post('/api/tools/submit', {
    name: `${MARK} NoEmail`,
    description: 'A tool submitted without any email address at all, to prove the field is required.',
    url: 'https://example.com',
  })
  check('rejected without an email', noEmail.status === 400, `HTTP ${noEmail.status}`)
  check('and says why', String(noEmail.json.error ?? '').toLowerCase().includes('email'), String(noEmail.json.error))

  console.log('\n2. A submission is stored and screened\n')
  const submitted = await post('/api/tools/submit', {
    name: `${MARK} Cursor`,
    description:
      'An AI-first code editor for pair programming with a model, with inline edits and codebase-aware chat across many files.',
    url: 'https://cursor.com',
    category: 'Code & Development',
    email: 'e2e@example.com',
  })
  check('accepted', submitted.status === 200, `HTTP ${submitted.status} ${JSON.stringify(submitted.json).slice(0, 120)}`)

  const submissionId = String(submitted.json.submissionId ?? '')
  if (submissionId) created.submissions.push(submissionId)

  const { data: row } = await db
    .from('tool_submissions')
    .select('id, status, screening, screening_score, review_token, submitted_by')
    .eq('id', submissionId)
    .maybeSingle()

  check('row exists and is pending', row?.status === 'pending', String(row?.status))
  check('screening was stored', Boolean(row?.screening), `score ${row?.screening_score}`)
  check('scored well for a real tool', (row?.screening_score ?? 0) >= 70, String(row?.screening_score))
  check('submitter email kept', row?.submitted_by === 'e2e@example.com')
  check('a review token was minted', typeof row?.review_token === 'string' && row.review_token.length > 20)

  const token = String(row?.review_token ?? '')

  console.log('\n3. The review link renders and writes nothing\n')
  const page = await fetch(`${BASE}/review/${token}?intent=approve`)
  const html = await page.text()
  check('review page loads', page.status === 200, `HTTP ${page.status}`)
  check('shows the tool', html.includes('Cursor'))
  check('shows the checks', html.toLowerCase().includes('automated checks'))
  check('is noindex', html.toLowerCase().includes('noindex'))

  const { data: afterGet } = await db
    .from('tool_submissions')
    .select('status, review_token')
    .eq('id', submissionId)
    .maybeSingle()
  // The whole reason the link does not act on GET: mail scanners follow it.
  check('GET did NOT change the status', afterGet?.status === 'pending', String(afterGet?.status))
  check('GET did NOT spend the token', Boolean(afterGet?.review_token))

  console.log('\n4. Approving publishes and spends the link\n')
  const approved = await post('/api/submissions/review', { token, action: 'approve' })
  check('approved', approved.status === 200, `HTTP ${approved.status} ${JSON.stringify(approved.json).slice(0, 140)}`)
  check('reports it published', approved.json.published === true)

  const { data: published } = await db
    .from('ai_tools')
    .select('id, name, platform, popularity')
    .eq('name', `${MARK} Cursor`)
    .maybeSingle()
  if (published?.id) created.tools.push(published.id)
  check('the tool is in the catalog', Boolean(published), published?.id ?? 'not found')
  // Below PUBLISH_MIN_POPULARITY (75) on purpose: listed and searchable, but
  // it does not get a public SEO page on a stranger's say-so.
  check('published below the SEO floor', (published?.popularity ?? 0) === 50, String(published?.popularity))

  console.log('\n5. The link is single-use\n')
  const replay = await post('/api/submissions/review', { token, action: 'approve' })
  check('a replayed link is refused', replay.status === 404 || replay.status === 409, `HTTP ${replay.status}`)

  console.log('\n6. A forged token gets nothing\n')
  const forged = await post('/api/submissions/review', { token: 'x'.repeat(43), action: 'approve' })
  check('forged token refused', forged.status === 404, `HTTP ${forged.status}`)
}

main()
  .catch((e) => {
    console.error('\nthrew:', e.message)
    failures++
  })
  .finally(async () => {
    await cleanup()
    console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
    process.exit(failures === 0 ? 0 : 1)
  })
