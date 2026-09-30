"use client"

import { motion } from "framer-motion"
import { ArrowLeft, Star, Bookmark, Layers } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

/**
 * /community.
 *
 * This page used to claim "50K+ Active Members", "12K+ Discussions" and
 * "150K+ Likes & Reviews". Measured on 2026-09-21, the real figures were 73
 * registered profiles, 7 reviews and 19 recorded tool views. The page is
 * public, indexable and self-canonical, so those numbers were the first thing
 * a visitor and a crawler saw.
 *
 * They were the same invented figures the landing page carried until it was
 * rewritten to read the database -- the fix was applied there and this page
 * was missed, which is the argument for not hard-coding a number anywhere.
 *
 * It also promised features that do not exist. "Go to Discussions" linked to
 * /home, the signed-in dashboard; there is no discussion surface. "Share Your
 * Tools" invited a submission and then rendered a button labelled "Browse
 * Tools". Both are gone rather than restyled.
 *
 * There are no counts on this page on purpose. The honest ones are too small
 * to publish and the flattering ones are not ours to claim -- so it describes
 * what a visitor can actually do instead. Add real figures here when they are
 * worth showing, and read them from the database the way app/page.tsx does.
 */
export default function CommunityPage() {
  const ways = [
    {
      icon: Star,
      title: "Review a tool you use",
      body:
        "Ratings and written reviews sit on the tool's page. Reviewing something you have actually used is the most useful thing you can add here.",
      href: "/tools",
      cta: "Find a tool to review",
    },
    {
      icon: Bookmark,
      title: "Save what works",
      body:
        "Favourite the tools you keep coming back to, so you can find them again without searching twice.",
      href: "/browse",
      cta: "Browse and filter",
    },
    {
      icon: Layers,
      title: "Build a collection",
      body:
        "Group tools around a job -- a podcast workflow, a design stack -- and keep it private or make it public.",
      href: "/collections",
      cta: "Start a collection",
    },
  ]

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-[calc(3rem_+_var(--mobile-nav-clearance))] md:pb-12">
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
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-4xl md:text-5xl font-bold">Community</h1>
          </div>

          <p className="text-xl text-muted-foreground mb-4 max-w-3xl">
            Arcyn Find is early. The directory is large, the community around it
            is not yet — and we would rather say so than invent a number.
          </p>
          <p className="text-muted-foreground mb-2 max-w-3xl">
            Everything below is a thing you can do today. Each one makes the
            directory more useful to the next person who searches it.
          </p>
          <p className="text-sm text-muted-foreground mb-12 max-w-3xl">
            All three need an account — reading and searching the directory
            never does.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {ways.map((way, i) => (
              <motion.div
                key={way.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Card className="p-6 h-full flex flex-col">
                  <way.icon className="w-7 h-7 text-primary mb-3" />
                  <h2 className="text-lg font-semibold mb-2">{way.title}</h2>
                  <p className="text-sm text-muted-foreground mb-6 flex-1">{way.body}</p>
                  <Link href={way.href}>
                    <Button variant="outline" className="w-full">
                      {way.cta}
                    </Button>
                  </Link>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="p-8 bg-muted/30 rounded-xl">
            <h2 className="text-2xl font-semibold mb-4">Community guidelines</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Be respectful and constructive in all interactions</li>
              <li>• Review tools you have used, and say what you used them for</li>
              <li>• Share accurate information and verify sources</li>
              <li>• Follow our code of conduct and terms of service</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
