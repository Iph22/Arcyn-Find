'use client'

import { useState } from 'react'
import { Check, Download, Link2, Printer } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ComparableTool } from '@/lib/compare'
import {
  downloadFile,
  exportComparisonToCSV,
  exportComparisonToJSON,
  exportComparisonToPDF,
} from '@/lib/export-utils'

/**
 * Take the comparison with you: as a link, a file, or on paper.
 *
 * The link is first and is the one most people want. The exports underneath it
 * are the helpers that have sat unreferenced in lib/export-utils.ts since they
 * were written -- they work, nothing had ever called them.
 */
export function CompareExport({ tools }: { tools: ComparableTool[] }) {
  const [copied, setCopied] = useState(false)

  const filename = `arcyn-comparison-${tools.map((t) => t.slug || t.id).join('-')}`.slice(0, 120)

  async function copyLink() {
    // The current URL already IS the comparison -- that is the whole reason
    // this lives at a route with the tools in the query string rather than in
    // a modal.
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the link', {
        description: 'Copy it from the address bar instead.',
      })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={copyLink}>
        {copied ? <Check className="mr-2 h-4 w-4" /> : <Link2 className="mr-2 h-4 w-4" />}
        {copied ? 'Link copied' : 'Copy link'}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() =>
              downloadFile(exportComparisonToCSV(tools), `${filename}.csv`, 'text/csv')
            }
          >
            Download CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              downloadFile(
                exportComparisonToJSON(tools),
                `${filename}.json`,
                'application/json'
              )
            }
          >
            Download JSON
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              if (!exportComparisonToPDF(tools)) {
                toast.error('Your browser blocked the print window', {
                  description: 'Allow pop-ups for this site, or use your browser’s own print.',
                })
              }
            }}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print / save as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
