import { NextRequest, NextResponse } from 'next/server'

/**
 * API route to check if a URL is accessible
 * Used by tool health monitoring to bypass CORS restrictions
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  
  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    )
  }

  // Validate URL format
  try {
    new URL(url)
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL format' },
      { status: 400 }
    )
  }

  try {
    const startTime = Date.now()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime

    return NextResponse.json({
      status: response.ok ? 'up' : 'down',
      responseTime,
      statusCode: response.status,
    })
  } catch (error) {
    const responseTime = Date.now() - Date.now() // Will be negative, but that's okay
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({
        status: 'down',
        error: 'Request timeout',
        responseTime: 10000, // Timeout duration
      })
    }

    return NextResponse.json({
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: 0,
    })
  }
}

