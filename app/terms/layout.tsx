import type { Metadata } from "next"

import { siteUrl } from "@/lib/seo/site"

/**
 * Metadata for /terms.
 *
 * The page itself is a client component and so cannot export `metadata`;
 * this sibling layout is a server component and can. Without it the page
 * inherited the root title and -- until the root canonical was removed --
 * declared itself a duplicate of the homepage.
 */
export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern your use of Arcyn Find.",
  alternates: { canonical: `${siteUrl()}/terms` },
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
