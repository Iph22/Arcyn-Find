"use client"

import { useEffect } from 'react'
import type { AIEntry } from '@/lib/ai-data'

export function StructuredData({ ai }: { ai: AIEntry }) {
  useEffect(() => {
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: ai.name,
      description: ai.description,
      applicationCategory: 'AI Tool',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: ai.pricing,
        priceCurrency: 'USD',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: (ai.popularity / 20).toFixed(1),
        ratingCount: 1,
        bestRating: 5,
        worstRating: 1,
      },
      url: ai.platform,
      category: ai.category,
      keywords: ai.tags.join(', '),
    }

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'structured-data'
    script.text = JSON.stringify(structuredData)
    
    // Remove existing structured data if any
    const existing = document.getElementById('structured-data')
    if (existing) {
      existing.remove()
    }
    
    document.head.appendChild(script)

    return () => {
      const scriptToRemove = document.getElementById('structured-data')
      if (scriptToRemove) {
        scriptToRemove.remove()
      }
    }
  }, [ai])

  return null
}

