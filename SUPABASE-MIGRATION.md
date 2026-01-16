# Supabase Migration Complete ✅

## What Changed

Successfully migrated from custom Express.js backend to **Supabase** (Backend-as-a-Service):

### Files Replaced
- ✅ `src/auth.js` → **Supabase auth** (old version backed up as `src/auth-old.js`)
- ✅ `src/subscription.js` → **Supabase database** (old version backed up as `src/subscription-old.js`)
- ✅ `manifest.json` → Added Supabase permissions

### New System Features
- **Authentication**: Email/password with automatic email verification
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Session Management**: Automatic JWT token handling
- **No Backend Server**: Everything handled by Supabase
- **Secure**: RLS policies ensure users only see their own data

---

## Next Steps for User

### 1. Create Supabase Project (5 minutes)

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" → Sign in with GitHub
3. Create new organization (or use existing)
4. Create new project:
   - **Name**: `money-trap-analyzer` (or your choice)
   - **Database Password**: Save this securely!
   - **Region**: Choose closest to your users
   - **Plan**: Free tier (can upgrade later)

### 2. Get Supabase Credentials

After project creation (2-3 minutes):

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon/Public Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 3. Update Extension Code

Open `chrome-extension/src/auth.js` and replace placeholders (lines 8-9):

```javascript
const SUPABASE_URL = 'https://your-project-id.supabase.co'; // Replace with YOUR URL
const SUPABASE_ANON_KEY = 'your-anon-key-here'; // Replace with YOUR KEY
```

**Example:**
```javascript
const SUPABASE_URL = 'https://abcdefghijklmnop.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjk4MTkyMSwiZXhwIjoxOTMyNTU3OTIxfQ.qF6jcR-OxW4J3Qlqg_MNZ7Y8FhVq2aK8wZ9rGm3kJ8g';
```

### 4. Set Up Database Schema

Follow the complete guide in **`SUPABASE-SETUP.md`** (Step 3):

1. Go to Supabase dashboard → **SQL Editor**
2. Copy SQL from `SUPABASE-SETUP.md` (lines 80-180)
3. Run to create:
   - `subscriptions` table
   - `usage_tracking` table
   - Row Level Security policies
   - Helper functions

**Quick Schema Summary:**
```sql
-- subscriptions table: tier, status, scans_used, scans_limit, expires_at
-- usage_tracking table: user_id, url, risk_score, analysis_date
-- RLS policies: Users can only see/modify their own data
-- Functions: upsert_subscription(), increment_scan_usage()
```

### 5. Configure Authentication

In Supabase dashboard:

1. **Authentication** → **Providers** → Enable **Email**
2. **URL Configuration**:
   - **Site URL**: `chrome-extension://YOUR_EXTENSION_ID`
   - **Redirect URLs**: Add `chrome-extension://YOUR_EXTENSION_ID/*`
3. **Email Templates**: Customize confirmation email (optional)

**To find Extension ID:**
```
1. Load extension in Chrome (Developer mode)
2. Copy ID from chrome://extensions page
3. Example: chrome-extension://abcdefghijklmnopqrstuvwxyz
```

### 6. Test the Extension

1. **Load Extension:**
   ```bash
   Chrome → chrome://extensions → Developer mode ON → Load unpacked
   Select: /path/to/money-trap-analyzer-extension/chrome-extension/
   ```

2. **Test Registration:**
   - Click extension icon → Redirects to login
   - Click "Create account" → Fill form
   - Check email for verification link
   - Verify email → Login

3. **Test Analysis:**
   - Navigate to any Terms of Service page
   - Click extension icon → "Analyze Page"
   - Should increment scan counter
   - Check Supabase → `usage_tracking` table

4. **Verify Database:**
   - Supabase → **Table Editor** → `subscriptions`
   - Should see your user with `free` tier
   - `scans_used` should increment after each analysis

---

## Architecture Overview

### Authentication Flow
```
User Registration → Supabase Auth → Email Verification → Login
         ↓
Extension stores: { user: { id, email, name, emailVerified } }
         ↓
Supabase manages: JWT token, session, password hashing
```

### Analysis Flow
```
User clicks "Analyze" → Check canAnalyze() → Supabase query
         ↓
Usage limit check → recordAnalysis() → Supabase RPC
         ↓
Increment scans_used → Update chrome.storage.local
```

### Subscription Management
```
User upgrades → upgradeSubscription(tier, licenseKey) → Supabase upsert
         ↓
Update: tier, scans_limit, expires_at, status
         ↓
Sync to local storage
```

---

## Key Functions Reference

### Authentication (`src/auth.js`)
- `register(email, password, name)` - Create account
- `login(email, password)` - Sign in
- `logout()` - Sign out
- `isAuthenticated()` - Check login status
- `getCurrentUser()` - Get user object
- `resendVerificationEmail()` - Resend email
- `requestPasswordReset(email)` - Reset password
- `updateProfile(name, email)` - Update user info
- `changePassword(oldPassword, newPassword)` - Change password

### Subscription (`src/subscription.js`)
- `getSubscription()` - Get current subscription
- `canAnalyze()` - Check if user can analyze (usage limits)
- `recordAnalysis(url, riskScore)` - Increment usage counter
- `upgradeSubscription(tier, licenseKey, paymentId)` - Upgrade tier
- `cancelSubscription()` - Cancel subscription
- `syncSubscription()` - Refresh from Supabase
- `getUsageStats(days)` - Get usage statistics

---

## Tier Configuration

| Tier       | Scans Limit | Price  | Period |
|------------|-------------|--------|--------|
| Free       | 3           | $0     | week   |
| Starter    | 15          | $9.99  | month  |
| Pro        | 80          | $29    | month  |
| Pro Plus   | 200         | $60    | month  |
| Agency     | 300         | $100   | month  |

**Note**: Payment integration pending - Lemon Squeezy "not worked", need alternative.

---

## Payment Integration (TODO)

Current status: **Payment provider needed**

Options:
1. **Stripe** - Most popular, Chrome extension compatible
2. **Paddle** - Handles VAT/taxes automatically
3. **Lemon Squeezy** - Previously attempted (reported not working)
4. **Gumroad** - Simple, creator-friendly

**Integration Steps (when decided):**
1. Set up payment provider account
2. Create products for each tier
3. Get checkout URLs or API keys
4. Update `subscription.html` with checkout buttons
5. Handle webhooks → Supabase function to activate subscription
6. Call `upgradeSubscription()` with license key from webhook

---

## Troubleshooting

### "Network error" on login/register
- **Check**: Supabase credentials in `src/auth.js`
- **Check**: Internet connection
- **Check**: Supabase project status (dashboard)

### Email verification not received
- **Check**: Spam folder
- **Check**: Supabase → Authentication → Email Templates enabled
- **Use**: `resendVerificationEmail()` function

### "Usage limit reached" but counter shows 0
- **Check**: Supabase → `subscriptions` table → `scans_used` value
- **Fix**: Run `resetUsageCounter()` or manually update database

### RLS policy errors
- **Check**: Policies enabled (see `SUPABASE-SETUP.md` Step 4)
- **Test**: Supabase → SQL Editor → Run `SELECT * FROM subscriptions;`
- **Fix**: Re-run RLS policy SQL from setup guide

### Extension not loading
- **Check**: manifest.json syntax (JSON validator)
- **Check**: Chrome → chrome://extensions → Errors section
- **Check**: Service worker console (Inspect views)

---

## Security Notes

✅ **Implemented:**
- Row Level Security (RLS) - users can't see each other's data
- Supabase Auth - passwords hashed with bcrypt
- JWT tokens - signed and verified by Supabase
- HTTPS only - all Supabase communication encrypted
- Chrome storage - minimal data stored locally

⚠️ **Important:**
- **NEVER commit Supabase keys to git** (already in .gitignore)
- **Use environment variables** for production builds
- **Enable 2FA** on Supabase account
- **Monitor** Supabase logs for suspicious activity

---

## Production Checklist

Before publishing extension:

- [ ] Replace Supabase credentials (auth.js lines 8-9)
- [ ] Test all authentication flows
- [ ] Test subscription upgrade/downgrade
- [ ] Verify RLS policies working
- [ ] Set up payment provider
- [ ] Configure webhook for payment activation
- [ ] Test email verification
- [ ] Enable Supabase production mode
- [ ] Set up monitoring/alerts
- [ ] Review Supabase usage limits (free tier)
- [ ] Consider upgrading Supabase plan if needed

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Discord**: https://discord.supabase.com
- **Chrome Extension Docs**: https://developer.chrome.com/docs/extensions/
- **This Project Guide**: See `SUPABASE-SETUP.md` for detailed setup

---

## File Structure Reference

```
chrome-extension/
├── src/
│   ├── auth.js              ← NEW Supabase auth (ACTIVE)
│   ├── auth-old.js          ← Old backend auth (BACKUP)
│   ├── subscription.js      ← NEW Supabase subscriptions (ACTIVE)
│   ├── subscription-old.js  ← Old backend subscriptions (BACKUP)
│   ├── background.js        ← Service worker
│   ├── content.js           ← Content script
│   └── ...
├── login.html               ← Login page (ready to use)
├── register.html            ← Register page (ready to use)
├── subscription.html        ← Subscription management
├── manifest.json            ← Updated with Supabase permissions
├── SUPABASE-SETUP.md        ← Complete setup guide (read this!)
└── SUPABASE-MIGRATION.md    ← This file
```

---

**Status**: ✅ Migration Complete - Ready for Supabase setup
**Next Action**: Follow "Next Steps for User" section above
