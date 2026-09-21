import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    // Tool logos are scraped from arbitrary vendor domains, so this list
    // cannot be enumerated -- but `hostname: '**'` over BOTH protocols made
    // the optimizer an open proxy that anyone could point at any URL on the
    // internet and bill to this project. https-only at least removes the
    // plaintext half and every http source we hold redirects to https anyway.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // Tool logos live in Supabase Storage and count against the same egress
    // quota as the database. The default TTL is 4 hours (Next 16), so every
    // optimized variant of ~2,600 logos re-pulled the original from Supabase
    // six times a day. These files are immutable in practice: lib/storage.ts
    // names uploads `${userId}-${Date.now()}.${ext}` and the logo pipeline
    // writes a new path rather than overwriting one.
    //
    // Caveat, straight from the Next docs: there is NO cache invalidation.
    // A genuinely changed image needs a changed `src`, which is what the
    // timestamped filenames already give us.
    minimumCacheTTL: 2678400, // 31 days
    // Allow local images from public directory
    unoptimized: false,
  },
  // No X-Robots-Tag headers here on purpose.
  //
  // These previously forced `index, follow` onto `/tools/:path*`, which would
  // now silently override the per-page `noindex` that the SEO layer applies to
  // tool pages whose only content is a truncated scraped blurb, and to the
  // /browse filter UI. Indexability is decided in exactly one place: each
  // page's `generateMetadata`.
  //
  // The old sitemap emitted `/tools?id=<id>` for every tool, so those URLs may
  // be indexed. No redirect rule is needed for them: the new `/tools` ignores
  // the query parameter and declares `<link rel="canonical" href="/tools">`,
  // which is how Google consolidates them. (A redirect here would loop --
  // Next preserves the query string, so `/tools?id=x` would target itself.)
  // Legacy `/tools/<opaque-id>` links are resolved to the right slug and
  // permanently redirected inside app/tools/[slug]/page.tsx.
};

export default nextConfig;
