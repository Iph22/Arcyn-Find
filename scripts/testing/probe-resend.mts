/**
 * Why did no email arrive?
 *
 * The submission stored and was screened, so the failure is in delivery. There
 * are only a few candidates and Resend can be asked about all of them:
 *
 *   - which domains are verified (an unverified sender is refused outright)
 *   - whether the configured from-address belongs to one of them
 *   - what happens when the preview fallback sender is actually used
 *
 * The last one matters because RESEND_FROM_EMAIL is set on production only, so
 * a preview deployment falls back to onboarding@resend.dev -- Resend's shared
 * sandbox sender, which will not deliver to arbitrary recipients.
 *
 * Sends one real message when given --send=<address>. Prints no secrets.
 *
 * Run: npx tsx --env-file=.env.local scripts/testing/probe-resend.mts [--send=you@example.com]
 */

const apiKey = process.env.RESEND_API_KEY
if (!apiKey) {
  console.error('RESEND_API_KEY is not set in this environment.')
  process.exit(1)
}

const configuredFrom = process.env.RESEND_FROM_EMAIL
console.log(`RESEND_FROM_EMAIL locally: ${configuredFrom ? configuredFrom : '(unset — would fall back to onboarding@resend.dev)'}`)

async function api(path: string) {
  const res = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

console.log('\nVerified domains on this Resend account:')
const domains = await api('/domains')
if (domains.status !== 200) {
  console.log(`  could not list domains (HTTP ${domains.status})`)
} else {
  const list = (domains.body as { data?: { name: string; status: string; region?: string }[] }).data ?? []
  if (!list.length) {
    console.log('  NONE. Without a verified domain, Resend only accepts')
    console.log('  onboarding@resend.dev as a sender, and that sender only')
    console.log('  delivers to the account owner.')
  }
  for (const d of list) console.log(`  ${d.name.padEnd(28)} ${d.status}`)
}

const sendArg = process.argv.find((a) => a.startsWith('--send='))
if (!sendArg) {
  console.log('\n(pass --send=<address> to attempt a real send and see the exact refusal)')
  process.exit(0)
}

const to = sendArg.slice('--send='.length)

// Exactly what a preview deployment would do today: no RESEND_FROM_EMAIL on
// that target, so the code falls back to the sandbox sender.
for (const from of [
  `Arcyn Find <${configuredFrom || 'onboarding@resend.dev'}>`,
  'Arcyn Find <onboarding@resend.dev>',
]) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: 'Arcyn Find — delivery probe',
      text: 'If this arrived, this sender works for this recipient.',
    }),
  })
  const body = (await res.json().catch(() => ({}))) as { message?: string; name?: string; id?: string }
  console.log(`\nfrom ${from}`)
  console.log(`  HTTP ${res.status}${body.id ? ` — accepted, id ${body.id}` : ''}`)
  if (body.message) console.log(`  ${body.name ?? 'error'}: ${body.message}`)
}
