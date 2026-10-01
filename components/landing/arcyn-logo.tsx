/**
 * The Arcyn Find mark.
 *
 * Three elements, matching the brand art: a chevron A, an elliptical orbit
 * sweeping across it, and a four-point sparkle in the counter.
 *
 * Drawn inline rather than loaded from `/public` so it inherits
 * `currentColor` and therefore the theme. The brand art was supplied as
 * raster only (a silver-to-blue gradient on near-black), so this is a
 * reconstruction of the geometry rather than an exported vector — if a real
 * SVG turns up, replace the paths and keep the component: every caller sizes
 * it with a className and colours it by setting a text colour on an ancestor.
 *
 * `currentColor` rather than the brand's own silver-blue gradient, because
 * the mark has to survive the light theme. A fixed light gradient would be
 * invisible on the light background, and it would be the one element on the
 * page that ignores the token set. Callers pass `text-primary`, so it picks
 * up Crystal Midnight's blue in both themes.
 *
 * ON SIZE. The orbit and the sparkle are detail that stops paying for itself
 * somewhere around 16px — the header renders this at 20px, where the orbit is
 * a hairline. That is deliberate rather than overlooked: the silhouette is
 * carried by the A, and the other two elements read as texture at small sizes
 * and as the brand at large ones. If a favicon is cut from this, cut it from
 * `ArcynLogoMark` below, which is the A alone.
 */
export function ArcynLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      /* Decorative: the wordmark beside it already names the product, so
         announcing "Arcyn Find" here would make every screen reader say it
         twice. Callers that render the mark ALONE pass their own label. */
      aria-hidden="true"
      focusable="false"
    >
      {/* The A. A chevron with an open counter — no crossbar, because the
          orbit crosses the letter where a crossbar would sit. */}
      <path
        d="M24 5.5 L43.2 42.5 L34.4 42.5 L24 22 L13.6 42.5 L4.8 42.5 Z"
        fill="currentColor"
      />

      {/* The orbit. A stroked ellipse, tilted, wider than the A so it reads as
          a ring passing around the letter rather than a line drawn on it. */}
      <ellipse
        cx="24"
        cy="28.5"
        rx="18.6"
        ry="6.6"
        transform="rotate(-20 24 28.5)"
        stroke="currentColor"
        strokeWidth="2.1"
        opacity="0.85"
      />

      {/* The sparkle, in the counter below the orbit. Concave four-point star:
          the curves are what separate it from a plus sign at small sizes.
          Seated at y=34.3 rather than higher up — the counter is a triangle,
          so it is only 11px wide at y=33 and the star crowded both the orbit
          above it and the legs either side. */}
      <path
        d="M24 30.1 C24.42 32.7 25.75 34.03 28.35 34.45 C25.75 34.87 24.42 36.2 24 38.8 C23.58 36.2 22.25 34.87 19.65 34.45 C22.25 34.03 23.58 32.7 24 30.1 Z"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * The A alone, without the orbit or the sparkle.
 *
 * For anywhere the full mark would turn to mud: favicons, the 16px end of the
 * scale, and monochrome stamps. Same viewBox as `ArcynLogo` so the two are
 * interchangeable and sit identically in a layout.
 */
export function ArcynLogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M24 5.5 L43.2 42.5 L34.4 42.5 L24 22 L13.6 42.5 L4.8 42.5 Z"
        fill="currentColor"
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
