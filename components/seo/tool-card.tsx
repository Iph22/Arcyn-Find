import Link from 'next/link'
import { ToolImage } from '@/components/tools/tool-image'
import { Badge } from '@/components/ui/badge'
import { clampForMeta, slugify, type CatalogTool } from '@/lib/seo/catalog'

/**
 * A tool card that is a real link.
 *
 * The interactive browser renders cards that open a modal, which is invisible
 * to a crawler. Every card in the public layer is an `<a href>` to the tool's
 * own URL so the directory forms a traversable graph.
 */
export function SeoToolCard({ tool }: { tool: CatalogTool }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group flex gap-4 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
        <ToolImage
          src={tool.image}
          alt={`${tool.name} logo`}
          className="object-cover"
          sizes="48px"
          fallbackText={tool.name}
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold group-hover:text-primary">{tool.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {clampForMeta(tool.description, 120)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {tool.category && (
            <Badge variant="outline" className="text-xs font-normal">
              {tool.category}
            </Badge>
          )}
          {tool.accessType && (
            <Badge variant="secondary" className="text-xs font-normal">
              {tool.accessType}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  )
}

export function CategoryCard({
  category,
}: {
  category: { slug: string; name: string; count: number }
}) {
  return (
    <Link
      href={`/tools/category/${category.slug}`}
      className="group rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <h3 className="font-semibold group-hover:text-primary">{category.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {category.count.toLocaleString()} {category.count === 1 ? 'tool' : 'tools'}
      </p>
    </Link>
  )
}

export { slugify }
