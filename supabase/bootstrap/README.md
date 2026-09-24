# Provisioning a fresh Supabase project

Run order for building this schema from nothing. Produced 2026-09-24.

**You cannot do this from `supabase/migrations/` alone.** Eleven tables —
including `ai_tools` — have no `CREATE TABLE` statement anywhere in this
repository, `supabase/schema.sql` is zero bytes, and
`001_clerk_compatible_schema.sql` is a *conversion* migration that assumes the
tables already exist. That is why `02_tables.sql` had to be generated from the
live database rather than written from the repo.

---

## Order

Run each block top to bottom in the Supabase SQL editor. Stop at the first
error rather than continuing — later files assume earlier ones succeeded.

### 1. Bootstrap files, in this directory

| # | file | what it does |
|---|---|---|
| 1 | `01_extensions.sql` | `vector`, `pg_trgm`, `pgcrypto`, **and the two enum types** |
| 2 | `02_tables.sql` | the 11 tables with no DDL in the repo, plus their foreign keys |
| 3 | `03_view_and_grants.sql` | `user_stats` view, grants, **and an RLS decision you must make** |

`01` carries the `tool_learning_curve` and `tool_status` enums even though
`add_tool_profile_fields.sql` also defines them. `ai_tools.learning_curve` and
`ai_tools.status` are declared with those types, so `02` fails with *"type
public.tool_status does not exist"* unless they are created first — and that
migration runs far too late. Both definitions are guarded, so the migration
remains a no-op when it runs later.

### 2. Then these migrations, in this exact order

From `supabase/migrations/`. Order is dependency-driven, not alphabetical.

```
add_advanced_search.sql               search_cache, fts_vector + trigger, FTS index
add_semantic_search.sql               embedding column (its IVFFlat index is dropped at the end)
add_view_tracking.sql                 tool_views, view-count columns
add_tool_submissions.sql
add_priority_column.sql
add_structured_pricing.sql
add_tool_slugs.sql                    slug column + partial unique index
add_normalized_name.sql
add_recommendation_cache.sql          columns on search_cache
add_stack_cache.sql                   columns on search_cache
add_recommendation_feedback.sql
fix_advanced_search_bounded_retrieval.sql   the CURRENT search_tools_advanced
add_refresh_trending_stats.sql
add_missing_perf_indexes.sql
add_seo_catalog_rpcs.sql              published_category_stats, find_published_slug_by_name
add_cache_retention.sql               prune_search_cache
add_catalog_stats.sql                 catalog_stats_current
add_notification_digest.sql
add_contact_submissions.sql
add_push_subscriptions.sql
add_tool_profile_fields.sql
drop_unused_indexes.sql               LAST of the migrations — see note below
```

### 3. Finally

| # | file | what it does |
|---|---|---|
| 4 | `04_indexes_not_in_migrations.sql` | the HNSW vector index and five btrees that exist live but in no migration |

---

## Deliberately skipped

| file | why |
|---|---|
| `001_clerk_compatible_schema.sql` | One-way UUID→TEXT conversion against a database that already existed. The tables in `02` are already TEXT. Its `user_stats` view and grants are extracted into `03`. |
| `update_advanced_search_v2.sql` | Superseded by `fix_advanced_search_bounded_retrieval.sql`. It also creates trigram indexes on `name` and `description` that were measured non-viable (§2) — and which turned out never to have been applied to the old project at all. |
| `fix_embedding_dimensions.sql` | Repairs a wrong vector dimension on an existing column. `02` already declares `vector(768)`. |
| `reindex_embeddings_after_backfill.sql` | Maintenance, not schema. |
| `drop_stale_search_overload.sql` | Drops a function overload that will not exist on a new project. |

## Why `drop_unused_indexes.sql` runs last

`add_semantic_search.sql` creates an IVFFlat index on `embedding`. Measured on
the old project it was 28 MB with **zero scans** — the planner always chose the
HNSW index instead. Running the drop at the end of the migration sequence leaves
the database in the correct final state without editing either file.

This is also why `04` must run *after* it: the drop removes IVFFlat, and `04`
adds the HNSW index that actually gets used. Skip `04` and you finish with no
usable vector index at all.

---

## What is verified, and what is not

Being explicit because an earlier pass on this project asserted things about
indexes that were read from the migrations directory and turned out to be false.

**Verified** — read from the live database on 2026-09-24 via the PostgREST
OpenAPI schema:

- the 20 tables and views, their column names, Postgres types, NOT NULL, and
  primary/foreign keys
- the 16 RPC functions that exist

**Not verified** — reconstructed, and worth capturing from the old project
before it is gone:

- **column DEFAULTs** — inferred from convention (`gen_random_uuid()`, `now()`)
- **CHECK and UNIQUE constraints** — absent from the OpenAPI schema entirely.
  `add_missing_perf_indexes.sql` refers to `UNIQUE(tool_id, user_id)` on
  `tool_reviews` and `UNIQUE(follower_id, following_id)` on `user_follows`,
  neither of which is created anywhere in this repo.
- **index definitions** in `04` — names, sizes and scan counts are measured;
  the `CREATE INDEX` statements are reconstructed from column names and usage.
- **RLS policies** — see the long note in `03`.

Three queries capture all of it. Run them against the old project **while it
still exists** and paste the output over the inferred parts:

```sql
-- Defaults
SELECT table_name, column_name, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public' AND column_default IS NOT NULL
 ORDER BY 1, 2;

-- CHECK / UNIQUE / FK constraints
SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid)
  FROM pg_constraint WHERE connamespace = 'public'::regnamespace
 ORDER BY 1, 2;

-- Index definitions, and RLS
SELECT tablename, indexname, indexdef FROM pg_indexes
 WHERE schemaname = 'public' ORDER BY 1, 2;
SELECT tablename, policyname, roles, cmd, qual, with_check
  FROM pg_policies WHERE schemaname = 'public' ORDER BY 1, 2;
```

---

## This creates an empty database

Schema only. No rows. Moving the data is a separate job, and worth doing
deliberately rather than by copying everything:

- The old `ai_tools` was **94.4% duplicate re-ingests** (257,545 of 272,755
  rows) until they were deleted on 2026-09-21. Do not reintroduce them.
- Only ~5,900 rows carry a `slug` and are reachable as public pages.
- `search_cache` is a cache. Do not migrate it; it refills.
- `tool_views` has 30-day retention applied by `refresh_trending_stats()`.
  Only recent rows are meaningful.

## A new project does not fix the burn rate

The old project hit 11.93 GB against a 5.5 GB egress quota. A fresh project
starts the counter at zero, but the same code against the same schema spends it
at the same rate — so carry the fix across. The sitemap was re-walking the
entire published catalog (4.1 MB) every hour on three separate URLs, roughly
80% of the daily burn; that is fixed on `main` as of #57. Verify the deployment
pointing at the new project includes it.
