"use client"

import { motion } from "framer-motion"
import { ArrowLeft, Users, MessageSquare, TrendingUp, Heart } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function CommunityPage() {
  const stats = [
    { label: "Active Members", value: "50K+", icon: Users },
    { label: "Discussions", value: "12K+", icon: MessageSquare },
    { label: "Tools Shared", value: "2,000+", icon: TrendingUp },
    { label: "Likes & Reviews", value: "150K+", icon: Heart },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
          <div className="flex items-center gap-3 mb-8">
            <Users className="w-8 h-8 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold">Community</h1>
          </div>

          <p className="text-xl text-muted-foreground mb-12 max-w-3xl">
            Join thousands of AI enthusiasts, developers, and innovators sharing knowledge, tools, and insights.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Card className="p-6 text-center">
                  <stat.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                  <div className="text-3xl font-bold mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-4">Join the Discussion</h2>
              <p className="text-muted-foreground mb-6">
                Connect with other members, share your favorite AI tools, ask questions, and help others discover
                the best solutions for their needs.
              </p>
              <Button className="w-full" onClick={() => window.location.href = "/home"}>
                Go to Discussions
              </Button>
            </Card>

            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-4">Share Your Tools</h2>
              <p className="text-muted-foreground mb-6">
                Found an amazing AI tool? Share it with the community! Help others discover tools that can
                transform their workflow.
              </p>
              <Button variant="outline" className="w-full" onClick={() => window.location.href = "/tools"}>
                Browse Tools
              </Button>
            </Card>
          </div>

          <div className="mt-12 p-8 bg-muted/30 rounded-xl">
            <h2 className="text-2xl font-semibold mb-4">Community Guidelines</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Be respectful and constructive in all interactions</li>
              <li>• Share accurate information and verify sources</li>
              <li>• Help others by answering questions and providing feedback</li>
              <li>• Follow our code of conduct and terms of service</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

