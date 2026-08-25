"use client"

import { Badge } from "@/components/ui/badge"
import { DollarSign, Gift, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"

interface PricingBadgeProps {
  pricing?: string | null
  accessType?: "Free" | "Freemium" | "Paid" | string | null
  size?: "sm" | "md" | "lg"
  showIcon?: boolean
  className?: string
}

export function PricingBadge({ 
  pricing, 
  accessType, 
  size = "md",
  showIcon = true,
  className 
}: PricingBadgeProps) {
  // Determine badge style based on access type
  const getBadgeStyle = () => {
    switch (accessType) {
      case "Free":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "Freemium":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "Paid":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const getIcon = () => {
    switch (accessType) {
      case "Free":
        return <Gift className={cn("shrink-0", size === "sm" ? "w-3 h-3" : size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5")} />
      case "Freemium":
        return <DollarSign className={cn("shrink-0", size === "sm" ? "w-3 h-3" : size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5")} />
      case "Paid":
        return <CreditCard className={cn("shrink-0", size === "sm" ? "w-3 h-3" : size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5")} />
      default:
        return <DollarSign className={cn("shrink-0", size === "sm" ? "w-3 h-3" : size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5")} />
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "text-xs px-2 py-0.5"
      case "lg":
        return "text-sm px-3 py-1.5"
      default:
        return "text-xs px-2.5 py-1"
    }
  }

  // Format pricing text
  const formatPricing = () => {
    if (!pricing) {
      return accessType || "Pricing unavailable"
    }
    
    // If pricing already contains access type info, return as is
    if (pricing.toLowerCase().includes("free") || pricing.toLowerCase().includes("freemium")) {
      return pricing
    }
    
    // Combine access type with pricing if available
    if (accessType === "Freemium" && !pricing.toLowerCase().includes("free")) {
      return `Free tier + ${pricing}`
    }
    
    return pricing
  }

  if (!pricing && !accessType) {
    return null
  }

  return (
    <Badge 
      className={cn(
        getBadgeStyle(),
        getSizeClasses(),
        "border font-medium",
        className
      )}
    >
      {showIcon && getIcon()}
      <span className={showIcon ? "ml-1" : ""}>{formatPricing()}</span>
    </Badge>
  )
}

