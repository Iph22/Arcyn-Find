'use client'

import { Check, GitCompare } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { MAX_COMPARE } from '@/lib/compare'
import { useCompareSelection, type CompareItem } from '@/lib/compare-selection'
import { cn } from '@/lib/utils'

/**
 * Add this tool to the comparison, or take it out again.
 *
 * Two shapes, one behaviour. `icon` sits on a result card next to the
 * favourite button; `button` sits in the row of actions on a tool page.
 *
 * On a card this MUST stay above the stretched title anchor -- docs/ROUTING.md
 * §"A click handler is not a link": the card's `<a>` carries
 * `after:absolute after:inset-0`, so anything interactive on top of it needs
 * `relative z-10` or the overlay eats the click. The class is applied here
 * rather than left to each caller, because it is not optional and a missing
 * one fails silently.
 */
export function CompareToggle({
  tool,
  variant = 'icon',
  className,
}: {
  tool: CompareItem
  variant?: 'icon' | 'button'
  className?: string
}) {
  const { isSelected, toggle } = useCompareSelection()
  const selected = isSelected(tool.id)

  function onClick(event: React.MouseEvent) {
    // The card is a link. Without this, adding to the comparison also
    // navigates to the tool page.
    event.preventDefault()
    event.stopPropagation()

    const result = toggle(tool)
    if (result === 'full') {
      // The one outcome where nothing visible happens, so it has to be said.
      toast.error(`You can compare ${MAX_COMPARE} tools at a time`, {
        description: 'Remove one from the compare bar to add another.',
      })
    }
  }

  const label = selected ? `Remove ${tool.name} from comparison` : `Add ${tool.name} to comparison`

  if (variant === 'icon') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-pressed={selected}
        aria-label={label}
        title={label}
        onClick={onClick}
        className={cn(
          'relative z-10 h-8 w-8 shrink-0 rounded-lg',
          selected && 'bg-primary/10 text-primary hover:bg-primary/15',
          className
        )}
      >
        {selected ? <Check className="h-4 w-4" /> : <GitCompare className="h-4 w-4" />}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={selected ? 'secondary' : 'outline'}
      aria-pressed={selected}
      onClick={onClick}
      className={cn('relative z-10', className)}
    >
      {selected ? (
        <Check className="mr-2 h-4 w-4 text-primary" />
      ) : (
        <GitCompare className="mr-2 h-4 w-4" />
      )}
      {selected ? 'In comparison' : 'Compare'}
    </Button>
  )
}
