# Security Hardening Documentation

## Overview

This document describes the security hardening measures implemented in the Arcyn Find application, following OWASP best practices for web application security.

## Security Features Implemented

### 1. Rate Limiting

All public and protected endpoints now implement rate limiting to prevent abuse and denial-of-service attacks.

#### Rate Limit Presets

| Preset | Max Requests | Window | Use Case |
|--------|-------------|--------|----------|
| `STANDARD` | 60 (100 auth) | 1 min | General API endpoints |
| `AUTH` | 5 | 1 min | Authentication endpoints |
| `SEARCH` | 30 (60 auth) | 1 min | Search operations |
| `WRITE` | 20 (40 auth) | 1 min | POST/PUT/DELETE operations |
| `CONTACT` | 3 | 1 min | Contact form submissions |
| `EXPENSIVE` | 10 | 1 min | Resource-intensive operations |
| `PUBLIC_READ` | 120 | 1 min | Public read-only endpoints |

#### Implementation

```typescript
import { checkRateLimit, RATE_LIMIT_PRESETS, createRateLimitResponse } from '@/lib/security'

// In your API route:
const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.STANDARD, userId)

if (!rateLimit.allowed) {
  return createRateLimitResponse(rateLimit)
}
```

#### Features
- **IP-based limiting** for unauthenticated requests
- **User-based limiting** for authenticated requests (prevents single user abuse)
- **Sliding window algorithm** for smooth rate limiting
- **Burst protection** to prevent request spikes
- **Graceful 429 responses** with `Retry-After` headers
- **Standard rate limit headers** (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)

---

### 2. Input Validation & Sanitization

All user inputs are validated and sanitized using schema-based validation with Zod.

#### Sanitization Functions

| Function | Purpose |
|----------|---------|
| `sanitizeHtml()` | Escapes HTML entities to prevent XSS |
| `sanitizeForQuery()` | Escapes SQL wildcards, logs injection attempts |
| `sanitizePath()` | Prevents directory traversal attacks |
| `stripUnexpectedFields()` | Removes unallowed properties from objects |

#### Pre-built Validators

```typescript
import {
  safeString,
  safeEmail,
  safeUrl,
  safeId,
  safeUsername,
  safeRating,
  safePaginationLimit
} from '@/lib/security'
```

#### Pre-built Schemas

```typescript
import {
  createCollectionSchema,  // Collection creation
  updateCollectionSchema,  // Collection updates
  createReviewSchema,      // Review creation
  updateReviewSchema,      // Review updates
  updateProfileSchema,     // Profile updates
  contactFormSchema,       // Contact form
  toolIdSchema,            // Tool ID validation
  trackViewSchema          // View tracking
} from '@/lib/security'
```

#### Validation Example

```typescript
import { parseAndValidateBody, createReviewSchema } from '@/lib/security'

// In your API route:
const parseResult = await parseAndValidateBody(request, createReviewSchema)

if ('error' in parseResult) {
  return parseResult.error // Already formatted as proper error response
}

const { tool_id, rating, review_text } = parseResult.data
```

#### Security Features
- **Type checking** - All inputs validated for correct types
- **Length limits** - Maximum lengths enforced on all string fields
- **Strict mode** - Unknown/unexpected fields are rejected
- **XSS prevention** - HTML entities escaped in user inputs
- **SQL injection prevention** - Dangerous patterns logged and wildcards escaped

---

### 3. Secure API Key Handling

All secrets are loaded from environment variables with proper validation and protection.

#### Environment Variables

**Required (Server-side only):**
- `SUPABASE_SERVICE_ROLE_KEY` - Database admin access
- `GOOGLE_CLIENT_SECRET` - OAuth secret
- `CRON_SECRET` - Cron job authentication

**Public (Safe for client):**
- `NEXT_PUBLIC_SUPABASE_URL` - Database URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key (RLS protected)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - OAuth client ID
- `NEXT_PUBLIC_SITE_URL` - Site URL

#### Usage

```typescript
import { getSecureConfig, verifyCronAuthorization } from '@/lib/security'

// Get full config (server-side only)
const config = getSecureConfig()

// Verify cron authorization
if (!verifyCronAuthorization(authHeader)) {
  return createErrorResponse('Unauthorized', 401)
}
```

#### Security Features
- **No hardcoded keys** - All secrets from environment variables
- **Client exposure prevention** - Server-only secrets validated
- **Timing-safe comparison** - Prevents timing attacks on secret comparison
- **Placeholder detection** - Warns if placeholder values are used
- **Runtime validation** - Missing secrets caught at startup

---

## SSRF Prevention

The `/api/check-url` endpoint includes SSRF (Server-Side Request Forgery) protection:

- **Allowed protocols**: Only `http://` and `https://`
- **Blocked hosts**: `localhost`, `127.0.0.1`, private networks (`10.x`, `172.16.x`, `192.168.x`), cloud metadata endpoints

---

## Endpoints Hardened

| Endpoint | Rate Limit | Validation | Auth Required |
|----------|------------|------------|---------------|
| `POST /api/contact` | CONTACT (3/min) | ✅ Schema | ❌ |
| `GET /api/reviews` | PUBLIC_READ | ✅ Query params | ❌ |
| `POST /api/reviews` | WRITE (user) | ✅ Schema | ✅ |
| `PUT /api/reviews/[id]` | WRITE (user) | ✅ Schema + ID | ✅ |
| `DELETE /api/reviews/[id]` | WRITE (user) | ✅ ID | ✅ |
| `GET /api/collections` | STANDARD (user) | ❌ | ✅ |
| `POST /api/collections` | WRITE (user) | ✅ Schema | ✅ |
| `PUT /api/collections/[id]` | WRITE (user) | ✅ Schema + ID | ✅ |
| `DELETE /api/collections/[id]` | WRITE (user) | ✅ ID | ✅ |
| `GET /api/user/profile` | STANDARD (user) | ❌ | ✅ |
| `PUT /api/user/profile` | WRITE (user) | ✅ Schema | ✅ |
| `DELETE /api/user/delete-account` | 1/min (user) | ❌ | ✅ |
| `GET /api/users/search` | SEARCH (user) | ✅ Query | ✅ |
| `POST /api/users/[id]/follow` | 30/min (user) | ✅ ID | ✅ |
| `DELETE /api/users/[id]/follow` | 30/min (user) | ✅ ID | ✅ |
| `POST /api/favorites` | WRITE (user) | ✅ Schema | ✅ |
| `POST /api/track-view` | 30/min | ✅ Schema | ❌ |
| `GET /api/check-url` | 20/min | ✅ URL + SSRF | ❌ |
| `GET /api/cron/fetch-tools` | N/A | Cron secret | Bearer token |
| `GET /api/ai-models` | STANDARD | ✅ Query params | ❌ |
| `GET /api/trending` | EXPENSIVE | ❌ | ❌ |

---

## Best Practices Followed

### OWASP Top 10 Mitigations

1. **A01:2021 - Broken Access Control**
   - Authentication checks on protected routes
   - Ownership verification before modifications
   - Rate limiting prevents enumeration

2. **A02:2021 - Cryptographic Failures**
   - Secrets stored in environment variables
   - HTTPS enforced in production
   - Session cookies httpOnly + secure

3. **A03:2021 - Injection**
   - Schema-based input validation
   - HTML entity escaping
   - SQL wildcard escaping
   - Parameterized queries (via Supabase)

4. **A04:2021 - Insecure Design**
   - Rate limiting by design
   - Strict input schemas
   - Rejection of unexpected fields

5. **A05:2021 - Security Misconfiguration**
   - Environment validation on startup
   - Separate configs for dev/prod
   - CRON_SECRET for cron jobs

6. **A07:2021 - XSS**
   - HTML sanitization on all user inputs
   - Content-Security-Policy recommended

7. **A10:2021 - SSRF**
   - URL validation with protocol check
   - Private network blocking

---

## Configuration

### Generate a Secure CRON_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Required Environment Variables

```env
# Required for security features
CRON_SECRET=<your-secure-random-string>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
GOOGLE_CLIENT_SECRET=<your-client-secret>
```

---

## Monitoring & Logging

Security events are logged for monitoring:

- Rate limit exceeded events
- Potential SQL injection attempts
- Blocked SSRF requests
- Authentication failures
- Account deletion requests

---

## Future Enhancements

Consider implementing:

1. **Redis-based rate limiting** for distributed deployment
2. **Content-Security-Policy headers** for XSS protection
3. **CAPTCHA** for public form submissions
4. **IP blacklisting** for persistent abusers
5. **Request signing** for API authentication
6. **Audit logging** to a dedicated service
