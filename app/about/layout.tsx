import type { Metadata } from "next"

import { siteUrl } from "@/lib/seo/site"

/**
 * Metadata for /about.
 *
 * The page itself is a client component and so cannot export `metadata`;
 * this sibling layout is a server component and can. Without it the page
 * inherited the root title and -- until the root canonical was removed --
 * declared itself a duplicate of the homepage.
 */
export const metadata: Metadata = {
  title: "About Arcyn Find",
  description:
    "Arcyn Find is a directory for discovering, comparing and mastering AI tools. Learn who builds it and how tools are verified.",
  alternates: { canonical: `${siteUrl()}/about` },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
