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
  "NLP/Audio",
  "Audio/NLP",
  "Code Generation",
  "Multimodal Platform",
  "Autonomous AI",
  "Video Generation",
  "Audio/Video Processing",
  "Search/QA",
  "NLP Platform",
  "ML Infrastructure",
]

const regions = ["All", "USA", "EU", "Canada", "China", "Israel", "UAE", "Global"]
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
      <div className="mx-auto max-w-7xl px-4 py-3 md:py-4">
        {/* Mobile: Stack vertically, Desktop: Horizontal */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          {/* Category Filter */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
            <label htmlFor="category-filter" className="text-xs sm:text-sm font-medium text-muted-foreground">
              Category:
            </label>
            <div className="relative flex-1 sm:flex-initial">
              <select
                id="category-filter"
                value={selectedCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="w-full sm:w-auto appearance-none rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 sm:px-4 sm:py-2 pr-10 text-sm text-foreground transition-colors duration-150 hover:bg-card focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
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
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
            <label htmlFor="region-filter" className="text-xs sm:text-sm font-medium text-muted-foreground">
              Region:
            </label>
            <div className="relative flex-1 sm:flex-initial">
              <select
                id="region-filter"
                value={selectedRegion}
                onChange={(e) => onRegionChange(e.target.value)}
                className="w-full sm:w-auto appearance-none rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 sm:px-4 sm:py-2 pr-10 text-sm text-foreground transition-colors duration-150 hover:bg-card focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
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
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
            <label htmlFor="access-filter" className="text-xs sm:text-sm font-medium text-muted-foreground">
              Access:
            </label>
            <div className="relative flex-1 sm:flex-initial">
              <select
                id="access-filter"
                value={selectedAccessType}
                onChange={(e) => onAccessTypeChange(e.target.value)}
                className="w-full sm:w-auto appearance-none rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 sm:px-4 sm:py-2 pr-10 text-sm text-foreground transition-colors duration-150 hover:bg-card focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
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
    </motion.div>
  )
}
