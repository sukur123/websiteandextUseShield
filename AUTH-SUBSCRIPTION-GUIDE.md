# Authentication & Subscription System - Implementation Guide

This document provides a complete guide to the authentication and subscription system for the Money Trap Analyzer Chrome Extension.

---

## Overview

The extension now features:
- ✅ **User Authentication** - Register, login, logout with JWT tokens
- ✅ **Email Verification** - Verify email addresses before full access
- ✅ **Password Management** - Secure password reset flow
- ✅ **Subscription Management** - Database-backed subscriptions via Lemon Squeezy
- ✅ **Backend Integration** - RESTful API at `https://api.useshield.net`

---

## Architecture

### Frontend (Chrome Extension)

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  login.html  │  │register.html │  │  popup.html  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                            │                                │
│                            ▼                                │
│                    ┌───────────────┐                        │
│                    │   src/auth.js │ (Authentication)       │
│                    └───────┬───────┘                        │
│                            │                                │
│                            ▼                                │
│              ┌─────────────────────────┐                    │
│              │ src/subscription.js     │ (Subscriptions)    │
│              └─────────┬───────────────┘                    │
│                        │                                    │
│                        ▼                                    │
│              ┌─────────────────────────┐                    │
│              │ src/lemonsqueezy.js     │ (Payment)          │
│              └─────────────────────────┘                    │
│                                                              │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          │ HTTPS/JWT
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend API Server                         │
│              (https://api.useshield.net)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  /api/auth/*          - Authentication endpoints            │
│  /api/subscriptions/* - Subscription management             │
│  /api/webhooks/*      - Lemon Squeezy webhooks              │
│                                                              │
│  Database: Users + Subscriptions tables                     │
│                                                              │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          │ License Validation
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Lemon Squeezy API                          │
│           (Payment Processing & Licensing)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## User Flow

### 1. Registration & Login

```mermaid
sequenceDiagram
    User->>+Extension: Click extension icon
    Extension->>+Extension: Check isAuthenticated()
    Extension-->>-User: Redirect to login.html
    
    User->>+Extension: Click "Create Account"
    Extension-->>-User: Show register.html
    
    User->>+Extension: Enter name, email, password
    Extension->>+Backend: POST /api/auth/register
    Backend->>+Database: Create user record
    Backend-->>-Extension: Return JWT token + user data
    Extension->>+Storage: Save token to chrome.storage.local
    Extension-->>-User: Redirect to popup.html
```

### 2. Purchase Subscription

```mermaid
sequenceDiagram
    User->>+Extension: Click "Upgrade to Pro"
    Extension->>+Backend: POST /api/subscriptions/purchase {tier, email}
    Backend->>+Lemon Squeezy: Create checkout session
    Lemon Squeezy-->>-Backend: Return checkout URL
    Backend-->>-Extension: Return checkout URL
    Extension-->>-User: Open checkout in new tab
    
    User->>+Lemon Squeezy: Complete payment
    Lemon Squeezy->>+Backend: Webhook: order_paid
    Backend->>+Database: Create/update subscription
    Backend->>+Lemon Squeezy: Verify license
    Backend-->>-Extension: Subscription activated
    Extension->>+Storage: Update tier in chrome.storage.local
    Extension-->>-User: Show success message
```

---

## Frontend Implementation

### 1. Authentication Module (`src/auth.js`)

**Key Functions**:

```javascript
// Register new user
const result = await register(name, email, password);
// Returns: { success, user, token }

// Login
const result = await login(email, password);
// Returns: { success, user, token }

// Check if authenticated
const isAuth = await isAuthenticated();
// Returns: boolean

// Get current user
const user = await getCurrentUser();
// Returns: { id, email, name, emailVerified }

// Logout
await logout();
// Clears token and user data
```

**Storage Format**:
```javascript
{
  "mta_auth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "mta_user": {
    "id": "user_abc123",
    "email": "john@example.com",
    "name": "John Doe",
    "emailVerified": true
  }
}
```

### 2. Subscription Module (`src/subscription.js`)

**Key Functions**:

```javascript
// Purchase a plan
const result = await purchasePlan(tier, email);
// Returns: { checkoutUrl, orderId }

// Activate subscription after payment
const result = await activateSubscription(licenseKey, orderId);
// Returns: { success, subscription }

// Get current subscription
const sub = await getSubscription();
// Returns: { tier, status, expiresAt, scansUsed, scansLimit }

// Sync subscription from backend
await syncSubscription();
// Updates local storage with backend data
```

### 3. UI Pages

**login.html**:
- Email/password fields with validation
- "Forgot password?" link
- "Create account" link
- Real-time validation feedback
- Loading states during login

**register.html**:
- Name, email, password, confirm password fields
- Password strength indicator (weak/medium/strong)
- Real-time validation
- Terms acceptance checkbox
- Auto-redirect if already logged in

**popup.html**:
- Auth check on load → redirect to login if not authenticated
- User info section in header (avatar, name, email, logout button)
- All features require authentication

**subscription.html**:
- Auth check on load
- Integration with backend subscription system
- Checkout instructions modal
- User info display

---

## Backend Implementation

### Required Endpoints

See `BACKEND-API-SPEC.md` for complete API documentation.

**Authentication**:
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/forgot-password` - Request reset
- `POST /api/auth/reset-password` - Reset password
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/change-password` - Change password

**Subscriptions**:
- `POST /api/subscriptions/purchase` - Create purchase
- `POST /api/subscriptions/activate` - Activate subscription
- `GET /api/subscriptions/current` - Get subscription
- `POST /api/subscriptions/sync` - Sync from Lemon Squeezy
- `POST /api/subscriptions/cancel` - Cancel subscription

**Webhooks**:
- `POST /api/webhooks/lemonsqueezy` - Handle Lemon Squeezy events

### Database Schema

**users table**:
```sql
id, email, name, password_hash, email_verified,
email_verification_token, password_reset_token,
password_reset_expires, created_at, updated_at
```

**subscriptions table**:
```sql
id, user_id, tier, status, license_key,
lemon_squeezy_order_id, lemon_squeezy_subscription_id,
start_date, expires_at, auto_renew, scans_used,
scans_limit, created_at, updated_at
```

---

## Setup Instructions

### 1. Chrome Extension Setup

No changes needed - extension is ready to use. Just ensure:
- `API_BASE_URL` in `src/auth.js` points to your backend
- `API_BASE_URL` in `src/subscription.js` matches

### 2. Backend Setup

**a) Install Dependencies**:
```bash
npm init -y
npm install express cors bcrypt jsonwebtoken mysql2 dotenv
npm install --save-dev nodemon
```

**b) Create `.env` file**:
```env
PORT=3000
DATABASE_URL=mysql://user:pass@host:3306/db
JWT_SECRET=your-secret-key
LEMONSQUEEZY_API_KEY=your-api-key
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret
CORS_ORIGIN=chrome-extension://your-extension-id
```

**c) Create Database**:
```bash
mysql -u root -p
CREATE DATABASE mta_production;
USE mta_production;
# Run schema from BACKEND-API-SPEC.md
```

**d) Start Server**:
```bash
npm run dev
```

### 3. Lemon Squeezy Setup

1. Create account at lemonsqueezy.com
2. Create products for each tier (Starter, Pro, Pro Plus, Agency)
3. Enable license keys for all products
4. Configure webhook to `https://api.useshield.net/api/webhooks/lemonsqueezy`
5. Copy webhook secret to `.env`
6. Update variant IDs in `src/types.js`

---

## Testing

### Manual Testing Flow

**1. Registration**:
```
1. Open extension
2. Should redirect to login.html
3. Click "Create Account"
4. Fill form with valid data
5. Submit
6. Verify redirect to popup.html
7. Check chrome.storage.local has token and user
```

**2. Login**:
```
1. Logout from popup
2. Enter valid credentials
3. Verify redirect to popup
4. Check user info appears in header
```

**3. Purchase**:
```
1. Click subscription link
2. Select a plan
3. Verify checkout opens
4. Complete payment (use Lemon Squeezy test mode)
5. Verify subscription activates automatically
6. Check tier updated in popup
```

### Automated Testing

Create tests for:
- Auth module functions
- Subscription module functions
- API endpoint responses
- Database operations
- Webhook handling

---

## Security Considerations

1. **Password Hashing**: Use bcrypt with 10+ rounds
2. **JWT Tokens**: 7-day expiration, secure secret
3. **CORS**: Whitelist only extension ID
4. **Rate Limiting**: Prevent brute force attacks
5. **Input Validation**: Sanitize all user inputs
6. **HTTPS Only**: Enforce TLS for all API calls
7. **Token Storage**: chrome.storage.local (encrypted by Chrome)

---

## Troubleshooting

### "Unauthorized" Errors
- Check JWT token exists in chrome.storage.local
- Verify token hasn't expired
- Ensure backend CORS allows extension origin

### Subscription Not Activating
- Check Lemon Squeezy webhook is configured
- Verify webhook secret matches
- Check backend logs for webhook errors
- Ensure license key is valid

### Login Redirects to Login Page
- Clear chrome.storage.local and try again
- Check `isAuthenticated()` logic
- Verify token validation on backend

---

## Deployment Checklist

- [ ] Backend deployed to production server
- [ ] Database created with schema
- [ ] Environment variables configured
- [ ] Lemon Squeezy products created
- [ ] Webhook configured and tested
- [ ] CORS origin set to extension ID
- [ ] SSL/TLS certificate installed
- [ ] Rate limiting enabled
- [ ] Logging configured
- [ ] Error monitoring set up (Sentry, etc.)
- [ ] Backup system configured
- [ ] Extension manifest updated with production URLs

---

## Support

For issues or questions:
- Email: support@useshield.net
- Docs: https://docs.useshield.net
- GitHub: https://github.com/useshield/money-trap-analyzer

---

**Last Updated**: January 2024
