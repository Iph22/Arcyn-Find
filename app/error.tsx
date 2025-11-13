"use client"

import { useEffect } from "react"
import { AlertCircle, RotateCcw } from "lucide-react"

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-lg w-full rounded-xl border border-border/50 bg-card p-8 text-center shadow-lg">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>

        <p className="text-muted-foreground mb-6">
          An unexpected error occurred. Try reloading the page or come back later.
        </p>

        {error.message && (
          <div className="mb-6 rounded-lg bg-muted p-3 text-sm text-left font-mono text-muted-foreground overflow-auto max-h-24">
            {error.message}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-accent-foreground hover:bg-accent/90 transition-colors font-medium"
            aria-label="Retry loading the page"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>

          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-border/50 px-4 py-2 text-foreground hover:bg-muted transition-colors font-medium"
            aria-label="Go back to home page"
          >
            Go Home
          </a>
        </div>

        {error.digest && (
          <p className="mt-4 text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
