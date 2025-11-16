"use client"

import Link from "next/link"

export function Footer() {
  const currentYear = new Date().getFullYear()
  const instagramUrl = "https://instagram.com/arcyn.x" // Update with your actual Instagram URL

  return (
    <footer className="border-t border-border/50 bg-background/50 py-6 md:py-8 mt-12 md:mt-16">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="flex flex-col items-center justify-center gap-4 text-xs sm:text-sm text-muted-foreground text-center">
          {/* Privacy, Terms, and About Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <Link
              href="/about"
              className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              About
            </Link>
            <span className="text-muted-foreground/50">•</span>
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Privacy Policy
            </Link>
            <span className="text-muted-foreground/50">•</span>
            <Link
              href="/terms"
              className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Terms of Service
            </Link>
          </div>

          {/* Copyright with ARCYN as Instagram link */}
          <p>
            © {currentYear}{" "}
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline transition-colors font-medium"
            >
              ARCYN
            </a>{" "}
            Find. All rights reserved.
          </p>

          {/* Creator credit */}
          <p className="text-[10px] sm:text-xs">
            Created by{" "}
            <a
              href="https://22-bio.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline transition-colors"
            >
              David Iphy
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}

