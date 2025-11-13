"use client"

import { motion } from "framer-motion"
import type { AIEntry } from "@/lib/ai-data"
import { AICard } from "./ai-card"
import { Flame } from "lucide-react"

interface TrendingSectionProps {
  trendingAIs: AIEntry[]
  onSelectAI: (ai: AIEntry) => void
}

export function TrendingSection({ trendingAIs, onSelectAI }: TrendingSectionProps) {
  if (trendingAIs.length === 0) return null

  return (
    <section className="border-b border-border/50 bg-gradient-to-b from-background to-background/50 py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-bold text-accent uppercase tracking-wider">Trending Now</h2>
          </div>
          <h3 className="text-3xl font-bold text-foreground md:text-4xl">Popular AI Tools</h3>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trendingAIs.map((ai, idx) => (
            <AICard key={ai.id} ai={ai} onClick={() => onSelectAI(ai)} delay={idx * 0.1} />
          ))}
        </div>
      </div>
    </section>
  )
}
