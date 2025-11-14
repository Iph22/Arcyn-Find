"use client"

import { motion } from "framer-motion"
import { TypeoutBackground } from "./typeout-background"

export function HeroSection() {
  const handleStartExploring = () => {
    // Scroll to search section
    const searchSection = document.querySelector('section[class*="border-b"]')
    if (searchSection) {
      searchSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Focus the search input after a short delay
      setTimeout(() => {
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
        searchInput?.focus()
      }, 500)
    }
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-background/80 py-20 md:py-32">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(0deg, transparent 24%, rgba(139, 92, 246, 0.1) 25%, rgba(139, 92, 246, 0.1) 26%, transparent 27%, transparent 74%, rgba(139, 92, 246, 0.1) 75%, rgba(139, 92, 246, 0.1) 76%, transparent 77%, transparent),
            linear-gradient(90deg, transparent 24%, rgba(139, 92, 246, 0.1) 25%, rgba(139, 92, 246, 0.1) 26%, transparent 27%, transparent 74%, rgba(139, 92, 246, 0.1) 75%, rgba(139, 92, 246, 0.1) 76%, transparent 77%, transparent)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      <TypeoutBackground />

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-6"
        >
          <span className="text-sm font-medium text-accent">Welcome to Arcyn Find</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mb-6 text-balance text-4xl font-bold tracking-tight md:text-6xl"
        >
          Discover <span className="text-accent">AI Tools</span> Worldwide
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-8 text-balance text-lg text-muted-foreground md:text-xl"
        >
          Search, filter, and explore AI tools, models, platforms, and research across all categories and regions.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex justify-center gap-4"
        >
          <button 
            onClick={handleStartExploring}
            className="rounded-lg bg-accent px-8 py-3 font-medium text-accent-foreground transition-all hover:shadow-lg hover:shadow-accent/50 active:scale-95"
          >
            Start Exploring
          </button>
        </motion.div>
      </div>
    </section>
  )
}
