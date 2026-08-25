"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Sparkles, Code, Palette, TrendingUp, BookOpen, Zap } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AISuggestion {
    id: string
    title: string
    category: string
    description: string
    icon: typeof Sparkles
    gradient: string
    query: string
}

const suggestions: AISuggestion[] = [
    {
        id: "1",
        title: "AI Writing",
        category: "Content Creation",
        description: "Discover powerful AI tools for writing, editing, and content generation",
        icon: BookOpen,
        gradient: "from-blue-500/20 to-cyan-500/20",
        query: "writing"
    },
    {
        id: "2",
        title: "Image Generation",
        category: "Creative",
        description: "Explore cutting-edge image generation and art creation tools",
        icon: Palette,
        gradient: "from-purple-500/20 to-pink-500/20",
        query: "image generation"
    },
    {
        id: "3",
        title: "Code Assistants",
        category: "Development",
        description: "Boost your productivity with AI-powered coding tools",
        icon: Code,
        gradient: "from-green-500/20 to-emerald-500/20",
        query: "code"
    },
    {
        id: "4",
        title: "Trending AI",
        category: "Popular",
        description: "Check out the most popular and trending AI tools right now",
        icon: TrendingUp,
        gradient: "from-orange-500/20 to-red-500/20",
        query: "trending"
    },
    {
        id: "5",
        title: "Productivity",
        category: "Workflow",
        description: "Streamline your workflow with intelligent productivity tools",
        icon: Zap,
        gradient: "from-yellow-500/20 to-amber-500/20",
        query: "productivity"
    },
    {
        id: "6",
        title: "AI Models",
        category: "Research",
        description: "Discover the latest language models and AI frameworks",
        icon: Sparkles,
        gradient: "from-indigo-500/20 to-violet-500/20",
        query: "gpt"
    },
]

interface AISuggestionsProps {
    onSuggestionClick?: (query: string) => void
    limit?: number
    className?: string
}

export function AISuggestions({ onSuggestionClick, limit = 6, className }: AISuggestionsProps) {
    const [displayedSuggestions, setDisplayedSuggestions] = useState<AISuggestion[]>([])

    useEffect(() => {
        // Shuffle and select suggestions
        const shuffled = [...suggestions].sort(() => Math.random() - 0.5)
        setDisplayedSuggestions(shuffled.slice(0, limit))
    }, [limit])

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
                    <h2 className="text-xl sm:text-2xl font-bold">AI Suggestions</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                    Discover popular AI tools tailored to your interests
                </p>
            </motion.div>

            {/* Desktop Grid */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedSuggestions.map((suggestion, index) => (
                    <motion.div
                        key={suggestion.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                    >
                        <Card
                            onClick={() => onSuggestionClick?.(suggestion.query)}
                            className={cn(
                                "relative overflow-hidden p-5 cursor-pointer transition-all duration-300",
                                "hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
                                "border-border/50 bg-card/50 backdrop-blur-sm"
                            )}
                        >
                            <div className={cn(
                                "absolute inset-0 bg-gradient-to-br opacity-0 hover:opacity-100 transition-opacity duration-300",
                                suggestion.gradient
                            )} />

                            <div className="relative z-10">
                                <div className="flex items-start justify-between mb-3">
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center",
                                        "bg-gradient-to-br",
                                        suggestion.gradient
                                    )}>
                                        <suggestion.icon className="w-5 h-5 text-primary" />
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded-full bg-muted/50 text-muted-foreground">
                                        {suggestion.category}
                                    </span>
                                </div>

                                <h3 className="font-semibold mb-1 text-base">{suggestion.title}</h3>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    {suggestion.description}
                                </p>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Mobile Horizontal Scroll */}
            <div className="md:hidden">
                <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hidden">
                    {displayedSuggestions.map((suggestion, index) => (
                        <motion.div
                            key={suggestion.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: index * 0.1 }}
                            className="flex-shrink-0 w-[280px] snap-start"
                        >
                            <Card
                                onClick={() => onSuggestionClick?.(suggestion.query)}
                                className={cn(
                                    "relative overflow-hidden p-4 cursor-pointer transition-all duration-300",
                                    "active:scale-[0.98] border-border/50 bg-card/50 backdrop-blur-sm h-full"
                                )}
                            >
                                <div className={cn(
                                    "absolute inset-0 bg-gradient-to-br opacity-50",
                                    suggestion.gradient
                                )} />

                                <div className="relative z-10">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center",
                                            "bg-gradient-to-br",
                                            suggestion.gradient
                                        )}>
                                            <suggestion.icon className="w-5 h-5 text-primary" />
                                        </div>
                                        <span className="text-xs px-2 py-1 rounded-full bg-muted/50 text-muted-foreground">
                                            {suggestion.category}
                                        </span>
                                    </div>

                                    <h3 className="font-semibold mb-1 text-base">{suggestion.title}</h3>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {suggestion.description}
                                    </p>
                                </div>
                            </Card>
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
