/**
 * What people have said about Arcyn Find, for the homepage rail.
 *
 * WHY THIS IS A CURATED MODULE AND NOT A QUERY
 *
 * Nothing in the database holds a review OF THIS SITE. The two candidates
 * both fail, and it is worth writing down why so neither gets wired up later
 * by mistake:
 *
 *   `tool_reviews`   7 rows, averaging 4.1. These rate individual TOOLS --
 *                    "Not preferable for price range", "Generate slides" --
 *                    so presenting them as a verdict on Arcyn Find would
 *                    misdescribe what was rated, however real the number is.
 *
 *   `contact_submissions`  8 rows, from the feedback widget. Private messages
 *                    sent to the team. Publishing one as a public testimonial
 *                    is a consent problem, not a data problem, and no column
 *                    in that table records consent.
 *
 * So entries here are added by hand, from feedback whose author agreed to it
 * being shown. The rail renders nothing when the list is empty, and the hero
 * drops to two columns -- which is the correct outcome for a site that has
 * not collected any yet, and is why there is deliberately no starter content.
 * docs/ROUTING.md, "Don't populate a panel that makes a claim about the
 * reader", is the same rule applied to a different panel.
 *
 * The summary figures are DERIVED from these entries (see `testimonialStats`)
 * rather than written alongside them, so the headline rating can never drift
 * from the quotes printed underneath it -- which is exactly how a design
 * showing "4.8/5" over three 5-star quotes gets shipped next to a real
 * average of 4.1.
 *
 * WHEN THE FEEDBACK WIDGET LEARNS TO RATE
 *
 * The intended end state is that submitting feedback with a rating and an
 * explicit "you may show this publicly" consent adds a row to a moderated
 * table, and this module reads the approved ones. Keep `Testimonial` as the
 * shape that surfaces, so the swap is a change of source and not of caller.
 */

export interface Testimonial {
  /** As the person wants to be credited. "Kwame A." over a full surname. */
  name: string
  /** Their words. Not edited for length -- shorten by choosing a different
   *  quote, not by trimming someone's sentence into a different claim. */
  quote: string
  /** 1-5. Feeds the average, so it must be what they actually gave. */
  rating: number
  /** ISO date of the feedback, for the "2 days ago" caption. */
  date: string
}

/**
 * The published set. Empty until real, consented feedback is added.
 *
 * To add one: paste the quote verbatim, credit them the way they asked to be
 * credited, and use the rating they gave. Do not round a 4 up to a 5 to make
 * the average read better -- the average is computed below and will simply
 * tell the truth about whatever is in this array.
 */
export const TESTIMONIALS: readonly Testimonial[] = []

export interface TestimonialStats {
  /** Mean rating across the entries, to one decimal. Null when empty. */
  average: number | null
  /** How many entries there are. Never rounded up into a "10,000+". */
  count: number
}

/** Summary figures for the rail, derived so they cannot contradict the list. */
export function testimonialStats(
  entries: readonly Testimonial[] = TESTIMONIALS
): TestimonialStats {
  if (entries.length === 0) return { average: null, count: 0 }
  const total = entries.reduce((sum, t) => sum + t.rating, 0)
  return {
    average: Math.round((total / entries.length) * 10) / 10,
    count: entries.length,
  }
}
