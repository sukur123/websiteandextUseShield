# 🚀 Supabase Edge Function Deployment Guide

## Overview

This guide explains how to deploy the `analyze-tos` Edge Function to Supabase. This function:
- **Keeps OpenAI API key secure** (server-side only, never exposed to client)
- **Enforces authentication** (requires valid user session)
- **Tracks usage limits** (automatically increments scan counter)
- **Handles rate limiting** (manages OpenAI 429 errors)

## Prerequisites

1. **Supabase Account** with project created
2. **OpenAI API Key** (get from https://platform.openai.com/api-keys)
3. **Supabase CLI** installed globally
4. **Database schema** already deployed (SUPABASE-SCHEMA.sql)

---

## Step 1: Install Supabase CLI

```bash
# Install globally
npm install -g supabase

# Verify installation
supabase --version
```

---

## Step 2: Login to Supabase

```bash
# Login (will open browser)
supabase login

# This creates a session token for deployments
```

---

## Step 3: Link Your Project

```bash
# Navigate to extension directory
cd /home/sukur/Desktop/aiadvice/money-trap-analyzer-extension/chrome-extension

# Link to your Supabase project
supabase link --project-ref fmptjjpwndojeywyacum

# You'll be prompted for the database password
# Use the password you set when creating the project
```

---

## Step 4: Set Up Edge Function Directory

```bash
# Create Supabase functions directory structure
mkdir -p supabase/functions/analyze-tos

# Copy the Edge Function code
cp supabase-edge-function.ts supabase/functions/analyze-tos/index.ts
```

---

## Step 5: Store OpenAI API Key in Database

**Option A: Using Supabase Dashboard**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Run `SUPABASE-API-KEYS.sql` (paste contents and click Run)
5. Then update the API key:

```sql
-- Replace 'your-openai-api-key-here' with actual key
UPDATE private.api_keys
SET api_key = 'sk-proj-...'  -- Your actual OpenAI API key
WHERE service = 'openai' AND key_name = 'default';
```

**Option B: Using psql CLI**

```bash
# Get connection string from Supabase Dashboard → Settings → Database
psql "postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Then run SQL commands
\i SUPABASE-API-KEYS.sql
UPDATE private.api_keys SET api_key = 'sk-proj-...' WHERE service = 'openai';
```

---

## Step 6: Deploy Edge Function

```bash
# Deploy the function
supabase functions deploy analyze-tos

# You should see output like:
# ✓ Deployed Function analyze-tos
# URL: https://fmptjjpwndojeywyacum.supabase.co/functions/v1/analyze-tos
```

---

## Step 7: Verify Deployment

**Test with curl:**

```bash
# First, get a valid user session token
# (You can get this from chrome.storage.local after logging in)

curl -X POST https://fmptjjpwndojeywyacum.supabase.co/functions/v1/analyze-tos \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/terms",
    "text": "Terms of Service test text...",
    "title": "Test Terms"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "findings": [...],
    "riskScore": 45,
    "whatItMeans": "...",
    "whatToDo": "...",
    "analyzed_at": "2026-01-06T...",
    "scans_used": 1,
    "scans_limit": 3
  }
}
```

---

## Step 8: Monitor Function Logs

```bash
# View real-time logs
supabase functions logs analyze-tos --follow

# Or view in dashboard:
# Functions → analyze-tos → Logs
```

---

## Troubleshooting

### Error: "Failed to retrieve API key"

**Cause:** API key not stored in database or function can't access it.

**Fix:**
```sql
-- Verify API key exists
SELECT * FROM private.api_keys WHERE service = 'openai';

-- If empty, insert:
INSERT INTO private.api_keys (service, key_name, api_key)
VALUES ('openai', 'default', 'sk-proj-...');

-- Verify function has permissions
GRANT EXECUTE ON FUNCTION private.get_api_key TO service_role;
```

### Error: "Unauthorized"

**Cause:** Invalid or expired session token.

**Fix:** User needs to log in again. Session tokens expire after ~1 hour.

### Error: "No active subscription found"

**Cause:** User doesn't have a subscription record.

**Fix:**
```sql
-- Manually create free subscription for testing
INSERT INTO public.subscriptions (user_id, tier, status, scans_limit)
VALUES ('user-uuid-here', 'free', 'active', 3);
```

### Error: "Usage limit reached"

**Cause:** User exceeded their scan limit.

**Fix:**
```sql
-- Reset usage counter for testing
UPDATE public.subscriptions
SET scans_used = 0
WHERE user_id = 'user-uuid-here';
```

---

## Security Notes

✅ **What's Secure:**
- OpenAI API key stored in `private` schema (not accessible via REST API)
- Edge Function uses Service Role key (full database access)
- Client only sends session token (no API keys)
- Usage limits enforced server-side

❌ **What's NOT Secure:**
- Storing API key in chrome.storage.local (NEVER DO THIS)
- Hardcoding API key in client-side code
- Exposing Service Role key to client

---

## Cost Optimization

**Edge Function Pricing:**
- Free tier: 500,000 invocations/month
- After that: $2 per 1M invocations

**OpenAI API Costs (GPT-4o-mini):**
- Input: $0.150 per 1M tokens (~$0.00015 per 1K tokens)
- Output: $0.600 per 1M tokens (~$0.0006 per 1K tokens)
- Average ToS analysis: ~3K input + 1K output = **~$0.0011 per scan**

**For 1000 monthly scans:**
- Edge Function: FREE (under 500K limit)
- OpenAI: ~$1.10
- **Total: ~$1.10/month**

---

## Updating the Function

```bash
# Edit the function
nano supabase/functions/analyze-tos/index.ts

# Redeploy
supabase functions deploy analyze-tos

# Changes are live immediately
```

---

## Next Steps

1. ✅ Deploy Edge Function
2. ✅ Store OpenAI API key in database
3. ✅ Test with curl
4. ✅ Verify usage counter increments
5. ✅ Test authentication flow in extension
6. ✅ Monitor logs for errors

---

## Support

If you encounter issues:
1. Check function logs: `supabase functions logs analyze-tos`
2. Verify database schema: All tables/functions created
3. Check API key: `SELECT * FROM private.api_keys`
4. Test authentication: Try logging in/out
5. Check Supabase Dashboard → Functions → Logs

For more help: https://supabase.com/docs/guides/functions
