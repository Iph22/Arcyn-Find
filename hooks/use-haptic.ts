"use client"

import { useCallback } from "react"

type HapticType = "light" | "medium" | "heavy" | "success" | "warning" | "error"

export function useHaptic() {
    const trigger = useCallback((type: HapticType = "light") => {
        if (typeof window === "undefined" || !window.navigator?.vibrate) return

        switch (type) {
            case "light":
                window.navigator.vibrate(10)
                break
            case "medium":
                window.navigator.vibrate(20)
                break
            case "heavy":
                window.navigator.vibrate(40)
                break
            case "success":
                window.navigator.vibrate([10, 30, 10])
                break
            case "warning":
                window.navigator.vibrate([30, 50, 10])
                break
            case "error":
                window.navigator.vibrate([50, 30, 50, 30, 50])
                break
        }
    }, [])

    return { trigger }
}
