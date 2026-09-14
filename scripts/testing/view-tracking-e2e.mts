/**
 * Exercises the view-tracking path against the real database.
 *
 *   npm run test:views
 *
 * Why this exists: view tracking was silently dead for the entire life of the
 * feature, in three independent ways at once — nothing in the app called the
 * endpoint, the endpoint read a cookie name that did not exist, and the write
 * itself failed on a type error whose result was never checked, so it reported
 * success. `tool_views` held 0 rows all time. None of that is visible from
 * reading the code, and none of it would fail a build; only a round trip to the
 * database shows it.
 *
 * This writes ONE view row against a real tool and then restores every column
 * it touched, in a `finally` so an assertion failure still cleans up. It needs
 * SUPABASE credentials, so it is not part of CI's default run:
 *
 *   npx tsx --env-file=.env.local scripts/testing/view-tracking-e2e.mts
 */
import { trackToolView, updateViewCountCaches } from '../../lib/services/view-tracking.service.ts'
import { getSupabaseAdmin } from '../../lib/supabase.ts'

const supabase = getSupabaseAdmin()

let failures = 0
function check(name: string, ok: boolean, detail = '') {
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
    if (!ok) failures++
}

const { data: target, error: targetError } = await supabase
    .from('ai_tools')
    .select('id, name, view_count, view_count_24h, view_count_7d, popularity, last_view_at')
    .limit(1)
    .single()

if (targetError || !target) {
    console.error('Could not read a tool row to test against:', targetError?.message)
    process.exit(1)
}

const before = { ...target }
const viewId = `e2e-${Math.random().toString(16).slice(2, 10)}`
console.log(`target: ${before.id} (${before.name})`)

try {
    const result = await trackToolView(before.id, {
        ip: '203.0.113.5',
        sessionId: viewId,
        source: 'e2e',
    })
    check('trackToolView reports success', result.success === true, JSON.stringify(result))

    const { data: row } = await supabase
        .from('tool_views')
        .select('tool_id, session_id, ip_hash, source')
        .eq('session_id', viewId)
        .maybeSingle()

    check('a tool_views row was inserted', !!row)
    check('session_id carries the anonymous view id', row?.session_id === viewId)
    // The raw IP must never reach the table.
    check('ip is hashed, not stored', !!row?.ip_hash && row.ip_hash !== '203.0.113.5', String(row?.ip_hash))
    check('ip_hash is the expected 16-char digest', (row?.ip_hash ?? '').length === 16)

    // The regression that made every previous view a no-op: popularity is an
    // INTEGER column, and a fractional value in this same UPDATE used to fail
    // the whole statement with 22P02 while still reporting success.
    const { data: after } = await supabase
        .from('ai_tools')
        .select('view_count, last_view_at')
        .eq('id', before.id)
        .single()
    check(
        'view_count incremented',
        (after?.view_count ?? 0) === (before.view_count ?? 0) + 1,
        `${before.view_count} -> ${after?.view_count}`
    )
    check('last_view_at was set', !!after?.last_view_at)

    // The same call the 6-hourly cron makes.
    const agg = await updateViewCountCaches()
    console.log(`updateViewCountCaches: ${JSON.stringify(agg)}`)

    const { data: cached } = await supabase
        .from('ai_tools')
        .select('view_count_24h, view_count_7d')
        .eq('id', before.id)
        .single()
    check('the 24h cache counted the view', (cached?.view_count_24h ?? 0) >= 1, String(cached?.view_count_24h))
    check('the 7d cache counted the view', (cached?.view_count_7d ?? 0) >= 1, String(cached?.view_count_7d))
} finally {
    // Runs even if an assertion above threw: a half-finished run must not leave
    // a synthetic view or an inflated counter behind.
    await supabase.from('tool_views').delete().eq('session_id', viewId)
    await supabase
        .from('ai_tools')
        .update({
            view_count: before.view_count,
            view_count_24h: before.view_count_24h,
            view_count_7d: before.view_count_7d,
            popularity: before.popularity,
            last_view_at: before.last_view_at,
        })
        .eq('id', before.id)

    const { data: restored } = await supabase
        .from('ai_tools')
        .select('view_count, view_count_24h, view_count_7d, popularity, last_view_at')
        .eq('id', before.id)
        .single()

    check(
        'the tool row was restored',
        restored?.view_count === before.view_count &&
            restored?.view_count_24h === before.view_count_24h &&
            restored?.view_count_7d === before.view_count_7d &&
            restored?.popularity === before.popularity,
        JSON.stringify(restored)
    )
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
