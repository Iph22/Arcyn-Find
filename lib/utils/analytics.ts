export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (typeof window === "undefined") return

  // Track with Vercel Analytics if available
  if ((window as any).va) {
    try {
      (window as any).va("track", eventName, properties)
    } catch (e) {
      // Ignore analytics errors
    }
  }

  // Also log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log("Analytics Event:", eventName, properties)
  }
}

export function trackPageView(path: string) {
  trackEvent("page_view", { path })
}

export function trackSearch(query: string) {
  trackEvent("search", { query })
}

export function trackToolView(toolId: string, toolName: string) {
  trackEvent("tool_view", { tool_id: toolId, tool_name: toolName })
}

export function trackCollectionCreate(collectionId: string) {
  trackEvent("collection_create", { collection_id: collectionId })
}

export function trackReviewSubmit(toolId: string, rating: number) {
  trackEvent("review_submit", { tool_id: toolId, rating })
}

