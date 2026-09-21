import Link from 'next/link'

/**
 * Chrome for the public, crawlable pages.
 *
 * Deliberately server-rendered with plain anchors and no auth context: these
 * pages are the entry point for visitors arriving from search, who have no
 * session. The in-app `Sidebar` assumes one and ships a large client bundle,
 * which is the wrong trade for a landing page.
 */

export function PublicHeader() {
  return (
    <header className="glass-header sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Arcyn Find
        </Link>
        <nav className="flex items-center gap-4 text-sm" aria-label="Primary">
          <Link
            href="/tools"
            className="inline-flex min-h-11 items-center text-muted-foreground transition-colors hover:text-foreground sm:min-h-0"
          >
            Browse tools
          </Link>
          <Link
            href="/tools/category"
            className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline-flex sm:items-center"
          >
            Categories
          </Link>
          <Link
            href="/home"
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:min-h-0"
          >
            Open app
          </Link>
        </nav>
      </div>
    </header>
  )
}

export function PublicFooter({
  categories = [],
}: {
  categories?: { slug: string; name: string }[]
}) {
  return (
    <footer className="mt-16 border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-[calc(2.5rem_+_var(--mobile-nav-clearance))] sm:px-6 md:pb-10">
        {categories.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Browse by category
            </h2>
            {/* A flat, crawlable link block. This is the crawl graph: every
                public page reaches every category in one hop. */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/tools/category/${category.slug}`}
                  className="inline-flex min-h-11 items-center text-muted-foreground transition-colors hover:text-foreground sm:min-h-0"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col justify-between gap-4 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Arcyn Find</p>
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <Link href="/about" className="inline-flex min-h-11 items-center transition-colors hover:text-foreground sm:min-h-0">
              About
            </Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center transition-colors hover:text-foreground sm:min-h-0">
              Contact
            </Link>
            <Link href="/privacy" className="inline-flex min-h-11 items-center transition-colors hover:text-foreground sm:min-h-0">
              Privacy
            </Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center transition-colors hover:text-foreground sm:min-h-0">
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
