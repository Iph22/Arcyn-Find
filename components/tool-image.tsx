"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface ToolImageProps {
  src: string | null | undefined
  alt: string
  className?: string
  fill?: boolean
  sizes?: string
  unoptimized?: boolean
  fallbackText?: string
  containerClassName?: string
}

/**
 * ToolImage component that shows text fallback when image is missing or fails to load
 * Treats /og-image.png and other placeholder images as missing
 */
export function ToolImage({
  src,
  alt,
  className,
  fill = true,
  sizes,
  unoptimized = false,
  fallbackText,
  containerClassName,
}: ToolImageProps) {
  const [imageError, setImageError] = useState(false)
  
  // Get fallback text (first letter or first 2 letters of tool name)
  const getFallbackText = () => {
    if (fallbackText) return fallbackText
    const name = alt || "Tool"
    if (name.length <= 2) return name.toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }
  
  // Check if image is a placeholder/default
  const isPlaceholder = !src || 
    src === "/og-image.png" || 
    src === "/assets/default.png" ||
    src.toLowerCase().includes("og-image") ||
    src.toLowerCase().includes("placeholder") ||
    src.toLowerCase().includes("r-synth") ||
    src.toLowerCase().includes("rsynth")
  
  // Show fallback if placeholder or error
  const showFallback = isPlaceholder || imageError
  
  if (showFallback) {
    const text = getFallbackText()
    
    // Modern, vibrant gradient combinations based on tool name
    // Each tool gets a consistent, beautiful gradient with depth
    const gradientPresets = [
      {
        gradient: "from-blue-500 via-purple-500 to-pink-500",
        glow: "shadow-2xl shadow-blue-500/30",
        accent: "from-blue-400/20",
      },
      {
        gradient: "from-emerald-500 via-teal-500 to-cyan-500",
        glow: "shadow-2xl shadow-emerald-500/30",
        accent: "from-emerald-400/20",
      },
      {
        gradient: "from-orange-500 via-red-500 to-rose-500",
        glow: "shadow-2xl shadow-orange-500/30",
        accent: "from-orange-400/20",
      },
      {
        gradient: "from-indigo-500 via-purple-500 to-violet-500",
        glow: "shadow-2xl shadow-indigo-500/30",
        accent: "from-indigo-400/20",
      },
      {
        gradient: "from-cyan-500 via-blue-500 to-indigo-500",
        glow: "shadow-2xl shadow-cyan-500/30",
        accent: "from-cyan-400/20",
      },
      {
        gradient: "from-pink-500 via-rose-500 to-orange-500",
        glow: "shadow-2xl shadow-pink-500/30",
        accent: "from-pink-400/20",
      },
      {
        gradient: "from-green-500 via-emerald-500 to-teal-500",
        glow: "shadow-2xl shadow-green-500/30",
        accent: "from-green-400/20",
      },
      {
        gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
        glow: "shadow-2xl shadow-violet-500/30",
        accent: "from-violet-400/20",
      },
    ]
    
    // Generate consistent color based on tool name
    const colorIndex = text.charCodeAt(0) % gradientPresets.length
    const preset = gradientPresets[colorIndex]
    
    return (
      <div className={cn(
        "relative flex items-center justify-center overflow-hidden",
        "bg-gradient-to-br",
        preset.gradient,
        preset.glow,
        "ring-1 ring-white/10",
        containerClassName
      )}>
        {/* Light overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />
        
        {/* Subtle pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        
        {/* Main text with enhanced styling */}
        <span className={cn(
          "relative z-10 font-extrabold select-none",
          "text-white",
          "drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]",
          fill ? "text-5xl md:text-6xl lg:text-7xl" : "text-3xl md:text-4xl",
          "tracking-[-0.02em]"
        )}>
          {text}
        </span>
        
        {/* Subtle corner accents for polish */}
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/10 to-transparent rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-black/5 to-transparent rounded-tr-full" />
      </div>
    )
  }
  
  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      unoptimized={unoptimized}
      onError={() => setImageError(true)}
    />
  )
}

