"use client"

interface HighlightTextProps {
  text: string
  query: string
  className?: string
}

/**
 * Highlights matching text in search results
 */
export function HighlightText({ text, query, className = "" }: HighlightTextProps) {
  if (!query.trim()) {
    return <span className={className}>{text}</span>
  }

  const normalizedQuery = query.toLowerCase()
  const normalizedText = text.toLowerCase()
  const index = normalizedText.indexOf(normalizedQuery)

  if (index === -1) {
    // Try fuzzy matching for partial highlights
    const words = query.split(/\s+/).filter((w) => w.length > 2)
    if (words.length === 0) {
      return <span className={className}>{text}</span>
    }

    const parts: Array<{ text: string; highlight: boolean }> = []
    let lastIndex = 0
    let currentText = text

    words.forEach((word) => {
      const wordIndex = currentText.toLowerCase().indexOf(word.toLowerCase(), lastIndex)
      if (wordIndex !== -1) {
        // Add text before match
        if (wordIndex > lastIndex) {
          parts.push({ text: currentText.substring(lastIndex, wordIndex), highlight: false })
        }
        // Add highlighted match
        parts.push({
          text: currentText.substring(wordIndex, wordIndex + word.length),
          highlight: true,
        })
        lastIndex = wordIndex + word.length
      }
    })

    // Add remaining text
    if (lastIndex < currentText.length) {
      parts.push({ text: currentText.substring(lastIndex), highlight: false })
    }

    if (parts.length === 0) {
      return <span className={className}>{text}</span>
    }

    return (
      <span className={className}>
        {parts.map((part, idx) =>
          part.highlight ? (
            <mark key={idx} className="bg-accent/30 text-accent-foreground rounded px-0.5">
              {part.text}
            </mark>
          ) : (
            <span key={idx}>{part.text}</span>
          )
        )}
      </span>
    )
  }

  // Exact match found
  const before = text.substring(0, index)
  const match = text.substring(index, index + query.length)
  const after = text.substring(index + query.length)

  return (
    <span className={className}>
      {before}
      <mark className="bg-accent/30 text-accent-foreground rounded px-0.5">{match}</mark>
      {after}
    </span>
  )
}

