<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Before querying or generating pages from `ai_tools`

Read `docs/CORPUS_AND_CONSTRAINTS.md`.

The table does not behave the way its size suggests. 55% of it is duplicate
re-ingests of a few projects, `ILIKE` is non-viable at any indexing, several
natural query shapes hit the statement timeout, and PostgREST silently caps
responses at 1000 rows — so a plausible-looking number is often a truncation
rather than a measurement. That document records what was measured, and how.
