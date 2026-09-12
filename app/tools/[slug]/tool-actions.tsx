'use client'

import { useState } from 'react'
import { Bookmark, Check, ExternalLink, Share2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useFavorites } from '@/lib/hooks/use-favorites'

/**
 * The only interactive part of a tool page.
 *
 * Kept as a small client island so the page itself stays a server component:
 * everything a crawler needs is in the server-rendered HTML, and this adds
 * saving and sharing for people who are signed in.
 */
export function ToolActions({
  toolId,
  name,
  platform,
  url,
}: {
  toolId: string
  name: string
  platform: string | null
  url: string
}) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const [copied, setCopied] = useState(false)

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
      <Button variant="outline" onClick={share}>
        {copied ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
        {copied ? 'Link copied' : 'Share'}
      </Button>
    </div>
  )
}
