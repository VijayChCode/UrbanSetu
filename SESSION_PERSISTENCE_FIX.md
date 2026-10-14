# Session Persistence Fix — Complete Documentation

> **Date:** October 14, 2026  
> **Commit:** `e8898ec3`  
> **Affected Files:**  
> - `api/utils/sessionManager.js`  
> - `api/utils/verify.js`

---

## 1. The Problem

Users were getting **logged out after ~7 days** even though the system was designed for **90-day persistent sessions** (like Amazon). After signing in, users would return after a week to find themselves on the login page with no session.

---

## 2. How the Authentication System Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User Signs In (Password / Google / OTP)                           │
│       │                                                             │
│       ▼                                                             │
│  createEnhancedSession() → Session saved to user.activeSessions    │
│       │                    (90-day expiresAt)                       │
│       ▼                                                             │
│  generateTokenPair()                                                │
│       ├── Access Token  (JWT, 1-day expiry)                        │
│       └── Refresh Token (JWT, 90-day expiry)                       │
│       │                                                             │
│       ▼                                                             │
│  setSecureCookies() → Cookies sent to browser                      │
│       ├── access_token  (httpOnly, 1-day maxAge)                   │
│       └── refresh_token (httpOnly, 90-day maxAge)                  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  On Every API Call:                                                 │
│       │                                                             │
│       ▼                                                             │
│  verifyToken() middleware                                           │
│       ├── Checks access_token JWT validity                         │
│       ├── Finds session in user.activeSessions                     │
│       ├── Checks session.expiresAt not passed                      │
│       ├── Refreshes cookie expiry                                  │
│       └── Updates session.lastActive (throttled, every 6h) ← NEW  │
│                                                                     │
│  If access_token expired:                                           │
│       │                                                             │
│       ▼                                                             │
│  authenticatedFetch() (frontend) calls /api/auth/refresh            │
│       ├── Verifies refresh_token JWT                               │
│       ├── Generates new token pair (rotation)                      │
│       ├── Extends session.expiresAt by 90 days (sliding window)    │
│       └── Updates session.lastActive                               │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Daily Cron (4:00 AM IST):                                         │
│       │                                                             │
│       ▼                                                             │
│  cleanupAllStaleSessions()                                          │
│       └── Deletes sessions where lastActive > 90 days ago ← FIXED │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Role |
|---|---|
| `api/utils/jwtUtils.js` | Token generation, expiry config, cookie helpers |
| `api/utils/sessionManager.js` | Session creation, cleanup, revocation |
| `api/utils/verify.js` | Middleware that runs on every authenticated API call |
| `api/controllers/auth.controller.js` | SignIn, SignUp, Google, RefreshToken, verifyAuth handlers |
| `api/services/schedulerService.js` | Daily cron that calls cleanupAllStaleSessions |
| `web/src/utils/auth.js` | Frontend token refresh logic (authenticatedFetch) |

---

## 3. Root Cause — 4 Bugs Found

### Bug 1: `cleanupAllStaleSessions()` — THE PRIMARY KILLER 🔴

**Location:** `sessionManager.js:705-732`

A daily cron job at 4 AM deleted any session where `lastActive` was older than **7 days**. Even though sessions were created with 90-day expiry, the cron silently removed them from the database.

**Before:**
```js
// Automatically cleanup stale sessions for ALL users (sessions inactive for > 7 days)
export const cleanupAllStaleSessions = async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // ... deletes sessions where lastActive < sevenDaysAgo
};
```

**After:**
```js
// Automatically cleanup stale sessions for ALL users (sessions inactive for > 90 days)
export const cleanupAllStaleSessions = async () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    // ... deletes sessions where lastActive < ninetyDaysAgo
};
```

---

### Bug 2: `verify.js` Never Updated `lastActive` 🔴

**Location:** `verify.js:64-73`

The `verifyToken` middleware runs on every authenticated API call but **never updated the session's `lastActive` timestamp** in the database. So even an actively browsing user appeared "inactive" to the cleanup cron.

**Before:**
```js
// Refresh cookie expiry
res.cookie('access_token', token, { ... });
req.user = user;
next();
// ← lastActive was NEVER updated here
```

**After:**
```js
// Refresh cookie expiry
res.cookie('access_token', token, { ... });

// Update session lastActive in DB (throttled to once per 6 hours to avoid DB spam)
if (decoded.sessionId) {
    const cacheKey = `${user._id}_${decoded.sessionId}`;
    const lastUpdate = lastActiveUpdateCache.get(cacheKey);
    if (!lastUpdate || Date.now() - lastUpdate > LAST_ACTIVE_THROTTLE) {
        lastActiveUpdateCache.set(cacheKey, Date.now());
        User.findOneAndUpdate(
            { _id: user._id, 'activeSessions.sessionId': decoded.sessionId },
            { $set: { 'activeSessions.$.lastActive': new Date() } }
        ).catch(() => {});
    }
}

req.user = user;
next();
```

**Why throttled?** Without throttling, every single API call would trigger a DB write. With throttling (once per 6 hours), the DB load is negligible while still keeping sessions marked as active.

---

### Bug 3: Legacy `createSession()` Used 7-Day Expiry 🟠

**Location:** `sessionManager.js:20-49`

While all auth controllers correctly use `createEnhancedSession()` (90 days), the older `createSession()` function was still set to 7 days. This was a safety hazard if any code path ever used it.

**Before:**
```js
const sessionId = jwt.sign(
    { userId, type: 'session', timestamp: Date.now() },
    process.env.JWT_TOKEN,
    { expiresIn: '7d' }       // ← 7 days
);
// ...
expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
```

**After:**
```js
const sessionId = jwt.sign(
    { userId, type: 'session', timestamp: Date.now() },
    process.env.JWT_TOKEN,
    { expiresIn: '90d' }      // ← 90 days
);
// ...
expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
```

---

### Bug 4: Misleading Error Message 🟡

**Location:** `verify.js:44-52`

The session expiry check had a comment and error message that said "7-day limit" even though the actual `expiresAt` field was set to 90 days.

**Before:**
```js
// Check absolute session expiry (7 days policy)
// ...
return res.status(401).json({ message: 'Session expired (7-day limit reached). Please sign in again.' });
```

**After:**
```js
// Check absolute session expiry (90 days policy)
// ...
return res.status(401).json({ message: 'Session expired. Please sign in again.' });
```

---

## 4. What Was Already Correct ✅

These components were already correctly configured (done in commit `e78a54e`):

| Component | File | Value |
|---|---|---|
| Access Token JWT expiry | `jwtUtils.js` | 1 day |
| Refresh Token JWT expiry | `jwtUtils.js` | 90 days |
| Access Token cookie maxAge | `jwtUtils.js` | 1 day |
| Refresh Token cookie maxAge | `jwtUtils.js` | 90 days |
| `createEnhancedSession()` expiry | `sessionManager.js` | 90 days |
| `RefreshToken` handler — sliding window | `auth.controller.js` | Extends by 90 days on refresh |
| `verifyAuth` handler — sliding window | `auth.controller.js` | Extends by 90 days on refresh |
| All login controllers | `auth.controller.js` | Use `createEnhancedSession()` |
| Frontend token refresh | `auth.js` | Auto-refreshes on 401 |

---

## 5. Full Token Lifecycle — After Fix

```
Day 0:   User signs in
         ├── Access Token created  (expires Day 1)
         ├── Refresh Token created (expires Day 90)
         └── Session created in DB (expiresAt: Day 90, lastActive: Day 0)

Day 0.5: User browses the site
         └── verifyToken() runs → lastActive updated to Day 0.5 (throttled per 6h)

Day 1:   Access Token expires
         └── Frontend auto-calls /api/auth/refresh
             ├── New Access Token (expires Day 2)
             ├── New Refresh Token (expires Day 91) ← rotation
             └── Session.expiresAt extended to Day 91 ← sliding window
             └── Session.lastActive updated to Day 1

Day 7:   (Previously: session would be DELETED by cron!)
         Now: User still active, lastActive = recent, session survives ✅

Day 30:  User still browsing occasionally
         └── lastActive keeps getting updated every 6 hours
         └── Session.expiresAt keeps sliding forward on every refresh

Day 90:  If user STOPS using the site entirely for 90 consecutive days:
         └── Cron deletes session (truly inactive)
         └── Next visit → user sees sign-in page

Day 90+: If user was ACTIVE during those 90 days:
         └── Session still alive (sliding window + lastActive updates)
         └── Effectively PERMANENT as long as user visits occasionally
```

---

## 6. Environment Variables (Render Backend)

These env vars control token expiry on the backend. If not set, defaults apply:

| Variable | Default | Description |
|---|---|---|
| `JWT_TOKEN` | *required* | Secret key for signing JWTs |
| `JWT_ACCESS_EXPIRE` | `1d` | Access token lifetime |
| `JWT_REFRESH_EXPIRE` | `90d` | Refresh token lifetime |

> **Note:** You don't need to change any Render env vars. The defaults in `jwtUtils.js` are already correct (`1d` / `90d`). Only set these env vars if you want to override the defaults.

---

## 7. Summary of Changes

| # | Bug | File | Before | After | Severity |
|---|---|---|---|---|---|
| 1 | Cron deletes sessions after 7 days inactivity | `sessionManager.js` | 7-day threshold | 90-day threshold | 🔴 Critical |
| 2 | `lastActive` never updated on API calls | `verify.js` | Not updated | Throttled update (6h) | 🔴 Critical |
| 3 | Legacy `createSession()` 7-day expiry | `sessionManager.js` | 7 days | 90 days | 🟠 Medium |
| 4 | Misleading "7-day limit" error message | `verify.js` | "7-day limit reached" | "Session expired" | 🟡 Minor |

---

## 8. How to Verify the Fix

1. **Sign in** on the website
2. **Check MongoDB** — your session in `users.activeSessions` should have:
   - `expiresAt`: ~90 days from now
   - `lastActive`: current timestamp
3. **Browse the site** for a few minutes → check `lastActive` in DB updates (within 6 hours)
4. **Wait 7+ days** → user should still be logged in (previously would be logged out)
5. **Check Render logs** at 4 AM IST — the cleanup cron should report `modifiedCount: 0` (no sessions deleted for active users)
