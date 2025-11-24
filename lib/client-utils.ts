/**
 * Client-side utility functions with SSR safety checks
 */

/**
 * Check if code is running on client side
 */
export function isClient(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Safe localStorage wrapper
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (!isClient()) return null
    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.error('localStorage.getItem error:', error)
      return null
    }
  },

  setItem: (key: string, value: string): void => {
    if (!isClient()) return
    try {
      localStorage.setItem(key, value)
    } catch (error) {
      console.error('localStorage.setItem error:', error)
    }
  },

  removeItem: (key: string): void => {
    if (!isClient()) return
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('localStorage.removeItem error:', error)
    }
  },
}

/**
 * Safe sessionStorage wrapper
 */
export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    if (!isClient()) return null
    try {
      return sessionStorage.getItem(key)
    } catch (error) {
      console.error('sessionStorage.getItem error:', error)
      return null
    }
  },

  setItem: (key: string, value: string): void => {
    if (!isClient()) return
    try {
      sessionStorage.setItem(key, value)
    } catch (error) {
      console.error('sessionStorage.setItem error:', error)
    }
  },

  removeItem: (key: string): void => {
    if (!isClient()) return
    try {
      sessionStorage.removeItem(key)
    } catch (error) {
      console.error('sessionStorage.removeItem error:', error)
    }
  },
}


