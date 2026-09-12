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
    <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Arcyn Find
        </Link>
        <nav className="flex items-center gap-4 text-sm" aria-label="Primary">
          <Link href="/tools" className="text-muted-foreground transition-colors hover:text-foreground">
            Browse tools
          </Link>
          <Link
            href="/tools/category"
            className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Categories
          </Link>
          <Link
            href="/home"
            className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
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
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
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
                  className="text-muted-foreground transition-colors hover:text-foreground"
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
            <Link href="/about" className="transition-colors hover:text-foreground">
              About
            </Link>
            <Link href="/contact" className="transition-colors hover:text-foreground">
              Contact
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
