"use client"

import { useEffect, useMemo, useReducer, useState } from "react"
import Image from "next/image"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, ChevronRight, Search } from "lucide-react"

import { ArcynLogo } from "@/components/landing/arcyn-logo"
import type { DemoResult, LandingSearchDemo } from "@/lib/landing/search-demo"
import { searchHref } from "@/lib/tool-href"
import { isPlaceholderImage } from "@/lib/tool-image"
import { useLanguage } from "@/contexts/language-context"

/** How long each tool stays featured. */
const CYCLE_MS = 4200

/**
 * The hero's card stack.
 *
 * Three cards fanned behind one another; the front one shows a search for
 * DEMO_QUERY with one result promoted to a featured card and the rest listed
 * beneath as "similar tools". Every CYCLE_MS the featured tool advances and
 * the stack shuffles.
 *
 * WHAT IT MAY SHOW
 *
 * The design this came from put a star rating and "4.8 (12.4k)" on the
 * featured card, and a rating on every similar-tools row. There is no rating
 * data behind any of that -- `tool_reviews` holds 7 rows for the entire site,
 * and COMPARE_FIELDS deliberately carries no rating for the same reason. The
 * card uses the tool's own tags and access type in those positions instead,
 * which are stored values that describe the tool.
 *
 * Everything else is real too: the tools, their descriptions and their logos
 * come from running DEMO_QUERY against the live catalog (lib/landing/
 * search-demo.ts). The animation this replaced once typed a query and
 * returned DevAssistant Pro, CodeGenius AI and DebugMaster 3000, none of
 * which exist.
 *
 * MOTION
 *
 * `useReducedMotion` stops the cycle rather than merely shortening it: this
 * component's whole animation is content changing underneath the reader, and
 * a faster version of that is worse, not better. Reduced-motion users get the
 * first tool, static, with the full list visible.
 */
export function ToolCardStack({ demo }: { demo: LandingSearchDemo }) {
  const { t } = useLanguage()
  const reduceMotion = useReducedMotion()
  const [index, advance] = useReducer((i: number) => i + 1, 0)

  const results = demo.results
  const count = results.length

  useEffect(() => {
    if (reduceMotion || count < 2) return
    const id = setInterval(advance, CYCLE_MS)
    return () => clearInterval(id)
  }, [reduceMotion, count])

  // Rotate the list so a different tool is featured each cycle, and the rest
  // keep their order beneath it.
  const { featured, similar } = useMemo(() => {
    if (count === 0) return { featured: null, similar: [] as DemoResult[] }
    const offset = index % count
    const rotated = [...results.slice(offset), ...results.slice(0, offset)]
    return { featured: rotated[0], similar: rotated.slice(1, 4) }
  }, [results, count, index])

  if (!featured) {
    // No results means the catalog read failed. Render the frame with the
    // search box and nothing in it, rather than inventing a tool.
    return <StackFrame demo={demo} />
  }

  return (
    // The rearmost card is offset 20px right of the front one, so the stack is
    // wider than the card it contains. The width is capped below `sm` so that
    // overhang still fits inside the hero's 16px gutter -- at max-w-sm the fan
    // ran 17px past a 390px viewport and was sliced off by the section's
    // overflow-hidden.
    <div className="relative w-full max-w-[21rem] sm:max-w-sm">
      {/* The two cards behind. Purely decorative -- aria-hidden, and they hold
          no text, so nothing is announced twice or read out of order. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 translate-x-3 translate-y-3 rotate-[2deg] sm:translate-x-5 sm:translate-y-4 sm:rotate-[3.5deg] rounded-2xl border border-border/50 bg-card/30"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-[1deg] sm:translate-x-2.5 sm:translate-y-2 sm:rotate-[1.75deg] rounded-2xl border border-border/70 bg-card/55"
      />

      <StackFrame demo={demo}>
        {/* Featured result. `key` on the tool name is what makes framer treat
            each cycle as a new element and run the enter transition. */}
        <motion.div
          key={featured.name}
          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="rounded-xl border border-border bg-background/60 p-3"
        >
          <div className="flex items-start gap-2.5">
            <ToolAvatar result={featured} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight">{featured.name}</p>
              {featured.accessType && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">{featured.accessType}</p>
              )}
            </div>
          </div>

          {featured.description && (
            <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
              {featured.description}
            </p>
          )}

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap gap-1">
              {featured.tags.map((tag) => (
                <span
                  key={tag}
                  className="truncate rounded-full border border-border/80 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
            {/* Deliberately not a link. DemoResult carries no id or slug --
                search_tools_advanced returns neither -- so there is no href
                to build, and docs/ROUTING.md is explicit that a control with
                no URL is worse than none. The card's own search box above is
                the real route in. Widen DemoResult if this needs to click
                through to the tool. */}
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground">
              {t("landing.tryTool")} <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </motion.div>

        <p className="mt-3 text-[10px] font-medium text-muted-foreground">
          {t("landing.similarTools")}
        </p>

        <div className="mt-1.5 space-y-1.5">
          {similar.map((result) => (
            <motion.div
              key={result.name}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-2 py-1.5"
            >
              <ToolAvatar result={result} size={24} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium leading-tight">{result.name}</p>
                {result.accessType && (
                  <p className="text-[9px] text-muted-foreground">{result.accessType}</p>
                )}
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            </motion.div>
          ))}
        </div>
      </StackFrame>
    </div>
  )
}

/** The card chrome: product mark, the search box, then whatever is passed in. */
function StackFrame({
  demo,
  children,
}: {
  demo: LandingSearchDemo
  children?: React.ReactNode
}) {
  return (
    <div className="relative rounded-2xl border border-border bg-card/90 p-3.5 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        <ArcynLogo className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-bold tracking-tight">
          Arcyn <span className="text-primary">Find</span>
        </span>
      </div>

      {/* The demo query, as a link to the real search for it. Someone who
          reads the card and wants that result should be able to get it. */}
      <a
        href={searchHref(demo.query)}
        className="mt-2.5 flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 transition-colors hover:border-primary/50"
      >
        <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate text-[11px] text-muted-foreground">{demo.query}</span>
      </a>

      <div className="mt-3">{children}</div>
    </div>
  )
}

/**
 * Logo, or the initial.
 *
 * Not components/tools/ToolImage: that renders a large multi-colour gradient
 * tile with 5xl type, which at 24px is an unreadable bright square fighting
 * the palette. It shares the part that matters -- `isPlaceholderImage`, which
 * is why the two rows storing the site's own og-image as their "logo" fall
 * back to an initial here rather than rendering the Arcyn Find banner as a
 * third-party product's mark.
 */
function ToolAvatar({ result, size }: { result: DemoResult; size: number }) {
  const [failed, setFailed] = useState(false)
  const side = { width: size, height: size }
  const usable = !isPlaceholderImage(result.image) && !failed

  if (usable && result.image) {
    return (
      <Image
        src={result.image}
        alt=""
        width={size}
        height={size}
        // Decorative: the tool's name is printed beside it in every case, so
        // an alt would repeat it. unoptimized because these are arbitrary
        // vendor domains already allowed in next.config.ts, and the hero
        // should not wait on the optimizer for a logo this small.
        unoptimized
        onError={() => setFailed(true)}
        className="shrink-0 rounded-md border border-border/60 bg-background object-contain"
        style={side}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-md border border-border/60 bg-primary/10 font-semibold text-primary"
      style={{ ...side, fontSize: Math.round(size * 0.42) }}
    >
      {result.name.charAt(0).toUpperCase()}
    </span>
  )
}
