<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Before adding a link, a search box, or a result list

Read `docs/ROUTING.md`.

`/tools` and `/browse` are different pages and only one of them reads
`?search=`. Linking a tool by id costs a 308 on every click. Slugifying a
category name produces a 404 for every category below the size floor. And a
click handler that opens a modal is not a link — it leaves the result with no
URL at all, which is how the app came to contribute zero internal links to the
pages the sitemap is trying to get indexed.

# Before querying or generating pages from `ai_tools`

Read `docs/CORPUS_AND_CONSTRAINTS.md`.

The table does not behave the way its size suggests. `ILIKE` is non-viable at
any indexing, several natural query shapes hit the statement timeout, and
PostgREST silently caps responses at 1000 rows — so a plausible-looking number
is often a truncation rather than a measurement. That document records what
was measured, and how.

It also held 94.4% duplicate re-ingests until 2026-09-21, caused by a `.limit()`
on an existence check that capped rows where it meant to cap names. Those rows
are deleted and the ingest now goes through `existing_tool_names`, but the
failure rebuilds itself silently if that guard is removed — §1 has the detail.
Never publish a row count as the catalog size; read `catalog_stats_current()`.
