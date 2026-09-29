"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Search, SlidersHorizontal, Compass, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"

import { ArcynLogo } from "@/components/landing/arcyn-logo"
import { categoryPageSlugHref, searchHref } from "@/lib/tool-href"

const ThemeToggle = dynamic(() => import("@/components/layout/theme-toggle").then(mod => mod.ThemeToggle), { ssr: false })
const LanguagePicker = dynamic(() => import("@/components/layout/language-picker").then(mod => mod.LanguagePicker), { ssr: false })
const BrowserSearchAnimation = dynamic(() => import("@/components/search/browser-search-animation").then(mod => mod.BrowserSearchAnimation), { ssr: false })
import type { LandingSearchDemo } from "@/lib/landing/search-demo"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"

export interface LandingStats {
  /** Distinct products in the catalog. NOT the row count — the row count once
   *  overstated this ~18x, see lib/seo/catalog-stats.ts. */
  toolCount: number
  /** Distinct products with a public page at /tools/<slug>. */
  published: number
  /** Categories with public landing pages. */
  categories: number
}

/** One hero chip: a category large enough to have a page of its own. */
export interface LandingCategory {
  slug: string
  name: string
  count: number
}

/**
 * The landing page.
 *
 * LAYOUT
 *
 * A conventional scrolling page: header, hero, "how it works", footer. It
 * replaced six `min-h-dvh` scroll-snap frames, which forced a full viewport
 * gesture per section and put the search box — the thing the page exists to
 * offer — four frames deep, behind a sign-in box. Search is now the first
 * interactive element on the page.
 *
 * WHAT IT MAY CLAIM
 *
 * Every figure arrives as a prop from the server component in app/page.tsx, so
 * a crawler reads it in the HTML and there is no flash of a missing number.
 *
 * The design this was built from carried a testimonial rail: "4.8/5", "From
 * 10,000+ users", and three named reviews. Measured against production on
 * 2026-09-29, `tool_reviews` holds 7 rows averaging 4.1 and `user_profiles`
 * holds 77 — so the rail would have been an invention, and this page has
 * shipped invented figures before ("50K+ Active Users", "150K+ Daily
 * Searches", "120+ Countries", none of them measured). The rail states catalog
 * size instead, which is both genuinely large and genuinely counted.
 *
 * The same reasoning removed the old "Why Arcyn Find?" trio. "Every tool is
 * manually tested and verified" was false of a scraped corpus, and "Join
 * thousands of developers worldwide" was false of 77 accounts. "How it works"
 * describes what the product does instead, which needs no such claim.
 *
 * WHERE THINGS LINK
 *
 * See docs/ROUTING.md. Briefly: free text goes to /browse via searchHref(), a
 * named category goes to its own page via categoryPageSlugHref(), and both are
 * real anchors rather than click handlers so they can be crawled, copied and
 * opened in a new tab.
 */
export function LandingPage({
  stats,
  searchDemo,
  categories: categoryChips,
}: {
  stats: LandingStats
  searchDemo: LandingSearchDemo
  categories: LandingCategory[]
}) {
  const { t } = useLanguage()
  const router = useRouter()
  const { isAuthenticated, isLoading, signIn } = useAuth()
  const { toolCount, published, categories } = stats
  const [query, setQuery] = useState("")

  // Redirect authenticated users (but not for bots/crawlers)
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      const isBot = /bot|googlebot|crawler|spider|robot|crawling|bingbot|slurp|duckduckbot|baidu|yandex|sogou|exabot|facebot|facebook|ia_archiver|inspection|google/i.test(userAgent)

      if (!isBot) {
        // replace, so the query params from a Google result are not preserved
        router.replace('/home')
      }
    }
  }, [isLoading, isAuthenticated, router])

  // searchHref() owns the route and the parameter name. Typing a query and
  // pressing enter has to land on the page that actually filters: /tools takes
  // no searchParams at all and silently drops the query.
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(searchHref(query))
  }

  /* The three steps. Each one ends in a real link, because a step that
     describes a capability and then offers no way to reach it is an
     advertisement rather than a route into the product. */
  const steps = [
    {
      n: "01",
      icon: Search,
      title: t("landing.stepSearchTitle"),
      desc: t("landing.stepSearchDesc"),
      cta: t("landing.stepSearchCta"),
      href: "/browse",
    },
    {
      n: "02",
      icon: SlidersHorizontal,
      title: t("landing.stepCompareTitle"),
      desc: t("landing.stepCompareDesc"),
      cta: t("landing.stepCompareCta"),
      href: "/compare",
    },
    {
      n: "03",
      icon: Compass,
      title: t("landing.stepDiscoverTitle"),
      desc: t("landing.stepDiscoverDesc"),
      cta: t("landing.stepDiscoverCta"),
      href: "/tools",
    },
  ]

  return (
    <div className="min-h-dvh w-full bg-background text-foreground">
      <header className="sticky top-0 z-50 glass-header">
        <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Arcyn Find">
              <ArcynLogo className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              <span className="text-lg sm:text-xl font-bold tracking-tight">
                Arcyn <span className="text-primary">Find</span>
              </span>
            </Link>

            {/* Every destination here is public.
              *
              * The design named these Discover / Categories / Collections, but
              * /collections calls router.push("/") for anyone not signed in —
              * so a nav item pointing at it would bounce a logged-out visitor
              * straight back to this page, which is the same failure
              * docs/ROUTING.md records for the footer's old /home link. This
              * page is only ever rendered signed-out (authenticated users are
              * redirected to /home above), so the third slot goes to
              * /community, which is public and is the nearest public thing to
              * collections the site has. */}
            <nav className="hidden md:flex items-center gap-1 text-sm">
              <Link href="/tools" className="px-3 py-2 rounded-md text-foreground hover:bg-accent transition-colors">
                {t("landing.discover")}
              </Link>
              <Link href="/tools/category" className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                {t("landing.categories")}
              </Link>
              <Link href="/community" className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                {t("community.heading")}
              </Link>
            </nav>

            <div className="flex-1" />

            <form onSubmit={submitSearch} className="hidden lg:flex items-center" role="search">
              <label htmlFor="header-search" className="sr-only">{t("landing.searchLabel")}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="header-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("landing.searchShortPlaceholder")}
                  className="h-9 w-56 xl:w-64 rounded-full border border-border bg-card/60 pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
            </form>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={signIn}>
                {t("nav.signIn")}
              </Button>
              <Button size="sm" onClick={signIn}>
                {t("nav.getStarted")}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border/60">
        {/* Ambient wash. Two primary-tinted radials rather than a flat panel,
            so the hero separates from the section below it without a hard
            edge. pointer-events-none: it spans the whole section and would
            otherwise sit on top of the search box. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_75%_20%,var(--primary)_0%,transparent_60%)] opacity-10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_50%_at_10%_90%,var(--primary)_0%,transparent_65%)] opacity-[0.07]"
        />

        <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
          <div className="grid gap-10 lg:gap-8 lg:grid-cols-12 items-start">
            {/* Left: the pitch and the search box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-5 xl:col-span-4"
            >
              <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-primary">
                {t("landing.eyebrow")}
              </p>

              <h1 className="mt-4 text-4xl sm:text-5xl xl:text-6xl font-bold tracking-tight leading-[1.08]">
                {/* Two block lines rather than one wrapping phrase. As
                    inline spans the accent broke wherever the measure ran
                    out -- "AI tool for / what you are / building." -- which
                    put the colour change mid-line. Each half is a complete
                    phrase in every locale, so each gets its own line and
                    wraps within itself. */}
                <span className="block">{t("landing.heroTitle")}</span>
                <span className="block text-primary">{t("landing.heroAccent")}</span>
              </h1>

              <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-md">
                {t("landing.heroSub")}
              </p>

              {/* The search box. A real <form>: enter submits, and the button
                  is type=submit, so it behaves the way a browser's own search
                  affordances do. */}
              <form onSubmit={submitSearch} className="mt-7 sm:mt-8" role="search">
                <label htmlFor="hero-search" className="sr-only">{t("landing.searchLabel")}</label>
                <div className="relative flex items-center rounded-full border border-border bg-card/80 shadow-lg backdrop-blur-sm transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                  <Search className="absolute left-5 h-5 w-5 text-muted-foreground pointer-events-none" />
                  <input
                    id="hero-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("landing.searchPlaceholder")}
                    className="h-14 sm:h-16 w-full rounded-full bg-transparent pl-14 pr-16 text-base outline-none placeholder:text-muted-foreground"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    aria-label={t("landing.searchLabel")}
                    className="absolute right-2 h-11 w-11 rounded-full"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>
              </form>

              {/* Category chips.
                *
                * Real categories, with real pages. `categoryPageSlugHref` and
                * a server-supplied list, because a category name is not a URL:
                * slugifying one below MIN_CATEGORY_SIZE produces a 404, and
                * inventing plausible labels ("AI writing", "Design") produces
                * links to pages that describe nothing in the catalog. The
                * order is by catalog size, which is what the server sorted on
                * — not popularity, which this site has no signal for. */}
              {categoryChips.length > 0 && (
                <nav className="mt-5 flex flex-wrap gap-2" aria-label={t("landing.browseByCategory")}>
                  {categoryChips.map((c) => (
                    <Link
                      key={c.slug}
                      href={categoryPageSlugHref(c.slug)}
                      className="rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs sm:text-[13px] text-muted-foreground transition-colors hover:text-foreground hover:border-primary/50 hover:bg-accent"
                    >
                      {c.name}
                    </Link>
                  ))}
                </nav>
              )}
            </motion.div>

            {/* Middle: the product itself, searching the real catalog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="lg:col-span-4 xl:col-span-5 flex items-center justify-center min-h-88"
            >
              <BrowserSearchAnimation demo={searchDemo} />
            </motion.div>

            {/* Right: what is actually in the catalog.
              *
              * This is the slot the source design filled with a star rating
              * and three testimonials — see the note at the top of this file
              * for why it states catalog size instead. Each figure carries the
              * definition of what it counts, because a stat without one is how
              * "7K+ tools" and a directory of 2,913 ended up on the same
              * site. A figure the database did not return renders as an em
              * dash rather than a placeholder. */}
            <motion.aside
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="lg:col-span-3 w-full"
              aria-labelledby="catalog-figures"
            >
              <p id="catalog-figures" className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {t("landing.catalogEyebrow")}
              </p>

              <div className="mt-4 space-y-3">
                {[
                  {
                    value: toolCount > 0 ? toolCount.toLocaleString() : "—",
                    label: t("landing.statTools"),
                    hint: t("landing.statToolsHint"),
                  },
                  {
                    value: published > 0 ? published.toLocaleString() : "—",
                    label: t("landing.statPublished"),
                    hint: t("landing.statPublishedHint"),
                  },
                  {
                    value: categories > 0 ? String(categories) : "—",
                    label: t("landing.categories"),
                    hint: t("landing.statCategoriesHint"),
                  },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-card/60 p-4">
                    <div className="text-2xl sm:text-3xl font-bold text-primary tabular-nums leading-none">
                      {s.value}
                    </div>
                    <div className="mt-1.5 text-sm font-medium">{s.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground leading-snug">{s.hint}</div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                {t("landing.catalogNote")}
              </p>

              <Button asChild variant="outline" size="sm" className="mt-4 w-full gap-2">
                <Link href="/tools">
                  {t("landing.browseDirectory")} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </motion.aside>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-primary">
            {t("landing.howEyebrow")}
          </p>
          <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            {t("landing.howTitle")}
          </h2>
          <p className="mt-4 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            {t("landing.howSub")}
          </p>
        </motion.div>

        <div className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              /* `relative` plus a stretched link on the CTA: the whole card is
                 clickable and the destination still has a real href. Nothing
                 else in the card is interactive, so there is no overlay to
                 raise above it. */
              className="relative flex flex-col rounded-2xl border border-border bg-card/60 p-6 transition-colors hover:border-primary/40 hover:bg-card"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground tabular-nums">
                {step.n}
              </span>
              <span className="mt-6 inline-flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                <step.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-xl font-bold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              <div className="flex-1" />
              <Link
                href={step.href}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline after:absolute after:inset-0"
              >
                {step.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          ))}

          {/* Submit a tool. The design gave this card a destination that did
              not exist — POST /api/tools/submit had no page in front of it and
              nothing in the app linked to it. app/submit/page.tsx is that
              page. */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative flex flex-col rounded-2xl border border-primary/40 bg-primary/5 p-6"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </span>
            <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
              {t("landing.addToolEyebrow")}
            </p>
            <h3 className="mt-3 text-2xl font-bold leading-tight">
              {t("landing.addToolTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {t("landing.addToolDesc")}
            </p>
            <div className="flex-1" />
            <Button asChild className="mt-6 w-full gap-2 rounded-full">
              <Link href="/submit">
                {t("landing.addToolCta")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Footer                                                           */}
      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="shrink-0">
              <Link href="/" className="flex items-center gap-2" aria-label="Arcyn Find">
                <ArcynLogo className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold tracking-tight">
                  Arcyn <span className="text-primary">Find</span>
                </span>
              </Link>
              <p className="mt-3 text-sm text-muted-foreground">{t("landing.footerTagline")}</p>
              <div className="mt-5 flex items-center gap-2">
                <LanguagePicker />
                <ThemeToggle />
              </div>
            </div>

            {/* The full link set is kept rather than trimmed to the three the
                design showed. These are the homepage's internal links into the
                pages the sitemap is trying to get indexed, and dropping them
                costs exactly that. */}
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:gap-16">
              <nav aria-labelledby="footer-explore">
                <h2 id="footer-explore" className="text-sm font-semibold">{t("landing.resources")}</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/tools" className="hover:text-primary transition-colors">{t("landing.browseTools")}</Link></li>
                  <li><Link href="/tools/category" className="hover:text-primary transition-colors">{t("landing.categories")}</Link></li>
                  <li><Link href="/compare" className="hover:text-primary transition-colors">{t("landing.stepCompareTitle")}</Link></li>
                  <li><Link href="/submit" className="hover:text-primary transition-colors">{t("landing.addToolCta")}</Link></li>
                </ul>
              </nav>

              <nav aria-labelledby="footer-company">
                <h2 id="footer-company" className="text-sm font-semibold">{t("landing.connect")}</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/about" className="hover:text-primary transition-colors">{t("landing.aboutUs")}</Link></li>
                  <li><Link href="/community" className="hover:text-primary transition-colors">{t("community.heading")}</Link></li>
                  <li><Link href="/contact" className="hover:text-primary transition-colors">{t("landing.contactUs")}</Link></li>
                  <li>
                    <a href="https://x.com/Arcyn_x" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                      X (Twitter)
                    </a>
                  </li>
                </ul>
              </nav>

              <nav aria-labelledby="footer-legal">
                <h2 id="footer-legal" className="text-sm font-semibold">{t("landing.legal")}</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/privacy" className="hover:text-primary transition-colors">{t("landing.privacyPolicy")}</Link></li>
                  <li><Link href="/terms" className="hover:text-primary transition-colors">{t("landing.termsOfService")}</Link></li>
                  <li>
                    <a href="mailto:hello@arcynfind.com" className="hover:text-primary transition-colors break-all">
                      hello@arcynfind.com
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

          <div className="mt-10 border-t border-border pt-6">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Arcyn Find. {t("landing.rightsReserved")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
