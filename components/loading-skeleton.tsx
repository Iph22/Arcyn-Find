"use client"

export function AICardSkeleton() {
  return (
    <div className="h-64 animate-pulse rounded-xl border border-border/50 bg-card/50">
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 h-6 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
          </div>
          <div className="h-5 w-5 rounded bg-muted" />
        </div>
        <div className="mb-4 space-y-2">
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-5/6 rounded bg-muted" />
        </div>
        <div className="mb-4 flex gap-2">
          <div className="h-4 w-16 rounded-full bg-muted" />
          <div className="h-4 w-20 rounded-full bg-muted" />
        </div>
        <div className="flex items-center justify-between border-t border-border/50 pt-4">
          <div className="h-6 w-16 rounded-full bg-muted" />
          <div className="h-4 w-12 rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}

export function TrendingSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <AICardSkeleton key={i} />
      ))}
    </div>
  )
}

