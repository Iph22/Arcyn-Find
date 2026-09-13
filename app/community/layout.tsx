import type { Metadata } from "next"

import { siteUrl } from "@/lib/seo/site"

/**
 * Metadata for /community.
 *
 * The page itself is a client component and so cannot export `metadata`;
 * this sibling layout is a server component and can. Without it the page
 * inherited the root title and -- until the root canonical was removed --
 * declared itself a duplicate of the homepage.
 */
export const metadata: Metadata = {
  title: "Arcyn Find Community",
  description:
    "See what the Arcyn Find community is building, reviewing and recommending across the AI tool directory.",
  alternates: { canonical: `${siteUrl()}/community` },
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
