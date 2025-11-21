import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables')
}

// Production URL for OAuth callbacks
const PRODUCTION_URL = 'https://arcyn-find.vercel.app'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // Get the proper redirect URL (production or current origin)
  // Use production URL if in production environment, otherwise use request origin
  const isProduction = requestUrl.hostname !== 'localhost' && !requestUrl.hostname.includes('127.0.0.1')
  const redirectUrl = isProduction 
    ? (process.env.NEXT_PUBLIC_SITE_URL || PRODUCTION_URL)
    : requestUrl.origin

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorDescription || error)}`, redirectUrl)
    )
  }

  // Handle OAuth callback with code
  if (!code) {
    return NextResponse.redirect(new URL('/', redirectUrl))
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Exchange code for session - this sets cookies automatically
    // Using type assertion because exchangeCodeForSession exists but TypeScript may not recognize it
    // We've already checked that code is not null above, so we can safely assert it
    const authApi = supabase.auth as any
    const { data, error: exchangeError } = await authApi.exchangeCodeForSession(code!)

    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError)
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent('Authentication failed. Please try again.')}`, redirectUrl)
      )
    }

    // Create or update user profile after successful OAuth
    if (data?.user) {
      try {
        const supabaseAdmin = getSupabaseAdmin()
        const { data: existingProfile } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('id', data.user.id)
          .single()

        if (!existingProfile) {
          // Create user profile from OAuth metadata
          const metadata = data.user.user_metadata || {}
          await supabaseAdmin
            .from('user_profiles')
            .insert({
              id: data.user.id,
              username: metadata.preferred_username || metadata.user_name || (metadata.name ? metadata.name.toLowerCase().replace(/\s+/g, '') : null) || null,
              display_name: metadata.full_name || metadata.name || metadata.preferred_username || null,
              avatar_url: metadata.avatar_url || metadata.picture || null,
            })
        } else {
          // Update existing profile with latest OAuth metadata
          const metadata = data.user.user_metadata || {}
          const updateData: {
            display_name?: string | null
            avatar_url?: string | null
          } = {}
          
          if (metadata.full_name || metadata.name || metadata.preferred_username) {
            updateData.display_name = metadata.full_name || metadata.name || metadata.preferred_username || null
          }
          if (metadata.avatar_url || metadata.picture) {
            updateData.avatar_url = metadata.avatar_url || metadata.picture || null
          }
          
          if (Object.keys(updateData).length > 0) {
            await supabaseAdmin
              .from('user_profiles')
              .update(updateData)
              .eq('id', data.user.id)
          }
        }
      } catch (profileError) {
        // Log but don't fail the auth flow if profile creation fails
        console.error('Error creating/updating user profile:', profileError)
      }
    }

    // Mark as authenticated and redirect to onboarding
    // The onboarding page will check if user has already completed onboarding
    return NextResponse.redirect(new URL('/onboarding?auth=success', redirectUrl))
  } catch (error) {
    console.error('Error in OAuth callback:', error)
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent('Authentication failed. Please try again.')}`, redirectUrl)
    )
  }
}

