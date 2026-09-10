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
 * That limit is not theoretical: the keyword check scored 100% on a run whose
 * answers included "TLDR" for "find and fix bugs in my codebase". Hence
 * labels.json — reviewed per-query judgements, graded separately below. The
 * keyword score is a floor; the labeled score is the actual quality number.
 *
 * Usage:
 *   node scripts/eval/recommendation-eval.mjs [baseUrl]
 *   node scripts/eval/recommendation-eval.mjs [baseUrl] --collect
 *   node scripts/eval/recommendation-eval.mjs [baseUrl] --cached
 *
 * --collect writes every query's current answer to a review file with blank
 * verdict fields, so labelling is a matter of filling in judgements rather than
 * writing JSON from scratch. See labels.json for the schema.
 *
 * By default every request sends fresh=1 to bypass the recommendation cache.
 * That matters: cached answers live for 7 days, so without the bypass a run
 * grades week-old output and any retrieval or ranking change appears to have
 * done nothing. --cached measures the cache path on purpose.
 *
 * Requires a running dev server (default http://localhost:3000).
 */

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const COLLECT = args.includes("--collect")
// Off by default: an eval that silently grades cached answers is worse than no
// eval, because it reports "no regression" for a change it never exercised.
const CACHED = args.includes("--cached")
const BASE_URL = args.find(a => !a.startsWith("--")) || "http://localhost:3000"
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

/**
 * Reviewed judgements, keyed by query. Optional: a missing or malformed file
 * degrades to "no labeled subset" rather than failing the run, because the
 * structural checks above are still worth having on their own.
 *
 * Schema per entry (all fields optional):
 *   acceptTools   names that are a correct answer. Non-empty means the best
 *                 match MUST be one of them.
 *   rejectTools   names judged wrong for this goal. A hit here is a hard
 *                 failure and reported as a regression, not a soft miss —
 *                 these are answers a reviewer already rejected once.
 *   requireAll    every term must appear in name+description+tags.
 *   requireAny    at least one term must appear. Stricter than the loose
 *                 `keywords` list above; use it to encode the actual intent.
 *   labeledBy     "human" or "assistant". Only "human" counts toward the
 *                 reviewed-coverage figure, because the point of this file is
 *                 judgement the automated checks cannot supply.
 */
function loadLabels() {
    try {
        const raw = JSON.parse(readFileSync(join(HERE, "labels.json"), "utf8"))
        const byQuery = new Map()
        for (const entry of raw.labels ?? []) {
            if (entry?.query) byQuery.set(entry.query, entry)
        }
        return byQuery
    } catch (err) {
        if (err.code !== "ENOENT") {
            console.warn(`(labels.json present but unreadable: ${err.message} — skipping labeled grading)\n`)
        }
        return new Map()
    }
}

const LABELS = loadLabels()

/**
 * Grade one answer against its label.
 *
 * Returns null when the query has no label, which is different from a pass —
 * an unlabeled query contributes to neither the numerator nor the denominator
 * of the labeled score. Conflating the two is how you get a reassuring 100%
 * that means "we only graded the easy ones".
 */
function gradeAgainstLabel(query, best) {
    const label = LABELS.get(query)
    if (!label) return null

    const name = norm(best?.name)
    const haystack = best
        ? `${best.name} ${best.description} ${(best.tags ?? []).join(" ")}`.toLowerCase()
        : ""

    const rejected = (label.rejectTools ?? []).some(t => norm(t) === name)
    if (rejected) {
        return { pass: false, regression: true, why: `previously rejected answer returned: ${best?.name}` }
    }

    const accept = label.acceptTools ?? []
    if (accept.length > 0 && !accept.some(t => norm(t) === name)) {
        return { pass: false, regression: false, why: `not in accepted set: ${best?.name}` }
    }

    const missingAll = (label.requireAll ?? []).filter(term => !haystack.includes(term.toLowerCase()))
    if (missingAll.length > 0) {
        return { pass: false, regression: false, why: `missing required term(s): ${missingAll.join(", ")}` }
    }

    const any = label.requireAny ?? []
    if (any.length > 0 && !any.some(term => haystack.includes(term.toLowerCase()))) {
        return { pass: false, regression: false, why: `no required term matched: ${any.join(" / ")}` }
    }

    return { pass: true, regression: false, why: "" }
}

async function runCase({ q, keywords }) {
    const started = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
        // fresh=1 skips the cache READ (writes still happen). Without it the
        // eval grades a 7-day-old cached answer, so a retrieval or ranking
        // change registers as no change at all. Pass --cached to measure the
        // cache path deliberately instead.
        const url = `${BASE_URL}/api/recommend${CACHED ? "" : "?fresh=1"}`
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: q }),
            signal: controller.signal,
        })
        const ms = Date.now() - started
        const cacheState = res.headers.get("x-recommend-cache") ?? "-"
        // Which retrieval tier served this. NOT cosmetic: semantic/hybrid
        // retrieval needs a query embedding, and that embedding call shares the
        // Gemini quota. When the quota is exhausted the route silently falls
        // back to FTS and returns DIFFERENT answers — measured on this eval,
        // "summarize long research papers" gave Article Summarizer via FTS and
        // ResearchRabbit via hybrid. Answers are deterministic within one
        // retrieval mode and differ across modes, so precision@1 is only
        // comparable between runs with the same mix printed below.
        const retrieval = res.headers.get("x-recommend-retrieval") ?? "-"
        const body = await res.json().catch(() => null)

        if (!res.ok || !body) {
            return { q, ms, ok: false, cacheState, retrieval, note: `HTTP ${res.status}` }
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
            q, ms, ok: true, coverage, reasoned, distinct, keywordHit, cacheState, retrieval,
            best: best?.name ?? "(none)",
            altCount: alts.length,
            graded: gradeAgainstLabel(q, best),
            // Kept for --collect, so a review file can show what was actually
            // returned instead of just its name.
            bestDetail: best
                ? {
                    name: best.name,
                    category: best.category,
                    description: String(best.description ?? "").slice(0, 220),
                    reason: best.reason,
                }
                : null,
            altNames: alts.map(a => a.name),
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
    console.log(`Recommendation eval — ${CASES.length} goal-shaped queries against ${BASE_URL}`)
    console.log(
        CACHED
            ? "cache: ENABLED (--cached) — measuring the cache path, not the live system\n"
            : "cache: bypassed (fresh=1) — measuring the live system\n"
    )

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
                r.graded?.regression ? "REGRESSION" : r.graded && !r.graded.pass ? "LABEL-FAIL" : "",
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

    // Stated outright, so a run can never be misread as measuring the live
    // system when it was actually served from cache.
    const served = ok.reduce((acc, r) => {
        acc[r.cacheState] = (acc[r.cacheState] ?? 0) + 1
        return acc
    }, {})
    console.log(`served from          ${Object.entries(served).map(([k, v]) => `${k}:${v}`).join("  ")}`)

    const tiers = ok.reduce((acc, r) => {
        acc[r.retrieval] = (acc[r.retrieval] ?? 0) + 1
        return acc
    }, {})
    console.log(`retrieval mix        ${Object.entries(tiers).map(([k, v]) => `${k}:${v}`).join("  ")}  ← compare precision@1 only across runs with the same mix`)

    // The labeled subset, reported separately and never folded into the numbers
    // above. Its denominator is the labeled queries only, and the coverage line
    // makes the size of that subset impossible to overlook.
    const gradedResults = ok.filter(r => r.graded)
    const humanLabeled = [...LABELS.values()].filter(l => l.labeledBy === "human").length
    console.log("-".repeat(64))
    if (gradedResults.length === 0) {
        console.log(`labeled subset       none — add entries to scripts/eval/labels.json`)
        console.log(`                     (run with --collect to generate a review file)`)
    } else {
        const passed = gradedResults.filter(r => r.graded.pass).length
        console.log(`labeled coverage     ${gradedResults.length}/${CASES.length} queries labeled  (${humanLabeled} reviewed by a human)`)
        console.log(`precision@1          ${pct(passed, gradedResults.length)}  ← THE quality number`)
        console.log(`regressions          ${gradedResults.filter(r => r.graded.regression).length}  (a rejected answer came back)`)
    }
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

    const labelFails = gradedResults.filter(r => !r.graded.pass)
    if (labelFails.length) {
        console.log("\nLabeled failures (a reviewer said these are wrong):")
        labelFails.forEach(r =>
            console.log(`  ${r.graded.regression ? "[REGRESSION] " : ""}"${r.q}" → ${r.graded.why}`)
        )
    }

    // Unlabeled queries are the backlog. Named explicitly so the labeled score
    // above can never be mistaken for a verdict on the whole set.
    const unlabeled = ok.filter(r => !r.graded)
    if (unlabeled.length) {
        console.log(`\nUnlabeled (${unlabeled.length}) — these do not count toward precision@1:`)
        unlabeled.forEach(r => console.log(`  "${r.q}" → ${r.best}`))
    }

    if (COLLECT) {
        // A review file, not a labels file: verdict/notes are blank on purpose,
        // and it is written to a separate path so a --collect run can never
        // overwrite reviewed judgements.
        const outPath = join(HERE, "collected-answers.json")
        writeFileSync(
            outPath,
            JSON.stringify(
                {
                    collectedAt: new Date().toISOString(),
                    baseUrl: BASE_URL,
                    howToUse:
                        "Review each answer, then move the ones you have judged into labels.json " +
                        "with labeledBy: \"human\". Put wrong answers in rejectTools and right ones " +
                        "in acceptTools.",
                    answers: ok.map(r => ({
                        query: r.q,
                        bestMatch: r.bestDetail,
                        alternatives: r.altNames,
                        verdict: "",
                        notes: "",
                    })),
                },
                null,
                2
            ) + "\n"
        )
        console.log(`\nWrote ${outPath} for review (${ok.length} answers).`)
    }
}

main()
