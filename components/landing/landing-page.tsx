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
import { TestimonialRail } from "@/components/landing/testimonial-rail"
import { categoryPageSlugHref, searchHref } from "@/lib/tool-href"
import type { Testimonial, TestimonialStats } from "@/lib/landing/testimonials"

const ThemeToggle = dynamic(() => import("@/components/layout/theme-toggle").then(mod => mod.ThemeToggle), { ssr: false })
const LanguagePicker = dynamic(() => import("@/components/layout/language-picker").then(mod => mod.LanguagePicker), { ssr: false })
const ToolCardStack = dynamic(() => import("@/components/landing/tool-card-stack").then(mod => mod.ToolCardStack), { ssr: false })
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
 * Type and spacing are deliberately small. An earlier pass scaled everything
 * up (a 60px headline, a 64px search box, 24px section padding) and the
 * result read as a poster rather than a product: fewer than two sections fit
 * on a laptop screen. The reference design runs roughly one step smaller at
 * every level, which is what the ramps below follow.
 *
 * WHAT IT MAY CLAIM
 *
 * Every figure arrives as a prop from the server component in app/page.tsx, so
 * a crawler reads it in the HTML and there is no flash of a missing number.
 *
 * The catalog line under the subcopy states the distinct-product count and
 * nothing else. It replaced a three-card stat panel, which was accurate but
 * read like an internal dashboard on a page whose job is to get somebody
 * searching.
 *
 * The testimonial rail renders only when lib/landing/testimonials.ts holds
 * consented entries, and its rating is derived from them. That module records
 * why neither `tool_reviews` nor `contact_submissions` can fill it. This page
 * has shipped invented figures before — "50K+ Active Users", "150K+ Daily
 * Searches", "120+ Countries", none of them measured — and the reference
 * design's "4.8/5 from 10,000+ users" over three named quotes is the same
 * thing against 7 real reviews averaging 4.1.
 *
 * WHERE THINGS LINK
 *
 * See docs/ROUTING.md. Briefly: free text goes to /discover via searchHref(), a
 * named category goes to its own page via categoryPageSlugHref(), and both are
 * real anchors rather than click handlers so they can be crawled, copied and
 * opened in a new tab.
 */
export function LandingPage({
  stats,
  searchDemo,
  categories: categoryChips,
  testimonials,
  testimonialStats,
}: {
  stats: LandingStats
  searchDemo: LandingSearchDemo
  categories: LandingCategory[]
  testimonials: readonly Testimonial[]
  testimonialStats: TestimonialStats
}) {
  const { t } = useLanguage()
  const router = useRouter()
  const { isAuthenticated, isLoading, signIn } = useAuth()
  const { toolCount } = stats
  const [query, setQuery] = useState("")

  // Whether the third hero column exists at all. The rail renders null when
  // empty, so without this the grid would keep an empty 3-column track and
  // leave a gap where a panel used to be.
  const hasRail = testimonials.length > 0 && testimonialStats.average !== null

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
      href: "/discover",
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
        <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 shrink-0" aria-label="Arcyn Find">
              <ArcynLogo className="h-5 w-5 text-primary" />
              <span className="text-base font-bold tracking-tight">
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
            <nav className="hidden md:flex items-center gap-0.5 text-[13px]">
              <Link href="/tools" className="rounded-md px-2.5 py-1.5 font-medium text-foreground hover:bg-accent transition-colors">
                {t("landing.discover")}
              </Link>
              <Link href="/tools/category" className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                {t("landing.categories")}
              </Link>
              <Link href="/community" className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                {t("community.heading")}
              </Link>
            </nav>

            <div className="flex-1" />

            <form onSubmit={submitSearch} className="hidden lg:flex items-center" role="search">
              <label htmlFor="header-search" className="sr-only">{t("landing.searchLabel")}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  id="header-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("landing.searchShortPlaceholder")}
                  className="h-8 w-52 rounded-full border border-border bg-card/60 pl-8 pr-3 text-[12px] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
            </form>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex h-8 rounded-full text-[13px]" onClick={() => signIn()}>
                {t("nav.signIn")}
              </Button>
              <Button size="sm" className="h-8 rounded-full text-[13px]" onClick={() => signIn()}>
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
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_55%_at_70%_15%,var(--primary)_0%,transparent_60%)] opacity-10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_50%_at_8%_95%,var(--primary)_0%,transparent_65%)] opacity-[0.06]"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-16">
          <div
            className={`grid items-start gap-8 lg:gap-10 ${
              hasRail ? "lg:grid-cols-12" : "lg:grid-cols-2"
            }`}
          >
            {/* Left: the pitch and the search box */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className={hasRail ? "lg:col-span-5" : ""}
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
                {t("landing.eyebrow")}
              </p>

              <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]">
                {/* Two block lines rather than one wrapping phrase. As inline
                    spans the accent broke wherever the measure ran out --
                    "AI tool for / what you are / building." -- which put the
                    colour change mid-line. Each half is a complete phrase in
                    every locale, so each gets its own line. */}
                <span className="block">{t("landing.heroTitle")}</span>
                <span className="block text-primary">{t("landing.heroAccent")}</span>
              </h1>

              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                {t("landing.heroSub")}
              </p>

              {/* The catalog, in one line.
                *
                * This replaced a three-card stat panel. The figure is the
                * distinct-product count from catalog_stats_current() -- not
                * the row count, which once overstated it 18x and was on this
                * very page -- and it is stated exactly, not rounded up into a
                * "10,000+" that would be both vaguer and, here, lower than
                * the truth. */}
              {toolCount > 0 && (
                <p className="mt-4 text-[13px] text-muted-foreground">
                  <strong className="font-semibold tabular-nums text-primary">
                    {toolCount.toLocaleString()}
                  </strong>{" "}
                  {t("landing.indexedCount")}
                </p>
              )}

              {/* The search box. A real <form>: enter submits, and the button
                  is type=submit, so it behaves the way a browser's own search
                  affordances do. */}
              <form onSubmit={submitSearch} className="mt-5" role="search">
                <label htmlFor="hero-search" className="sr-only">{t("landing.searchLabel")}</label>
                <div className="relative flex max-w-md items-center rounded-full border border-border bg-card/80 shadow-lg backdrop-blur-sm transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                  <Search className="absolute left-4 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="hero-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("landing.searchPlaceholder")}
                    className="h-12 w-full rounded-full bg-transparent pl-11 pr-13 text-[14px] outline-none placeholder:text-muted-foreground"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    aria-label={t("landing.searchLabel")}
                    className="absolute right-1.5 h-9 w-9 rounded-full"
                  >
                    <ArrowRight className="h-4 w-4" />
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
                <nav className="mt-4 flex max-w-md flex-wrap gap-1.5" aria-label={t("landing.browseByCategory")}>
                  {categoryChips.map((c) => (
                    <Link
                      key={c.slug}
                      href={categoryPageSlugHref(c.slug)}
                      className="rounded-full border border-border bg-card/50 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground hover:border-primary/50 hover:bg-accent"
                    >
                      {c.name}
                    </Link>
                  ))}
                </nav>
              )}
            </motion.div>

            {/* Middle: the product, searching the real catalog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className={`flex justify-center lg:justify-end ${hasRail ? "lg:col-span-4" : ""}`}
            >
              <ToolCardStack demo={searchDemo} />
            </motion.div>

            {/* Right: what people have said. Absent until there is something
                real to put in it — see the note at the top of this file. */}
            {hasRail && (
              <motion.aside
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}
                className="lg:col-span-3 w-full"
              >
                <TestimonialRail testimonials={testimonials} stats={testimonialStats} />
              </motion.aside>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
            {t("landing.howEyebrow")}
          </p>
          <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
            {t("landing.howTitle")}
          </h2>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
            {t("landing.howSub")}
          </p>
        </motion.div>

        <div className="mt-8 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              /* `relative` plus a stretched link on the CTA: the whole card is
                 clickable and the destination still has a real href. Nothing
                 else in the card is interactive, so there is no overlay to
                 raise above it. */
              className="relative flex flex-col rounded-xl border border-border bg-card/60 p-5 transition-colors hover:border-primary/40 hover:bg-card"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-[10px] font-medium text-muted-foreground tabular-nums">
                {step.n}
              </span>
              <span className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                <step.icon className="h-4 w-4" />
              </span>
              <h3 className="mt-4 text-base font-bold">{step.title}</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{step.desc}</p>
              <div className="flex-1" />
              <Link
                href={step.href}
                className="mt-5 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline after:absolute after:inset-0"
              >
                {step.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          ))}

          {/* Submit a tool. The design gave this card a destination that did
              not exist — POST /api/tools/submit had no page in front of it and
              nothing in the app linked to it. app/submit/page.tsx is that
              page. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: 0.24 }}
            className="relative flex flex-col rounded-xl border border-primary/40 bg-primary/5 p-5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
              <Plus className="h-4 w-4" />
            </span>
            <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
              {t("landing.addToolEyebrow")}
            </p>
            <h3 className="mt-2.5 text-lg font-bold leading-tight">
              {t("landing.addToolTitle")}
            </h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
              {t("landing.addToolDesc")}
            </p>
            <div className="flex-1" />
            <Button asChild size="sm" className="mt-5 w-full gap-1.5 rounded-full text-[12px]">
              <Link href="/submit">
                {t("landing.addToolCta")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Footer                                                           */}
      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-9 sm:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="shrink-0">
              <Link href="/" className="flex items-center gap-1.5" aria-label="Arcyn Find">
                <ArcynLogo className="h-5 w-5 text-primary" />
                <span className="text-base font-bold tracking-tight">
                  Arcyn <span className="text-primary">Find</span>
                </span>
              </Link>
              <p className="mt-2.5 text-[13px] text-muted-foreground">{t("landing.footerTagline")}</p>
              <div className="mt-4 flex items-center gap-2">
                <LanguagePicker />
                <ThemeToggle />
              </div>
            </div>

            {/* The full link set is kept rather than trimmed to the three the
                design showed. These are the homepage's internal links into the
                pages the sitemap is trying to get indexed, and dropping them
                costs exactly that. */}
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:gap-14">
              <nav aria-labelledby="footer-explore">
                <h2 id="footer-explore" className="text-[13px] font-semibold">{t("landing.resources")}</h2>
                <ul className="mt-2.5 space-y-1.5 text-[13px] text-muted-foreground">
                  <li><Link href="/tools" className="hover:text-primary transition-colors">{t("landing.browseTools")}</Link></li>
                  <li><Link href="/tools/category" className="hover:text-primary transition-colors">{t("landing.categories")}</Link></li>
                  <li><Link href="/compare" className="hover:text-primary transition-colors">{t("landing.stepCompareTitle")}</Link></li>
                  <li><Link href="/submit" className="hover:text-primary transition-colors">{t("landing.addToolCta")}</Link></li>
                </ul>
              </nav>

              <nav aria-labelledby="footer-company">
                <h2 id="footer-company" className="text-[13px] font-semibold">{t("landing.connect")}</h2>
                <ul className="mt-2.5 space-y-1.5 text-[13px] text-muted-foreground">
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
                <h2 id="footer-legal" className="text-[13px] font-semibold">{t("landing.legal")}</h2>
                <ul className="mt-2.5 space-y-1.5 text-[13px] text-muted-foreground">
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

          <div className="mt-8 border-t border-border pt-5">
            <p className="text-[11px] text-muted-foreground">
              © {new Date().getFullYear()} Arcyn Find. {t("landing.rightsReserved")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
