"use client"

import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"

interface FilterBarProps {
  onCategoryChange: (category: string) => void
  onRegionChange: (region: string) => void
  onAccessTypeChange: (type: string) => void
  selectedCategory: string
  selectedRegion: string
  selectedAccessType: string
}

const categories = [
  "All",
  "Generative AI",
  "Computer Vision",
  "NLP",
  "Audio/NLP",
  "Code Generation",
  "Multimodal Platform",
  "Autonomous AI",
  "Video Generation",
]

const regions = ["All", "USA", "EU", "Canada", "Global"]
const accessTypes = ["All", "Free", "Freemium", "Paid"]

export function FilterBar({
  onCategoryChange,
  onRegionChange,
  onAccessTypeChange,
  selectedCategory,
  selectedRegion,
  selectedAccessType,
}: FilterBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="category-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Category:
              </label>
              <div className="relative">
                <select
                  id="category-filter"
                  value={selectedCategory}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="appearance-none rounded-lg border border-border/50 bg-card/50 px-4 py-2 pr-10 text-sm text-foreground transition-colors duration-150 hover:bg-card focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat === "All" ? "" : cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            {/* Region Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="region-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Region:
              </label>
              <div className="relative">
                <select
                  id="region-filter"
                  value={selectedRegion}
                  onChange={(e) => onRegionChange(e.target.value)}
                  className="appearance-none rounded-lg border border-border/50 bg-card/50 px-4 py-2 pr-10 text-sm text-foreground transition-colors duration-150 hover:bg-card focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  {regions.map((reg) => (
                    <option key={reg} value={reg === "All" ? "" : reg}>
                      {reg}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            {/* Access Type Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="access-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Access:
              </label>
              <div className="relative">
                <select
                  id="access-filter"
                  value={selectedAccessType}
                  onChange={(e) => onAccessTypeChange(e.target.value)}
                  className="appearance-none rounded-lg border border-border/50 bg-card/50 px-4 py-2 pr-10 text-sm text-foreground transition-colors duration-150 hover:bg-card focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  {accessTypes.map((type) => (
                    <option key={type} value={type === "All" ? "" : type}>
                      {type}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
