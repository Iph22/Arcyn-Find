# Deployment

Blue-green: stage a build, verify it, then promote. Nothing goes straight to
production.

It runs on Vercel's Git integration rather than the Vercel CLI, for a reason
recorded at the bottom of this file.

---

## The flow

```
  merge PR -> main          Vercel builds a PREVIEW deployment   (the green)
  npm run smoke <url>       verify that exact build
  merge main -> release     Vercel promotes it to production     (the swap)
```

A preview deployment is a complete production-grade build of that commit, on
its own URL. Promoting is a rebuild of the same commit on the production
branch, so what you verified is what goes live.

## One-time setup

**Vercel → Project → Settings → Git → Production Branch: `release`.**

That single setting is what makes this blue-green. With it on `main`, every
merge publishes to production immediately and there is nothing to verify
first.

Then create the branch:

```bash
git checkout -b release main
git push -u origin release
```

## Releasing

```bash
# 1. main already merged; find the preview URL on the PR, or:
#    Vercel > Deployments > the newest one for main

# 2. verify that build, not production
npm run smoke -- https://arcyn-find-<hash>.vercel.app

# 3. promote only if it passed
git checkout release && git merge --ff-only main && git push
```

## Rolling back

Vercel → Deployments → pick the last good one → **Promote to Production**.
Instant, no rebuild. Then reset `release` to that commit so the next release
does not re-promote the bad one:

```bash
git checkout release && git reset --hard <good-sha> && git push --force-with-lease
```

## What `npm run smoke` checks

Deliberately not a generic uptime probe. Both assertions are regressions this
project actually shipped, and both returned HTTP 200 while broken:

| check | the failure it catches |
|---|---|
| 5 routes return 200 | the deployment is not serving |
| homepage states a real catalog count | figures read from the database failed; the page rendered an em dash |
| sitemap carries > 100 URLs | a swallowed query published 8 static pages as the whole site, telling Google it had 8 pages |

It takes any URL, needs no credentials, and exits non-zero on failure, so it
can gate a release by hand or from a script.

---

## Why not `vercel deploy` from CI

It was attempted and does not work here. The Vercel CLI authenticates as an
*account*; the tokens this project can issue are *project-scoped*. Measured
against the live API with two separate tokens:

```
/v2/user                404      <- the CLI needs this
/v2/teams               403      <- and this
/v2/teams/{ourTeam}     403
/v9/projects            200      <- only project endpoints work

$ vercel whoami --token ...
Error: User not found.
```

Every variation failed the same way: env vars alone, `--scope <teamId>`, and
`vercel pull` before `deploy`. It is the wrong credential class, not a wrong
value, so no flag fixes it.

A CI deploy job would also have been a *second* deploy path racing Vercel's
own, which would need the Git integration disabled — trading something that
works for something that does not.

The verification the CI job was going to provide is not lost: it is
`npm run smoke`, and it can point at any deployment.
