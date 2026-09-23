# Deployment

Blue-green: stage a build, verify it, then promote.

It runs on Vercel's Git integration rather than the Vercel CLI, for a reason
recorded at the bottom of this file.

> **This page described a flow that was never switched on.** Until 2026-09-22
> it opened with "Nothing goes straight to production" while the Vercel
> production branch was `main`, the `release` branch did not exist, and every
> merge to `main` reached production about two minutes later. The one-time
> setup below had been written but never performed, and nothing checked, so
> the claim went unchallenged for 150 commits.
>
> CI now asserts it on every run — `production-branch` in
> `.github/workflows/ci-cd.yml` reads the setting back from the Vercel API.
> **If that job is red, the rest of this page is not true yet.**

---

## The flow

```
  merge PR -> main          Vercel builds a PREVIEW deployment   (the green)
  smoke runs automatically  verify that exact build
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

Nothing in this repository can hold that setting in place — it is dashboard
state. So the `production-branch` job reads it back from
`/v9/projects/{id}` on every CI run and fails the build if it is anything but
`release`. That is the guard whose absence let this page stay wrong.

The `release` branch exists as of 2026-09-22. If it is ever lost:

```bash
git checkout -b release main
git push -u origin release
```

## Releasing

```bash
# 1. main is merged. Vercel builds a preview, and the "Verify deployment"
#    workflow smokes it automatically and reports against the commit.
#    Confirm it is green -- or run it yourself against the preview URL:
npm run smoke -- https://arcyn-find-<hash>.vercel.app

# 2. promote only if it passed
git checkout release && git merge --ff-only main && git push

# 3. tag it, so the deployed commit has a name (see Versioning)
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

### It runs on its own now

`npm run smoke` used to be referenced only inside a comment in `ci-cd.yml`,
which meant it ran when somebody remembered to run it.
`.github/workflows/deploy-verify.yml` now runs it on GitHub's
`deployment_status` event, so every deployment Vercel finishes — preview and
production alike — is smoked against its own URL and reports back on the
commit. A red check on a preview is the signal not to promote.

## Versioning

Releases are tagged `vMAJOR.MINOR.PATCH` on `release`, matching `version` in
`package.json` and the top entry in `CHANGELOG.md`.

```bash
# after the promote step above, with release checked out and pushed
git tag -a v1.2.0 -m "v1.2.0" && git push origin v1.2.0
```

Worth the effort even though Vercel can roll back without it: rolling back
means choosing the last good deployment, and a list of SHAs is not a list of
what shipped. Tags and a current changelog turn "which release broke this"
into a lookup instead of an excavation.

Before 2026-09-22 this repo had no tags at all, a `CHANGELOG.md` 150 commits
out of date, and `package.json` still reading `my-v0-project` at `0.1.0`.

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
