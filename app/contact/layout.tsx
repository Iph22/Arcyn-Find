import type { Metadata } from "next"

import { siteUrl } from "@/lib/seo/site"

/**
 * Metadata for /contact.
 *
 * The page itself is a client component and so cannot export `metadata`;
 * this sibling layout is a server component and can. Without it the page
 * inherited the root title and -- until the root canonical was removed --
 * declared itself a duplicate of the homepage.
 */
export const metadata: Metadata = {
  title: "Contact Arcyn Find",
  description:
    "Get in touch with the Arcyn Find team about listings, corrections, partnerships or support.",
  alternates: { canonical: `${siteUrl()}/contact` },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
