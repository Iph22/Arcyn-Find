import type { Metadata } from "next"

import { siteUrl } from "@/lib/seo/site"

/**
 * Metadata for /submit.
 *
 * The page itself is a client component and so cannot export `metadata`;
 * this sibling layout is a server component and can.
 */
export const metadata: Metadata = {
  title: { absolute: "Submit an AI tool — Arcyn Find" },
  description:
    "Add your AI tool to the Arcyn Find directory. Submissions go to a review queue and appear on the site once approved.",
  alternates: { canonical: `${siteUrl()}/submit` },
}

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
