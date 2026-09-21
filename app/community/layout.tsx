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
  title: { absolute: "Arcyn Find Community" },
  // Describes what the page offers, not a community size. The previous
  // description implied activity the numbers on the page were inventing.
  description:
    "Ways to take part in Arcyn Find: review tools you have used, save the ones that work, and build collections around a job.",
  alternates: { canonical: `${siteUrl()}/community` },
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
