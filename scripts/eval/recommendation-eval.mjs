/**
 * Recommendation quality eval.
 *
 * WHY THIS EXISTS: Phase 2's goal is "make recommendations genuinely useful."
 * Before this script, the only way to judge that was eyeballing three or four
 * queries by hand — enough to answer "does it run", useless for "is it good" or
 * "did that change help". This turns Phase 2 into a measurable exercise.
 *
 * DESIGN NOTE — what this does and does not measure. Most checks are structural
 * properties that are objectively verifiable without a human deciding what the
 * "right" tool is:
 *
 *   coverage   did we return a best match at all
 *   reasoned   did real model reasoning run, or did it silently fall back
 *   distinct   are the alternatives actually different products from the pick
 *              (this is the duplicate-corpus problem, measured directly)
 *   latency    p50 / p95, because a recommendation nobody waits for is unused
 *
 * Only `keywords` is a relevance judgement, and it is deliberately loose: a
 * substring match against the returned name/description/tags. It catches
 * catastrophic misses ("podcast to clips" returning a Java ML library) without
 * pretending to grade nuance. Do not read a high keyword score as "the
 * recommendations are good" — read a LOW one as "something is broken."
 *
 * Usage:  node scripts/eval/recommendation-eval.mjs [baseUrl]
 * Requires a running dev server (default http://localhost:3000).
 */

const BASE_URL = process.argv[2] || "http://localhost:3000"
const LATENCY_BUDGET_MS = 8000
const REQUEST_TIMEOUT_MS = 90_000

/**
 * Goal-shaped queries — phrased the way the product thesis says users should be
 * able to phrase them ("what I want to accomplish"), not as category keywords.
 * `keywords`: at least one must appear in the best match's name, description, or
 * tags. Kept broad on purpose.
 */
const CASES = [
    { q: "turn my podcast into short clips", keywords: ["clip", "short", "video", "repurpos"] },
    { q: "generate product photos for my online store", keywords: ["product", "photo", "image", "ecommerce", "commerce"] },
    { q: "write blog posts for my company", keywords: ["blog", "writ", "content", "copy", "article"] },
    { q: "transcribe interview recordings to text", keywords: ["transcri", "speech", "audio", "text"] },
    { q: "build a website without coding", keywords: ["website", "web", "site", "builder", "no-code", "nocode"] },
    { q: "remove the background from images", keywords: ["background", "image", "photo", "remov", "edit"] },
    { q: "help me write code faster", keywords: ["code", "coding", "developer", "program", "ide"] },
    { q: "create a logo for my brand", keywords: ["logo", "brand", "design", "graphic"] },
    { q: "summarize long research papers", keywords: ["summar", "research", "paper", "pdf", "document"] },
    { q: "make an explainer video from a script", keywords: ["video", "explainer", "script", "animat"] },
    { q: "answer customer support questions automatically", keywords: ["support", "customer", "chat", "bot", "helpdesk", "ticket"] },
    { q: "translate my documents into other languages", keywords: ["translat", "language", "document"] },
    { q: "generate voiceovers for my videos", keywords: ["voice", "speech", "audio", "tts", "narrat"] },
    { q: "analyze my spreadsheet data", keywords: ["data", "spreadsheet", "analy", "excel", "csv", "chart"] },
    { q: "schedule and post to social media", keywords: ["social", "post", "schedul", "media", "instagram", "twitter"] },
    { q: "detect whether text was written by AI", keywords: ["detect", "ai-generated", "plagiar", "authentic", "checker"] },
    { q: "practice for a job interview", keywords: ["interview", "job", "career", "resume", "practice"] },
    { q: "clean up and enhance old photos", keywords: ["photo", "enhance", "upscal", "restor", "image"] },
    { q: "build a chatbot trained on my own documents", keywords: ["chatbot", "document", "knowledge", "custom", "rag", "train"] },
    { q: "generate music for my video project", keywords: ["music", "audio", "sound", "compos", "track"] },
    { q: "automate repetitive tasks between my apps", keywords: ["automat", "workflow", "integrat", "task", "zapier"] },
    { q: "help me study for an exam", keywords: ["study", "learn", "exam", "flashcard", "quiz", "educat"] },
    { q: "edit my video by typing instead of timelines", keywords: ["video", "edit", "text-based", "transcript"] },
    { q: "find and fix bugs in my codebase", keywords: ["bug", "code", "debug", "test", "review", "static"] },
    { q: "turn a screenshot into working code", keywords: ["code", "screenshot", "image", "ui", "design", "html"] },
    { q: "write cold outreach emails that convert", keywords: ["email", "outreach", "sales", "cold", "copy", "market"] },
]

const norm = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")

async function runCase({ q, keywords }) {
    const started = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
        const res = await fetch(`${BASE_URL}/api/recommend`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: q }),
            signal: controller.signal,
        })
        const ms = Date.now() - started
        const body = await res.json().catch(() => null)

        if (!res.ok || !body) {
            return { q, ms, ok: false, note: `HTTP ${res.status}` }
        }

        const best = body.bestMatch
        const alts = body.alternatives ?? []

        // Structural checks
        const coverage = Boolean(best)
        const reasoned = body.degraded === false
        const altNames = alts.map(a => norm(a.name))
        const distinct =
            !best ||
            (new Set([norm(best.name), ...altNames]).size === altNames.length + 1)

        // Loose relevance
        const haystack = best
            ? `${best.name} ${best.description} ${(best.tags ?? []).join(" ")}`.toLowerCase()
            : ""
        const keywordHit = keywords.some(k => haystack.includes(k))

        return {
            q, ms, ok: true, coverage, reasoned, distinct, keywordHit,
            best: best?.name ?? "(none)",
            altCount: alts.length,
        }
    } catch (err) {
        return { q, ms: Date.now() - started, ok: false, note: err.name === "AbortError" ? "timeout" : err.message }
    } finally {
        clearTimeout(timer)
    }
}

function pct(n, d) {
    return d === 0 ? "n/a" : `${Math.round((n / d) * 100)}%`
}

async function main() {
    console.log(`Recommendation eval — ${CASES.length} goal-shaped queries against ${BASE_URL}\n`)

    const results = []
    for (const c of CASES) {
        const r = await runCase(c)
        results.push(r)
        const flags = r.ok
            ? [
                r.coverage ? "" : "NO-MATCH",
                r.reasoned ? "" : "DEGRADED",
                r.distinct ? "" : "DUPES",
                r.keywordHit ? "" : "off-topic?",
            ].filter(Boolean).join(" ")
            : r.note
        console.log(
            `${String(r.ms).padStart(6)}ms  ${(r.best ?? "-").slice(0, 34).padEnd(34)} ${flags}   ← "${r.q}"`
        )
    }

    const ok = results.filter(r => r.ok)
    const lat = ok.map(r => r.ms).sort((a, b) => a - b)
    const p = q => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * q))] : 0)

    console.log("\n" + "=".repeat(64))
    console.log(`requests succeeded   ${ok.length}/${results.length}`)
    console.log(`coverage             ${pct(ok.filter(r => r.coverage).length, ok.length)}  (returned a best match)`)
    console.log(`reasoned             ${pct(ok.filter(r => r.reasoned).length, ok.length)}  (real model reasoning, not fallback)`)
    console.log(`distinct alts        ${pct(ok.filter(r => r.distinct).length, ok.length)}  (alternatives differ from the pick)`)
    console.log(`keyword hit          ${pct(ok.filter(r => r.keywordHit).length, ok.length)}  (loose relevance floor)`)
    console.log(`latency p50 / p95    ${p(0.5)}ms / ${p(0.95)}ms   (budget ${LATENCY_BUDGET_MS}ms)`)
    console.log(`within budget        ${pct(ok.filter(r => r.ms <= LATENCY_BUDGET_MS).length, ok.length)}`)
    console.log("=".repeat(64))

    const offTopic = ok.filter(r => !r.keywordHit)
    if (offTopic.length) {
        console.log("\nWorth a human look (no keyword overlap — may be a real miss or a loose keyword list):")
        offTopic.forEach(r => console.log(`  "${r.q}" → ${r.best}`))
    }
    const dupes = ok.filter(r => !r.distinct)
    if (dupes.length) {
        console.log("\nDuplicate alternatives (corpus dedup not working for these):")
        dupes.forEach(r => console.log(`  "${r.q}" → ${r.best}`))
    }
}

main()
