# Quick Reference: Updating API Routes from Clerk to Google Auth

## Import Changes

### Before (Clerk):
```typescript
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }
  // ...
}
```

### After (Google OAuth):
```typescript
import { getCurrentUser } from '@/lib/google-auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }
  const userId = user.id
  // ...
}
```

## Common Patterns

### Pattern 1: Simple Auth Check
```typescript
// OLD
const { userId } = await auth()

// NEW
const user = await getCurrentUser()
const userId = user?.id
```

### Pattern 2: Get User Info
```typescript
// OLD
import { currentUser } from '@clerk/nextjs/server'
const user = await currentUser()
const email = user?.emailAddresses[0]?.emailAddress

// NEW
import { getCurrentUser } from '@/lib/google-auth'
const user = await getCurrentUser()
const email = user?.email
```

### Pattern 3: Protect API Route
```typescript
// OLD
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// NEW
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = user.id
}
```

## Files That Need Updates

### API Routes (Priority Order):

1. **High Priority** (User-facing features):
   - `app/api/user/profile/route.ts`
   - `app/api/user/preferences/route.ts`
   - `app/api/user/saved-tools/route.ts`
   - `app/api/user/collections/route.ts`
   - `app/api/user/delete-account/route.ts`

2. **Medium Priority** (Social features):
   - `app/api/user/followers/route.ts`
   - `app/api/user/activity/route.ts`
   - `app/api/users/[id]/follow/route.ts`
   - `app/api/users/[id]/follow-status/route.ts`
   - `app/api/users/search/route.ts`

3. **Low Priority** (Collections):
   - `app/api/collections/route.ts`
   - `app/api/collections/[id]/route.ts`
   - `app/api/collections/[id]/tools/route.ts`

### Search & Replace Command

For VS Code, you can use this regex find & replace:

**Find:** `import { auth } from '@clerk/nextjs/server'`
**Replace:** `import { getCurrentUser } from '@/lib/google-auth`

**Find:** `const { userId } = await auth()`
**Replace:** `const user = await getCurrentUser()\n  const userId = user?.id`

**Find:** `if (!userId)`
**Replace:** `if (!user)`

## Example: Complete API Route Migration

### Before:
```typescript
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch user data
    const userData = await fetchUserData(userId)
    
    return NextResponse.json({ data: userData })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### After:
```typescript
import { getCurrentUser } from '@/lib/google-auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch user data
    const userData = await fetchUserData(user.id)
    
    return NextResponse.json({ data: userData })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Testing Checklist

After updating each API route:

- [ ] Test with authenticated user
- [ ] Test with unauthenticated user (should return 401)
- [ ] Verify user data is correctly retrieved
- [ ] Check error handling
- [ ] Test on mobile devices
- [ ] Verify session persistence

## Additional Resources

- Google Auth Implementation: `lib/google-auth.ts`
- Auth Context: `contexts/auth-context.tsx`
- Middleware: `middleware.ts`
- Migration Guide: `MIGRATION_GUIDE.md`

---

*Last Updated: December 26, 2025*
