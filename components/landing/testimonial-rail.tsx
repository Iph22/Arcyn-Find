"use client"

import { Sparkles, Star } from "lucide-react"

import type { Testimonial, TestimonialStats } from "@/lib/landing/testimonials"
import { useLanguage } from "@/contexts/language-context"

/**
 * The hero's "trusted and loved" rail.
 *
 * Renders nothing at all when there are no testimonials, which is the state
 * this ships in -- see lib/landing/testimonials.ts for why neither
 * `tool_reviews` nor `contact_submissions` can honestly fill it. The hero
 * checks the same emptiness and drops to a two-column layout, so the absence
 * reads as a design with two columns rather than one with a hole in it.
 *
 * The rating and the count are derived from the entries by
 * `testimonialStats()`, never passed independently. That is the whole
 * safeguard: the headline figure is a function of the quotes underneath it,
 * so the two cannot disagree the way "4.8/5 from 10,000+ users" disagreed
 * with 7 reviews averaging 4.1.
 */
export function TestimonialRail({
  testimonials,
  stats,
}: {
  testimonials: readonly Testimonial[]
  stats: TestimonialStats
}) {
  const { t } = useLanguage()

  if (testimonials.length === 0 || stats.average === null) return null

  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary" />
        {t("landing.trustedBy")}
      </p>

      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums leading-none">
          {stats.average.toFixed(1)}
        </span>
        <span className="text-sm text-muted-foreground">/5</span>
        <Stars value={stats.average} />
      </div>

      {/* The real count, stated plainly. It says "reviews", not "users":
          those are different quantities and the design conflated them. */}
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {t("landing.fromReviews", { count: stats.count })}
      </p>

      <div className="mt-4 space-y-2.5">
        {testimonials.slice(0, 3).map((item) => (
          <figure
            key={`${item.name}-${item.date}`}
            className="rounded-xl border border-border bg-card/60 p-3"
          >
            <figcaption className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
              >
                {item.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold leading-tight">
                  {item.name}
                </span>
                <time dateTime={item.date} className="block text-[9px] text-muted-foreground">
                  {relativeDate(item.date)}
                </time>
              </span>
            </figcaption>
            <blockquote className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              &ldquo;{item.quote}&rdquo;
            </blockquote>
            <div className="mt-1.5">
              <Stars value={item.rating} small />
            </div>
          </figure>
        ))}
      </div>
    </div>
  )
}

/** Five stars, filled to `value`. One accessible label, not five icons. */
function Stars({ value, small }: { value: number; small?: boolean }) {
  const size = small ? "h-2.5 w-2.5" : "h-3 w-3"
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`${size} ${
            i <= Math.round(value) ? "fill-primary text-primary" : "text-border"
          }`}
        />
      ))}
    </span>
  )
}

/**
 * "2 days ago", from the entry's date.
 *
 * Intl.RelativeTimeFormat with the document language, so this is one of the
 * few strings that does not need a translation key -- the browser already
 * holds the phrasing for every locale the picker offers.
 */
function relativeDate(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""

  const days = Math.round((then - Date.now()) / 86_400_000)
  const lang = typeof document !== "undefined" ? document.documentElement.lang || "en" : "en"
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" })

  if (Math.abs(days) < 30) return rtf.format(days, "day")
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), "month")
  return rtf.format(Math.round(days / 365), "year")
}
