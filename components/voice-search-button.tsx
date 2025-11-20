"use client"

import { useState, useEffect } from "react"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { VoiceSearch, getVoiceSearchSupport } from "@/lib/voice-search"

interface VoiceSearchButtonProps {
  onTranscript: (text: string) => void
  className?: string
}

export function VoiceSearchButton({ onTranscript, className = "" }: VoiceSearchButtonProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [voiceSearch] = useState(() => new VoiceSearch())

  useEffect(() => {
    setMounted(true)
    const support = getVoiceSearchSupport()
    setIsSupported(support.supported)
  }, [])

  const handleClick = () => {
    if (!isSupported) {
      alert('Voice search is not supported in your browser. Please use Chrome, Edge, or Safari.')
      return
    }

    if (isListening) {
      voiceSearch.stop()
      setIsListening(false)
    } else {
      voiceSearch.start({
        onStart: () => setIsListening(true),
        onResult: (text) => {
          onTranscript(text)
          setIsListening(false)
        },
        onError: (error) => {
          alert(error.message)
          setIsListening(false)
        },
        onEnd: () => setIsListening(false),
      })
    }
  }

  if (!mounted || !isSupported) {
    return null
  }

  return (
    <button
      onClick={handleClick}
      className={`rounded-lg p-2 transition-colors ${
        isListening
          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
          : "hover:bg-muted text-muted-foreground hover:text-foreground"
      } ${className}`}
      aria-label={isListening ? "Stop listening" : "Start voice search"}
      title={isListening ? "Stop listening" : "Start voice search"}
    >
      {isListening ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </button>
  )
}

