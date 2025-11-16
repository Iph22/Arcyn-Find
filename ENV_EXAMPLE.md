# Environment Variables Setup

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase Configuration
# Get these from your Supabase project dashboard: https://supabase.com/dashboard
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Important Notes

- **Never commit `.env.local` to git!** It's already in `.gitignore`
- The service role key has admin access and should be kept secret
- For production, set these in your hosting platform's environment variables (e.g., Vercel)

## Getting Your Supabase Keys

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

## Current Configuration

The app currently uses fallback values in `lib/supabase.ts` for development, but you should set these environment variables for production.

