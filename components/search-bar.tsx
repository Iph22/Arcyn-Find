"use client"

import { motion } from "framer-motion"
import { Search } from "lucide-react"

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <motion.div className="relative" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, tags, keywords..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 pl-12 text-foreground placeholder-muted-foreground transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>
    </motion.div>
  )
}
