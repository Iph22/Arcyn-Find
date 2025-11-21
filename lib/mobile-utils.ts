/**
 * Mobile optimization utilities
 */

// Check if device is mobile
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768
}

// Check if device is iOS
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

// Check if device is Android
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false
  return /Android/.test(navigator.userAgent)
}

// Check if device supports touch
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

// Get viewport height (accounting for mobile browser UI)
export function getViewportHeight(): number {
  if (typeof window === 'undefined') return 0
  return window.innerHeight || document.documentElement.clientHeight
}

// Get safe area insets (for iOS notch)
export function getSafeAreaInsets() {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }

  const style = getComputedStyle(document.documentElement)
  return {
    top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0', 10),
    right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0', 10),
    bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0', 10),
    left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0', 10),
  }
}

// Prevent zoom on double tap (iOS)
export function preventDoubleTapZoom(element: HTMLElement) {
  let lastTouchEnd = 0
  element.addEventListener('touchend', (event) => {
    const now = Date.now()
    if (now - lastTouchEnd <= 300) {
      event.preventDefault()
    }
    lastTouchEnd = now
  }, false)
}

// Add mobile-specific CSS classes
export function addMobileClasses() {
  if (typeof document === 'undefined') return

  const html = document.documentElement
  if (isMobile()) html.classList.add('is-mobile')
  if (isIOS()) html.classList.add('is-ios')
  if (isAndroid()) html.classList.add('is-android')
  if (isTouchDevice()) html.classList.add('is-touch')
}

// Initialize mobile optimizations
export function initMobileOptimizations() {
  if (typeof window === 'undefined') return

  addMobileClasses()

  // Set CSS custom properties for safe area
  const insets = getSafeAreaInsets()
  document.documentElement.style.setProperty('--safe-area-inset-top', `${insets.top}px`)
  document.documentElement.style.setProperty('--safe-area-inset-right', `${insets.right}px`)
  document.documentElement.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`)
  document.documentElement.style.setProperty('--safe-area-inset-left', `${insets.left}px`)

  // Prevent pull-to-refresh on mobile (optional)
  let touchStartY = 0
  document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY
  }, { passive: true })

  document.addEventListener('touchmove', (e) => {
    const touchY = e.touches[0].clientY
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    if (touchY > touchStartY && scrollTop === 0) {
      // At top and pulling down - could prevent here if needed
    }
  }, { passive: true })
}

