import type { Metadata } from 'next'
import Link from 'next/link'

/**
 * Offline fallback, served by the service worker when a navigation fails and
 * nothing useful is cached.
 *
 * Previously the fallback was `caches.match('/')`, which handed back the home
 * page as though the navigation had succeeded — the reader got a working-looking
 * site that silently wasn't the page they asked for. A dedicated page says what
 * happened.
 *
 * Deliberately static and dependency-free: it has to render from cache with no
 * network, so it cannot fetch, and it must survive being precached at install
 * time before anyone has signed in.
 */
export const metadata: Metadata = {
  title: 'Offline · Arcyn Find',
  description: 'You are offline.',
  robots: { index: false, follow: false },
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <p className="text-sm font-medium text-muted-foreground">No connection</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">You&apos;re offline</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This page isn&apos;t available without a connection. Pages you&apos;ve already visited
          will still open, and everything else will load again once you&apos;re back online.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Go to home
          </Link>
          <Link
            href="/tools"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
          >
            Browse tools
          </Link>
        </div>
      </div>
    </main>
  )
}
