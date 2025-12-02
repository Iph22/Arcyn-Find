import { SignIn } from '@clerk/nextjs'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-card shadow-xl",
          }
        }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        // Remove redirectUrl to let ClerkProvider's afterSignInUrl handle it
        // This will redirect to /onboarding, which will check user state and redirect accordingly
      />
    </div>
  )
}
