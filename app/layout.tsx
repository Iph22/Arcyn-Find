import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "next-themes"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL("https://arcyn-find.com"),
  title: "Arcyn Find - Discover AI Tools Worldwide",
  description:
    "Search, filter, and explore AI tools, models, platforms, and research worldwide. Find the perfect AI for your needs.",
  generator: "Arcyn Eye",
  keywords: ["AI tools", "machine learning", "artificial intelligence", "AI search", "AI discovery"],
  authors: [{ name: "David Iphy", url: "https://github.com/Iph22" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://arcyn-find.app.vercel.app",
    siteName: "Arcyn Find",
    title: "Arcyn Find - Discover AI Tools Worldwide",
    description: "Search, filter, and explore AI tools, models, platforms, and research worldwide.",
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
    description: "Search, filter, and explore AI tools, models, platforms, and research worldwide.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
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
  },
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
