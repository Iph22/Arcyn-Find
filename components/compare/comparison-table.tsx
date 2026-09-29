import Link from 'next/link'
import { ExternalLink, X } from 'lucide-react'

import { ToolImage } from '@/components/tools/tool-image'
import { Badge } from '@/components/ui/badge'
import {
  COMPARE_FIELDS,
  NO_VALUE,
  cheapestId,
  compareHref,
  fieldValues,
  isUniform,
  type ComparableTool,
} from '@/lib/compare'
import { toolHref } from '@/lib/tool-href'
import { cn } from '@/lib/utils'

/**
 * The comparison itself.
 *
 * A server component, and a real `<table>`. Both are deliberate: the table is
 * what makes the thing readable by a screen reader (row headers name the
 * attribute, column headers name the tool), and keeping it on the server means
 * the page's content is in the HTML rather than assembled after hydration --
 * so a shared /compare link renders for someone who follows it with a cold
 * cache and a slow phone.
 *
 * The only interactive parts are links: removing a column is a link to the
 * same page with one fewer tool in the query string. Nothing here needs
 * JavaScript to work.
 */
export function ComparisonTable({ tools }: { tools: ComparableTool[] }) {
  const cheapest = cheapestId(tools)

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">
          {tools.map((t) => t.name).join(' compared with ')}
        </caption>

        <thead>
          <tr>
            {/* The corner cell. `sticky left-0` keeps the attribute labels
                visible while the tool columns scroll sideways on a phone --
                without it the reader scrolls to column four and can no longer
                see which row is the price. */}
            <th
              scope="col"
              className="sticky left-0 z-10 w-36 bg-background p-3 text-left align-bottom text-xs font-medium uppercase tracking-wide text-muted-foreground sm:w-44"
            >
              <span className="sr-only">Attribute</span>
            </th>

            {tools.map((tool) => (
              <th
                key={tool.id}
                scope="col"
                className="min-w-[13rem] border-b border-border/60 p-3 text-left align-bottom"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="relative mb-2 h-10 w-10 overflow-hidden rounded-lg bg-muted">
                      <ToolImage
                        src={tool.image}
                        alt={`${tool.name} logo`}
                        className="object-cover"
                        sizes="40px"
                        fallbackText={tool.name}
                      />
                    </div>
                    <Link
                      href={toolHref(tool)}
                      className="font-semibold leading-tight hover:underline"
                    >
                      {tool.name}
                    </Link>
                  </div>

                  {/* Removing a column is a link, so it works with no
                      JavaScript and leaves a URL you can go back to. */}
                  {tools.length > 1 && (
                    <Link
                      href={compareHref(tools.filter((t) => t.id !== tool.id))}
                      aria-label={`Remove ${tool.name} from this comparison`}
                      title={`Remove ${tool.name}`}
                      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Link>
                  )}
                </div>

                {tool.platform && (
                  <a
                    href={tool.platform}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Visit site
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {COMPARE_FIELDS.map((field) => {
            const values = fieldValues(field, tools)

            // A row where every tool answers the same carries no comparison.
            // Dropping it entirely would hide real information (they ARE all
            // freemium), so it is kept and muted rather than removed.
            const uniform = isUniform(values)

            // Nothing known for anyone. This is common -- most of the catalog
            // is scraped rows with partial fields -- and four em-dashes in a
            // row is worse than no row.
            if (values.every((v) => v === NO_VALUE)) return null

            return (
              <tr key={field.key} className="border-b border-border/40 last:border-0">
                <th
                  scope="row"
                  className={cn(
                    'sticky left-0 z-10 bg-background p-3 text-left align-top text-xs font-medium',
                    uniform ? 'text-muted-foreground/60' : 'text-muted-foreground'
                  )}
                >
                  {field.label}
                </th>

                {tools.map((tool, index) => {
                  const value = values[index]
                  const isCheapest = field.key === 'price' && cheapest === tool.id

                  return (
                    <td
                      key={tool.id}
                      className={cn(
                        'p-3 align-top',
                        value === NO_VALUE && 'text-muted-foreground/50',
                        uniform && 'text-muted-foreground'
                      )}
                    >
                      {field.key === 'tags' && tool.tags && tool.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {tool.tags.slice(0, 6).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs font-normal">
                              {tag}
                            </Badge>
                          ))}
                          {tool.tags.length > 6 && (
                            <span className="text-xs text-muted-foreground">
                              +{tool.tags.length - 6}
                            </span>
                          )}
                        </div>
                      ) : field.key === 'platform' && tool.platform ? (
                        <a
                          href={tool.platform}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="break-words underline-offset-2 hover:underline"
                        >
                          {value}
                        </a>
                      ) : (
                        <span className={cn('break-words', isCheapest && 'font-semibold')}>
                          {value}
                          {isCheapest && (
                            <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
                              Lowest
                            </Badge>
                          )}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
