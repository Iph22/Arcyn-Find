"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

export default function NotFound() {
  const router = useRouter()
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 text-center border border-border rounded-lg">
        <h1 className="text-3xl font-bold mb-3">404 - Page Not Found</h1>
        <p className="text-muted-foreground mb-8">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col gap-4">
          <Link href="/" className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90">
            Go to Homepage
          </Link>
          <button onClick={() => router.back()} className="px-4 py-2 border border-border rounded-lg hover:bg-muted">
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
