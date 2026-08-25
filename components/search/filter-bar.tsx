"use client"

import { useState } from "react"
import { Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface FilterBarProps {
  categories?: string[]
  regions?: string[]
  accessTypes?: string[]
  selectedCategory?: string
  selectedRegion?: string
  selectedAccessType?: string
  onCategoryChange?: (category: string) => void
  onRegionChange?: (region: string) => void
  onAccessTypeChange?: (accessType: string) => void
  onClear?: () => void
  className?: string
}

export function FilterBar({
  categories = [],
  regions = [],
  accessTypes = [],
  selectedCategory,
  selectedRegion,
  selectedAccessType,
  onCategoryChange,
  onRegionChange,
  onAccessTypeChange,
  onClear,
  className,
}: FilterBarProps) {
  const hasActiveFilters =
    selectedCategory || selectedRegion || selectedAccessType

  const handleClear = () => {
    onCategoryChange?.("")
    onRegionChange?.("")
    onAccessTypeChange?.("")
    onClear?.()
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters:</span>
      </div>

      <Select value={selectedCategory || "all"} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {regions.length > 0 && (
        <Select value={selectedRegion || "all"} onValueChange={onRegionChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {regions.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {accessTypes.length > 0 && (
        <Select
          value={selectedAccessType || "all"}
          onValueChange={onAccessTypeChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Access Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Access Types</SelectItem>
            {accessTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-8 gap-2"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}

      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {selectedCategory && (
            <Badge variant="secondary" className="gap-1">
              {selectedCategory}
              <button
                onClick={() => onCategoryChange?.("")}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {selectedRegion && (
            <Badge variant="secondary" className="gap-1">
              {selectedRegion}
              <button
                onClick={() => onRegionChange?.("")}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {selectedAccessType && (
            <Badge variant="secondary" className="gap-1">
              {selectedAccessType}
              <button
                onClick={() => onAccessTypeChange?.("")}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

