import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { PreferencesProvider } from "@/contexts/preferences-context"
import { AvatarProvider } from "@/contexts/avatar-context"
import { ThemeProvider } from "next-themes"
import ClientLayout from "./client-layout"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import { ClerkProvider } from '@clerk/nextjs'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
})

// Advanced metadata for SEO and PWA
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://arcyn-find.vercel.app"),
  title: {
    default: "Arcyn Find - Discover AI Tools Worldwide",
    template: "%s | Arcyn Find",
  },
  description: "Your intelligent companion for discovering AI tools, insights, and everything in between. Search, filter, and explore thousands of AI tools, models, platforms, and research worldwide.",
  keywords: [
    "AI tools",
    "artificial intelligence",
    "machine learning",
    "AI discovery",
    "AI search",
    "AI platforms",
    "AI models",
    "generative AI",
    "AI comparison",
    "AI directory",
  ],
  authors: [{ name: "David iphy" }],
  creator: "David iphy",
  publisher: "David iphy",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Arcyn Find",
    title: "Arcyn Find - Discover AI Tools Worldwide",
    description: "Search, filter, and explore thousands of AI tools, models, platforms, and research worldwide.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Arcyn Find - AI Tools Discovery",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arcyn Find - Discover AI Tools Worldwide",
    description: "Search, filter, and explore thousands of AI tools, models, platforms, and research worldwide.",
    images: ["/og-image.png"],
    creator: "@arcynfind",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/icon.svg",
        color: "#000000",
      },
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Arcyn Find",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
  },
  alternates: {
    canonical: "/",
  },
  category: "technology",
}

// Advanced viewport configuration for mobile optimization
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  colorScheme: "dark light",
  viewportFit: "cover", // For iOS notch support
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
        <head>
          {/* Preconnect to external domains for performance */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

          {/* Preload critical resources */}
          <link rel="preload" href="/icon.svg" as="image" type="image/svg+xml" />

          {/* Security headers via meta tags */}
          <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
          <meta httpEquiv="X-Frame-Options" content="DENY" />
          <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
          <meta name="referrer" content="strict-origin-when-cross-origin" />

          {/* Mobile web app meta tags */}
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="Arcyn Find" />

          {/* Performance hints */}
          <link rel="prefetch" href="/api/ai-models" as="fetch" crossOrigin="anonymous" />
        </head>
        <body
          className={`font-sans antialiased ${geistSans.variable} ${geistMono.variable}`}
          suppressHydrationWarning
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange={false}
            storageKey="arcyn-theme"
          >
            <PreferencesProvider>
              <AvatarProvider>
                <ClientLayout>
                  {children}
                </ClientLayout>
              </AvatarProvider>
            </PreferencesProvider>
          </ThemeProvider>
          <Analytics />
          <Toaster />

          {/* Datafast Analytics */}
          <Script
            defer
            data-website-id="dfid_v5dvlwt0DbAG35I4MUzlO"
            data-domain="arcyn-find.vercel.app"
            data-allow-localhost="true"
            src="https://datafa.st/js/script.js"
            strategy="afterInteractive"
          />

          {/* Service Worker Registration */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js')
                      .then((registration) => {
                        console.log('SW registered: ', registration);
                      })
                      .catch((registrationError) => {
                        console.log('SW registration failed: ', registrationError);
                      });
                  });
                }
              `,
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  )
}
