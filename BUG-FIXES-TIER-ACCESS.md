# Critical Bug Fixes - Analysis Mode Access

## Issues Fixed

### 🐛 Bug #1: Subscription Data Not Returned Correctly
**File**: `src/subscription.js` (lines 103-119)

**Problem**: 
```javascript
// WRONG - using 'data' instead of 'subscription'
return {
  id: data.id,          // ❌ data is an array
  tier: data.tier,      // ❌ tier was undefined
  ...
}
```

**Fix**:
```javascript
// CORRECT - using 'subscription' object
return {
  id: subscription.id,       // ✅
  tier: subscription.tier,   // ✅
  ...
}
```

**Impact**: This bug caused all tier checks to fail because `subscription.tier` was undefined!

---

### 🐛 Bug #2: Analysis Mode Not Sent to Edge Function
**File**: `src/background.js` (line 325)

**Problem**:
```javascript
// Function signature was missing parameters
async function callAnalysisEdgeFunction({ url, text, title, maxChars = 20000 }) {
  // analysisMode and customPrompt were ignored!
}
```

**Fix**:
```javascript
async function callAnalysisEdgeFunction({ 
  url, text, title, maxChars = 20000, 
  analysisMode = 'standard',  // ✅ Added
  customPrompt = ''           // ✅ Added
}) {
```

**Impact**: All analyses defaulted to 'standard' mode regardless of user selection!

---

### 🐛 Bug #3: Edge Function Not Receiving Parameters
**File**: `src/background.js` (lines 383-389)

**Problem**:
```javascript
body: JSON.stringify({
  url,
  text,
  title,
  maxChars
  // Missing analysisMode and customPrompt!
})
```

**Fix**:
```javascript
body: JSON.stringify({
  url,
  text,
  title,
  maxChars,
  analysisMode,    // ✅ Added
  customPrompt     // ✅ Added
})
```

---

### 🐛 Bug #4: Custom Prompt Not Applied
**File**: `supabase-edge-function.ts` (line 202)

**Problem**:
```javascript
// customPrompt was extracted but never used
const systemPrompt = systemPrompts[analysisMode] || systemPrompts.standard
// Always used default prompt ❌
```

**Fix**:
```javascript
const systemPrompt = systemPrompts[analysisMode] || systemPrompts.standard

// Allow Pro Plus+ users to override
const finalSystemPrompt = (customPrompt && userTierLevel >= 3) 
  ? customPrompt 
  : systemPrompt

// Use finalSystemPrompt in OpenAI call ✅
```

---

## Tier Configuration (Database Schema)

Based on your `SUPABASE-SCHEMA.sql`:

```sql
tier TEXT NOT NULL DEFAULT 'free' 
CHECK (tier IN ('free', 'starter', 'pro', 'pro_plus', 'agency'))
```

### Tier → Mode Access Matrix

| Tier | Level | Flash | Standard | Deep-Dive | Neural | Custom Prompt |
|------|-------|-------|----------|-----------|--------|---------------|
| **free** | 0 | ✅ | ❌ | ❌ | ❌ | ❌ |
| **starter** | 1 | ✅ | ✅ | ❌ | ❌ | ❌ |
| **pro** | 2 | ✅ | ✅ | ❌ | ❌ | ❌ |
| **pro_plus** | 3 | ✅ | ✅ | ✅ | ❌ | ✅ |
| **agency** | 4 | ✅ | ✅ | ✅ | ✅ | ✅ |

### Mode Requirements
```javascript
const modeTierMap = { 
  flash: 0,     // Free and above
  standard: 1,  // Starter and above
  deepdive: 3,  // Pro Plus and above
  neural: 4     // Agency only
}
```

---

## Deployment Steps

### 1. Update Edge Function
```bash
cd chrome-extension
supabase functions deploy analyze-tos
```

### 2. Reload Extension
```
1. Chrome → chrome://extensions
2. Find "UseShield" extension
3. Click reload icon 🔄
```

### 3. Clear Cache & Test
```javascript
// Open extension popup → DevTools → Console
chrome.storage.local.clear(() => {
  console.log('Cache cleared');
  location.reload();
});
```

---

## Verification Steps

### Step 1: Check Subscription Data
```javascript
// In popup console:
chrome.storage.local.get(['mta_subscription', 'mta_tier'], (data) => {
  console.log('Subscription:', data.mta_subscription);
  console.log('Tier:', data.mta_tier);
  // Expected for Pro Plus:
  // { tier: 'pro_plus', status: 'active', ... }
});
```

### Step 2: Check Mode Selection
```javascript
// Should show unlocked modes based on tier
chrome.storage.local.get(['mta_analysisMode'], (data) => {
  console.log('Selected mode:', data.mta_analysisMode);
});
```

### Step 3: Test Analysis
```
1. Open a Terms page (e.g., google.com/terms)
2. Open extension popup
3. Select "Deep-Dive" mode (should be unlocked for Pro Plus)
4. Click "Analyze This Page"
5. Check console logs:
   - [Background] Analysis parameters: { analysisMode: 'deepdive', ... }
   - [Edge Function] Tier validation: { subscriptionTier: 'pro_plus', ... }
   - [Edge Function] Using model: 'gpt-4o'
```

### Step 4: Check Edge Function Logs
```bash
# In Supabase dashboard
1. Go to Edge Functions → analyze-tos
2. Click "Logs" tab
3. Look for recent invocations
4. Check for tier validation messages:
   ✅ "Tier validation: { subscriptionTier: 'pro_plus', userTierLevel: 3, ... }"
```

---

## Expected Console Output

### Successful Deep-Dive Analysis (Pro Plus)
```
[Popup] Initializing mode selector...
[Popup] User tier: pro_plus (level 3)
[Popup] Mode 'deepdive' unlocked
[Background] Analysis parameters: {
  analysisMode: 'deepdive',
  hasCustomPrompt: false
}
[Edge Function] Request params: {
  analysisMode: 'deepdive',
  textLength: 45000
}
[Edge Function] Tier validation: {
  subscriptionTier: 'pro_plus',
  userTierLevel: 3,
  requiredTierLevel: 3,
  hasAccess: true
}
[Edge Function] Using model: gpt-4o
[Edge Function] Analysis complete: { riskScore: 72, findings: 18 }
```

### Failed Analysis (Insufficient Tier)
```
[Edge Function] Tier validation: {
  subscriptionTier: 'starter',
  userTierLevel: 1,
  requiredTierLevel: 3,
  hasAccess: false
}
[Edge Function] Returning 403: Insufficient tier
```

---

## Custom Prompt Testing (Pro Plus+)

### Test Custom Prompt
```
1. Open settings panel (gear icon)
2. Custom prompt textarea should be enabled
3. Enter: "Focus on data privacy and GDPR compliance"
4. Analyze a page
5. Check logs:
   [Edge Function] Using system prompt: { isCustom: true, promptLength: 47 }
```

### Test Tier Restriction
```
1. Simulate 'starter' tier in console:
   chrome.storage.local.set({
     mta_subscription: { tier: 'starter', status: 'active' }
   }, () => location.reload());
   
2. Custom prompt textarea should be disabled
3. Clicking it shows: "Custom Prompts requires Pro Plus tier..."
```

---

## Database Verification

### Check Your Subscription in Supabase
```sql
-- Run in Supabase SQL Editor
SELECT 
  user_id,
  tier,
  status,
  scans_used,
  scans_limit,
  created_at,
  expires_at
FROM subscriptions
WHERE user_id = 'YOUR_USER_ID';

-- Expected result for Pro Plus:
-- tier: 'pro_plus'
-- status: 'active'
-- scans_limit: 200
```

### Update Tier Manually (If Needed)
```sql
-- If tier is wrong, update it:
UPDATE subscriptions
SET 
  tier = 'pro_plus',
  scans_limit = 200,
  status = 'active'
WHERE user_id = 'YOUR_USER_ID';
```

---

## Troubleshooting

### Issue: "Insufficient tier" error for Pro Plus
**Check**:
1. Verify database has `tier = 'pro_plus'` (not `'pro-plus'` or `'ProPlus'`)
2. Check RLS policies allow user to read subscription
3. Verify JWT token is valid (not expired)

### Issue: Mode selector shows all locked
**Check**:
1. `getSubscriptionData()` returns valid tier
2. `mta_subscription` exists in chrome.storage.local
3. Router initialized correctly

### Issue: Custom prompt not applied
**Check**:
1. Tier is `pro_plus` or `agency`
2. Edge Function received `customPrompt` parameter
3. Check Edge Function logs for "Using system prompt: { isCustom: true }"

---

## Files Modified

1. ✅ `src/subscription.js` - Fixed subscription data return bug
2. ✅ `src/background.js` - Added analysisMode/customPrompt to function
3. ✅ `supabase-edge-function.ts` - Added tier validation logging & custom prompt support

---

## Next Steps

1. **Deploy Edge Function** to Supabase
2. **Reload Extension** in Chrome
3. **Test with Pro Plus account**
4. **Verify all modes work** (Flash/Standard/Deep-Dive accessible)
5. **Test custom prompts** (Pro Plus+ only)

---

**Last Updated**: 2025-01-07  
**Status**: Ready to Deploy ✅
