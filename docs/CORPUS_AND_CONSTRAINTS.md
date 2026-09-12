# Corpus shape and database constraints

Measured facts about `ai_tools` and the queries that run against it. Everything
here was verified against the live database, with the measurement shown — the
point is to stop the next person rediscovering it the expensive way.

Figures are from 2026-09-12 unless stated. Re-measure before trusting anything
load-bearing; the scripts named below will do it.

---

## 1. The corpus is not what it looks like

**~260,000 rows, but far fewer products.** Of the 5,000 most-viewed rows, only
2,232 are distinct products — **55% are duplicate re-ingests**, mostly
GitHub-scraped:

| product | rows |
|---|---|
| tensorflow | 356 |
| Langflow | 290 |
| langchain | 279 |
| AutoGPT | 264 |
| transformers | 254 |

`search_tools_advanced` hides this at query time with
`DISTINCT ON (normalized name)` applied *before* its final `LIMIT`, so results
look clean — measured 780/780 distinct across 26 queries. **The duplicates are
invisible in search output but still consume the candidate pool**, and anything
that walks the table directly (sitemaps, exports, page generation) will see all
of them.

Measure with `node scripts/eval/corpus-health.js`.

**Categories are unreliable.** Roughly 2% of sampled rows contradict their own
category outright, and the errors are not subtle:

- `Klap` (long video → short clips) and `Latte Social` (video editing) → `Code & Development`
- `Video Editor AI` → `HR & Recruiting`
- `Uberduck` (voice) → `HR & Recruiting`
- `Sourcio` (hiring) → `Productivity`

Anything built on the category column inherits this.

**Pricing is scraped and partially unclassified.** The structured columns
(`pricing_model`, `price_monthly_min_usd`, …) come from parsing free-text
pricing copy; ~1.4% is unclassified, and only ~2,580 rows in the whole corpus
have a non-zero monthly price. Annual plans are stored as their monthly
equivalent, so a real "$6/year" appears as `$0.50/mo` — correct for comparison,
wrong if presented as a monthly bill. See `lib/pricing-display.ts`.

**Embedding coverage is partial.** The semantic tier requires
`embedding IS NOT NULL`, so uncovered rows can only ever be found by keyword:

| band | rows | have embedding |
|---|---|---|
| popularity ≥ 100 | 2,777 | 75% |
| popularity ≥ 80 | 3,062 | 69% |
| popularity ≥ 20 | 263,610 | 1% |

Measure with `npx tsx --env-file=.env.local scripts/eval/embedding-coverage.mts`.

---

## 2. Database constraints, with measurements

The statement timeout is roughly 8–9 seconds. These are the shapes that hit it.

**`ILIKE` is not viable on this table, at any indexing.** Measured on 257k rows:

```
FTS  (fts_vector @@ tsquery)      421ms – 1.5s   viable
ILIKE on name (trigram indexed)   8.5s           not viable
ILIKE on description (indexed)    TIMEOUT        not viable
```

The cost is driven by **trigram commonality, not selectivity** — `'%gauth%'`
decomposes to `gau/aut/uth`, and `aut`/`uth` are pervasive in an AI-tools
corpus. A *rarer* term can be dramatically slower than a common one, so latency
is unpredictable. Use full-text search.

**`ORDER BY popularity` combined with a sparse filter degrades over time.**
`WHERE embedding IS NULL ORDER BY popularity` worked at 5.2s when few rows had
embeddings and timed out at *every* page size (even 25 rows, 9.5s) once the
popular ones filled in — Postgres scans ever deeper to find matches. Use an
indexed band filter (`WHERE popularity >= n`) instead of a sort: 296ms.

**Never `SELECT` the `embedding` column to test for null.** 1000 rows × 768
floats is a multi-megabyte payload. Two separate scripts here had this bug and
both got *slower as they succeeded*. Filter on it, or count server-side.

**PostgREST caps a response at 1000 rows**, silently. A "1000" count is almost
certainly a truncation, not a measurement.

**`count: 'exact'` times out** on large result sets — it counts the whole match
set regardless of `.limit()`. Use a bounded probe, or count within a narrow
filter.

**Numeric columns come back as strings.** Coerce before comparing, or you get
lexicographic ordering.

**Bulk `UPDATE`s have a blast radius.** Writing 300 embeddings (each maintaining
the IVFFlat index) made an unrelated query go from 2828ms to timing out, and it
did not recover when writes stopped — bloat and stale statistics, not
contention. User-facing search was unaffected because `search_tools_advanced`
narrows with FTS before sorting. Run `VACUUM ANALYZE ai_tools;` after large
backfills.

**`.upsert()` with a partial payload** generates `INSERT ... ON CONFLICT` and
will fail `NOT NULL` constraints on insert. Bit this project twice.

---

## 3. How search actually ranks

Retrieval is three tiers (`lib/retrieval.ts`): hybrid (semantic + FTS via
`search_tools_advanced`) → full-text → none.

`/api/recommend` then **filters with the orchestrator but orders by the SQL
relevance score**. That combination was measured against the labeled set:

```
constants + JS ranking (original)     62%
real scores + JS ranking              73%
SQL order alone, no filtering         77%
orchestrator filter + SQL order       81%   <- shipped
```

Two traps worth knowing:

- **`source: "hybrid"` does not mean semantic ran.** The RPC returns `ok` with a
  null embedding by falling back to its text tiers. Use `usedEmbedding`.
- **A missing embedding is not zero similarity.** The SQL does
  `COALESCE(sim, 0.0) * 3.0`, which scores unmeasured rows as maximally
  dissimilar. While coverage is partial that is a systematic bonus for embedded
  rows; `coverageAdjustedScores` in `lib/retrieval.ts` corrects it and becomes a
  no-op at full coverage.

Retrieval is deterministic as of the current migration — it wasn't, and six
identical calls returned six disjoint result sets. `node
scripts/eval/retrieval-determinism.js` is the regression test.

---

## 4. Quota is the binding constraint

Gemini free tier: **1,000 embedding requests per day**
(`EmbedContentRequestsPerDayPerUserPerProjectPerModel-FreeTier`). Generation
quota is separate and far smaller — often a single call before 429.

Consequences:

- Query embeddings are generated on a query's **second** sighting, not its
  first. Measured on real traffic, 321 of 444 cached queries were keystroke
  fragments (`"ai t"`, `"ai too"`, `"ai tool"`…) and 338 were never repeated, so
  ~70% of the budget was going to strings nobody meant to submit. The trade: a
  brand-new query gets full-text results, a repeated one gets semantic.
- A length or word-count gate for this was tried and **rejected on measurement**
  — no threshold separates fragments from real queries.
- The backfill runs hourly via `.github/workflows/cron-backfill-embeddings.yml`
  and needs `CRON_SECRET` + `SITE_URL` in Actions secrets.

---

## 5. Evaluation tooling

`scripts/eval/labels.json` is the only real quality signal. The loose keyword
check in the eval scored 100% on a run that answered "TLDR" for "find and fix
bugs in my codebase".

| script | answers |
|---|---|
| `recommendation-eval.mjs` | live precision@1 against labels |
| `ranking-offline.mts` | A/B ranking variants offline, no server or quota |
| `retrieval-determinism.js` | is retrieval reproducible and in budget |
| `embedding-coverage.mts` | coverage by popularity band |
| `corpus-health.js` | duplicates and miscategorisation |
| `stack-stages.mts` | what every stack template stage retrieves |
| `stack-decomposition.mjs` | model goal-decomposition quality (needs quota) |
| `seo/audit.mjs` | publishable vs indexable page counts, per category |

**Labels are `labeledBy: "assistant"` — only 1 of 26 is human-reviewed.** That
count is the actual acceptance criterion for "recommendations are useful";
everything else is the assistant grading its own homework.

`ranking-offline.mts` also records **measured dead ends** — do not re-try
lexical-overlap blending, it makes ranking monotonically worse.

---

## 6. If you are working on SEO

Read §1 first. The specific hazards:

- **One page per row = ~130k near-duplicate pages.** Deduplicate on normalized
  name before generating anything, the way the search function does.
- **Category landing pages inherit bad categories** — `Klap` under
  "Code & Development" will be on the wrong page.
- **Sitemap generation must not walk the table naively.** Deep `.range()`
  offsets timed out at ~87,000 rows during a previous backfill; use keyset
  pagination.
- **Structured data for pricing needs the same caution the UI takes** — ~1.4%
  unclassified, and annual plans are stored as monthly equivalents.
- **Tool descriptions are scraped**, sometimes truncated mid-sentence, and some
  rows are GitHub repos rather than products. The project decided (2026-09-10)
  that a repo is an acceptable *recommendation*; whether it deserves an indexed
  page is a separate call.

### 6.1 The public layer as built (2026-09-12)

`docs/SEO_ARCHITECTURE.md` has the full design. The measurements that drove it,
reproducible with `npm run seo:audit`:

**The publishable set is ~2,900 rows, not 7,000 and not 260,000.** Popularity
tops out just under 150, so the band that matters is `popularity >= 90`:

| band | rows | distinct products |
|---|---|---|
| ≥ 150 | 0 | — |
| ≥ 90 | 2,929 | 2,913 |
| ≥ 60 | ~35,800 | not measured |

Deduplication barely matters *inside this band* — 2,929 rows collapse to 2,913
products, only 16 duplicates. The 55% duplication in §1 is concentrated in the
low-popularity GitHub re-ingests, which this band excludes. Dedupe anyway: the
band is a threshold, not a guarantee.

**Descriptions are hard-capped at exactly 200 characters, cut mid-word.** Of
1,000 sampled rows, 946 are exactly 200 chars long; the median is 200 and the
max is 500. 2,644 of 2,929 fail a "ends on sentence punctuation" test.

**Truncation is not a usable quality signal, and this cost a round trip.** The
first indexability gate rejected truncated descriptions and admitted **66 of
2,913 pages** — because the cap truncates the *good* descriptions too. What
actually separates a real page from a stub is word count and tag richness, and
on those the corpus is bimodal, so the gate is not balanced on a knife edge:

| gate | pages |
|---|---|
| ≥120 chars, has tags, not an "AI tool mentioned in:" stub | 2,704 |
| + ≥2 tags + has image | 2,701 |
| + ≥25 words | **2,603** ← shipped |
| + has outbound URL | 2,603 |
| (rejected) + not truncated | 66 |

So ~2,600 pages carry ~70 words, 9–15 tags, an image and an outbound link.
That is modest but genuine content, not scraped filler.

**Slugs do not collide.** Slugifying the 2,913 distinct names produced 0
collisions and 0 empty slugs, so `slugify(name)` is safe as the URL key. The
backfill still carries a `-2` suffix path for future rows.

**`ILIKE` being non-viable (§2) is why `slug` is a real column** rather than a
value matched against `name` at request time.

---

## 7. Environment notes

- This shell mangles `\\` and `$$` inside heredocs — both silently corrupted
  generated code here. Prefer the editing tools over heredoc-generated scripts.
- `scripts/setup/fix-npm-path.ps1` is unreadable (Windows Defender). It shows as
  deleted in `git diff` but not `git status`; a `git commit -a` would drop it.
- `npm run lint` is broken — neither `eslint` nor `@eslint/eslintrc` is
  installed, though `eslint.config.mjs` exists.
- **`npx tsc --noEmit` dies with `out of memory` on this machine**, and so will
  `next build`. The box has ~4 GB total and was measured with **38 MB free**;
  the TypeScript 7 compiler (the Go port, per `"typescript": "^7"`) allocates
  well past that. It is an environment limit, not a code error — the same
  checkout typechecks on CI. For a fast local sanity check that a file parses,
  `node_modules/.bin/esbuild <file> --jsx=preserve --outfile=/dev/null` costs
  almost nothing, but it validates syntax only and will not catch type errors.
- Some source files are CRLF (`lib/hooks/use-ai-tools.ts`), most are LF.
