# Supabase Setup Guide for Money Trap Analyzer

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub
4. Click "New project"
5. Fill in:
   - **Name**: `money-trap-analyzer` (or your choice)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine to start
6. Click "Create new project"
7. Wait ~2 minutes for project to initialize

## Step 2: Get API Keys

### Navigate to Project Settings
1. Click the **Settings** icon (gear) in left sidebar
2. Click **API** in the settings menu

### Copy These Values:

#### 1. Project URL
```
https://your-project-id.supabase.co
```
**Example:** `https://abcdefghijklmnop.supabase.co`

#### 2. Anon/Public Key (anon key)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...
```
This is safe to use in your extension (public-facing).

#### 3. Service Role Key (OPTIONAL - only for backend/webhooks)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...
```
⚠️ **Never** expose this in your extension! Only use in secure backend.

## Step 3: Configure Authentication

### Enable Email Auth
1. Go to **Authentication** in left sidebar
2. Click **Providers** tab
3. Find **Email** provider
4. Toggle it **ON**
5. Configure:
   - ✅ Enable email provider
   - ✅ Confirm email (recommended)
   - ✅ Secure email change
   - Email templates: Use defaults or customize

### Set Site URL (Important!)
1. Still in **Authentication** settings
2. Scroll to **Site URL**
3. Add your extension ID:
   ```
   chrome-extension://YOUR_EXTENSION_ID
   ```
   
   **How to find your extension ID:**
   - Load unpacked extension in Chrome
   - Go to `chrome://extensions`
   - Find "Money Trap Analyzer"
   - Copy the ID (e.g., `abcdefghijklmnopqrstuvwxyz`)
   
4. Add redirect URLs (optional):
   ```
   chrome-extension://YOUR_EXTENSION_ID/popup.html
   chrome-extension://YOUR_EXTENSION_ID/*
   ```

### Email Templates (Optional)
1. Click **Email Templates** tab
2. Customize:
   - **Confirm signup**: Welcome email with verification link
   - **Invite user**: For team invitations
   - **Magic link**: For passwordless login
   - **Change email address**: Confirmation for email changes
   - **Reset password**: Password reset instructions

## Step 4: Run Database Schema

1. Go to **SQL Editor** in left sidebar
2. Click **New query**
3. Copy and paste the entire contents of `SUPABASE-SCHEMA.sql`
4. Click **Run** (or press Ctrl+Enter)
5. Verify success: Should see "Success. No rows returned"

### Verify Tables Created
1. Go to **Table Editor** in left sidebar
2. You should see:
   - ✅ `subscriptions` table
   - ✅ `usage_tracking` table

### Check RLS Policies
1. Click on `subscriptions` table
2. Click **Policies** tab at top
3. You should see:
   - Users can view own subscription
   - Users can update own subscription
   - System can insert subscriptions

## Step 5: Update Extension Configuration

Open `/chrome-extension/src/auth.js` and update:

```javascript
// Line 8-9
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

Replace with your actual values from Step 2.

## Step 6: Update Subscription Module

Open `/chrome-extension/src/subscription.js` and verify it has the same config:

```javascript
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

## Step 7: Test Authentication

### Test User Registration
1. Load extension in Chrome
2. Open popup → Should see login form
3. Click "Create Account"
4. Fill in:
   - Name: Test User
   - Email: test@example.com
   - Password: testpass123
5. Click "Create Account"
6. Check your email for verification link
7. Click verification link

### Test Login
1. Enter email and password
2. Click "Sign In"
3. Should see main app view

### Verify in Supabase
1. Go to **Authentication** → **Users** in Supabase
2. You should see your test user listed
3. Check email confirmation status

### Check Database
1. Go to **Table Editor** → `subscriptions`
2. You should see:
   - One row with your user_id
   - tier: 'free'
   - scans_limit: 3
   - scans_used: 0

## Step 8: Test Database Functions

### Test in SQL Editor:

#### Check Subscription
```sql
SELECT * FROM public.subscriptions 
WHERE user_id = 'your-user-uuid';
```

#### Increment Usage (simulates an analysis)
```sql
SELECT public.increment_scan_usage(
  'your-user-uuid'::uuid,
  'https://netflix.com/terms',
  75
);
```

Should return:
```json
{
  "success": true,
  "scans_used": 1,
  "scans_limit": 3
}
```

#### Check Usage Tracking
```sql
SELECT * FROM public.usage_tracking 
WHERE user_id = 'your-user-uuid';
```

#### Upgrade Subscription (test)
```sql
SELECT public.upgrade_subscription(
  'your-user-uuid'::uuid,
  'pro',
  'TEST-LICENSE-KEY',
  'test-payment-id'
);
```

Check:
```sql
SELECT tier, scans_limit, scans_used 
FROM public.subscriptions 
WHERE user_id = 'your-user-uuid';
```

Should show:
- tier: 'pro'
- scans_limit: 80
- scans_used: 0 (reset on upgrade)

## Step 9: Configure Usage Reset (Optional)

### Option A: Manual Reset (SQL Editor)
Run weekly for free tier:
```sql
SELECT public.reset_weekly_usage();
```

Run monthly for paid tiers:
```sql
SELECT public.reset_monthly_usage();
```

### Option B: Scheduled Cron (Pro Plan Only)
If you have Supabase Pro, enable pg_cron:

1. Go to **Database** → **Extensions**
2. Enable `pg_cron`
3. Run in SQL Editor:

```sql
-- Reset free tier every Monday at midnight UTC
SELECT cron.schedule(
  'reset-weekly-usage',
  '0 0 * * 1',
  'SELECT public.reset_weekly_usage()'
);

-- Reset paid tier on 1st of month at midnight UTC
SELECT cron.schedule(
  'reset-monthly-usage',
  '0 0 1 * *',
  'SELECT public.reset_monthly_usage()'
);
```

### Option C: Edge Function with Cron (Free Tier Compatible)
Create Edge Function and use Supabase Cron trigger.

## Step 10: Security Checklist

✅ **Email confirmation enabled** (prevents fake signups)  
✅ **RLS policies active** (users can only see own data)  
✅ **Service role key NOT in extension code** (keep it secret)  
✅ **Anon key in extension code** (this is safe, it's public-facing)  
✅ **Site URL configured with extension ID**  
✅ **Password strength enforced** (min 8 chars in extension)

## Troubleshooting

### "Invalid API key"
- Double-check SUPABASE_URL and SUPABASE_ANON_KEY
- Make sure no extra spaces or quotes
- Verify project is fully initialized (wait 2 minutes after creation)

### "Email not confirmed"
- Check spam folder for verification email
- Resend verification from Authentication → Users → Click user → Resend email
- Or disable "Confirm email" in Authentication → Providers → Email

### "Row level security policy violation"
- Check that RLS policies are created (Step 4)
- Verify user is authenticated before querying database
- Check that `auth.uid()` matches the user_id in the policy

### "Function not found"
- Verify SQL schema ran successfully
- Check Database → Functions to see if they're listed
- Re-run SUPABASE-SCHEMA.sql if needed

### Extension won't load
- Check manifest.json for syntax errors
- Reload extension in chrome://extensions
- Check browser console for CSP errors
- Make sure auth.js and subscription.js have correct URLs

## Next Steps

1. **Test the full flow:**
   - Register → Login → Analyze page → Check usage counter
   
2. **Integrate payment provider:**
   - Set up Stripe/Paddle/LemonSqueezy
   - Create webhook to call `upgrade_subscription()`
   - Update paywall view with real checkout buttons

3. **Monitor usage:**
   - Go to Database → Table Editor → usage_tracking
   - Watch real-time as users analyze pages

4. **Set up backups:**
   - Database → Backups (Pro plan)
   - Or use `pg_dump` manually

## Reference

**Supabase Docs:**
- Auth: https://supabase.com/docs/guides/auth
- Database: https://supabase.com/docs/guides/database
- RLS: https://supabase.com/docs/guides/auth/row-level-security
- Edge Functions: https://supabase.com/docs/guides/functions

**Your Project Dashboard:**
- URL: https://app.supabase.com/project/YOUR_PROJECT_ID
- API Docs: https://app.supabase.com/project/YOUR_PROJECT_ID/api
- Database: https://app.supabase.com/project/YOUR_PROJECT_ID/editor
- Auth: https://app.supabase.com/project/YOUR_PROJECT_ID/auth/users

---

**Created:** January 2026  
**Extension:** Money Trap Analyzer (UseShield)  
**Stack:** Chrome Extension MV3 + Supabase
