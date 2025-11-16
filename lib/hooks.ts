import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Custom hook for debouncing values
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Custom hook for managing URL search params (Next.js compatible)
 */
export function useURLState(key: string, defaultValue: string = '') {
  const [value, setValue] = useState<string>(defaultValue)

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const params = new URLSearchParams(window.location.search)
    const urlValue = params.get(key) || defaultValue
    if (urlValue !== value) {
      setValue(urlValue)
    }
  }, [key, defaultValue])

  const updateValue = useCallback((newValue: string) => {
    setValue(newValue)
    if (typeof window === 'undefined') return
    
    const params = new URLSearchParams(window.location.search)
    if (newValue && newValue !== defaultValue) {
      params.set(key, newValue)
    } else {
      params.delete(key)
    }
    
    const newURL = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    window.history.replaceState({}, '', newURL)
  }, [key, defaultValue])

  return [value, updateValue] as const
}

/**
 * Custom hook for keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return
      }

      const key = e.key.toLowerCase()
      const shortcut = shortcuts[key]
      
      if (shortcut && (e.ctrlKey || e.metaKey || !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey)) {
        e.preventDefault()
        shortcut()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

/**
 * Custom hook for scroll to top button
 */
export function useScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }, [])

  return { isVisible, scrollToTop }
}

/**
 * Custom hook for favorites management
 */
export function useFavorites() {
  const FAVORITES_KEY = 'arcyn-find-favorites'

  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(FAVORITES_KEY)
      if (stored) {
        setFavorites(new Set(JSON.parse(stored)))
      }
    } catch (error) {
      console.error('Failed to load favorites:', error)
    }
  }, [])

  const addFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev)
      newFavorites.add(id)
      if (typeof window !== 'undefined') {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(newFavorites)))
      }
      return newFavorites
    })
  }, [])

  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev)
      newFavorites.delete(id)
      if (typeof window !== 'undefined') {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(newFavorites)))
      }
      return newFavorites
    })
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    if (favorites.has(id)) {
      removeFavorite(id)
    } else {
      addFavorite(id)
    }
  }, [favorites, addFavorite, removeFavorite])

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites])

  return { favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite }
}

/**
 * Custom hook for share functionality
 */
export function useShare() {
  const share = useCallback(async (data: { title: string; text: string; url: string }) => {
    if (navigator.share) {
      try {
        await navigator.share(data)
        return true
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error)
        }
        return false
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(data.url)
        return true
      } catch (error) {
        console.error('Error copying to clipboard:', error)
        return false
      }
    }
  }, [])

  return { share }
}

