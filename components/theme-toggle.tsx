"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const handleThemeToggle = () => {
    // Use requestAnimationFrame for smoother, batched DOM updates
    requestAnimationFrame(() => {
      const newTheme = theme === "dark" ? "light" : "dark"
      setTheme(newTheme)
    })
  }

  return (
    <button
      onClick={handleThemeToggle}
      className="rounded-lg border border-border/50 bg-card/50 p-2 hover:bg-card transition-colors duration-150"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5 text-accent" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5 text-accent" aria-hidden="true" />
      )}
    </button>
  )
}
