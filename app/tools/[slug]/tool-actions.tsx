'use client'

import { useState } from 'react'
import { Bookmark, Check, ExternalLink, Share2 } from 'lucide-react'

import { CompareToggle } from '@/components/compare/compare-toggle'
import { Button } from '@/components/ui/button'
import { useFavorites } from '@/lib/hooks/use-favorites'
import { useTrackToolView } from '@/lib/hooks/use-track-tool-view'

/**
 * The only interactive part of a tool page.
 *
 * Kept as a small client island so the page itself stays a server component:
 * everything a crawler needs is in the server-rendered HTML, and this adds
 * saving and sharing for people who are signed in.
 *
 * It also reports the page view. That has to happen from the client: this page
 * sets `revalidate = 7200`, so the server component runs on regeneration, not
 * per request, and counting views there would count cache misses instead of
 * readers.
 */
export function ToolActions({
  toolId,
  slug,
  name,
  platform,
  url,
}: {
  toolId: string
  /** For the compare link, which prefers the slug exactly as toolHref() does. */
  slug?: string | null
  name: string
  platform: string | null
  url: string
}) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const [copied, setCopied] = useState(false)

  useTrackToolView(toolId)

  async function share() {
    // Native share where available, clipboard everywhere else.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: name, url })
        return
      } catch {
        // Cancelled or unavailable: fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked; nothing useful to do.
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      {platform && (
        <Button asChild>
          <a href={platform} target="_blank" rel="noopener noreferrer nofollow">
            Visit website
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      )}
      <Button variant="outline" onClick={() => toggleFavorite(toolId)}>
        <Bookmark className={`mr-2 h-4 w-4 ${isFavorite(toolId) ? 'fill-primary text-primary' : ''}`} />
        {isFavorite(toolId) ? 'Saved' : 'Save'}
      </Button>
      {/* The other half of the comparison flow. Someone who arrived here from
          Google has not been through /browse and has no tray yet -- this is
          where they start one, and the bar appears as soon as they do. */}
      <CompareToggle tool={{ id: toolId, slug, name }} variant="button" />
      <Button variant="outline" onClick={share}>
        {copied ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
        {copied ? 'Link copied' : 'Share'}
      </Button>
    </div>
  )
}
