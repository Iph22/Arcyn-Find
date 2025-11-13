export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="space-y-4 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent border-r-2 mx-auto" aria-label="Loading" />
        <p className="text-sm text-muted-foreground">Loading AI tools...</p>
      </div>
    </div>
  )
}
