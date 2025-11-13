"use client"

import { motion } from "framer-motion"

export function TypeoutBackground() {
  const text = "ARCYN FIND"

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="text-9xl md:text-[200px] font-bold font-mono tracking-widest">
          {text.split("").map((char, idx) => (
            <motion.span
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.08 }}
              transition={{
                duration: 0.5,
                delay: idx * 0.10,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "loop",
                repeatDelay: text.length * 0.1,
              }}
              className="inline-block text-accent"
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  )
}
