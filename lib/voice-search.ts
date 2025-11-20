/**
 * Voice Search Utilities
 * Uses Web Speech API for voice input
 */

export interface VoiceSearchOptions {
  onResult: (text: string) => void
  onError?: (error: Error) => void
  onStart?: () => void
  onEnd?: () => void
  language?: string
}

export class VoiceSearch {
  private recognition: any = null
  private isSupported: boolean = false

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      this.isSupported = !!SpeechRecognition
      
      if (this.isSupported) {
        this.recognition = new SpeechRecognition()
        this.recognition.continuous = false
        this.recognition.interimResults = false
        this.recognition.lang = 'en-US'
      }
    }
  }

  /**
   * Check if voice search is supported
   */
  isVoiceSearchSupported(): boolean {
    return this.isSupported
  }

  /**
   * Start voice recognition
   */
  start(options: VoiceSearchOptions): void {
    if (!this.isSupported || !this.recognition) {
      options.onError?.(new Error('Voice search is not supported in this browser'))
      return
    }

    this.recognition.lang = options.language || 'en-US'
    
    this.recognition.onstart = () => {
      options.onStart?.()
    }

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      options.onResult(transcript)
    }

    this.recognition.onerror = (event: any) => {
      let errorMessage = 'Voice recognition error'
      if (event.error === 'no-speech') {
        errorMessage = 'No speech detected. Please try again.'
      } else if (event.error === 'audio-capture') {
        errorMessage = 'No microphone found. Please check your microphone.'
      } else if (event.error === 'not-allowed') {
        errorMessage = 'Microphone permission denied. Please allow microphone access.'
      }
      options.onError?.(new Error(errorMessage))
    }

    this.recognition.onend = () => {
      options.onEnd?.()
    }

    try {
      this.recognition.start()
    } catch (error: any) {
      options.onError?.(error)
    }
  }

  /**
   * Stop voice recognition
   */
  stop(): void {
    if (this.recognition) {
      this.recognition.stop()
    }
  }

  /**
   * Abort voice recognition
   */
  abort(): void {
    if (this.recognition) {
      this.recognition.abort()
    }
  }
}

/**
 * Get browser support info
 */
export function getVoiceSearchSupport(): {
  supported: boolean
  browser: string
} {
  if (typeof window === 'undefined') {
    return { supported: false, browser: 'unknown' }
  }

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  const supported = !!SpeechRecognition

  let browser = 'unknown'
  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent.toLowerCase()
    if (userAgent.includes('chrome')) browser = 'chrome'
    else if (userAgent.includes('safari')) browser = 'safari'
    else if (userAgent.includes('firefox')) browser = 'firefox'
    else if (userAgent.includes('edge')) browser = 'edge'
  }

  return { supported, browser }
}

