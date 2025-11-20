# OAuth Setup Guide

This guide will help you set up Google and GitHub OAuth authentication for your application.

## Prerequisites

- Supabase project created
- Production URL: `https://arcyn-find.vercel.app`

## Step 1: Configure OAuth Providers in Supabase

### Google OAuth Setup

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Create a new project or select an existing one

2. **Create OAuth 2.0 Credentials**
   - Navigate to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `Arcyn Find`
   - **Authorized JavaScript origins**:
     - `https://arcyn-find.vercel.app`
     - `https://otrtjqomyukafgnyylij.supabase.co` (your Supabase project URL)
   - **Authorized redirect URIs**:
     - `https://otrtjqomyukafgnyylij.supabase.co/auth/v1/callback`
   - Click **Create**
   - Copy the **Client ID** and **Client Secret**

3. **Configure in Supabase**
   - Go to your Supabase Dashboard: https://supabase.com/dashboard
   - Select your project
   - Navigate to **Authentication** → **Providers**
   - Find **Google** and click to enable it
   - Paste your **Client ID** and **Client Secret**
   - Click **Save**

### GitHub OAuth Setup

1. **Create GitHub OAuth App**
   - Visit: https://github.com/settings/developers
   - Click **New OAuth App**
   - **Application name**: `Arcyn Find`
   - **Homepage URL**: `https://arcyn-find.vercel.app`
   - **Authorization callback URL**: `https://otrtjqomyukafgnyylij.supabase.co/auth/v1/callback`
   - Click **Register application**
   - Copy the **Client ID**
   - Click **Generate a new client secret**
   - Copy the **Client Secret**

2. **Configure in Supabase**
   - Go to your Supabase Dashboard
   - Navigate to **Authentication** → **Providers**
   - Find **GitHub** and click to enable it
   - Paste your **Client ID** and **Client Secret**
   - Click **Save**

## Step 2: Set Redirect URLs in Supabase

1. **Go to Supabase Dashboard**
   - Navigate to **Authentication** → **URL Configuration**

2. **Set Site URL**
   - Site URL: `https://arcyn-find.vercel.app`

3. **Add Redirect URLs**
   - Add these redirect URLs:
     - `https://arcyn-find.vercel.app/auth/callback`
     - `https://arcyn-find.vercel.app/**` (wildcard for all routes)

## Step 3: Environment Variables

Make sure these are set in your Vercel deployment:

```env
NEXT_PUBLIC_SUPABASE_URL=https://otrtjqomyukafgnyylij.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_SITE_URL=https://arcyn-find.vercel.app
```

## Step 4: Test OAuth Flow

1. **Test Google OAuth**
   - Visit your site: `https://arcyn-find.vercel.app`
   - Click "Sign In" or try to use a feature that requires auth
   - Click "Continue with Google"
   - You should be redirected to Google for authentication
   - After approval, you'll be redirected back to `/auth/callback`
   - Then redirected to the home page

2. **Test GitHub OAuth**
   - Same process but click "Continue with GitHub"

## Troubleshooting

### "Redirect URI mismatch" error
- Make sure the redirect URI in your OAuth provider matches exactly: `https://otrtjqomyukafgnyylij.supabase.co/auth/v1/callback`
- Check that the Site URL in Supabase is set correctly

### "Invalid client" error
- Verify your Client ID and Client Secret are correct in Supabase
- Make sure the OAuth provider is enabled in Supabase

### Users not being created
- Check that the `user_profiles` table exists (run `supabase/complete-schema.sql`)
- Check browser console for errors
- Verify RLS policies allow profile creation

### Callback not working
- Verify the callback route exists at `/app/auth/callback/route.ts`
- Check that the redirect URL in `lib/auth.ts` matches your production URL
- Ensure environment variables are set correctly

## Security Notes

- Never commit OAuth credentials to git
- Use environment variables for all sensitive data
- The callback route automatically creates user profiles
- User profiles are created with data from OAuth providers (name, avatar, etc.)

## Current Implementation

- **Callback Route**: `/app/auth/callback/route.ts`
  - Handles OAuth code exchange
  - Creates/updates user profiles automatically
  - Redirects to home page after successful auth

- **OAuth Initiation**: `lib/auth.ts` → `signInWithProvider()`
  - Uses production URL for redirects
  - Supports Google and GitHub

- **Auth Modal**: `components/auth-modal.tsx`
  - Provides UI for OAuth sign-in buttons
  - Shows error messages if OAuth fails

