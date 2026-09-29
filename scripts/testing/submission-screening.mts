/**
 * Does the screen tell a reviewer the truth about a submission?
 *
 * Makes real outbound requests on purpose. The whole design question is how it
 * behaves against sites that exist, sites that do not, and sites that refuse
 * automated requests while being perfectly alive -- and that last category is
 * 23% of the most popular published tools, so it cannot be mocked away.
 *
 * Run: npx tsx scripts/testing/submission-screening.mts
 */

import { screenSubmission } from '../../lib/submission-screening'

let failures = 0

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

function statusOf(screening: Awaited<ReturnType<typeof screenSubmission>>, id: string) {
  return screening.checks.find((c) => c.id === id)?.status
}

async function main() {
  console.log('\n1. A real product, honestly described')
  const good = await screenSubmission({
    name: 'Cursor',
    description:
      'Cursor is an AI-first code editor built for pair programming with a model, with inline edits, codebase-aware chat and multi-file refactors.',
    url: 'https://cursor.com',
  })
  console.log(`   score ${good.score}, blocking ${good.blocking.length}`)
  for (const c of good.checks) console.log(`     ${c.status.padEnd(7)} ${c.label} — ${c.detail}`)
  check('scores well', good.score >= 70, `score ${good.score}`)
  check('nothing blocking', good.blocking.length === 0)

  console.log('\n2. A domain that no longer resolves')
  const dead = await screenSubmission({
    name: 'Make-A-Video',
    description: 'A research project that generates short video clips from a text prompt, published by Meta AI.',
    url: 'https://makeavideo.studio.meta.com',
  })
  check('reachability is unknown, not a pass', statusOf(dead, 'reachable') === 'unknown', String(statusOf(dead, 'reachable')))
  check(
    'and it is not silently scored as fine',
    dead.checks.some((c) => c.id === 'reachable' && c.detail.length > 0)
  )

  console.log('\n3. A live product that refuses bots (the 23% case)')
  const walled = await screenSubmission({
    name: 'OpenAI',
    description: 'OpenAI builds and serves large language models including the GPT family, available through a web app and an API.',
    url: 'https://openai.com',
  })
  const reach = walled.checks.find((c) => c.id === 'reachable')
  console.log(`   reachable: ${reach?.status} — ${reach?.detail}`)
  check(
    'a 403 does not count against the submitter',
    reach?.status !== 'fail',
    `got ${reach?.status}`
  )
  check('score is not dragged to zero by it', walled.score >= 50, `score ${walled.score}`)

  console.log('\n4. A page that never names the tool it was submitted as')
  const mismatch = await screenSubmission({
    name: 'Zylophorp Quantum Writer',
    description: 'An AI writing assistant that drafts long-form articles, rewrites paragraphs and adapts tone for different audiences.',
    url: 'https://example.com',
  })
  const named = mismatch.checks.find((c) => c.id === 'name-on-page')
  console.log(`   name-on-page: ${named?.status} — ${named?.detail}`)
  check('the mismatch is reported', named?.status === 'fail', String(named?.status))

  console.log('\n5. Claims that fail without any network at all')
  const thin = await screenSubmission({
    name: 'Thing',
    description: 'It is good.',
    url: 'https://bit.ly/abc123',
  })
  check('short description flagged', statusOf(thin, 'description') === 'fail')
  check('shortener flagged', statusOf(thin, 'own-domain') === 'fail')

  const dupe = await screenSubmission({
    name: 'Cursor',
    description: 'An AI code editor with inline edits and codebase-aware chat for working across many files.',
    url: 'https://cursor.com',
    existingNames: new Set(['cursor']),
  })
  check('duplicate is blocking', dupe.blocking.some((b) => b.includes('already in the catalog')))

  console.log('\n6. Prohibited content blocks outright')
  const bad = await screenSubmission({
    name: 'Undress Photo AI',
    description: 'Upload a photo of anyone and the AI will undress the photo automatically to remove their clothes.',
    url: 'https://example.com',
  })
  check('blocked', bad.blocking.length > 0, bad.blocking[0] ?? '(nothing)')

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  process.exitCode = failures === 0 ? 0 : 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
