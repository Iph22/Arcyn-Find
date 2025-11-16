"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, ExternalLink, X } from "lucide-react"
import type { AIEntry } from "@/lib/ai-data"
import { aiEntries } from "@/lib/ai-data"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"

const COMPARISON_STORAGE_KEY = 'arcyn-find-comparison-tools'

export default function ComparePage() {
    const router = useRouter()
    const [tools, setTools] = useState<AIEntry[]>([])

    useEffect(() => {
        // Load comparison tools from localStorage
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(COMPARISON_STORAGE_KEY)
            if (stored) {
                try {
                    const toolIds = JSON.parse(stored) as string[]
                    const loadedTools = toolIds
                        .map(id => aiEntries.find(ai => ai.id === id))
                        .filter((ai): ai is AIEntry => ai !== undefined)
                    setTools(loadedTools)
                } catch (error) {
                    console.error('Failed to load comparison tools:', error)
                }
            }
        }
    }, [])

    const removeTool = (id: string) => {
        const updated = tools.filter(t => t.id !== id)
        setTools(updated)
        
        // Update localStorage
        if (typeof window !== 'undefined') {
            if (updated.length === 0) {
                localStorage.removeItem(COMPARISON_STORAGE_KEY)
            } else {
                localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(updated.map(t => t.id)))
            }
        }
    }

    if (tools.length === 0) {
        return (
            <div className="min-h-screen bg-background text-foreground">
                <div className="fixed top-4 right-4 z-50">
                    <ThemeToggle />
                </div>
                <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
                    <motion.button
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => router.back()}
                        className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        <span>Back</span>
                    </motion.button>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-12"
                    >
                        <h1 className="text-3xl font-bold mb-4">No Tools to Compare</h1>
                        <p className="text-muted-foreground mb-6">
                            Add AI tools to comparison from the main page to see them here.
                        </p>
                        <button
                            onClick={() => router.push('/')}
                            className="rounded-lg bg-accent px-6 py-2.5 font-medium text-accent-foreground transition-all hover:bg-accent/90 hover:shadow-lg"
                        >
                            Browse AI Tools
                        </button>
                    </motion.div>
                </div>
                <Footer />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Theme Toggle */}
            <div className="fixed top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <div className="mx-auto max-w-7xl px-4 py-8 md:py-12">
                {/* Back Button */}
                <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => router.back()}
                    className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                    <span>Back</span>
                </motion.button>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Header */}
                    <div className="mb-6 flex items-center justify-between">
                        <h1 className="text-3xl font-bold md:text-4xl">Compare AI Tools</h1>
                        <div className="text-sm text-muted-foreground">
                            {tools.length} of 3 tools
                        </div>
                    </div>

                    {/* Comparison Table */}
                    <div className="rounded-xl border border-border/50 bg-card shadow-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="p-4 text-left font-semibold sticky left-0 bg-muted/30 z-10">Feature</th>
                                        {tools.map((tool) => (
                                            <th key={tool.id} className="p-4 text-left font-semibold min-w-[200px] relative">
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="flex-1">{tool.name}</span>
                                                    <button
                                                        onClick={() => removeTool(tool.id)}
                                                        className="rounded-lg p-1 hover:bg-muted transition-colors flex-shrink-0"
                                                        aria-label="Remove from comparison"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-border/50">
                                        <td className="p-4 font-medium sticky left-0 bg-card z-10">Category</td>
                                        {tools.map((tool) => (
                                            <td key={tool.id} className="p-4">{tool.category}</td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border/50">
                                        <td className="p-4 font-medium sticky left-0 bg-card z-10">Description</td>
                                        {tools.map((tool) => (
                                            <td key={tool.id} className="p-4 text-sm text-muted-foreground max-w-xs">{tool.description}</td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border/50">
                                        <td className="p-4 font-medium sticky left-0 bg-card z-10">Access Type</td>
                                        {tools.map((tool) => (
                                            <td key={tool.id} className="p-4">
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                    tool.accessType === 'Free' ? 'bg-green-500/20 text-green-400' :
                                                    tool.accessType === 'Freemium' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-purple-500/20 text-purple-400'
                                                }`}>
                                                    {tool.accessType}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border/50">
                                        <td className="p-4 font-medium sticky left-0 bg-card z-10">Pricing</td>
                                        {tools.map((tool) => (
                                            <td key={tool.id} className="p-4">{tool.pricing}</td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border/50">
                                        <td className="p-4 font-medium sticky left-0 bg-card z-10">Region</td>
                                        {tools.map((tool) => (
                                            <td key={tool.id} className="p-4">{tool.region}</td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border/50">
                                        <td className="p-4 font-medium sticky left-0 bg-card z-10">Popularity</td>
                                        {tools.map((tool) => (
                                            <td key={tool.id} className="p-4">{tool.popularity}%</td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border/50">
                                        <td className="p-4 font-medium sticky left-0 bg-card z-10">Tags</td>
                                        {tools.map((tool) => (
                                            <td key={tool.id} className="p-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {tool.tags.slice(0, 3).map((tag) => (
                                                        <span key={tag} className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="p-4 font-medium sticky left-0 bg-card z-10">Platform</td>
                                        {tools.map((tool) => (
                                            <td key={tool.id} className="p-4">
                                                <a
                                                    href={tool.platform}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-accent hover:underline"
                                                >
                                                    Visit <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.div>
            </div>

            <Footer />
        </div>
    )
}

