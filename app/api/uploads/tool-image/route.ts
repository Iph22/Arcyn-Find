import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/security'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const BUCKET = 'user-uploads'
const MAX_BYTES = 2 * 1024 * 1024

/**
 * Formats accepted, and why by magic number rather than by what the browser
 * says. `file.type` is supplied by the client and a filename extension is
 * supplied by whoever named the file: neither is evidence. Reading the first
 * bytes is, and it is the difference between accepting an image and accepting
 * anything at all with `image/png` written on the outside.
 */
const SIGNATURES: { ext: string; mime: string; match: (b: Uint8Array) => boolean }[] = [
  { ext: 'png', mime: 'image/png', match: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: 'jpg', mime: 'image/jpeg', match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'gif', mime: 'image/gif', match: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  {
    ext: 'webp',
    mime: 'image/webp',
    match: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
]

/**
 * POST /api/uploads/tool-image
 *
 * A logo or screenshot for a tool being submitted. Public, because submission
 * is public -- so it is rate limited, size capped, and type-checked by
 * content rather than by claim.
 *
 * SVG is deliberately not accepted. An SVG is a document that can carry script
 * and external references, and this bucket is public and served on our own
 * origin; a stored XSS in a logo is not a trade worth making for vector art.
 */
export async function POST(request: Request) {
  // WRITE, not STANDARD: this one costs storage, and an upload endpoint is
  // the kind of thing that gets found.
  const rate = checkRateLimit(request, RATE_LIMIT_PRESETS.WRITE)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Try again shortly.' },
      { status: 429, headers: getRateLimitHeaders(rate) }
    )
  }

  let file: File | null = null
  try {
    const form = await request.formData()
    const candidate = form.get('file')
    file = candidate instanceof File ? candidate : null
  } catch {
    return NextResponse.json({ error: 'Expected a multipart upload.' }, { status: 400 })
  }

  if (!file) return NextResponse.json({ error: 'No file was attached.' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'That file is empty.' }, { status: 400 })
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 2MB.` },
      { status: 413 }
    )
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const format = SIGNATURES.find((s) => s.match(bytes))
  if (!format) {
    return NextResponse.json(
      { error: 'That is not a PNG, JPEG, GIF or WebP image.' },
      { status: 415 }
    )
  }

  // The submitter never names the stored object. A client-supplied filename is
  // a path traversal and a content-type spoof waiting to happen, and nothing
  // downstream needs the original name.
  const key = `submissions/${crypto.randomUUID()}.${format.ext}`

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(BUCKET).upload(key, bytes, {
    contentType: format.mime,
    cacheControl: '31536000',
    upsert: false,
  })

  if (error) {
    logger.error('[Upload] storing submission image failed:', error)
    return NextResponse.json({ error: 'Could not store that image.' }, { status: 500 })
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key)
  return NextResponse.json({ url: data.publicUrl }, { headers: getRateLimitHeaders(rate) })
}
