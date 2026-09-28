"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
    Sparkles, Code, Palette, TrendingUp, BookOpen, Zap, MessageSquare,
    PenLine, Music, BarChart3, Video, Megaphone, Users, Headphones,
    ShieldCheck, Languages, HeartPulse, Wallet, Box, Gamepad2, Eye,
    type LucideIcon,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { browseCategorySlugHref } from "@/lib/tool-href"

/**
 * Category shortcuts on the signed-in home page.
 *
 * WHAT THIS REPLACED, AND WHY
 *
 * Six hardcoded cards with invented categories -- "Content Creation",
 * "Creative", "Workflow", "Popular" -- none of which is a value in
 * `ai_tools.category`, so the label on the card described nothing that exists.
 * They were shuffled with `Math.random()` on every mount, so the same card
 * moved between visits, and clicking one ran a free-text search ("gpt",
 * "trending") that landed the user in the directory rather than in the
 * category the card named.
 *
 * Now every card is a real published category, carries its real tool count,
 * and links to that category already filtered in the tool browser.
 *
 * ON THE NAME: these are shortcuts, not model output. The heading no longer
 * claims they are "tailored to your interests" unless they actually are --
 * the caller decides that by which categories it passes in.
 */

export interface SuggestionCategory {
    slug: string
    name: string
    count: number
}

/**
 * Per-category icon. Keyed by slug so it survives a display-name change, with
 * a neutral fallback -- a category without an entry gets a generic icon rather
 * than being dropped or mislabelled.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
    "code-development": Code,
    "ai-agents": Zap,
    "writing-content": PenLine,
    chatbots: MessageSquare,
    "image-generation": Palette,
    productivity: TrendingUp,
    "audio-music": Music,
    "data-analytics": BarChart3,
    "generative-ai": Sparkles,
    "learning-education": BookOpen,
    "marketing-sales": Megaphone,
    "video-generation": Video,
    "hr-recruiting": Users,
    "customer-service": Headphones,
    "ai-detection": ShieldCheck,
    "translation-language": Languages,
    healthcare: HeartPulse,
    finance: Wallet,
    "3d-spatial": Box,
    "gaming-entertainment": Gamepad2,
    "nlp-text-analysis": Eye,
}

/**
 * Editorial one-liners. Copy, not data -- these describe what a category is
 * for, they do not assert anything measured. A category with no entry shows
 * its tool count alone rather than a sentence somebody made up about it.
 */
const CATEGORY_BLURBS: Record<string, string> = {
    "code-development": "Coding assistants, IDEs and developer tooling.",
    "ai-agents": "Autonomous agents that plan and run multi-step work.",
    "writing-content": "Drafting, editing and long-form content generation.",
    chatbots: "Conversational assistants and chat interfaces.",
    "image-generation": "Text-to-image, editing and art creation.",
    productivity: "Automate the workflow around the work.",
    "audio-music": "Voice, speech and music generation.",
    "data-analytics": "Analysis, dashboards and data exploration.",
    "generative-ai": "General-purpose generation across media.",
    "learning-education": "Study aids, tutoring and course building.",
    "marketing-sales": "Campaigns, copy, outreach and CRM.",
    "video-generation": "Text-to-video, editing and post-production.",
    "hr-recruiting": "Resumes, screening and interview prep.",
    "customer-service": "Support automation and helpdesk tooling.",
    "ai-detection": "Spotting AI-generated text and images.",
    "translation-language": "Translation, localisation and language learning.",
    healthcare: "Clinical, diagnostic and wellbeing tools.",
    finance: "Analysis, accounting and financial modelling.",
    "3d-spatial": "3D assets, scenes and spatial computing.",
    "gaming-entertainment": "Game development, NPCs and media.",
    "nlp-text-analysis": "Extraction, classification and text understanding.",
}

/** Stable gradient per card position -- decoration, so index is fine. */
const GRADIENTS = [
    "from-blue-500/20 to-cyan-500/20",
    "from-purple-500/20 to-pink-500/20",
    "from-green-500/20 to-emerald-500/20",
    "from-orange-500/20 to-red-500/20",
    "from-yellow-500/20 to-amber-500/20",
    "from-indigo-500/20 to-violet-500/20",
]

interface AISuggestionsProps {
    /** Real published categories, already ordered by the caller. */
    categories: SuggestionCategory[]
    /** Heading, so the caller can say whether these match the user's interests. */
    heading: string
    subheading: string
    limit?: number
    className?: string
}

export function AISuggestions({
    categories,
    heading,
    subheading,
    limit = 6,
    className,
}: AISuggestionsProps) {
    // No shuffle. The previous version reordered on every mount, which made the
    // same six cards feel like different ones and meant a user could not learn
    // where anything was.
    const shown = categories.slice(0, limit)

    if (shown.length === 0) return null

    const renderCard = (category: SuggestionCategory, index: number, mobile: boolean) => {
        const Icon = CATEGORY_ICONS[category.slug] ?? Sparkles
        const gradient = GRADIENTS[index % GRADIENTS.length]
        const blurb = CATEGORY_BLURBS[category.slug]

        return (
            <Link href={browseCategorySlugHref(category.slug)} className="block h-full">
                <Card
                    className={cn(
                        "relative overflow-hidden cursor-pointer transition-all duration-300",
                        "border-border/50 bg-card/50 backdrop-blur-sm",
                        mobile ? "p-4 h-full" : "p-5 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                    )}
                >
                    <div
                        className={cn(
                            "absolute inset-0 bg-gradient-to-br transition-opacity duration-300",
                            mobile ? "opacity-50" : "opacity-0 hover:opacity-100",
                            gradient
                        )}
                    />

                    <div className="relative z-10">
                        <div className="flex items-start justify-between mb-3">
                            <div
                                className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br",
                                    gradient
                                )}
                            >
                                <Icon className="w-5 h-5 text-primary" />
                            </div>
                            {/* A measured number, not a made-up label. */}
                            <span className="text-xs px-2 py-1 rounded-full bg-muted/50 text-muted-foreground">
                                {category.count.toLocaleString()}
                            </span>
                        </div>

                        <h3 className="font-semibold mb-1 text-base">{category.name}</h3>
                        {blurb && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{blurb}</p>
                        )}
                    </div>
                </Card>
            </Link>
        )
    }

    return (
        <div className={cn("w-full", className)}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-6"
            >
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h2 className="text-xl sm:text-2xl font-bold">{heading}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{subheading}</p>
            </motion.div>

            {/* Desktop Grid */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-4">
                {shown.map((category, index) => (
                    <motion.div
                        key={category.slug}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                    >
                        {renderCard(category, index, false)}
                    </motion.div>
                ))}
            </div>

            {/* Mobile Horizontal Scroll */}
            <div className="md:hidden">
                <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hidden">
                    {shown.map((category, index) => (
                        <motion.div
                            key={category.slug}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: index * 0.1 }}
                            className="flex-shrink-0 w-[280px] snap-start"
                        >
                            {renderCard(category, index, true)}
                        </motion.div>
                    ))}
                </div>
            </div>

            <style jsx global>{`
        .scrollbar-hidden::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hidden {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
        </div>
    )
}
