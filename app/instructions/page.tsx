"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Search, Star, Heart, BookmarkPlus, TrendingUp, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

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
  const [isSaving, setIsSaving] = useState(false)

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
      
      // Now safe to redirect
      router.push("/home")
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
        className="absolute right-1/4 top-20 h-64 w-64 rounded-full bg-chart-1/20 blur-3xl"
        animate={{
          y: [0, -30, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 8,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <motion.div
            className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-1 shadow-2xl"
            animate={{
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          >
            <Search className="h-8 w-8 text-primary-foreground" />
          </motion.div>
          <h1 className="mb-4 text-5xl font-bold">How to Use Arcyn Find</h1>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
            Master the platform in minutes with these essential features
          </p>
        </motion.div>

        {/* Instructions grid */}
        <div className="mb-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {instructions.map((instruction, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="group relative h-full overflow-hidden border-border/50 bg-card/50 p-8 backdrop-blur-sm transition-all hover:border-border hover:shadow-xl">
                <div className="relative z-10">
                  <div
                    className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-${instruction.color}/10`}
                  >
                    <instruction.icon className={`h-6 w-6 text-${instruction.color}`} />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">{instruction.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{instruction.description}</p>
                </div>
                <div
                  className={`absolute inset-0 bg-gradient-to-br from-${instruction.color}/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100`}
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
          <Card className="relative mx-auto max-w-2xl overflow-hidden border-border/50 bg-card/80 p-12 backdrop-blur-xl">
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
              <h2 className="mb-4 text-3xl font-bold">Ready to explore?</h2>
              <p className="mb-8 text-lg text-muted-foreground">
                Start discovering amazing AI tools tailored to your interests
              </p>
              <Button 
                size="lg" 
                onClick={handleGetStarted} 
                disabled={isSaving}
                className="group gap-2 shadow-lg"
              >
                {isSaving ? (
                  <>
                    <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    Go to Home
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
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
