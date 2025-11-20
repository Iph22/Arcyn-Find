# Phase 2 Implementation Guide

## ✅ What's Been Implemented

### 1. Database Schema (`supabase/phase2-schema.sql`)
- **User Profiles**: Extended Supabase Auth with custom profile fields
- **Reviews & Ratings**: Full review system with ratings, helpfulness voting
- **Pricing History**: Track pricing changes over time
- **Price Alerts**: User notifications for price changes
- **Collections**: User-created playlists of AI tools
- **Row Level Security**: Proper RLS policies for all tables

### 2. Library Functions

#### Reviews (`lib/reviews.ts`)
- `getToolReviews()` - Fetch reviews for a tool
- `getToolReviewStats()` - Get average rating and distribution
- `submitReview()` - Submit new review
- `updateReview()` - Update existing review
- `deleteReview()` - Delete review
- `voteReviewHelpful()` - Vote on review helpfulness

#### Collections (`lib/collections.ts`)
- `getUserCollections()` - Get user's collections
- `getPublicCollections()` - Get public collections
- `getCollection()` - Get collection with tools
- `createCollection()` - Create new collection
- `updateCollection()` - Update collection
- `deleteCollection()` - Delete collection
- `addToolToCollection()` - Add tool to collection
- `removeToolFromCollection()` - Remove tool from collection

#### Pricing (`lib/pricing.ts`)
- `getPricingHistory()` - Get pricing history for a tool
- `recordPricingChange()` - Record price change (admin/scraper)
- `getUserPriceAlerts()` - Get user's price alerts
- `createPriceAlert()` - Create price alert
- `updatePriceAlert()` - Update price alert
- `deletePriceAlert()` - Delete price alert

#### Authentication (`lib/auth.ts`)
- `getCurrentUser()` - Get current authenticated user
- `getUserProfile()` - Get user profile
- `upsertUserProfile()` - Create/update profile
- `signUp()` - Email signup
- `signIn()` - Email signin
- `signOut()` - Sign out
- `signInWithProvider()` - OAuth (Google, GitHub)
- `resetPassword()` - Password reset

### 3. UI Components

#### Reviews Section (`components/reviews-section.tsx`)
- Display review statistics (average rating, distribution)
- Review form (submit/edit)
- Reviews list with helpfulness voting
- User can edit/delete their own reviews

#### Auth Modal (`components/auth-modal.tsx`)
- Sign in / Sign up / Reset password
- OAuth with Google and GitHub
- Form validation
- Error handling

### 4. API Routes
- `/api/reviews` - GET reviews for a tool with stats

### 5. Pages
- `/auth/callback` - OAuth callback handler

## 🚀 Setup Instructions

### Step 1: Run Database Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/phase2-schema.sql`
4. Click **Run** to execute

This will create all necessary tables, indexes, RLS policies, and functions.

### Step 2: Enable OAuth Providers (Optional)

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Google and/or GitHub
3. Add OAuth credentials:
   - **Google**: Client ID and Secret from Google Cloud Console
   - **GitHub**: Client ID and Secret from GitHub OAuth Apps

### Step 3: Update Environment Variables

Add to `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 4: Add Auth Button to Navigation

Add the auth modal trigger to your navigation/header:

```tsx
import { AuthModal } from '@/components/auth-modal'
import { getCurrentUser, signOut } from '@/lib/auth'

// In your component:
const [showAuth, setShowAuth] = useState(false)
const [user, setUser] = useState(null)

useEffect(() => {
  getCurrentUser().then(setUser)
}, [])

// In JSX:
{user ? (
  <button onClick={() => signOut().then(() => window.location.reload())}>
    Sign Out
  </button>
) : (
  <button onClick={() => setShowAuth(true)}>Sign In</button>
)}
<AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
```

## 📋 Next Steps (To Complete Phase 2)

### 1. Collections UI Component
Create `components/collections-section.tsx`:
- Display user's collections
- Create/edit/delete collections
- Add/remove tools from collections
- Public collection browsing

### 2. Pricing History Component
Create `components/pricing-history.tsx`:
- Display pricing history chart
- Show price alerts
- Create price alert form

### 3. User Profile Page
Create `app/profile/page.tsx`:
- Display user profile
- Edit profile
- View user's reviews
- View user's collections
- View price alerts

### 4. Collections Page
Create `app/collections/page.tsx`:
- Browse public collections
- View collection details
- Follow collections (future feature)

### 5. Add Collections to AI Detail Page
- "Add to Collection" button
- Quick collection selector

### 6. Add Pricing History to AI Detail Page
- Pricing history chart
- Price alert button

## 🎯 Features Ready to Use

✅ **Reviews System**: Fully functional, integrated into AI detail pages
✅ **Authentication**: Email and OAuth ready (needs OAuth setup)
✅ **Database Schema**: All tables and policies ready
✅ **Library Functions**: All CRUD operations implemented

## 🔒 Security Notes

- All tables have Row Level Security (RLS) enabled
- Users can only modify their own data
- Public collections are readable by everyone
- Private collections are only visible to the owner
- Reviews are public but users can only edit/delete their own

## 📊 Database Tables Created

1. `user_profiles` - User profile information
2. `tool_reviews` - Reviews and ratings
3. `review_helpful_votes` - Helpfulness votes
4. `pricing_history` - Historical pricing data
5. `price_alerts` - User price alerts
6. `collections` - User collections/playlists
7. `collection_items` - Tools in collections

## 🐛 Troubleshooting

### OAuth not working
- Check OAuth credentials in Supabase dashboard
- Verify redirect URL is set correctly
- Check browser console for errors

### RLS blocking queries
- Verify RLS policies are created
- Check user authentication status
- Review policy conditions

### Reviews not showing
- Check API route is working: `/api/reviews?toolId=xxx`
- Verify database has reviews
- Check browser console for errors

## 📝 Notes

- All functions use Supabase client-side SDK
- Server-side operations use admin client
- OAuth requires proper setup in Supabase dashboard
- Email verification is enabled by default (can be disabled in Supabase)

