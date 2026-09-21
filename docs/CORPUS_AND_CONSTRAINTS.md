# Corpus shape and database constraints

Measured facts about `ai_tools` and the queries that run against it. Everything
here was verified against the live database, with the measurement shown — the
point is to stop the next person rediscovering it the expensive way.

Figures are from 2026-09-12 unless stated. Re-measure before trusting anything
load-bearing; the scripts named below will do it.

---

## 1. The corpus is not what it looks like

**15,219 rows, 15,218 products — as of 2026-09-21. It used to be 273,175
rows for the same products.** The gap was duplicate re-ingests, and it is gone;
this section is kept because the cause is still live if the guard is removed.

**What it was.** The first measurement sampled the 5,000 most-viewed rows and
found 55% duplicates, mostly GitHub-scraped:

| product | rows |
|---|---|
| tensorflow | 356 |
| Langflow | 290 |
| langchain | 279 |
| AutoGPT | 264 |
| transformers | 254 |

Walking the whole table rather than a sample showed the real figure was far
worse — 94.4%:

| | before (2026-09-21) | after |
|---|---|---|
| rows | 273,175 | **15,219** |
| distinct products | 15,218 | **15,218** |
| duplicate rows | 257,957 (94.4%) | **1 (0.0%)** |
| with a public page | 2,913 | **2,913** |

**Why it happened.** `lib/auto-update.ts` asked "which of these names do I
already have?" with `.select('name').in('name', <50 names>).limit(50)`. The
limit caps *rows*, not names, and one name could occupy hundreds — `AgenticX`
had 665. The 50 slots filled with copies of a single name, every other name
came back "not found", and all were re-inserted. Self-reinforcing: the more
duplicates, the fewer names the check could see. Over two days it added 432
rows for 8 new products, a 98% waste rate.

**How it was fixed.** Three parts, all required together:

1. `ai_tools.normalized_name` — a STORED generated column, indexed, so product
   identity is computed once instead of by regex over every row.
2. `existing_tool_names(text[])` — an RPC returning `DISTINCT`, so the answer
   is bounded by the *input* size and cannot truncate against PostgREST's
   1000-row cap. Both in `supabase/migrations/add_normalized_name.sql`.
3. `scripts/database/dedupe-tools.mjs` — deleted the 257,956 backlog rows
   (0 failures), keeping every row with a slug, every row referenced from
   another table, and the richest row of each remaining group.

Verify the chain with `npm run test:dedup`; measure the corpus with
`node scripts/eval/corpus-health.js`.

**If you touch the ingest, keep the guard.** Removing any of the three
rebuilds the backlog at roughly 200 rows/day, invisibly —
`search_tools_advanced` applies `DISTINCT ON (normalized name)` *before* its
final `LIMIT`, so search output stays clean (measured 780/780 distinct across
26 queries) while the duplicates quietly eat the candidate pool. Only code
that walks the table directly — sitemaps, exports, page generation — ever sees
them.

**Never publish a row count as the catalog size.** The row count once
overstated the catalog 18-fold and had leaked into the product: the landing
page rendered `/api/tools/count` (the planner's row estimate) as "272.7K+ AI
Tools", while Google separately showed "Over 25,000" — a number matching
nothing at all — against a directory a visitor could only see 2,913 of.
Anything stating a catalog size must read `catalog_stats_current()`
(`supabase/migrations/add_catalog_stats.sql`), which counts distinct
normalized names the same way `search_tools_advanced` de-duplicates. Verify
with `npm run test:stats`.

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

Those row counts are **pre-dedupe (2026-09-12)** and count duplicate rows, not
products — the `popularity ≥ 20` band is now ~15k rows, not 263,610. The
*percentages* still hold: coverage is concentrated in the popular head, and the
long tail is keyword-only. Re-measure before relying on the absolute
numbers — the command is directly below.

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

> **Correction, 2026-09-21: `idx_ai_tools_name_trgm` and
> `idx_ai_tools_description_trgm` do not exist on the live database.**
> `update_advanced_search_v2.sql`, which creates them, was never applied — so
> the measurements above were taken against *whatever indexing was actually
> present*, which was not the trigram indexes their labels claim. ILIKE being
> non-viable here still holds and is still the reason search uses FTS; but do
> not cite those rows as evidence about trigram indexes specifically. See §9.3.

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

**The publishable set is ~2,900 rows** — out of 7,000 that looked eligible,
and out of the 260,000 rows the table then held (§1). Popularity
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

## 7. Trending and view tracking (2026-09-14)

`/api/cron/update-trending` had failed **40 scheduled runs out of 40**, every one
`curl: (22) ... error: 504`, going back at least to 2026-09-04. It walked all of
`ai_tools` in 500-row `.range()` batches — 528 of them — which is §6's deep-offset
degradation:

| offset | latency |
|---|---|
| 0 | 520ms |
| 50,000 | 5.2s |
| 100,000 | statement timeout |

It could not read past ~100k rows, against a 60s budget. Replaced by
`refresh_trending_stats()` (`supabase/migrations/add_refresh_trending_stats.sql`),
which runs set-based: **733ms cold, 229ms warm**. Verify with `npm run test:trending`.

**Nearly all the work was unnecessary.** With no views the score is
`popularity * 0.2` — max ~20, threshold 60 — so a tool with no views can neither
become trending nor change score between runs. Only rows with views, plus rows
previously promoted, need touching.

**Writes to `ai_tools` are superlinear in chunk size.** Every row maintains all
indexes on the table, IVFFlat included:

| rows per UPDATE | latency |
|---|---|
| 50 | 753ms |
| 200 | 855ms |
| 500 | 2.1s |
| 1000 | statement timeout |

Chunk at ~250 and loop in the caller against a wall clock. This is §2's blast
radius at read scale, and it is easy to re-introduce.

**A partial index only helps when the query predicate matches it textually.**
`COALESCE(view_count_7d, 0) > 0` and `view_count_7d > 0` are equivalent here —
`NULL > 0` filters out like false — but the planner cannot prove the first
implies the second, so it skipped the index and scanned ~60k rows, taking 6.4s to
prove zero matched. Returning *zero* rows slower than returning 250 is the
signature. Prefer a single simple predicate, and `ANALYZE` after creating it.

**`is_trending` is not a trending signal.** Two writers: the ingest sets it from
source heuristics (GitHub stars > 500/3000, HuggingFace downloads > 100k, top-5
index), making it true for ~56,900 of 263,548 rows (~25%); `refresh_trending_stats`
sets it from real views. It has been removed from ranking in
`app/api/tools/trending/route.ts` and from the "Featured" badge and sort in
`components/tools/tools-browser.tsx` — a quarter of the catalog was displaying as
featured and sorting first. The stale rows are deliberately left in place: nothing
reads them, and rewriting 57k rows would churn every index for no benefit while
the ingest re-set them anyway. **Rank on `trending_score`.**

**`tool_views` was empty** until view tracking shipped, so `trending_score` and
`view_count_*` were NULL for every row. Any ranking built on them before that was
ranking on nothing.

---

## 8. Environment notes

- This shell mangles `\\` and `$$` inside heredocs — both silently corrupted
  generated code here. Prefer the editing tools over heredoc-generated scripts.
- **Windows Defender can make a file in this repo unreadable, and git fails
  badly when it does.** `scripts/setup/fix-npm-path.ps1` was blocked at the
  filter-driver level — `Get-Item` reported the path absent while a read threw
  *"the file contains a virus or potentially unwanted software"* (os error
  225). The script was benign; it appended `C:\Program Files\nodejs` to the
  machine PATH, which is also a malware persistence technique, so the
  heuristic fired. It was **deleted on 2026-09-21**; `setup-npm.ps1` and
  `quick-fix-npm.ps1` cover the session-scoped fix and the permanent one is
  now manual steps in `setup-npm.ps1`'s header.

  What it cost, so the next occurrence is recognised faster:

  - **It 500'd every page route.** Tailwind v4 content detection read every
    file in the project; the read error propagated through PostCSS and CSS
    compilation failed. API routes kept working, which made it look like a
    rendering bug. Fixed by `@source not` in `app/globals.css` — those
    exclusions stay.
  - **`git add -A` aborts and leaves the index untouched**, so a following
    `git diff --cached` returns empty and reads as "no changes" when in fact
    nothing staged. That false-clean result is the dangerous part. Checkout,
    pull and rebase fail the same way, and `git worktree add` silently
    produces an *incomplete* worktree.
  - It shows as deleted in `git diff` but not `git status`; `git commit -a`
    would drop it.

  If it happens again: exclude the path explicitly
  (`git add -A . ':!path/to/file'`), check exit codes rather than trusting an
  empty diff, and read the committed content with `git cat-file -p` rather
  than opening the file.
- `npm run lint` is broken — neither `eslint` nor `@eslint/eslintrc` is
  installed, though `eslint.config.mjs` exists.
- **`npx tsc --noEmit` may die with `out of memory` on this machine**, and so
  may `next build`. The box has ~4 GB total and was once measured with **38 MB
  free**; the TypeScript 7 compiler (the Go port, per `"typescript": "^7"`)
  allocates well past that. It is an environment limit, not a code error — the
  same checkout typechecks on CI.
  **It is worth trying before assuming it will fail**: it completed in under a
  minute on 2026-09-21 with more memory free, and caught a real type error that
  esbuild and oxlint both missed (a non-literal `select()` string widening to
  `GenericStringError`). Close other applications and try.
  For a fast sanity check that a file parses,
  `node_modules/.bin/esbuild <file> --jsx=preserve --outfile=/dev/null` costs
  almost nothing, but it validates syntax only and will not catch type errors.
  `npx oxlint <paths>` does catch unused and undefined identifiers.
- Some source files are CRLF (`lib/hooks/use-ai-tools.ts`), most are LF.

---

## 9. Quota is the other binding constraint (2026-09-21)

§4 covers the Gemini quota. This section covers Supabase's, which bit harder:
the free tier was at **216% of egress (10.8GB/5GB)** and **123% of database
size (0.616GB/0.5GB)**, with restriction (402s) due 2026-10-18.

The figures below are estimates from the row shape in §6.1 unless a
measurement is given. Re-measure before trusting anything load-bearing.

### 9.1 The egress was one pattern, not many

**Every public tool page downloaded the entire published catalog.**
`app/tools/[slug]/page.tsx` called `getRelatedTools()` and
`getCategoriesSafe()`; both called `getPublishedTools()`, which keyset-walks
all ~2,929 published rows across 17 columns — roughly **3-4MB to render an
8-item sidebar and ~30 footer links**. React's `cache()` deduped that within
one render but not across requests, so every ISR revalidation of every one of
~2,600 tool pages paid for it again.

The same walk sat behind `/tools`, `/tools/category/[slug]`, both sitemap
routes, and `generateStaticParams`.

**The rule that replaced it: reduce in SQL, not in JavaScript.** If you find
yourself calling `getPublishedTools()` and then `.filter()`, `.find()` or
counting the result, that is the bug. `getPublishedTools()` is now called by
the sitemap and nothing else, and it carries a comment saying so.

| caller | was | is |
|---|---|---|
| `getRelatedTools` | walk 2,929, score all, return 8 | two bounded probes (category, tag overlap), 60 each |
| `getCategories` | walk 2,929, count in JS | `published_category_stats()` aggregate, ~30 rows |
| `getCategoryBySlug` | walk 2,929, filter to one category | one query, `.in('category', names)`, capped at 300 |
| `getDirectoryData` | walk 2,929, take top 24 | bounded query, `limit(96)`, gate applied in JS |
| `findCanonicalSlug` | walk 2,929, `.find()` by normalized name | `find_published_slug_by_name()`, indexed equality |

`getPublishedTools()` additionally has a **10-minute process-level TTL cache
with single-flight** (`sharedWithTtl` in `lib/seo/catalog.ts`). React `cache()`
is request-scoped and was never going to help a crawler sweeping the sitemap;
this does. Single-flight matters as much as the TTL — without it, N concurrent
cold requests each start their own walk, which is exactly the burst a crawler
produces.

**`published_category_stats()` duplicates `isIndexable()` in SQL.** That is a
real drift risk and it is deliberate: the JS version decides `robots: noindex`
from a row already in memory, and the SQL version exists so counting does not
cost 3-4MB. **If you change one, change the other**, and re-run
`npm run seo:audit`.

### 9.2 The other egress items, in order of size

- **`<link rel="prefetch" href="/api/ai-models">` in the root layout.** On
  every page of the site, crawler hits included. Unparameterized, that endpoint
  defaulted to `limit=500`, so it pulled ~500 full tool rows that nothing
  consumed — the grid asks for 24. `s-maxage=300` capped it at one 500-row read
  per 5 minutes, which is still ~5GB/month. **Removed.**
- **`/api/ai-models` default limit was 500**, now 24. This is what made the
  above expensive rather than merely pointless.
- **Supabase Storage images were re-pulled every 4 hours per variant.** Next 16
  defaults `minimumCacheTTL` to 14400, and the effective max-age is the *larger*
  of that and the upstream `Cache-Control` — so `lib/storage.ts` uploading with
  `cacheControl: '3600'` was silently capping what `next.config.ts` could do.
  Now 31 days and 1 year respectively. Safe because upload paths are
  timestamped (`${userId}-${Date.now()}.${ext}`), so a new image is a new URL.
  **There is no cache invalidation** — a changed image needs a changed `src`.
- **`getCollection()` fetched `/api/ai-models` (500 rows) to resolve a handful
  of tool ids.** Now `.in('id', toolIds)`. That relative `fetch()` also meant
  the function only ever worked in the browser.
- **The client cache in `use-ai-tools.ts` saved no bandwidth.** It rendered the
  hit and then fetched anyway. Now returns early under 30s; older-but-valid
  entries still revalidate.
- **`getActivityFeed()` was an N+1** — up to 2 queries per activity inside the
  loop, 41 round trips for a 20-item feed. Now two `.in()` lookups.
  `app/api/user/activity/route.ts` already did this correctly; the two had
  diverged.

`app/api/tools/trending/route.ts` and `app/api/user/collections/route.ts` were
checked and were already correct. **There are no polling loops and no realtime
subscriptions anywhere in this codebase** — the only two `setInterval` calls are
a rate-limiter cleanup and a typing animation.

### 9.3 Storage

- **Indexes are ~281 MB of the 631 MB database — about 45%.** Measured
  2026-09-21; `supabase/migrations/drop_unused_indexes.sql` carries the full
  table and the drop candidates.

  **This entry originally claimed the biggest win was dropping two GIN trigram
  indexes on `name` and `description`. That was wrong: those indexes do not
  exist.** `update_advanced_search_v2.sql` was never applied. The prediction
  came from reading the migrations directory and assuming it described the live
  schema — **it does not.** Six of the 25 indexes on `ai_tools` appear in no
  migration file at all (`idx_ai_tools_name_search`, `idx_ai_tools_fts_gin`,
  `idx_ai_tools_embedding_hnsw`, `idx_ai_tools_category`,
  `idx_ai_tools_priority_popularity`, `idx_ai_tools_access_type`,
  `idx_ai_tools_region`, `idx_ai_tools_is_trending`).

  **Query `pg_stat_user_indexes` before reasoning about indexes here.** The
  same error also produced advice to *keep* `idx_ai_tools_platform_trgm` on the
  grounds it was "small" — it is 46 MB, the largest index on the table, with 1
  lifetime scan.

  What the measurement actually found: `ai_tools_embedding_idx` (IVFFlat, 28 MB,
  0 scans) is superseded by `idx_ai_tools_embedding_hnsw` (16 MB, 2168 scans) —
  dropped, which also removes IVFFlat maintenance from every write (§7).
  `idx_ai_tools_name_search` (28 MB) and `idx_ai_tools_tags_gin` (6.7 MB) are at
  0 scans, and `ai_tools_fts_idx` + `idx_ai_tools_fts_gin` are 72 MB of
  possibly-duplicate full-text index. Those four need their `indexdef` checked
  before dropping and are left commented in the migration.
- **`search_cache` had no eviction of any kind.** Every row holds a
  `vector(768)` (~3KB) plus `recommendation` and `stack` jsonb. §4 measured
  ~76% of rows as keystroke fragments never looked up twice. `prune_search_cache()`
  now runs on the 6-hourly trending cron.
- **`discovery_queue` was insert-only.** Nothing in the repository ever read
  it. Write removed, table dropped. **If you rebuild this, write the consumer
  first** — the schema is in `add_cache_retention.sql`.
- **The landing page ran an exact count over ~263k rows per visitor** to render
  a figure it displays rounded. Now `ai_tools_estimated_count()` (reltuples, no
  table access) behind `/api/tools/count`, CDN-cached for a day.

**Not done, deliberately:** the 55% duplicate re-ingests (§1) are the bulk of
the table, but deleting them is a bulk write against an indexed table, which §7
measured as superlinear and capable of degrading unrelated queries for hours.
The safe subset is rows below the publish band with no slug, no views, no
favourites and no reviews — measure it before acting, chunk at ~250, and
`VACUUM ANALYZE` after.

**Also not done:** `VACUUM FULL`. A plain `VACUUM` reclaims space for reuse but
does not return it to the OS, so it will not move the quota number; `VACUUM
FULL` will, but it takes an ACCESS EXCLUSIVE lock and needs ~2x the table size
free. Drop the indexes first and re-measure — that may be enough on its own.

### 9.4 Verify before assuming the fix landed

Measure, do not infer. The index section of this document was written from the
migrations directory rather than from the database and was wrong about which
indexes exist, which was the largest, and which to keep (§9.3). Run these.

```sql
-- Index sizes, usage AND definitions. The definition is not optional: two
-- indexes can have similar names and sizes and index different things, and
-- "idx_scan = 0 so drop it" was how the wrong conclusion got reached.
SELECT s.indexrelname,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size,
       s.idx_scan,
       i.indexdef
  FROM pg_stat_user_indexes s
  JOIN pg_indexes i ON i.indexname = s.indexrelname AND i.tablename = s.relname
 WHERE s.relname = 'ai_tools'
 ORDER BY pg_relation_size(s.indexrelid) DESC;

-- A zero scan count means nothing if the stats were reset yesterday.
SELECT stats_reset FROM pg_stat_database WHERE datname = current_database();

-- Bloat, and whether autovacuum is keeping up.
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum, last_autoanalyze
  FROM pg_stat_user_tables ORDER BY n_dead_tup DESC;

-- Has tool_views retention ever actually run? §7 records 40 failed runs out
-- of 40 before the RPC rewrite. If min(viewed_at) predates the retention
-- window, it has not.
SELECT min(viewed_at), count(*) FROM tool_views;
```
