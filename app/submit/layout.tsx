import type { Metadata } from "next"
import Link from "next/link"

import { getCategoriesSafe } from "@/lib/seo/catalog"
import { siteUrl } from "@/lib/seo/site"

/**
 * Metadata and the server-rendered half of /submit.
 *
 * The page itself is a client component and so cannot export `metadata`;
 * this sibling layout is a server component and can.
 *
 * WHY THERE IS CONTENT HERE AND NOT JUST METADATA
 *
 * Measured 2026-09-30: /submit was already `index, follow` -- it inherits the
 * root layout's robots tag, because a client component cannot set its own --
 * while serving a crawler 36 words and no heading. An indexed page with
 * nothing on it is the worst of both: it spends crawl budget, it cannot rank,
 * and thin pages are judged at the domain level rather than one at a time.
 *
 * WHY IT SITS BELOW THE FORM RATHER THAN ABOVE IT
 *
 * The visible heading is client-rendered inside the form's state branch
 * (`t("submit.title")`), and there are two more in the signed-out and success
 * branches. A server `<h1>` above them would read as a doubled header to
 * anyone with JavaScript, and demoting all three to `<h2>` means editing a
 * page that changed in #87 and #88. Putting the prose after `{children}` gets
 * a crawler real content without touching the form at all.
 *
 * Everything below is true of the actual endpoint -- an account is required
 * (`app/api/tools/submit` answers 401 without one), submissions land in a
 * pending queue rather than publishing, duplicates are rejected with a 409,
 * and the length limits are the server's own. Describing a review process
 * that does not exist would be the same failure as an invented statistic.
 *
 * English only, like every other server-rendered page in the SEO layer
 * (/tools, /tools/category, /compare). Server components cannot read the
 * client `useLanguage()` context, so this is the existing pattern rather than
 * a new exception.
 */
export const metadata: Metadata = {
  title: { absolute: "Submit an AI tool — Arcyn Find" },
  description:
    "Add your AI tool to the Arcyn Find directory. Submissions go to a review queue and appear on the site once approved.",
  alternates: { canonical: `${siteUrl()}/submit` },
}

export default async function SubmitLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCategoriesSafe()

  return (
    <>
      {children}

      <section className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
        <div className="border-t border-border pt-10">
          <h2 className="text-xl font-semibold tracking-tight">How listing works</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">You need an account.</strong> An open form is a
              spam funnel, and every rejected entry costs a reviewer&apos;s attention. Signing in
              is the whole of the barrier — there is no fee, and paying does not move you up.
            </li>
            <li>
              <strong className="text-foreground">It goes to a review queue.</strong> Nothing
              publishes automatically. A submission is checked before it appears, and a tool
              already in the directory is rejected rather than duplicated.
            </li>
            <li>
              <strong className="text-foreground">Approved tools get their own page</strong> at
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">/tools/your-tool</code>
              covering what it does, how it is priced and what it competes with, and enter the
              search index the same day.
            </li>
          </ol>

          <h2 className="mt-10 text-xl font-semibold tracking-tight">What to have ready</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>The tool&apos;s name, up to 100 characters.</li>
            <li>A direct link to the product, not a landing page for a waitlist.</li>
            <li>
              A description of up to 500 characters saying what it does — plainly, not as
              marketing copy. Listings are rewritten in the directory&apos;s own voice.
            </li>
            <li>A category and a pricing model, both chosen from the lists in the form.</li>
          </ul>

          {categories.length > 0 && (
            <>
              <h2 className="mt-10 text-xl font-semibold tracking-tight">
                Where your tool would sit
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {categories.length} categories currently have their own page. Browsing the one
                closest to your tool is the quickest way to see the depth expected of a listing.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {categories.slice(0, 12).map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={`/tools/category/${category.slug}`}
                      className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                    >
                      {category.name}
                      <span className="ml-2 text-xs text-muted-foreground">{category.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                Or see{" "}
                <Link href="/tools" className="text-primary hover:underline">
                  the full directory
                </Link>{" "}
                and{" "}
                <Link href="/tools/category" className="text-primary hover:underline">
                  every category
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </section>
    </>
  )
}
