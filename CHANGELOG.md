# Changelog

All notable changes to this project will be documented in this file.

Releases are tagged `vMAJOR.MINOR.PATCH` on the `release` branch and match
`version` in `package.json`. See `docs/DEPLOYMENT.md` for the release flow.

---

## [1.2.0] - 2026-09-22

Reconstructed from git history (PRs #1–#48). No changelog entry had been
written since 2025-11-29, 150 commits earlier, so this covers everything
between that point and the first tagged release.

### 🌍 Internationalisation

- Translated the sidebar, mobile navigation and guest navigation (#37)
- Translated the settings page (#40), tool detail modal and public profile (#44),
  contact and about pages (#45), onboarding and landing page (#43), and the
  remaining pages (#41)
- Translated the auth pages, onboarding and collection pages (#49)
- Added an i18n audit tool, and fixed two blind spots it could not see (#43, #46)
- Translated the privacy policy (#46) and the terms page chrome (#47)
- Kept the privacy and terms *clauses* in English deliberately — translated
  legal text is a liability, not a feature (#47, #48)
- Translated labels that hand-written JSX still carried past the extractor (#38)
- Language now persists to the account, and `lang`/`dir` are set correctly for
  RTL (#36)

### 🔔 Notifications

- Weekly email digest sender (#5)
- Browser push notifications for the weekly digest (#34)
- A digest run that reached nobody is now reported as a failure rather than a
  success (#30)
- The provider message id is stored for every send, so deliveries can be traced
  (#39)

### 📚 Catalog integrity

- **Stopped re-ingesting tools the catalog already had (#19).** A `.limit()` on
  an existence check capped rows where it meant to cap names, leaving the table
  94.4% duplicate re-ingests. Ingest now goes through `existing_tool_names`.
- De-duplication script kept in the repo, with a record of what it removed (#20)
- The landing page states the real catalog size, measured rather than asserted
  (#9); read it via `catalog_stats_current()`, never a raw row count
- Stopped claiming 50K community members on a site with 73 (#23)
- Added the tool profile fields Ask Arcyn needs, and a way to fill them (#10)
- Fixed an enrich schema the API would reject, and stopped `collect` losing
  paid results (#22)

### 🔐 Authentication

- Session signing (#1)
- Google account chooser: people can pick an existing account (#31)
- The sign-up page no longer primes Google *account creation* (#32)
- Android users are warned before the hand-off to Google (#33)

### 🎨 Interface

- Landing page shows real search results; creator section redesigned (#28)
- Hero no longer clips its third result (#29)
- Mobile: navigation unblocked, button scale restored, glass chrome added (#25)
- Mobile: footer category names restored, touch sizing no longer shrinks
  buttons (#27)

### ⚡ Performance

- Trending: replaced a full-table walk with a set-based RPC (#2)
- Stopped the Supabase egress overage at its source and reclaimed storage (#7)
- Corrected index findings against the live database rather than assumptions (#8)

### 📱 PWA

- Stopped caching authenticated responses, and made the precache actually work
  (#35)

### 📮 Contact & API

- Contact submissions persist, and escape at output rather than input (#26)
- API no longer flattens caller-authored errors into "Internal server error"
  (#14)
- Review-round feedback widget, behind an env flag (#15)
- Public contact address moved to hello@arcynfind.com (#16)

### 🚢 Release management

- **Blue-green deployment is now enforced rather than merely documented.**
  `docs/DEPLOYMENT.md` had claimed "Nothing goes straight to production" since
  #11, but the Vercel production branch was still `main` and the `release`
  branch did not exist, so every merge published to production unverified. The
  `release` branch now exists and a `production-branch` CI job reads the
  setting back from the Vercel API on every run, failing the build if it drifts
  (#11, #17, #18)
- `npm run smoke` now runs automatically against every deployment via the
  `deployment_status` event, instead of being referenced only in a comment
- `npm run smoke` understands Vercel Deployment Protection: protected previews
  answer HTTP 200 with an SSO login page, which it used to report as an
  unreachable database. It now detects the wall, names it, and accepts
  `VERCEL_AUTOMATION_BYPASS_SECRET` to get through it
- First tagged release: the repo previously had no git tags at all
- `package.json` renamed from `my-v0-project` to `arcyn-find`, version
  `0.1.0` → `1.2.0`
- Branch protection added to `main` and `release`

### 🧹 CI

- The lint gate actually runs, on oxlint (#3, #11)
- Scheduled-workflow failures raise an alert; CI steps that could not fail were
  removed (#4)
- Dropped the no-op `?? {}` fallbacks that turned main red (#6)
- Removed, then ignored, the setup script Windows Defender will not let anyone
  read (#21, #24)

---

## Historical entries

> The two entries below were both added in a single commit on 2025-11-29 and
> their dates are internally inconsistent — 1.1.0 is dated eleven months
> *before* 1.0.0. Neither date can be corroborated from git history, so they
> are preserved as written rather than silently corrected.

## [1.1.0] - December 27, 2024 *(date as originally recorded; unreliable)*

### ✅ Added
- Comprehensive documentation file merging all previous docs
- Constants file (`lib/constants.ts`) for centralized configuration
- API utilities file (`lib/api-utils.ts`) with reusable helpers
- Rate limiting to review submissions and contact form
- Improved error handling with Promise.allSettled
- Logger utility integration across API routes

### 🔧 Changed
- Replaced console.* calls with logger utility (30+ instances)
- Improved error handling in home page and profile page
- Enhanced type safety (removed `any` types)
- Better error messages with user-facing feedback

### 🗑️ Removed
- 9 redundant documentation MD files (merged into COMPREHENSIVE_DOCUMENTATION.md)

### 🐛 Fixed
- Type safety issue in use-favorites.ts
- Promise.all error handling (one failure blocking all)
- Missing error handling in trending tools load

---

## [1.0.0] - November 23, 2025 *(date as originally recorded)*

### ✅ Initial Release
- Complete AI tools discovery platform
- Clerk authentication integration
- Supabase database backend
- User profiles and settings
- Collections system
- Reviews system
- Social features (follow/unfollow)
- Search and filtering
- Responsive design

---

See `COMPREHENSIVE_DOCUMENTATION.md` for complete feature list and documentation.
