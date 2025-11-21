"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Error Boundary]", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full p-8 text-center border border-border rounded-lg">
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-6">
          An unexpected error occurred. Try reloading the page or come back later.
        </p>
        {error.message && (
          <div className="mb-6 p-3 text-sm text-left font-mono text-muted-foreground overflow-auto max-h-24 bg-muted rounded">
            {error.message}
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90"
          >
            Try again
          </button>
          <a href="/" className="px-4 py-2 border border-border rounded-lg hover:bg-muted">
            Go Home
          </a>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-muted-foreground">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  )
}
