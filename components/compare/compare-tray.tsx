'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, GitCompare, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MAX_COMPARE, compareHref } from '@/lib/compare'
import { useCompareSelection } from '@/lib/compare-selection'

/**
 * The compare bar: what you have picked, and the way to go look at it.
 *
 * A REAL LINK, not a button that opens a modal. docs/ROUTING.md is explicit
 * about why -- a comparison behind a click handler has no URL, so it cannot be
 * copied to a colleague, opened in a second tab, or come back tomorrow. The
 * whole point of a comparison is that you show it to somebody.
 *
 * It appears at one selected tool rather than at two, with the button disabled
 * and the count visible. Appearing only at two would mean the first click did
 * nothing observable except a subtle state change on one card, which reads as
 * a broken button.
 *
 * Renders nothing on /compare itself: the page below it is the comparison, and
 * a floating bar offering to show it to you is noise.
 */
/**
 * Room at the end of a scrolling list for the fixed tray to sit over.
 *
 * A `fixed` element cannot push anything, so without this the tray covers
 * whatever is last in the list -- on /browse that is the "Load more" button,
 * which is exactly the control you reach for after picking two tools out of a
 * screenful. It reserves space only while the tray is actually showing.
 */
export function CompareTraySpacer() {
  const { count } = useCompareSelection()
  const pathname = usePathname()

  if (count === 0 || pathname === '/compare') return null
  return <div aria-hidden className="h-24" />
}

export function CompareTray() {
  const { items, count, clear, remove } = useCompareSelection()
  const pathname = usePathname()

  if (count === 0 || pathname === '/compare') return null

  const ready = count >= 2

  return (
    <div
      // Sits above the fixed mobile nav rather than under it -- the clearance
      // variable exists because hard-coded `bottom-20` guesses put the public
      // footer partly beneath it (app/globals.css).
      className="fixed inset-x-0 bottom-[var(--mobile-nav-clearance)] z-30 px-3 pb-3 md:bottom-0 md:px-6 md:pb-6"
      role="region"
      aria-label="Tools selected for comparison"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur-sm sm:flex-nowrap">
        <GitCompare className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />

        <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {items.map((tool) => (
            <li
              key={tool.id}
              className="flex max-w-[12rem] items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs"
            >
              <span className="truncate" title={tool.name}>
                {tool.name}
              </span>
              <button
                type="button"
                onClick={() => remove(tool.id)}
                aria-label={`Remove ${tool.name} from comparison`}
                className="shrink-0 rounded text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {/* The remaining capacity, stated rather than implied by a silent
              cap the reader only discovers by hitting it. */}
          {count < MAX_COMPARE && (
            <li className="text-xs text-muted-foreground">
              {ready
                ? `add up to ${MAX_COMPARE - count} more`
                : 'pick one more to compare'}
            </li>
          )}
        </ul>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
          {ready ? (
            <Button asChild size="sm" className="gap-1">
              <Link href={compareHref(items)}>
                Compare {count}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            // Disabled as a real button, not a dead link. An <a> that goes
            // nowhere is the failure docs/ROUTING.md records shipping twice.
            <Button size="sm" disabled className="gap-1">
              Compare {count}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
