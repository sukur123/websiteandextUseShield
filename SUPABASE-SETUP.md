# Supabase Setup Guide for Money Trap Analyzer

This guide will walk you through setting up Supabase for authentication and database for the Money Trap Analyzer Chrome Extension.

---

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "New Project"
3. Sign in with GitHub (recommended) or email
4. Create a new organization (if first time)
5. Click "New Project"
6. Fill in details:
   - **Project name**: `money-trap-analyzer`
   - **Database Password**: (generate strong password - save it!)
   - **Region**: Select closest to your users
   - **Pricing Plan**: Free tier is fine to start
7. Click "Create new project"
8. Wait 2-3 minutes for setup to complete

---

## Step 2: Get Supabase Credentials

Once your project is created:

1. Go to **Project Settings** (gear icon in sidebar)
2. Click **API** in the left menu
3. You'll see:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbG...` (long string)

**Copy both** - you'll need them in Step 4!

---

## Step 3: Configure Authentication

### Enable Email Authentication

1. Go to **Authentication** → **Providers** in Supabase dashboard
2. **Email** should already be enabled
3. Configure settings:
   - ✅ **Enable email provider**
   - ✅ **Confirm email**: ON (users must verify email)
   - **Email templates**: Keep defaults or customize

### Configure Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Customize templates:
   - **Confirm signup**: Email sent when user registers
   - **Reset password**: Email sent for password reset
   - **Change email**: Email sent when changing email

### Site URL Configuration

1. Go to **Authentication** → **URL Configuration**
2. Add your extension URL:
   - **Site URL**: `chrome-extension://your-extension-id`
   - **Redirect URLs**: Add:
     ```
     chrome-extension://your-extension-id/popup.html
     chrome-extension://your-extension-id/register.html
     chrome-extension://your-extension-id/login.html
     chrome-extension://your-extension-id/reset-password.html
     ```

**Note**: Get your extension ID from `chrome://extensions` after loading the extension.

---

## Step 4: Create Database Schema

### Create Subscriptions Table

1. Go to **Table Editor** in Supabase dashboard
2. Click **New table**
3. Configure table:
   - **Name**: `subscriptions`
   - **Enable Row Level Security**: ✅ ON
   
4. Add columns:

| Column Name | Type | Default | Options |
|------------|------|---------|---------|
| `id` | uuid | `uuid_generate_v4()` | Primary key |
| `created_at` | timestamp | `now()` | |
| `user_id` | uuid | | Foreign key → auth.users |
| `tier` | text | `'free'` | |
| `status` | text | `'active'` | |
| `license_key` | text | | Unique, nullable |
| `payment_id` | text | | Nullable |
| `start_date` | timestamp | `now()` | |
| `expires_at` | timestamp | | |
| `scans_used` | int4 | `0` | |
| `scans_limit` | int4 | `3` | |
| `auto_renew` | boolean | `true` | |

5. Click **Save**

### SQL Alternative (Faster)

Go to **SQL Editor** and run this:

```sql
-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  license_key TEXT UNIQUE,
  payment_id TEXT,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  scans_used INTEGER DEFAULT 0,
  scans_limit INTEGER DEFAULT 3,
  auto_renew BOOLEAN DEFAULT true
);

-- Create index for faster queries
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_license_key ON public.subscriptions(license_key);

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
CREATE POLICY "Users can update own subscription"
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);
```

### Create Usage Tracking Table

```sql
-- Create usage tracking table
CREATE TABLE public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  risk_score INTEGER,
  analysis_date TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index
CREATE INDEX idx_usage_user_id ON public.usage_tracking(user_id);
CREATE INDEX idx_usage_date ON public.usage_tracking(analysis_date);

-- Enable RLS
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can view own usage"
  ON public.usage_tracking
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON public.usage_tracking
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

## Step 5: Update Extension Code

### 1. Replace auth.js

Rename current `src/auth.js` to `src/auth-old.js` (backup), then:

```bash
mv chrome-extension/src/auth-supabase.js chrome-extension/src/auth.js
```

### 2. Update Supabase Credentials

Edit `chrome-extension/src/auth.js`:

```javascript
// Line 8-9: Replace with your credentials
const SUPABASE_URL = 'https://your-project.supabase.co'; // From Step 2
const SUPABASE_ANON_KEY = 'your-anon-key-here'; // From Step 2
```

### 3. Update manifest.json

Add Supabase to allowed hosts:

```json
{
  "host_permissions": [
    "https://*.supabase.co/*",
    "https://esm.sh/*"
  ]
}
```

---

## Step 6: Test Authentication

### 1. Load Extension

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `chrome-extension/` folder
5. Copy the **Extension ID** (looks like: `abcdefghijklmnop`)

### 2. Update Supabase Site URL

Go back to Supabase → Authentication → URL Configuration:
- Replace `chrome-extension://your-extension-id` with your actual ID

### 3. Test Registration

1. Click extension icon
2. Should redirect to login page
3. Click "Create Account"
4. Fill in:
   - Name: Test User
   - Email: test@example.com (use real email to test verification)
   - Password: testpass123
5. Click "Create Account"
6. Should see success message
7. Check email for verification link

### 4. Verify in Supabase Dashboard

1. Go to **Authentication** → **Users**
2. You should see your test user
3. Email confirmed status shows if verified

### 5. Test Login

1. Use verified email to login
2. Should redirect to popup
3. User info should appear in header

---

## Step 7: Create Subscription Management Functions

### Create Supabase Edge Function (Optional)

For handling subscriptions programmatically:

```sql
-- Function to create/update subscription
CREATE OR REPLACE FUNCTION public.upsert_subscription(
  p_user_id UUID,
  p_tier TEXT,
  p_license_key TEXT DEFAULT NULL,
  p_payment_id TEXT DEFAULT NULL
)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription public.subscriptions;
  v_scans_limit INTEGER;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Set scans limit based on tier
  v_scans_limit := CASE p_tier
    WHEN 'free' THEN 3
    WHEN 'starter' THEN 15
    WHEN 'pro' THEN 80
    WHEN 'pro_plus' THEN 200
    WHEN 'agency' THEN 300
    ELSE 3
  END;
  
  -- Set expiry date (30 days from now)
  v_expires_at := now() + INTERVAL '30 days';
  
  -- Upsert subscription
  INSERT INTO public.subscriptions (
    user_id,
    tier,
    license_key,
    payment_id,
    expires_at,
    scans_limit,
    status
  )
  VALUES (
    p_user_id,
    p_tier,
    p_license_key,
    p_payment_id,
    v_expires_at,
    v_scans_limit,
    'active'
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    tier = EXCLUDED.tier,
    license_key = EXCLUDED.license_key,
    payment_id = EXCLUDED.payment_id,
    expires_at = EXCLUDED.expires_at,
    scans_limit = EXCLUDED.scans_limit,
    updated_at = now()
  RETURNING * INTO v_subscription;
  
  RETURN v_subscription;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.upsert_subscription TO authenticated;
```

### Function to Track Usage

```sql
-- Function to increment scan count
CREATE OR REPLACE FUNCTION public.increment_scan_usage(
  p_user_id UUID,
  p_url TEXT,
  p_risk_score INTEGER DEFAULT NULL
)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription public.subscriptions;
BEGIN
  -- Increment scans_used
  UPDATE public.subscriptions
  SET scans_used = scans_used + 1,
      updated_at = now()
  WHERE user_id = p_user_id
  AND status = 'active'
  RETURNING * INTO v_subscription;
  
  -- Track usage
  INSERT INTO public.usage_tracking (user_id, url, risk_score)
  VALUES (p_user_id, p_url, p_risk_score);
  
  RETURN v_subscription;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_scan_usage TO authenticated;
```

---

## Step 8: Using Subscriptions in Extension

### Check User's Subscription

```javascript
import { getSupabase } from './src/auth.js';

async function getUserSubscription() {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single();
  
  if (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }
  
  return data;
}
```

### Check Usage Limit

```javascript
async function canAnalyze() {
  const subscription = await getUserSubscription();
  
  if (!subscription) {
    // No subscription found - create free tier
    await createFreeSubscription();
    return true; // Allow first scans
  }
  
  // Check if limit reached
  if (subscription.scans_used >= subscription.scans_limit) {
    return false; // Show upgrade prompt
  }
  
  // Check if expired
  if (new Date(subscription.expires_at) < new Date()) {
    return false; // Show renewal prompt
  }
  
  return true;
}
```

### Increment Usage

```javascript
async function recordAnalysis(url, riskScore) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return;
  
  // Call the increment function
  const { data, error } = await supabase.rpc('increment_scan_usage', {
    p_user_id: user.id,
    p_url: url,
    p_risk_score: riskScore
  });
  
  if (error) {
    console.error('Error recording usage:', error);
  }
  
  return data;
}
```

---

## Troubleshooting

### "Invalid API key" Error
- Check that you copied the **anon public** key (not service role key)
- Verify URL format: `https://xxxxx.supabase.co` (no trailing slash)

### Email Not Sending
- Check Authentication → Email Templates
- Verify SMTP settings (Supabase uses built-in SMTP on free tier)
- Check spam folder

### "Row Level Security" Errors
- Make sure RLS policies are created (Step 4)
- Verify user is authenticated before database queries

### Session Not Persisting
- Supabase sessions last 1 hour by default
- Extension should call `supabase.auth.getSession()` on startup
- Refresh token is handled automatically

---

## Production Checklist

- [ ] Created Supabase project
- [ ] Got URL and anon key
- [ ] Updated auth.js with credentials
- [ ] Created subscriptions table
- [ ] Created usage_tracking table
- [ ] Set up RLS policies
- [ ] Configured Site URLs in Supabase
- [ ] Added Supabase to manifest.json permissions
- [ ] Tested registration flow
- [ ] Tested login flow
- [ ] Tested email verification
- [ ] Created subscription functions
- [ ] Integrated subscription checks

---

## Next Steps

1. **Remove old backend code**: Delete `src/subscription.js` old version
2. **Update subscription.js**: Create new version using Supabase
3. **Payment integration**: Set up payment provider (Stripe/Paddle) with webhooks to Supabase
4. **Usage tracking**: Implement scan counting in background.js

---

**Resources**:
- Supabase Docs: https://supabase.com/docs
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase JavaScript Client: https://supabase.com/docs/reference/javascript

**Your Supabase project is ready!** 🎉
