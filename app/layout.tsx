import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "next-themes"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL("https://arcyn-find.vercel.app"),
  title: {
    default: "Arcyn Find - Discover AI Tools Worldwide",
    template: "%s | Arcyn Find",
  },
  description:
    "Search, filter, and explore AI tools, models, platforms, and research worldwide. Find the perfect AI for your needs. Discover thousands of AI models from Hugging Face, GitHub, research papers, and more.",
  generator: "Arcyn Eye",
  applicationName: "Arcyn Find",
  referrer: "origin-when-cross-origin",
  keywords: [
    "AI tools",
    "machine learning",
    "artificial intelligence",
    "AI search",
    "AI discovery",
    "AI models",
    "ML tools",
    "deep learning",
    "neural networks",
    "AI platforms",
    "Hugging Face",
    "AI research",
  ],
  authors: [{ name: "David Iphy", url: "https://github.com/Iph22" }],
  creator: "David Iphy",
  publisher: "Arcyn Find",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://arcyn-find.vercel.app",
    siteName: "Arcyn Find",
    title: "Arcyn Find - Discover AI Tools Worldwide",
    description: "Search, filter, and explore AI tools, models, platforms, and research worldwide. Find the perfect AI for your needs.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Arcyn Find - AI Tools Discovery Platform",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arcyn Find - Discover AI Tools Worldwide",
    description: "Search, filter, and explore AI tools, models, platforms, and research worldwide.",
    images: ["/og-image.png"],
    creator: "@itzz_iphy",
    site: "@ArcynFind",
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
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
  category: "Technology",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('theme') === 'light' || (!('theme' in localStorage) && !window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.remove('dark')
                } else {
                  document.documentElement.classList.add('dark')
                }
              } catch (e) {}
            `,
          }}
        />
        {/* Structured Data (JSON-LD) for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Arcyn Find",
              "alternateName": "Arcyn Find - AI Tools Discovery",
              "url": "https://arcyn-find.vercel.app",
              "description": "Search, filter, and explore AI tools, models, platforms, and research worldwide. Find the perfect AI for your needs.",
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": "https://arcyn-find.vercel.app?search={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
              "publisher": {
                "@type": "Organization",
                "name": "Arcyn Find",
                "url": "https://arcyn-find.vercel.app",
              },
              "inLanguage": "en-US",
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              "name": "AI Tools Directory",
              "description": "Comprehensive directory of AI tools, models, and platforms",
              "url": "https://arcyn-find.vercel.app",
              "numberOfItems": "100+",
              "itemListElement": {
                "@type": "ListItem",
                "position": 1,
                "name": "AI Tools Discovery Platform",
                "description": "Discover and explore AI tools worldwide",
              },
            }),
          }}
        />
      </head>
      <body className={`font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
