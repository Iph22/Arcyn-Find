# Clerk Webhook Setup for Automatic User Sync

This webhook automatically syncs Clerk user data to Supabase whenever users sign up, update their profile, or are deleted.

## What It Does

- **user.created**: Automatically creates a user profile in Supabase with `username` and `display_name` extracted from Clerk data
- **user.updated**: Updates the user profile in Supabase when Clerk user data changes
- **user.deleted**: Removes the user profile from Supabase when a user is deleted

## Setup Instructions

### 1. Get Your Webhook Secret

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Webhooks** in the sidebar
3. Click **Add Endpoint**
4. Enter your webhook URL:
   - **Production**: `https://your-domain.com/api/webhooks/clerk`
   - **Development**: Use a tool like [ngrok](https://ngrok.com) to expose your local server, or use Vercel preview URLs
5. Subscribe to these events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
6. Copy the **Signing Secret** (starts with `whsec_`)

### 2. Add Environment Variable

Add the webhook secret to your `.env.local` file:

```env
CLERK_WEBHOOK_SECRET=whsec_xxxxx
```

### 3. Deploy

Deploy your application. The webhook will automatically start syncing user data.

## How It Works

### User Creation/Update

When a user signs up or updates their profile in Clerk, the webhook:

1. Extracts user data from Clerk (name, email, username, avatar)
2. Detects OAuth provider (Apple, GitHub, etc.)
3. Generates `username` and `display_name` using the same logic as `ensureProfile`:
   - **Email users**: Username from email, display name from name or email
   - **Apple users**: Handles private relay emails, preserves existing names
   - **GitHub users**: Uses GitHub username
4. Creates or updates the profile in Supabase
5. Preserves onboarding state (doesn't overwrite if user already completed onboarding)

### User Deletion

When a user is deleted in Clerk, the webhook removes their profile from Supabase. Related data is cleaned up via CASCADE constraints.

## Benefits

✅ **Automatic**: No manual `ensure-profile` calls needed  
✅ **Real-time**: Profiles are synced immediately when users sign up  
✅ **Reliable**: Works even if users skip onboarding  
✅ **Searchable**: All users automatically get `username` and `display_name`  
✅ **Handles all providers**: Email, Apple, GitHub, etc.

## Testing

### Test the Webhook Locally

1. Install [ngrok](https://ngrok.com): `npm install -g ngrok`
2. Start your dev server: `npm run dev`
3. Expose it: `ngrok http 3000`
4. Use the ngrok URL in Clerk webhook settings: `https://xxxxx.ngrok.io/api/webhooks/clerk`
5. Create a test user in Clerk and verify the profile is created in Supabase

### Verify It's Working

1. Check your Supabase `user_profiles` table
2. Create a new user in Clerk (via sign-up page)
3. Verify the profile appears in Supabase with `username` and `display_name` populated
4. Update the user's name in Clerk
5. Verify the profile is updated in Supabase

## Troubleshooting

### Webhook Not Receiving Events

- Check that `CLERK_WEBHOOK_SECRET` is set correctly
- Verify the webhook URL is accessible (not blocked by firewall)
- Check Clerk dashboard for webhook delivery logs
- Check your application logs for webhook errors

### Profiles Not Being Created

- Verify webhook secret matches in Clerk dashboard
- Check Supabase connection (environment variables)
- Review application logs for errors
- Ensure the webhook endpoint is returning 200 status

### Users Still Not Searchable

- Verify profiles have `username` or `display_name` set (not both null)
- Check that the webhook is actually being called (check logs)
- For existing users, they may need to update their Clerk profile to trigger `user.updated`

## Migration for Existing Users

For existing users who don't have `username`/`display_name`:

1. They can update their profile in Clerk (triggers `user.updated` webhook)
2. Or visit `/onboarding` or `/home` (triggers `ensure-profile` as fallback)
3. Or manually trigger: `POST /api/auth/ensure-profile`

