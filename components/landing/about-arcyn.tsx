import Link from "next/link"

/**
 * What Arcyn Find is, in plain language.
 *
 * WHY THIS EXISTS
 *
 * Google OAuth branding verification rejected the app on 2026-10-01 with
 * "your homepage does not explain the purpose of your app". The reviewer
 * reads the homepage of the registered domain and looks for a clear account
 * of what the application does and why it asks for the sign-in it asks for.
 * The hero states the pitch in a sentence, which is right for a hero and is
 * not an explanation.
 *
 * WHY IT IS A SERVER COMPONENT, IN ENGLISH
 *
 * Three guarantees it needs that a client string in the landing page could
 * not give it:
 *
 *   1. It is in the server-rendered HTML whether or not the page hydrates.
 *   2. It does not depend on `useLanguage()`, so it cannot be hidden behind a
 *      locale the reviewer is not using. English-only matches the rest of the
 *      server-rendered SEO layer (/tools, /tools/category, app/submit's
 *      layout) rather than being a new exception.
 *   3. It cannot be removed by a change to the client bundle without someone
 *      deleting this file.
 *
 * WHAT IT MAY SAY
 *
 * Every claim here is checked against the code, because a verification page
 * that overstates the product is worse than none:
 *
 *   - Browsing without an account: /tools, /tools/category, /browse and
 *     /compare are public and request no session.
 *   - The scopes: lib/google-auth.ts requests exactly `openid email profile`.
 *     Not Gmail, Drive, Calendar or Contacts. The section says so explicitly,
 *     because "we only request basic profile data" is the specific thing a
 *     reviewer is checking.
 *   - What an account unlocks: favourites, collections and reviews, all of
 *     which are real routes.
 *
 * Keep it in step with lib/google-auth.ts. If a scope is ever added, this
 * page is part of the change, not a follow-up.
 */
export function AboutArcyn() {
  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="border-t border-border bg-background"
    >
      {/* max-w-7xl to match the hero and "How it works", with the prose held
          to a readable measure inside it. A centred max-w-3xl container read
          as a different page: every other section on this page starts at the
          same left gutter. */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-3xl">
        <h2 id="about-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
          What Arcyn Find is
        </h2>

        <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
          <p>
            Arcyn Find is a search engine and directory for AI tools. It indexes AI
            products — writing assistants, image and video generators, coding tools,
            chatbots, data and research software — and lets you search them by what you
            are trying to do, rather than by remembering a product&apos;s name.
          </p>
          <p>
            Each listing records what a tool does, how it is priced, and what it
            competes with, so you can compare options side by side before committing to
            one. Tools are grouped into categories, and anything with enough detail gets
            a page of its own.
          </p>
        </div>

        <h3 className="mt-10 text-lg font-semibold">What you can do without an account</h3>
        <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-muted-foreground">
          <li>
            Search the full catalogue and{" "}
            <Link href="/tools" className="text-primary hover:underline">
              browse the directory
            </Link>{" "}
            or{" "}
            <Link href="/tools/category" className="text-primary hover:underline">
              any category
            </Link>
            .
          </li>
          <li>Read any tool&apos;s page: what it does, its pricing and its alternatives.</li>
          <li>
            <Link href="/compare" className="text-primary hover:underline">
              Compare tools
            </Link>{" "}
            side by side on features and price.
          </li>
          <li>
            <Link href="/submit" className="text-primary hover:underline">
              Submit a tool
            </Link>{" "}
            for review.
          </li>
        </ul>

        <h3 className="mt-10 text-lg font-semibold">Why we offer Google sign-in</h3>
        <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
          <p>
            Signing in is optional. Everything above works without an account. An
            account exists so that the things you create are yours and persist across
            devices: saved favourites, collections of tools you assemble, and reviews
            you write.
          </p>
          <p>
            We offer Google as a sign-in method so you do not have to create and
            remember another password. When you choose it, we request only your{" "}
            <strong className="text-foreground">name, email address and profile picture</strong>{" "}
            — the standard <code className="rounded bg-muted px-1 py-0.5 text-[13px]">openid email profile</code>{" "}
            scopes. We do not request access to Gmail, Drive, Calendar, Contacts or any
            other Google service, and we cannot read them.
          </p>
          <p>
            That information is used to create your account, show who you are on
            reviews you post, and send the notifications you opt into. It is not sold,
            and it is not shared with advertisers. You can delete your account and the
            data attached to it at any time from your profile page.
          </p>
          <p>
            Full detail is in our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>
            . Questions about data handling go to{" "}
            <a href="mailto:hello@arcynfind.com" className="text-primary hover:underline">
              hello@arcynfind.com
            </a>
            .
          </p>
        </div>
        </div>
      </div>
    </section>
  )
}
