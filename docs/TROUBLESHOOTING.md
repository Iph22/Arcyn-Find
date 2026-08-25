# Troubleshooting Guide - Feature Issues

## 🚨 CRITICAL: Did you run the SQL setup?

**If you haven't run `/supabase/schema.sql` in Supabase SQL Editor, NOTHING will work!**

### Why Features Fail Without SQL Setup:
- ❌ "Failed to update favorites" → No `user_favorites` table or RLS blocking
- ❌ "Add to collection not working" → No `collections` table or RLS blocking
- ❌ "Write review not working" → No `tool_reviews` table or RLS blocking
- ❌ "Can't view collections" → No `collections` table

### Solution:
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy ALL content from `/supabase/schema.sql`
4. Paste and click "Run"
5. Wait for "Success" message
6. Refresh your app

---

## 🔍 How to Test Each Feature Properly

### 1. Testing Favorites Button

**Steps:**
1. Go to `/tools` page
2. Click on ANY tool card (entire card is clickable)
3. Modal opens with tool details
4. Look for the **heart icon button** (labeled "Favorite")
5. Click it
6. Should see toast: "Added to favorites"
7. Heart should fill red
8. Click again to remove

**If it fails:**
- Check browser console (F12) for errors
- Verify you're logged in (Clerk authentication)
- Confirm SQL setup was run
- Check `/api/favorites` endpoint exists

### 2. Testing Add to Collection

**Steps:**
1. Click any tool card to open modal
2. Find the **"Add to Collection" button** (has Plus icon)
3. Click it
4. Dialog opens

**Two scenarios:**

**A. If you have NO collections:**
- Dialog shows "You don't have any collections yet"
- Click "Create Collection" button
- Redirects to `/collections/new`
- Create a collection
- Try adding tool again

**B. If you have collections:**
- Dropdown shows your collections
- Select one
- Click "Add" button
- Should see toast: "Added to collection"

**If it fails:**
- Check browser console for errors
- Go to `/collections` to verify collections exist
- Confirm SQL setup was run
- Check `/api/collections/[id]/tools` endpoint

### 3. Testing Share Button

**Steps:**
1. Click any tool card to open modal
2. Find the **"Share" button** (has Share2 icon)
3. Click it
4. Dialog opens with 2 options:
   - "Share via..." - Uses native share (if supported)
   - "Copy Link" - Copies tool's website URL

**To test Copy Link:**
1. Click "Copy Link"
2. Button changes to "Copied!" with checkmark
3. Paste (Ctrl+V) to verify the URL
4. Should be the tool's actual website, NOT your app URL

**To test Share via:**
1. Click "Share via..."
2. Native share sheet appears (mobile/supported browsers)
3. Choose app to share with

**If it fails:**
- "Share via..." may not work on all browsers (desktop Chrome doesn't support it)
- "Copy Link" should work everywhere
- Check browser console for clipboard permission errors

### 4. Testing Write Review

**Steps:**
1. Click any tool card to open modal
2. Scroll down to "Reviews" section
3. Click **"Write Review" button** (has Star icon)
4. Dialog opens with:
   - 5-star rating selector (click stars to select)
   - Title field (optional)
   - Review text area (optional)
5. Click at least one star to set rating
6. Click "Submit Review" button
7. Should see toast: "Review submitted successfully"
8. Dialog closes
9. Your review appears in the reviews list

**If it fails:**
- Verify you clicked at least one star (rating is required)
- Check browser console for errors
- Confirm SQL setup was run
- Check `/api/reviews` endpoint exists

### 5. Testing View Collections

**Steps:**
1. Go to `/collections` page
2. Should see list of your collections (or empty state)
3. Click on any collection card
4. Opens `/collections/[id]` showing:
   - Collection name
   - Description
   - Public/Private badge
   - List of tools in collection
   - "Edit Collection" button
   - Delete button (trash icon)

**If page is blank or errors:**
- Check browser console for errors
- Verify `/api/user/collections` endpoint works
- Confirm SQL setup was run
- Check you're logged in

### 6. Testing Edit Collection

**Steps:**
1. Go to any collection page (`/collections/[id]`)
2. Click **"Edit Collection"** button (top right)
3. Opens `/collections/[id]/edit` with form:
   - Name field (pre-filled)
   - Description field (pre-filled)
   - Public/Private toggle (pre-set)
4. Change any field
5. Click "Save Changes"
6. Should see toast: "Collection updated successfully"
7. Redirects back to collection detail page

**If it fails:**
- Check if the edit page loads
- Verify form is pre-filled with current data
- Check browser console for errors
- Confirm `/api/collections/[id]` PUT endpoint exists

---

## 🐛 Common Issues & Fixes

### Issue: "Failed to update favorites"

**Causes:**
1. SQL not run → Tables don't exist
2. RLS enabled → Blocking inserts
3. Not logged in → No Clerk user ID

**Fix:**
1. Run `/supabase/schema.sql`
2. Verify tables exist in Supabase
3. Check RLS policies are set correctly on `user_favorites` table
4. Ensure you're signed in

### Issue: "Add to collection button doesn't open dialog"

**Causes:**
1. Button click handler not attached
2. JavaScript error preventing dialog
3. Modal not using latest component

**Fix:**
1. Check browser console for React errors
2. Verify `/app/tools/page.tsx` imports `enhanced-tool-detail-modal`
3. Clear browser cache and hard refresh (Ctrl+Shift+R)

### Issue: "Share button doesn't work"

**Causes:**
1. Dialog not opening → JavaScript error
2. Native share not supported → Expected on desktop
3. Clipboard API blocked → Browser permissions

**Fix:**
1. Try "Copy Link" instead of "Share via..."
2. Check browser console for errors
3. Allow clipboard access if prompted
4. Use HTTPS (required for clipboard API)

### Issue: "Can't see collections page or it's empty"

**Causes:**
1. SQL not run → Tables don't exist
2. No collections created yet
3. API error fetching collections

**Fix:**
1. Run SQL setup
2. Create a test collection via `/collections/new`
3. Check browser console for API errors
4. Verify `/api/user/collections` returns data

### Issue: "Reviews not showing or can't submit"

**Causes:**
1. SQL not run → `tool_reviews` table missing
2. RLS enabled → Blocking inserts/selects
3. Review API endpoint error

**Fix:**
1. Run SQL setup
2. Check `tool_reviews` table exists
3. Verify RLS is DISABLED
4. Test `/api/reviews` endpoint in browser dev tools

---

## 📋 Checklist Before Reporting Issues

Before saying "X feature doesn't work", please verify:

- [ ] Ran `/supabase/schema.sql` in Supabase SQL Editor
- [ ] Tables exist in Supabase (check Table Editor)
- [ ] RLS is DISABLED on all tables (check Table Editor → policies)
- [ ] Signed in with Clerk (check if user avatar shows)
- [ ] Browser console shows no JavaScript errors (F12 → Console tab)
- [ ] Hard refreshed page (Ctrl+Shift+R) after recent changes
- [ ] Tested the EXACT steps listed above
- [ ] Checked Network tab (F12) to see API responses

---

## 🔧 How to Debug Yourself

### 1. Open Browser DevTools (F12)

**Console Tab:**
- Shows JavaScript errors
- Shows API error messages
- Shows `console.log()` outputs

**Network Tab:**
- Shows all API requests
- Click on `/api/favorites` or `/api/collections` to see:
  - Status code (should be 200 for success)
  - Response body (shows actual error message)
  - Request payload (what was sent)

### 2. Check Supabase

**Table Editor:**
- Verify tables exist: `user_profiles`, `tool_reviews`, `collections`, `user_favorites`
- Check if data is being inserted (click table to view rows)

**SQL Editor:**
- Run: `SELECT * FROM user_favorites;`
- Run: `SELECT * FROM collections;`
- Run: `SELECT * FROM tool_reviews;`
- Should return results (or empty if no data yet)

**Authentication → Policies:**
- All tables should show "RLS disabled" or have NO policies listed
- If policies exist with `auth.uid()` → DELETE THEM

### 3. Check API Routes

Open these URLs directly in browser (while logged in):
- `http://localhost:3000/api/user/collections` → Should return JSON with collections
- `http://localhost:3000/api/favorites` → Should return JSON with favorites

If you get errors, that's your issue!

---

## ✅ Expected Behavior Summary

| Feature | What Should Happen |
|---------|-------------------|
| **Favorites Button** | Opens modal → Click heart → Toast "Added to favorites" → Heart fills red |
| **Add to Collection** | Opens modal → Click button → Dialog opens → Select collection → Click Add → Toast "Added to collection" |
| **Share Button** | Opens modal → Click button → Dialog opens → 2 options shown → Click "Copy Link" → Toast "Link copied" |
| **Write Review** | Opens modal → Click button → Dialog opens → Select stars → Fill form → Submit → Toast "Review submitted" |
| **View Collections** | Go to `/collections` → See list of collections → Click one → See tools in collection |
| **Edit Collection** | Open collection → Click "Edit" → Form opens → Change fields → Save → Toast "Collection updated" |

---

## 🆘 Still Not Working?

If you've done ALL of the above and it still doesn't work:

1. **Share the exact error message** from browser console
2. **Share the API response** from Network tab
3. **Share screenshot** of the Supabase table editor showing tables exist
4. **Confirm** you ran the SQL setup and saw "Success"

Without this info, I can't help further!
