"use client"

import { useState, useRef, useEffect } from "react"
import { Image, X, Loader2, Search } from "lucide-react"
import { searchByImage, validateImageFile, isImageSearchSupported, type ImageSearchResult } from "@/lib/image-search"
import type { AIEntry } from "@/lib/ai-data"
import { useRouter } from "next/navigation"

interface ImageSearchButtonProps {
  aiModels: AIEntry[]
  className?: string
}

export function ImageSearchButton({ aiModels, className = "" }: ImageSearchButtonProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<ImageSearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [supported, setSupported] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    setSupported(isImageSearchSupported())
  }, [])

  if (!mounted || !supported) {
    return null
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      setError(validation.error || 'Invalid image file')
      return
    }

    setError(null)
    setIsSearching(true)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    try {
      const searchResults = await searchByImage(file, aiModels)
      setResults(searchResults)
    } catch (err: any) {
      setError(err.message || 'Failed to process image')
    } finally {
      setIsSearching(false)
    }
  }

  const handleResultClick = (toolId: string) => {
    router.push(`/ai/${toolId}`)
    setResults([])
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClear = () => {
    setResults([])
    setPreview(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        id="image-search-input"
      />
      <label
        htmlFor="image-search-input"
        className={`cursor-pointer rounded-lg p-2 transition-colors ${
          isSearching
            ? "bg-blue-500/20 text-blue-400"
            : "hover:bg-muted text-muted-foreground hover:text-foreground"
        }`}
        title="Search by image"
      >
        {isSearching ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Image className="h-5 w-5" />
        )}
      </label>

      {/* Results Modal */}
      {(results.length > 0 || preview || error) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <button
              onClick={handleClear}
              className="absolute top-4 right-4 rounded-lg p-2 hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-2xl font-bold mb-4">Image Search Results</h2>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {preview && (
              <div className="mb-4">
                <img
                  src={preview}
                  alt="Search preview"
                  className="max-w-full h-auto rounded-lg border border-border"
                />
              </div>
            )}

            {results.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Found {results.length} matching {results.length === 1 ? 'tool' : 'tools'}
                </p>
                {results.map((result) => (
                  <button
                    key={result.toolId}
                    onClick={() => handleResultClick(result.toolId)}
                    className="w-full text-left rounded-lg border border-border bg-muted/30 p-4 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{result.toolName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {result.similarity}% match
                          </span>
                          {result.matchedFeatures.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {result.matchedFeatures.slice(0, 3).map((feature, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded"
                                >
                                  {feature}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <Search className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            ) : !error && !isSearching && (
              <p className="text-muted-foreground text-center py-8">
                No matching tools found. Try a different image or use text search.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

