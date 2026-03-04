"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Search, X, ArrowRight, Clock, TrendingUp, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

interface PremiumSearchInputProps {
    value: string
    onChange: (value: string) => void
    onSubmit?: () => void
    onFocus?: () => void
    placeholder?: string
    className?: string
    autoFocus?: boolean
    showButton?: boolean
}

interface Suggestion {
    text: string
    type: 'tool' | 'search' | 'category'
}

export function PremiumSearchInput({
    value,
    onChange,
    onSubmit,
    onFocus,
    placeholder = "Search...",
    className,
    autoFocus,
    showButton = false
}: PremiumSearchInputProps) {
    const [isFocused, setIsFocused] = useState(false)
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [correctedQuery, setCorrectedQuery] = useState<string | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [loadingSuggestions, setLoadingSuggestions] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const suggestionsRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    // Fetch autocomplete suggestions
    const fetchSuggestions = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSuggestions([])
            setCorrectedQuery(null)
            setShowSuggestions(false)
            return
        }

        // Abort previous request
        if (abortRef.current) abortRef.current.abort()
        const controller = new AbortController()
        abortRef.current = controller

        setLoadingSuggestions(true)

        try {
            const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`, {
                signal: controller.signal,
            })

            if (!res.ok) return

            const data = await res.json()

            if (!controller.signal.aborted) {
                const mapped: Suggestion[] = (data.suggestions || []).map((s: string) => ({
                    text: s,
                    type: s.toLowerCase().includes('tools') ? 'category' : 'tool' as const,
                }))
                setSuggestions(mapped)
                setCorrectedQuery(data.corrected || null)
                setShowSuggestions(mapped.length > 0 || !!data.corrected)
                setSelectedIndex(-1)
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return
        } finally {
            if (!controller.signal.aborted) {
                setLoadingSuggestions(false)
            }
        }
    }, [])

    // Debounced suggestion fetch (150ms — fast enough for instant feel)
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)

        if (value.length >= 2 && isFocused) {
            debounceRef.current = setTimeout(() => {
                fetchSuggestions(value)
            }, 150)
        } else {
            setSuggestions([])
            setCorrectedQuery(null)
            setShowSuggestions(false)
        }

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [value, isFocused, fetchSuggestions])

    // Global keyboard shortcut: "/" or "Ctrl+K" to focus search
    useEffect(() => {
        const handleGlobalKey = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in another input
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement)?.isContentEditable
            ) {
                return
            }

            if (e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
                e.preventDefault()
                inputRef.current?.focus()
            }
        }

        window.addEventListener('keydown', handleGlobalKey)
        return () => window.removeEventListener('keydown', handleGlobalKey)
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                e.preventDefault()
                handleSuggestionSelect(suggestions[selectedIndex].text)
            } else if (onSubmit) {
                setShowSuggestions(false)
                onSubmit()
            }
        } else if (e.key === "ArrowDown") {
            e.preventDefault()
            setSelectedIndex(prev =>
                prev < suggestions.length - 1 ? prev + 1 : prev
            )
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setSelectedIndex(prev => prev > -1 ? prev - 1 : -1)
        } else if (e.key === "Escape") {
            setShowSuggestions(false)
            setSelectedIndex(-1)
        }
    }

    const handleSuggestionSelect = (text: string) => {
        onChange(text)
        setShowSuggestions(false)
        setSelectedIndex(-1)
        // Trigger submit after a tiny delay so state updates
        setTimeout(() => onSubmit?.(), 50)
    }

    const handleFocus = () => {
        setIsFocused(true)
        if (value.length >= 2 && suggestions.length > 0) {
            setShowSuggestions(true)
        }
        onFocus?.()
    }

    const handleBlur = () => {
        // Delay blur to allow clicking suggestions
        setTimeout(() => {
            setIsFocused(false)
            setShowSuggestions(false)
        }, 200)
    }

    return (
        <div
            className={cn(
                "relative group flex flex-col w-full",
                className
            )}
        >
            {/* Main Input Area */}
            <div className="relative flex items-center w-full transition-all duration-300">
                {/* Glow Effect */}
                <div
                    className={cn(
                        "absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-primary/20 via-chart-1/20 to-chart-2/20 blur-xl opacity-0 transition-opacity duration-500",
                        isFocused && "opacity-100"
                    )}
                />

                {/* Main Container */}
                <div
                    className={cn(
                        "relative flex items-center w-full rounded-2xl border transition-all duration-300 overflow-hidden",
                        isFocused
                            ? "bg-background/80 border-primary/30 shadow-lg ring-1 ring-primary/20 backdrop-blur-xl"
                            : "bg-card/40 border-border/40 hover:bg-card/60 hover:border-primary/20 backdrop-blur-md"
                    )}
                >
                    {/* Search Icon */}
                    <div className="pl-4 sm:pl-5 flex items-center justify-center pointer-events-none">
                        <Search
                            className={cn(
                                "w-5 h-5 transition-colors duration-300",
                                isFocused ? "text-primary" : "text-muted-foreground"
                            )}
                        />
                    </div>

                    {/* Input */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder={placeholder}
                        autoFocus={autoFocus}
                        className="flex-1 w-full bg-transparent border-none outline-none h-12 sm:h-14 px-3 sm:px-4 text-base sm:text-lg placeholder:text-muted-foreground/50 text-foreground"
                    />

                    {/* Keyboard shortcut hint */}
                    {!isFocused && !value && (
                        <div className="hidden md:flex items-center mr-3 px-1.5 py-0.5 rounded border border-border/60 text-[10px] text-muted-foreground/60 font-mono">
                            /
                        </div>
                    )}

                    {/* Right Actions */}
                    <div className="pr-2 flex items-center gap-2">
                        <AnimatePresence>
                            {loadingSuggestions && isFocused && (
                                <motion.div
                                    key="loader"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="p-2"
                                >
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                </motion.div>
                            )}
                            {value && (
                                <motion.button
                                    key="clear_button"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    onClick={() => {
                                        onChange("")
                                        setSuggestions([])
                                        setCorrectedQuery(null)
                                        setShowSuggestions(false)
                                        inputRef.current?.focus()
                                    }}
                                    className="p-2 rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                    type="button"
                                >
                                    <X className="w-4 h-4" />
                                </motion.button>
                            )}
                        </AnimatePresence>

                        {showButton && (
                            <div className="pl-1 border-l border-border/40 py-1.5 pl-2">
                                <button
                                    onClick={() => {
                                        setShowSuggestions(false)
                                        onSubmit?.()
                                    }}
                                    className="h-9 sm:h-10 px-4 sm:px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm sm:text-base transition-all flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-95"
                                    type="button"
                                >
                                    <span className="hidden sm:inline">Search</span>
                                    <ArrowRight className="w-4 h-4 sm:hidden" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* "Did you mean?" correction */}
            <AnimatePresence>
                {correctedQuery && isFocused && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-1 px-2"
                    >
                        <button
                            type="button"
                            onClick={() => {
                                onChange(correctedQuery)
                                setCorrectedQuery(null)
                            }}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Did you mean{" "}
                            <span className="text-primary font-medium italic">
                                &ldquo;{correctedQuery}&rdquo;
                            </span>
                            ?
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Autocomplete Dropdown */}
            <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                    <motion.div
                        ref={suggestionsRef}
                        initial={{ opacity: 0, y: -5, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 z-50 mt-2 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl shadow-xl overflow-hidden"
                    >
                        <div className="max-h-72 overflow-auto p-1.5">
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={`${suggestion.text}-${index}`}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault() // Prevent blur
                                        handleSuggestionSelect(suggestion.text)
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                                        selectedIndex === index
                                            ? "bg-accent text-accent-foreground"
                                            : "hover:bg-accent/50 text-foreground"
                                    )}
                                >
                                    {suggestion.type === 'category' ? (
                                        <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                                    ) : (
                                        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                                    )}
                                    <span className="truncate">{suggestion.text}</span>
                                    {suggestion.type === 'category' && (
                                        <span className="ml-auto text-xs text-muted-foreground shrink-0">
                                            Category
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
