# Where links go

Read this before adding a search box, a result list, or a link to a tool or
category. Every rule below is here because the codebase got it wrong first, and
in each case the mistake was invisible to the type checker, the linter, and a
screenshot.

## /tools and /browse are not the same page

| route | what it is | reads `?search=` |
| --- | --- | --- |
| `/tools` | static SEO directory, `revalidate = 3600` | **no** |
| `/browse` | the interactive browser (`ToolsBrowser`), `noindex, follow` | yes |

`app/tools/page.tsx` takes no `searchParams` argument at all, so a query string
appended to it is silently dropped. The signed-in home page pushed
`/tools?search=...` on every search, which meant every search from that page
landed on a generic category grid with no sign that anything had been searched.

**Build search URLs with `searchHref()` from `lib/tool-href.ts`.** It owns the
route and the parameter name. The name mattered too: the homepage's JSON-LD
`SearchAction` advertised `?q=`, which `ToolsBrowser` does not read.

## Link to tools by slug, and use the helper

`toolHref()` in `lib/tool-href.ts`. It prefers `slug` and falls back to `id`.

Both resolve — `resolveToolRoute()` in `lib/seo/catalog.ts` accepts either —
but the id form costs a 308 redirect on every click, so it is the fallback, not
the default. `slug` is NULL below `PUBLISH_MIN_POPULARITY` and for anything
ingested since the last slug backfill; those pages still render, `noindex`,
which is the correct outcome for a real tool with no public page.

`slug` has to be selected to be used. It is in `AI_TOOLS_COLUMNS`
(`lib/supabase.ts`), in `AIEntry`, and in the `/api/tools/trending` select. A
new endpoint that omits it silently degrades every link it feeds to the
redirecting form.

## A search and a category go to different places

| the user did | lands on | why |
| --- | --- | --- |
| typed a query | `/browse?search=…` | a query needs filtering and refining |
| named a category | `/tools/category/<slug>` | a category is a destination with a curated list |

Use **`searchHref(query)`** and **`categoryPageHref(name, knownSlugs)`** /
`categoryPageSlugHref(slug)`. Every category link goes to the category's own
page, wherever it is — home-page shortcuts, a trending row's category label,
the footer, a tool page.

Watch the path segment: `/tools/category/<slug>` is one category,
`/tools/category` is the index of all of them. Landing on the index after
clicking a named category is a bug, and the two URLs differ by one segment.

`/browse?category=<slug>` also works and nothing links to it. It is kept
because `/browse` is an application surface whose state lives in its query
string, so the filter has to be expressible as a URL for that state to be
shareable at all.

**Two category vocabularies exist and neither is the other's slug.** The catalog
layer slugifies raw `ai_tools.category` values, so `Marketing & Sales` becomes
`marketing-sales`; the browser filters on display names, where the same category
is `Marketing` and slugifies to `marketing`. `lib/categories.ts` indexes both.

When that bridge breaks the failure is silent: an unresolved slug falls back to
`All`, the browser shows the unfiltered list, and `/browse` returns 200 either
way. `npm run test:home-links` asserts every published category slug resolves
to a real filter.

**A category name is still not a URL.** Category pages exist only above
`MIN_CATEGORY_SIZE` (20 published tools); measured 2026-09-28, **21** of the
catalog's categories qualify, and `Research & Open Source` and `Computer Vision`
are real category values that do not. `categoryPageHref()` returns `null` in
that case — the signal to render plain text instead of a link.

Onboarding interests are a separate trap: `preferences.categories` stores
abstract tags (`text`, `vision`, `coding`, `agents`, `automation`, `knowledge`,
`research`, `productivity`), none of which is a category value. Map them with
`categoriesForInterests()` in `lib/interest-categories.ts`.

## Don't populate a panel that makes a claim about the reader

"Recent Searches" shipped with three hardcoded strings. That is not a
placeholder — it is a false statement about the person reading it, and it
survived review twice because an empty panel looks unfinished and a full one
does not. Recent searches come from `lib/recent-searches.ts` (localStorage,
genuinely per-user) or the panel is empty. There is deliberately no starter
list.

They are **not** backed by `search_cache`: that table is global, with no user
column, so it would put one visitor's raw query text on every other visitor's
home page.

The same applied to the category shortcuts, which shipped as six hardcoded
cards labelled "Content Creation", "Creative", "Workflow" and "Popular" — none
of which is a value in `ai_tools.category`, so the label described nothing that
existed — shuffled with `Math.random()` on every mount. They are now real
published categories with real counts.

## There is no popularity signal yet. Don't rank on one.

Measured 2026-09-28, against production:

| signal | rows |
| --- | --- |
| `search_cache` (searches ever recorded) | **0** |
| `tool_views` (all time) | **44**, across 29 distinct tools |
| `user_favorites` | 9 |
| `tool_reviews` | 7 |
| `user_profiles` | 77 |

`trending_score` is non-null on 15,371 rows and `> 0` on 7,156, which looks
like signal and is not: the top ten values are a flat `20` derived from
`popularity`, and only one row (Cursor, 3 views) carries any view contribution
at all. `view_count_7d` is `> 0` on **29 rows**.

So nothing on the home page can honestly be ordered by popularity, and a block
headed "Popular Categories" was removed rather than ranked on 44 views. What is
real is catalog size — how many published tools a category holds — so that is
what the cards show, under a heading that says so.

The tracking itself works: `increment_search_count()` was probed directly and
wrote and read back correctly (`scripts/testing/probe-search-tracking.mts`).
The table is empty because nobody has searched yet, not because it is broken.
Re-run `scripts/testing/probe-engagement-signals.mts` before building anything
that claims to rank by engagement.

## A click handler is not a link

A result that opens a modal has no URL: it cannot be copied, shared, opened in
a new tab, prefetched, or crawled, and it contributes no internal links to the
tool pages the sitemap is trying to get indexed.

Listings use the stretched-link pattern — the title is a real `<a>` with
`after:absolute after:inset-0` over a `relative` card — so the whole card stays
clickable while the result keeps a genuine href. Anything interactive layered
on top (a favourite button, a "Details" button) needs `relative z-10`, or the
overlay swallows its clicks. Do not nest a `<button>` inside the `<a>`.

## Verifying

```
npm run test:home-links          # against a running dev server
npm run test:home-links -- https://example.com
```

It checks that every onboarding interest resolves to a category that has a
page, that every category `/api/categories` advertises really renders, that
every published slug also resolves to a browser filter rather than falling back
to `All`, and that a trending tool's `toolHref()` resolves. It exists because
the block it covers
previously shipped `<button>`s with no `onClick`, counts computed with
`Math.random()`, and a Tailwind class interpolated at runtime
(`from-${color}/5`) that therefore was never generated — all three type-checked
and linted clean.
