import { NextRequest } from 'next/server'
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * POST /api/webhooks/clerk
 * Handles Clerk webhooks to automatically sync user data to Supabase
 * Events: user.created, user.updated, user.deleted
 */
export async function POST(request: NextRequest) {
  // Get the Svix headers for verification
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    logger.warn('Webhook: Missing svix headers')
    return new Response('Error occurred -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await request.json()
  const body = JSON.stringify(payload)

  // Get the webhook secret
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    logger.error('CLERK_WEBHOOK_SECRET is not set')
    return new Response('Webhook secret not configured', {
      status: 500,
    })
  }

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: any

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as any
  } catch (err) {
    logger.error('Error verifying webhook:', err)
    return new Response('Error occurred', {
      status: 400,
    })
  }

  // Handle the webhook
  const eventType = evt.type
  const { id, email_addresses, first_name, last_name, username, image_url, external_accounts } = evt.data

  const supabaseAdmin = getSupabaseAdmin()

  try {
    if (eventType === 'user.created' || eventType === 'user.updated') {
      // Extract user data
      const email = email_addresses?.[0]?.email_address || null
      const firstName = first_name || ''
      const lastName = last_name || ''
      const fullName = `${firstName} ${lastName}`.trim() || null
      
      // Detect OAuth provider
      const primaryProvider = external_accounts?.[0]?.provider || null
      const isAppleUser = primaryProvider === 'oauth_apple'
      const isApplePrivateEmail = email?.includes('privaterelay.appleid.com') || false
      
      // Generate username from various sources (same logic as ensureProfile)
      const usernameFromName = fullName 
        ? fullName.toLowerCase().replace(/\s+/g, '') 
        : null
      const usernameFromEmail = email && !isApplePrivateEmail
        ? email.split('@')[0].toLowerCase()
        : null
      
      const finalUsername = username 
        || usernameFromName 
        || usernameFromEmail
        || (isAppleUser ? 'appleuser' : null)
      
      // Generate display name (same logic as ensureProfile)
      const displayNameFromEmail = email && !isApplePrivateEmail
        ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1)
        : null
      
      const finalDisplayName = fullName 
        || username 
        || displayNameFromEmail
        || (isAppleUser ? 'Apple User' : null)

      // Check if profile exists to preserve onboarding state
      const { data: existing } = await supabaseAdmin
        .from('user_profiles')
        .select('onboarding_completed, instructions_seen')
        .eq('id', id)
        .maybeSingle()

      // Upsert user profile in Supabase
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id,
          username: finalUsername || null,
          display_name: finalDisplayName || null,
          avatar_url: image_url || null,
          // Preserve onboarding state if profile already exists
          onboarding_completed: existing?.onboarding_completed || false,
          instructions_seen: existing?.instructions_seen || false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id',
        })
        .select()
        .single()

      if (error) {
        logger.error('Error syncing user profile:', error)
        return new Response('Error syncing profile', { status: 500 })
      }

      logger.log(`User profile synced: ${id} (${eventType}) - username: ${finalUsername}, display_name: ${finalDisplayName}`)
      return new Response('User profile synced', { status: 200 })
    }

    if (eventType === 'user.deleted') {
      // Delete user profile from Supabase
      // Note: CASCADE constraints should handle related data
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('id', id)

      if (error) {
        logger.error('Error deleting user profile:', error)
        return new Response('Error deleting profile', { status: 500 })
      }

      logger.log(`User profile deleted: ${id}`)
      return new Response('User profile deleted', { status: 200 })
    }

    // Unhandled event type - return success to acknowledge receipt
    logger.log(`Unhandled webhook event: ${eventType}`)
    return new Response('Event type not handled', { status: 200 })
  } catch (error) {
    logger.error('Error processing webhook:', error)
    return new Response('Error processing webhook', { status: 500 })
  }
}

