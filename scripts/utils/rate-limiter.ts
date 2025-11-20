/**
 * Rate limiter utility to prevent overwhelming external APIs
 */

export class RateLimiter {
  private delays: Map<string, number> = new Map()
  private lastRequest: Map<string, number> = new Map()

  /**
   * Wait for the appropriate delay before making a request
   */
  async wait(source: string, delayMs: number = 1000): Promise<void> {
    const now = Date.now()
    const last = this.lastRequest.get(source) || 0
    const elapsed = now - last

    if (elapsed < delayMs) {
      const waitTime = delayMs - elapsed
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.lastRequest.set(source, Date.now())
  }

  /**
   * Set a custom delay for a specific source
   */
  setDelay(source: string, delayMs: number): void {
    this.delays.set(source, delayMs)
  }

  /**
   * Get the delay for a source (default 1000ms)
   */
  getDelay(source: string): number {
    return this.delays.get(source) || 1000
  }
}

export const rateLimiter = new RateLimiter()

