/**
 * The Arcyn Find mark.
 *
 * Drawn inline rather than loaded from `/public` so it inherits `currentColor`
 * and therefore the theme. The brand redesign supplied the mark as a raster
 * mockup only; this is a geometric reconstruction of it, and the intent is
 * that a real vector replaces the paths below when one exists. Keep the
 * component and its API when that happens — every caller sizes it with a
 * className and colours it by setting a text colour on an ancestor, so
 * swapping the paths is the whole change.
 *
 * `currentColor` and not a hard-coded gold: the palette here is Crystal
 * Midnight, and a fixed brand colour would be the one element on the page that
 * does not answer to the light/dark token set.
 */
export function ArcynLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      /* Decorative: the wordmark beside it already names the product, so
         announcing "Arcyn Find" here would make every screen reader say it
         twice. Callers that render the mark ALONE pass their own label. */
      aria-hidden="true"
      focusable="false"
    >
      {/* The A: an open chevron, counter left as negative space. */}
      <path
        d="M16 2.6 L29.4 29.4 L22.3 29.4 L16 15.9 L9.7 29.4 L2.6 29.4 Z"
        fill="currentColor"
      />
      {/* The inner stroke of the layered mark, held back so it reads as a
          second plane rather than thickening the first. */}
      <path
        d="M16 10.4 L20.6 19.6 L16 19.6 L13.7 24.3 Z"
        fill="currentColor"
        opacity="0.45"
      />
    </svg>
  )
}

/** The mark plus the wordmark, as it appears in the header and the footer. */
export function ArcynWordmark({
  className,
  markClassName = "h-6 w-6 sm:h-7 sm:w-7",
}: {
  className?: string
  markClassName?: string
}) {
  return (
    <span className={className}>
      <ArcynLogo className={`${markClassName} text-primary shrink-0`} />
      <span className="text-lg sm:text-xl font-bold tracking-tight">
        Arcyn <span className="text-primary">Find</span>
      </span>
    </span>
  )
}
