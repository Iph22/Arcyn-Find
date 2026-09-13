import type { Metadata } from "next"

import { siteUrl } from "@/lib/seo/site"

/**
 * Metadata for /privacy.
 *
 * The page itself is a client component and so cannot export `metadata`;
 * this sibling layout is a server component and can. Without it the page
 * inherited the root title and -- until the root canonical was removed --
 * declared itself a duplicate of the homepage.
 */
export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Arcyn Find collects, uses and protects your data.",
  alternates: { canonical: `${siteUrl()}/privacy` },
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
