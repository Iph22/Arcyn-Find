# The public SEO layer

How Arcyn Find is exposed to search engines, what was actually wrong before,
and the two commands needed to turn it on.

Corpus measurements behind the numbers here live in
`docs/CORPUS_AND_CONSTRAINTS.md` §6.1 and are reproducible with
`npm run seo:audit`.

---

## 1. What was actually broken

An external SEO audit reported "your tool directory is behind sign-in". That
was the visible symptom; it was not the cause. `/tools` was already listed as a
public route in `proxy.ts` and was never gated. Four separate faults produced
the same appearance:

**The homepage pointed crawlers at the authenticated app.** The footer's
"Browse Tools" link was `href="/home"` — a route that is both auth-gated and
`Disallow: /home` in `robots.txt`. Following the site's own primary navigation
landed a crawler in a sign-in redirect. The public `/tools` directory existed
but nothing linked to it.

**The primary call to action was not a link.** The homepage's "Explore Tools"
button navigated with `onClick={() => router.push("/tools")}`. A crawler cannot
follow an onClick, so even the one path to the directory was invisible.

**The tool pages were client-rendered shells.** `/tools` and `/tools/[id]` were
both `"use client"` with data fetched in a hook. No `generateMetadata`, so every
tool page shipped the same title and description; no server-rendered body, so
the initial HTML contained no tool content at all. The `revalidate` exports in
their layouts did nothing, because there was nothing server-rendered to cache.

**The sitemap advertised ~52 files and could only fill one.** `loadAiEntries()`
used `.select('*').limit(10000)`, but PostgREST silently caps a response at
1,000 rows, so it never returned more than 1,000 — while the sitemap index
computed its file count from a `count: 'exact'` over the whole table and listed
~52 sitemaps, of which ~51 were empty. `select('*')` also pulled the 768-float
`embedding` column for every row. Every URL it emitted was of the form
`/tools?id=<id>` — a query parameter on a client-rendered page, so all ~1,000
"tool pages" in the sitemap resolved to the same document with the same title.

Additionally, `robots.txt` blocked `ChatGPT-User`, which is why the external
audit's own crawler saw so little of the site.

---

## 2. The shape now

```
PUBLIC (server-rendered, crawlable)        APPLICATION (auth-gated)
  /                  homepage                /home       app home
  /tools             directory               /profile
  /tools/category    category index          /settings
  /tools/category/*  category pages          /collections
  /tools/<slug>      tool pages              ...
  /browse            filter UI (noindex, follow)
```

The crawl graph is a closed loop: the homepage links to `/tools`, which links
to every category and to the top tools; each category page links to its tools
and to every other category; each tool page links to its category and to eight
related tools; and the footer on every public page links to every category.

`/browse` holds the interactive filter UI that used to live at `/tools`. It is
`noindex, follow` because its state lives in query parameters, which is an
unbounded URL space — but it is still crawlable so its outbound links are
followed. In-app navigation (sidebar, navbar, mobile nav) points there.

### Files

| path | role |
|---|---|
| `lib/seo/site.ts` | the absolute origin, guarded |
| `lib/seo/slug.ts` | slugify / normalize / description tidying, pure |
| `lib/seo/catalog.ts` | all server reads + the indexability gate |
| `lib/sitemap.ts` | sitemap + sitemap index |
| `app/tools/page.tsx` | directory |
| `app/tools/category/` | category index and pages |
| `app/tools/[slug]/` | tool pages + the interactive island |
| `components/seo/` | public chrome and linkable cards |
| `scripts/seo/backfill-slugs.mjs` | assigns one slug per distinct product |
| `scripts/seo/audit.mjs` | measures the layer against the live database |

---

## 3. Published vs indexable

These are two different decisions, and conflating them is the trap.

**Published** means the page exists, renders server-side, and is linked from
the directory. ~2,913 tools — one per distinct product in the
`popularity >= 90` band.

**Indexable** means the page additionally asks Google to index it. ~2,606 of
those. The rest are served `noindex, follow`: still crawled, still passing link
equity to their category and related tools, just not competing in search until
their content improves. Enriching a description flips a page automatically on
the next revalidation — there is no list to maintain.

The gate is `isIndexable()` in `lib/seo/catalog.ts`: at least 120 characters and
25 words of description, at least 2 tags, an image, an outbound URL, and not an
`"AI tool mentioned in:"` stub. See §6.1 of the corpus doc for why truncation is
deliberately *not* part of it.

A category page is indexable when at least 5 of its members are, and only
exists at all above 20 members.

**Indexability is decided in exactly one place: each page's
`generateMetadata`.** The blanket `X-Robots-Tag: index, follow` headers that
`proxy.ts` and `next.config.ts` used to set were removed — they would have
overridden every `noindex` above.

---

## 4. Turning it on

The slug column is the one thing that cannot be done from the application: it
is DDL, and PostgREST does not execute DDL.

**Step 1 — apply the migration.** Paste `supabase/migrations/add_tool_slugs.sql`
into the Supabase dashboard (SQL Editor → New query) and run it. It is additive
and reversible: one nullable column and two partial indexes.

**Step 2 — backfill the slugs.**

```bash
npm run seo:slugs:dry    # preview: what would be written, and to which rows
npm run seo:slugs        # write (~2,900 updates, throttled)
```

Then, in the SQL editor:

```sql
VACUUM ANALYZE ai_tools;
```

This is not optional. §2 of the corpus doc records a bulk write of this size
leaving index bloat and stale statistics that pushed an unrelated query from
2.8s to timing out, and it did not recover on its own.

**Step 3 — verify.**

```bash
npm run seo:audit
```

**Step 4 — after deploying**, submit `https://arcynfind.com/sitemap-index.xml`
in Google Search Console.

Until step 2 runs, no row has a slug, so the public pages render with zero
tools. That is the expected pre-migration state, not a bug.

---

## 5. Things deliberately not done

**No `/use-cases/*` pages.** They would be generated from the same rows with
different headings, which is how a directory acquires thousands of
near-duplicate URLs. They need their own written content to be worth having.

**No comparison (`/compare/a-vs-b`) pages.** Combinatorial, and the pricing data
is too unreliable to anchor a comparison — ~1.4% unclassified, and annual plans
stored as monthly equivalents.

**No indexed filter combinations.** `/browse?category=x&pricing=y` is noindex
by design.

**Pricing appears in structured data only when the ingest classified it.** A
confident `Offer` on scraped pricing would frequently be wrong.

**Category accuracy is inherited, not fixed.** ~2% of rows contradict their own
category (§1), so a video tool can appear on the coding page. The 20-member
floor limits the damage; it does not repair it. Fixing categorisation is the
highest-value follow-up, because it improves both these pages and search.

---

## 6. AI crawlers

`robots.txt` splits them by purpose rather than by vendor:

- **Allowed** — `ChatGPT-User`, `OAI-SearchBot`, `Claude-Web`,
  `Claude-SearchBot`, `PerplexityBot`. These fetch a page to answer a live
  question and cite the source, which is qualified referral traffic for a
  directory.
- **Blocked** — `GPTBot`, `CCBot`, `Google-Extended`, `anthropic-ai`,
  `Bytespider`, `Omgilibot`. Bulk training scrapes that send nothing back, and
  this catalog is the product.
