"use client"

import { useState, useRef } from "react"
import { Search, X, ArrowRight } from "lucide-react"
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
    const inputRef = useRef<HTMLInputElement>(null)

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && onSubmit) {
            onSubmit()
        }
    }

    const handleFocus = () => {
        setIsFocused(true)
        onFocus?.()
    }

    return (
        <div
            className={cn(
                "relative group flex items-center w-full transition-all duration-300",
                className
            )}
        >
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
                    onBlur={() => setIsFocused(false)}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className="flex-1 w-full bg-transparent border-none outline-none h-12 sm:h-14 px-3 sm:px-4 text-base sm:text-lg placeholder:text-muted-foreground/50 text-foreground"
                />

                {/* Right Actions */}
                <div className="pr-2 flex items-center gap-2">
                    <AnimatePresence>
                        {value && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={() => {
                                    onChange("")
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
                                onClick={onSubmit}
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
    )
}
