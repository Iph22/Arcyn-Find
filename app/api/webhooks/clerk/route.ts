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
  const { id } = evt.data

  const supabaseAdmin = getSupabaseAdmin()

  try {
    if (eventType === 'user.created' || eventType === 'user.updated') {
      // Fetch full user data from Clerk API to ensure we have complete information
      // Webhook payloads may be incomplete, especially for user.updated events
      const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY
      if (!CLERK_SECRET_KEY) {
        logger.error('CLERK_SECRET_KEY is not set - cannot fetch full user data')
        // Fallback to webhook payload, but log warning
        logger.warn('Falling back to webhook payload data which may be incomplete')
      }

      let clerkUserData: any = evt.data // Default to webhook payload

      // Try to fetch from Clerk API if secret is available
      if (CLERK_SECRET_KEY) {
        try {
          const clerkApiUrl = `https://api.clerk.com/v1/users/${id}`
          const clerkResponse = await fetch(clerkApiUrl, {
            headers: {
              'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
          })

          if (clerkResponse.ok) {
            clerkUserData = await clerkResponse.json()
            logger.log(`Fetched full user data from Clerk API for user ${id}`)
          } else {
            logger.warn(`Failed to fetch user from Clerk API: ${clerkResponse.status}, using webhook payload`)
            // Keep evt.data as fallback
          }
        } catch (fetchError) {
          logger.error('Error fetching user from Clerk API:', fetchError)
          // Keep evt.data as fallback
        }
      }

      // Extract user data from Clerk API response or webhook payload
      const email = clerkUserData.email_addresses?.[0]?.email_address || null
      const firstName = clerkUserData.first_name || ''
      const lastName = clerkUserData.last_name || ''
      const fullName = `${firstName} ${lastName}`.trim() || null
      const clerkUsername = clerkUserData.username || null
      const imageUrl = clerkUserData.image_url || null
      
      // Detect OAuth provider
      const primaryProvider = clerkUserData.external_accounts?.[0]?.provider || null
      const isAppleUser = primaryProvider === 'oauth_apple'
      const isApplePrivateEmail = email?.includes('privaterelay.appleid.com') || false

      // Check if profile exists to preserve onboarding state and existing data
      const { data: existing } = await supabaseAdmin
        .from('user_profiles')
        .select('onboarding_completed, instructions_seen, display_name, username')
        .eq('id', id)
        .maybeSingle()

      if (existing) {
        // Update existing profile (same logic as ensureProfile)
        const updateData: {
          display_name?: string | null
          avatar_url?: string | null
          username?: string | null
        } = {}

        const hasExistingDisplayName = existing.display_name && existing.display_name !== 'Apple User'
        const displayName = fullName || clerkUsername

        // For Apple users: preserve existing name if new data is missing
        // Apple only provides name/email on first sign-up
        if (isAppleUser) {
          if (displayName && typeof displayName === 'string' && displayName !== 'Apple User') {
            // We have real name data - update it
            updateData.display_name = displayName
          } else if (hasExistingDisplayName) {
            // Apple user with existing name but no new data - preserve existing
            // Don't update, keep what we have
          } else if (displayName && typeof displayName === 'string') {
            // First time or fallback - use what we have
            updateData.display_name = displayName
          }
        } else {
          // Non-Apple users: normal update logic
          if (displayName && typeof displayName === 'string') {
            updateData.display_name = displayName
          }
        }

        // Generate display_name from email if missing and no OAuth data
        if (!updateData.display_name && email && typeof email === 'string') {
          if (isApplePrivateEmail && hasExistingDisplayName) {
            // Don't overwrite existing name with private email
            // Keep existing display_name
          } else {
            const emailName = email.split('@')[0]
            updateData.display_name = emailName.charAt(0).toUpperCase() + emailName.slice(1)
          }
        }

        // Update avatar
        if (imageUrl && typeof imageUrl === 'string') {
          updateData.avatar_url = imageUrl
        }

        // Update username if not set and we have one
        if (clerkUsername && typeof clerkUsername === 'string' && !existing.username) {
          updateData.username = clerkUsername
        }

        // Generate username from email if missing
        if (!updateData.username && !existing.username && email && typeof email === 'string') {
          if (isApplePrivateEmail) {
            const emailPrefix = email.split('@')[0]
            // Try to use existing display_name if available, otherwise use email prefix
            updateData.username = (existing.display_name && existing.display_name !== 'Apple User'
              ? existing.display_name.toLowerCase().replace(/\s+/g, '')
              : emailPrefix.toLowerCase())
          } else {
            updateData.username = email.split('@')[0].toLowerCase()
          }
        }

        // Only update if we have changes
        if (Object.keys(updateData).length > 0) {
          const { error } = await supabaseAdmin
            .from('user_profiles')
            .update({
              ...updateData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)

          if (error) {
            logger.error('Error updating user profile:', error)
            return new Response('Error updating profile', { status: 500 })
          }

          logger.log(`User profile updated: ${id} (${eventType}) - updated fields: ${Object.keys(updateData).join(', ')}`)
        } else {
          logger.log(`User profile checked: ${id} (${eventType}) - no updates needed`)
        }
      } else {
        // Create new profile (same logic as ensureProfile)
        const usernameFromName = fullName 
          ? fullName.toLowerCase().replace(/\s+/g, '') 
          : null
        const usernameFromEmail = email && !isApplePrivateEmail
          ? email.split('@')[0].toLowerCase()
          : null

        const finalUsername = clerkUsername 
          || usernameFromName 
          || usernameFromEmail
          || (isAppleUser ? 'appleuser' : null)

        const displayNameFromEmail = email && !isApplePrivateEmail
          ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1)
          : null

        const finalDisplayName = fullName 
          || clerkUsername 
          || displayNameFromEmail
          || (isAppleUser ? 'Apple User' : null)

        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            id,
            username: finalUsername || null,
            display_name: finalDisplayName || null,
            avatar_url: imageUrl || null,
            onboarding_completed: false,
            instructions_seen: false,
          })
          .select()
          .single()

        if (error) {
          logger.error('Error creating user profile:', error)
          return new Response('Error creating profile', { status: 500 })
        }

        logger.log(`User profile created: ${id} (${eventType}) - username: ${finalUsername}, display_name: ${finalDisplayName}`)
      }

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

