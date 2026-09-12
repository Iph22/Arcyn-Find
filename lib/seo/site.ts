/**
 * The site's absolute origin, used for canonicals, OG tags and the sitemap.
 *
 * Deliberately dependency-free so the root layout can import it without
 * pulling in the Supabase client.
 *
 * `NEXT_PUBLIC_SITE_URL` is `http://localhost:3000` in this repo's .env.local.
 * Trusting it blindly is how a deploy ends up publishing
 * `http://localhost:3000/...` as its canonical URLs and OG images, so only an
 * absolute https origin is accepted and anything else falls back to the real
 * domain.
 */
export const PRODUCTION_ORIGIN = 'https://arcynfind.com'

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured && /^https:\/\/[^/\s]+/i.test(configured)) {
    return configured.replace(/\/+$/, '')
  }
  return PRODUCTION_ORIGIN
}
