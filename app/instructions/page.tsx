"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Search, Star, Heart, BookmarkPlus, TrendingUp, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useUser } from "@clerk/nextjs"

const instructions = [
  {
    icon: Search,
    title: "Search for AI Tools",
    description:
      "Use the powerful search bar to find AI tools by name, category, or description. Get instant results with smart filtering.",
    color: "primary",
  },
  {
    icon: Star,
    title: "Rate and Review",
    description:
      "Share your experience with tools by leaving ratings and detailed reviews. Help the community make better decisions.",
    color: "chart-1",
  },
  {
    icon: BookmarkPlus,
    title: "Create Collections",
    description:
      "Organize your favorite tools into custom collections. Keep track of tools you want to try or recommend.",
    color: "chart-2",
  },
  {
    icon: Heart,
    title: "Save Your Favorites",
    description: "Bookmark tools you love for quick access later. Build your personal library of AI resources.",
    color: "chart-3",
  },
  {
    icon: Users,
    title: "Follow and Connect",
    description: "Follow other users to see their reviews and collections. Build a network of AI enthusiasts.",
    color: "chart-4",
  },
  {
    icon: TrendingUp,
    title: "Stay Updated",
    description: "Discover trending tools and see what's popular in the community. Never miss the latest innovations.",
    color: "chart-5",
  },
]

export default function InstructionsPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const [isSaving, setIsSaving] = useState(false)

  // Check user status and redirect if needed
  useEffect(() => {
    if (isLoaded && user) {
      const checkUserStatus = async () => {
        try {
          const response = await fetch('/api/auth/ensure-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            return
          }

          const data = await response.json()

          // If user hasn't completed onboarding, redirect to onboarding
          if (!data.onboarding_completed) {
            router.replace('/onboarding')
            return
          }

          // If user has already seen instructions, redirect to home
          if (data.instructions_seen) {
            router.replace('/home')
            return
          }
        } catch (error) {
          console.error('Error checking user status:', error)
        }
      }

      checkUserStatus()
    }
  }, [user, isLoaded, router])

  const handleGetStarted = async () => {
    setIsSaving(true)
    try {
      // Mark instructions as seen in database first
      const { markInstructionsSeen } = await import("@/lib/user-preferences")
      const result = await markInstructionsSeen()

      if (!result.success) {
        console.error('Failed to mark instructions as seen:', result.error)
        alert('Failed to save. Please try again.')
        setIsSaving(false)
        return
      }

      // Only update localStorage after DB save succeeds
      localStorage.setItem("arcyn-instructions-seen", "true")

      // Now safe to redirect (use replace to avoid preserving query params)
      router.replace("/home")
    } catch (error) {
      console.error('Error marking instructions as seen:', error)
      alert('An error occurred. Please try again.')
      setIsSaving(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-background">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_110%)] opacity-20" />

      <motion.div
        className="absolute right-1/4 top-20 h-96 w-96 rounded-full bg-primary/20 blur-[100px] opacity-50"
        animate={{
          y: [0, -50, 0],
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 10,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute left-1/4 bottom-20 h-80 w-80 rounded-full bg-chart-2/20 blur-[100px] opacity-30"
        animate={{
          y: [0, 50, 0],
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{
          duration: 15,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:py-16 md:py-20 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 sm:mb-12 md:mb-16 text-center"
        >
          <motion.div
            className="mx-auto mb-4 sm:mb-6 inline-flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-chart-1 shadow-2xl"
            animate={{
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          >
            <Search className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
          </motion.div>
          <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl md:text-5xl font-bold px-4">How to Use Arcyn Find</h1>
          <p className="mx-auto max-w-2xl text-base sm:text-lg md:text-xl text-muted-foreground px-4">
            Master the platform in minutes with these essential features
          </p>
        </motion.div>

        {/* Instructions grid */}
        <div className="mb-8 sm:mb-12 md:mb-16 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {instructions.map((instruction, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="group relative h-full overflow-hidden border-white/10 bg-white/5 p-5 sm:p-6 md:p-8 backdrop-blur-xl transition-all duration-300 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1">
                <div className="relative z-10">
                  <div
                    className={`mb-4 sm:mb-5 inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-${instruction.color}/10 ring-1 ring-${instruction.color}/20 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}
                  >
                    <instruction.icon className={`h-6 w-6 sm:h-7 sm:w-7 text-${instruction.color}`} />
                  </div>
                  <h3 className="mb-2 sm:mb-3 text-lg sm:text-xl font-bold tracking-tight">{instruction.title}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed group-hover:text-muted-foreground/80">{instruction.description}</p>
                </div>
                <div
                  className={`absolute inset-0 bg-gradient-to-br from-${instruction.color}/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
                />
              </Card>
            </motion.div>
          ))}
        </div>

        {/* CTA section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center"
        >
          <Card className="relative mx-auto max-w-2xl overflow-hidden border-border/50 bg-card/80 p-6 sm:p-8 md:p-12 backdrop-blur-xl">
            <motion.div
              className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
            <div className="relative z-10">
              <h2 className="mb-3 sm:mb-4 text-2xl sm:text-3xl font-bold">Ready to explore?</h2>
              <p className="mb-6 sm:mb-8 text-base sm:text-lg text-muted-foreground">
                Start discovering amazing AI tools tailored to your interests
              </p>
              <Button
                size="lg"
                onClick={handleGetStarted}
                disabled={isSaving}
                className="group gap-2 shadow-lg w-full sm:w-auto h-12 sm:h-auto min-h-[48px] text-sm sm:text-base active:scale-[0.98]"
              >
                {isSaving ? (
                  <>
                    <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    Go to Home
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
