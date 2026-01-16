# 🏗️ Secure API Architecture

## Overview

The extension now uses a **secure server-side architecture** where the OpenAI API key is never exposed to the client. All AI analysis happens through Supabase Edge Functions.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     CHROME EXTENSION (Client)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐        ┌──────────────┐      ┌────────────┐ │
│  │   popup.js   │───────▶│  router.js   │─────▶│  auth.js   │ │
│  │              │        │              │      │            │ │
│  │ (UI Logic)   │        │ (SPA Router) │      │ (Auth API) │ │
│  └──────────────┘        └──────────────┘      └────────────┘ │
│         │                                             │         │
│         │                                             │         │
│         ▼                                             │         │
│  ┌──────────────┐                                    │         │
│  │ background.js│◀───────────────────────────────────┘         │
│  │              │                                               │
│  │ Calls Edge   │  ✅ No API Key Stored                        │
│  │ Function     │  ✅ Only Session Token                       │
│  └──────────────┘                                               │
│         │                                                       │
└─────────┼───────────────────────────────────────────────────────┘
          │
          │ HTTPS + Auth Token
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE (Server)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Edge Function: analyze-tos                     │    │
│  │                                                        │    │
│  │  1. ✅ Verify user authentication (session token)     │    │
│  │  2. ✅ Check subscription tier & usage limits         │    │
│  │  3. ✅ Get OpenAI API key from private schema         │    │
│  │  4. ✅ Call OpenAI API (server-side)                  │    │
│  │  5. ✅ Increment usage counter                        │    │
│  │  6. ✅ Return analysis results                        │    │
│  └────────────────────────────────────────────────────────┘    │
│         │                           │                           │
│         │ Get API Key               │ Update Usage              │
│         ▼                           ▼                           │
│  ┌──────────────────┐        ┌─────────────────┐              │
│  │ private.api_keys │        │  subscriptions  │              │
│  │                  │        │                 │              │
│  │ 🔒 NOT accessible│        │  - scans_used   │              │
│  │    from client   │        │  - scans_limit  │              │
│  └──────────────────┘        └─────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
          │
          │ HTTPS + API Key (server-side only)
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OPENAI API                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GPT-4o-mini                                                    │
│  - Analyzes Terms of Service                                   │
│  - Returns JSON with findings                                  │
│  - 🔒 API key never exposed to client                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Request Flow

### Before (INSECURE ❌)

```
User → Extension → OpenAI API
         ↑
    API Key stored in
    chrome.storage.local
    (visible to user!)
```

### After (SECURE ✅)

```
User → Extension → Supabase Edge Function → OpenAI API
         ↑              ↑                        ↑
    Session Token   Service Role Key        API Key
    (temporary)     (server-only)          (server-only)
```

---

## Security Layers

### Layer 1: Client Authentication
- **What:** User must log in with email/password
- **How:** Supabase Auth generates session token (JWT)
- **Storage:** Session token in `chrome.storage.local` (encrypted by Chrome)
- **Expiry:** 1 hour (auto-refreshed)

### Layer 2: Edge Function Authorization
- **What:** Validates session token on every request
- **How:** `supabaseAdmin.auth.getUser(token)`
- **Result:** Extracts user ID, checks if valid

### Layer 3: Subscription Verification
- **What:** Checks if user has active subscription
- **How:** Query `subscriptions` table by `user_id`
- **Result:** Returns tier, usage limits, scans remaining

### Layer 4: Usage Enforcement
- **What:** Prevents over-usage
- **How:** Check `scans_used < scans_limit`
- **Result:** Return 429 error if limit exceeded

### Layer 5: API Key Isolation
- **What:** OpenAI API key stored in `private` schema
- **How:** Only Service Role can access (Edge Functions have Service Role)
- **Result:** Client code CANNOT access API key

---

## Data Flow

### 1. User Opens Extension

```javascript
// popup.js
chrome.storage.local.get(['mta_session'], (result) => {
  if (result.mta_session) {
    // User is logged in
    router.showView('main');
  } else {
    // Show login
    router.showView('auth');
  }
});
```

### 2. User Clicks "Analyze"

```javascript
// popup.js → background.js
chrome.runtime.sendMessage({
  type: 'analyze',
  payload: {
    url: 'https://example.com/terms',
    text: '...',
    title: 'Terms of Service'
  }
});
```

### 3. Background Calls Edge Function

```javascript
// background.js
const { mta_session } = await chrome.storage.local.get(['mta_session']);

const resp = await fetch(
  'https://fmptjjpwndojeywyacum.supabase.co/functions/v1/analyze-tos',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mta_session.access_token}`,  // ✅ Session token
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url, text, title, maxChars: 20000 })
  }
);
```

### 4. Edge Function Processes Request

```typescript
// Edge Function (Deno/TypeScript on Supabase)

// Verify authentication
const { data: { user } } = await supabaseAdmin.auth.getUser(token);
if (!user) throw new Error('Unauthorized');

// Check subscription
const subscription = await supabaseAdmin
  .from('subscriptions')
  .select('*')
  .eq('user_id', user.id)
  .single();

if (subscription.scans_used >= subscription.scans_limit) {
  return new Response({ error: 'Limit reached' }, { status: 429 });
}

// Get API key from private schema
const apiKey = await supabaseAdmin.rpc('get_api_key', { p_service: 'openai' });

// Call OpenAI
const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${apiKey}` },  // ✅ Server-side only
  body: JSON.stringify({ model: 'gpt-4o-mini', messages: [...] })
});

// Increment usage
await supabaseAdmin.rpc('increment_scan_usage', {
  p_user_id: user.id,
  p_url: url,
  p_risk_score: analysis.riskScore
});

// Return results
return { success: true, data: analysis };
```

### 5. Extension Displays Results

```javascript
// popup.js
const response = await chrome.runtime.sendMessage({ type: 'analyze', payload });

if (response.ok) {
  displayAnalysis(response.data);
  updateUsageCounter(response.data.scans_used, response.data.scans_limit);
}
```

---

## Key Differences

| Aspect | Old Architecture ❌ | New Architecture ✅ |
|--------|-------------------|-------------------|
| **API Key Location** | chrome.storage.local | Supabase private schema |
| **API Key Visibility** | User can see it | Never exposed to client |
| **Authentication** | Optional | Required (session token) |
| **Usage Tracking** | Client-side (unreliable) | Server-side (atomic) |
| **Rate Limiting** | Client-side | Server-side |
| **Security** | Low (key exposed) | High (zero-trust) |
| **Cost Control** | User can abuse | Server enforces limits |

---

## Benefits

### 🔒 Security
- **Zero API key exposure**: Client never sees the key
- **Server-side validation**: All checks done server-side
- **Tamper-proof**: User can't modify limits in DevTools

### 💰 Cost Control
- **Usage limits enforced**: Server rejects over-usage
- **Atomic counters**: Database RPC ensures accuracy
- **Audit trail**: Every scan logged in `usage_tracking` table

### 📊 Analytics
- **Track usage patterns**: See which URLs analyzed most
- **Monitor abuse**: Detect suspicious activity
- **Optimize pricing**: Data-driven tier adjustments

### 🚀 Scalability
- **Centralized API key**: Change once, affects all users
- **A/B testing**: Switch between GPT models server-side
- **Rate limit management**: Handle OpenAI 429s centrally

---

## Environment Variables

Edge Functions automatically have access to:

```bash
SUPABASE_URL=https://fmptjjpwndojeywyacum.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=<automatically injected>
```

**Your OpenAI API key** is stored in the database, NOT in environment variables:

```sql
SELECT api_key FROM private.api_keys WHERE service = 'openai';
```

This allows:
- **Key rotation** without redeployment
- **Multiple keys** (backup, load balancing)
- **Per-tier keys** (different models for different tiers)

---

## Deployment Checklist

- [ ] Run `SUPABASE-SCHEMA.sql` to create tables
- [ ] Run `SUPABASE-API-KEYS.sql` to create private schema
- [ ] Insert OpenAI API key into `private.api_keys` table
- [ ] Deploy Edge Function: `supabase functions deploy analyze-tos`
- [ ] Test with curl (see EDGE-FUNCTION-DEPLOYMENT.md)
- [ ] Load extension in Chrome
- [ ] Test login → analyze flow
- [ ] Verify usage counter increments
- [ ] Test limit enforcement (exhaust scans)

---

## Monitoring

### Check Function Logs
```bash
supabase functions logs analyze-tos --follow
```

### Check Usage Stats
```sql
SELECT 
  u.email,
  s.tier,
  s.scans_used,
  s.scans_limit,
  s.status
FROM subscriptions s
JOIN auth.users u ON s.user_id = u.id
ORDER BY s.updated_at DESC
LIMIT 20;
```

### Check Recent Analysis
```sql
SELECT 
  url,
  risk_score,
  analysis_date,
  user_id
FROM usage_tracking
ORDER BY analysis_date DESC
LIMIT 50;
```

---

## Troubleshooting

### "Not authenticated. Please log in."
- **Cause:** No session token or token expired
- **Fix:** User needs to log in again

### "Usage limit reached"
- **Cause:** User exhausted their scan limit
- **Fix:** Upgrade tier or wait for reset

### "Failed to retrieve API key"
- **Cause:** API key not in database or wrong permissions
- **Fix:** Run `SUPABASE-API-KEYS.sql` and insert key

### Edge Function timeout
- **Cause:** OpenAI API slow or text too long
- **Fix:** Reduce `maxChars` or implement caching

---

## Future Enhancements

1. **Multiple AI Providers**
   - Add Anthropic Claude as alternative
   - Store multiple API keys in `private.api_keys`
   - Let user choose model in settings

2. **Caching Layer**
   - Cache common ToS (e.g., Netflix, Amazon)
   - Store in `public.tos_cache` table
   - Reduce OpenAI costs by ~70%

3. **Webhook Integration**
   - Edge Function for payment webhooks
   - Auto-upgrade on successful payment
   - Email notifications

4. **Team Features**
   - Shared subscription quotas
   - Team admin dashboard
   - Usage reports per member

---

## References

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Chrome Extension Security Best Practices](https://developer.chrome.com/docs/extensions/mv3/security/)
