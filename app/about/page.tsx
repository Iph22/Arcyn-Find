"use client"

import { motion } from "framer-motion"
import { ArrowLeft, Target, Zap, Users, Globe } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AboutPage() {
  const values = [
    {
      icon: Target,
      title: "Our Mission",
      description: "To make AI tools accessible and discoverable for everyone, empowering innovation and creativity worldwide.",
    },
    {
      icon: Zap,
      title: "Innovation",
      description: "We continuously update our platform with the latest AI tools and technologies to keep you ahead of the curve.",
    },
    {
      icon: Users,
      title: "Community-Driven",
      description: "Built by the community, for the community. Your feedback and contributions shape the future of Arcyn Find.",
    },
    {
      icon: Globe,
      title: "Global Reach",
      description: "Connecting AI enthusiasts, developers, and innovators from around the world in one unified platform.",
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/">
          <Button variant="ghost" className="mb-8 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">About Arcyn Find</h1>
          <p className="text-xl text-muted-foreground mb-12">
            The most comprehensive platform for discovering, comparing, and mastering AI tools.
          </p>

          <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground mb-12">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Who We Are</h2>
              <p>
                Arcyn Find is a platform dedicated to helping developers, researchers, and AI enthusiasts discover
                the best AI tools for their needs. We curate and organize thousands of AI tools, making it easy to
                find exactly what you're looking for.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">What We Do</h2>
              <p>
                We aggregate AI tools from various sources, provide detailed information, user reviews, and comparisons.
                Our platform helps you make informed decisions about which AI tools to use for your projects.
              </p>
            </section>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {values.map((value, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="p-6 bg-card border border-border rounded-xl"
              >
                <value.icon className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{value.title}</h3>
                <p className="text-muted-foreground">{value.description}</p>
              </motion.div>
            ))}
          </div>

          <div className="p-8 bg-muted/30 rounded-xl">
            <h2 className="text-2xl font-semibold mb-4">Get Involved</h2>
            <p className="text-muted-foreground mb-6">
              Arcyn Find is open source and community-driven. We welcome contributions, feedback, and suggestions.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild>
                <a href="https://github.com/Iph22/Arcyn-Find" target="_blank" rel="noopener noreferrer">
                  View on GitHub
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/contact">Contact Us</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

