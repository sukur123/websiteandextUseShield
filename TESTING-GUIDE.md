# Testing Guide for Phase 1 Implementation

## Quick Test Procedure

### 1. Load Extension
```bash
1. Open Chrome → chrome://extensions
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select: /home/sukur/Desktop/aiadvice/money-trap-analyzer-extension/chrome-extension
5. Click extension icon to open popup
```

### 2. Test Analysis Mode Selector

#### Visual Check
- [ ] 4 mode buttons visible (Flash, Standard, Deep-Dive, Neural)
- [ ] Flash button has "active" styling (blue gradient)
- [ ] Deep-Dive and Neural show lock icons
- [ ] Settings gear icon visible below modes

#### Interaction Test (Free Tier)
```
1. Click "Flash" → Should highlight (already active)
2. Click "Standard" → Should show upgrade prompt
3. Click "Deep-Dive" → Should show upgrade prompt (Pro Plus required)
4. Click "Neural" → Should show upgrade prompt (Agency required)
5. Click "Maybe Later" → Dialog closes
```

#### Check Storage
```javascript
// Open DevTools → Console
chrome.storage.local.get(['mta_analysisMode'], (result) => {
  console.log('Current mode:', result.mta_analysisMode); // Should be 'flash'
});
```

### 3. Test Settings Panel

#### Toggle Panel
```
1. Click settings gear icon → Panel slides down
2. Check visible settings:
   - ☑ Redact PII (checked by default)
   - ☑ Cache Results (checked by default)
   - ☐ Sound Notifications (unchecked by default)
   - Custom Prompt textarea (disabled/grayed out)
3. Click gear icon again → Panel slides up
```

#### Change Settings
```
1. Uncheck "Redact PII"
2. Check "Sound Notifications"
3. Open DevTools Console:

chrome.storage.local.get(['mta_redactPII', 'mta_soundEnabled'], (result) => {
  console.log('PII:', result.mta_redactPII); // Should be false
  console.log('Sound:', result.mta_soundEnabled); // Should be true
});
```

#### Test Custom Prompt (Free Tier)
```
1. Click inside "Custom Prompt" textarea
2. Should show upgrade prompt: "Custom Prompts requires Pro Plus tier..."
3. Click "Upgrade Now" → Should navigate to subscription view
```

### 4. Test Premium Feature Gating

#### Export Button
```
1. Analyze any page (e.g., google.com/terms)
2. Wait for results
3. Click "Export" button
4. Should show: "Export to Markdown requires Starter tier..."
5. Click "Upgrade Now" → Navigate to subscription
```

#### Compare Button
```
1. Click "Compare" icon in header
2. Should show: "Side-by-side comparison requires Starter tier..."
3. Click "Cancel" → Dialog closes
```

#### Watchlist Size Limit
```
1. Analyze page #1 → Click "Add to Watchlist" ✓
2. Analyze page #2 → Click "Add to Watchlist" ✓
3. Analyze page #3 → Click "Add to Watchlist"
4. Should show: "Your Free plan allows 2 watchlist items. Upgrade to add more!"
```

### 5. Test Tier Upgrades

#### Simulate Starter Tier
```javascript
// DevTools Console - Inject fake subscription data
chrome.storage.local.set({
  mta_subscription: {
    tier: 'starter',
    status: 'active'
  }
}, () => {
  location.reload(); // Reload popup
});
```

Then test:
- [ ] Standard mode unlocked (no lock icon)
- [ ] Flash + Standard selectable
- [ ] Deep-Dive + Neural still locked
- [ ] Export button works (no prompt)
- [ ] Compare button works (no prompt)
- [ ] Watchlist limit = 10 items

#### Simulate Pro Plus Tier
```javascript
chrome.storage.local.set({
  mta_subscription: {
    tier: 'pro_plus',
    status: 'active'
  }
}, () => {
  location.reload();
});
```

Then test:
- [ ] Flash, Standard, Deep-Dive unlocked
- [ ] Neural still locked (Agency only)
- [ ] Custom prompt textarea enabled (no upgrade prompt)
- [ ] Can type in custom prompt
- [ ] Watchlist limit = 100 items

#### Simulate Agency Tier
```javascript
chrome.storage.local.set({
  mta_subscription: {
    tier: 'agency',
    status: 'active'
  }
}, () => {
  location.reload();
});
```

Then test:
- [ ] All 4 modes unlocked
- [ ] No lock icons visible
- [ ] All features accessible
- [ ] Watchlist limit = 500 items

### 6. Test Server-Side Validation

#### Prerequisites
```bash
# Ensure Supabase Edge Function is deployed
# See SUPABASE-SETUP.md for deployment steps
```

#### Test Tier Bypass Attempt
```javascript
// DevTools → Set local tier to Free
chrome.storage.local.set({
  mta_subscription: { tier: 'free', status: 'active' }
});

// Manually send API request with premium mode
chrome.runtime.sendMessage({
  type: 'analyze',
  data: {
    url: 'https://google.com/terms',
    text: 'Sample terms...',
    title: 'Test',
    analysisMode: 'neural' // Try to bypass with Agency mode
  }
}, (response) => {
  console.log(response);
  // Expected: { ok: false, error: 'Insufficient tier', status: 403 }
});
```

### 7. Test Full Analysis Flow

#### End-to-End Test (Free Tier)
```
1. Open popup
2. Navigate to a Terms page (e.g., netflix.com/terms)
3. Click "Analyze This Page"
4. Verify:
   - Analysis uses Flash mode (fastest)
   - Results show 3-7 findings
   - Risk score calculated
   - Cache indicator shows (if re-analyzing)
5. Try to export → Upgrade prompt
6. Try to add to watchlist → Works (1st time)
7. Try to add to watchlist → Works (2nd time)
8. Try to add to watchlist → Limit reached prompt (3rd time)
```

#### End-to-End Test (Pro Plus Tier)
```
1. Set tier to 'pro_plus' (see above)
2. Reload popup
3. Select "Deep-Dive" mode
4. Analyze Terms page
5. Verify:
   - Analysis uses gpt-4o model (slower, better)
   - Results show 10-25 findings
   - More detailed explanations
   - Legal precedents mentioned
6. Export works without prompt
7. Compare works without prompt
8. Can add custom prompt
```

### 8. Test Error Handling

#### Invalid Custom Prompt
```
1. Set tier to 'pro_plus'
2. Open settings panel
3. Enter very long text (>10,000 chars) in custom prompt
4. TODO: Should show validation error (not yet implemented)
```

#### Network Offline
```
1. Open DevTools → Network tab
2. Set to "Offline"
3. Try to analyze page
4. Should show cached results or "offline" message
```

#### Invalid Tier Response
```javascript
// Simulate corrupted subscription data
chrome.storage.local.set({
  mta_subscription: { tier: 'invalid_tier', status: 'active' }
}, () => {
  location.reload();
  // Should default to Free tier behavior
});
```

---

## Expected Console Logs

### Successful Mode Change
```
[Popup] Initializing mode selector...
[Popup] User tier: free (level 0)
[Popup] Mode 'standard' locked (requires tier level 1)
[Popup] Mode 'deepdive' locked (requires tier level 3)
[Popup] Mode 'neural' locked (requires tier level 4)
```

### Successful Analysis
```
[Background] Analyzing: https://example.com/terms
[Background] Using mode: flash
[Background] Custom prompt: (empty)
[Edge Function] Tier validation: free (0) → flash (0) ✓
[Edge Function] Using model: gpt-4o-mini
[Edge Function] Max chars: 10000
[Popup] Analysis complete: 85/100 risk score
```

### Tier Violation
```
[Background] Analyzing with mode: neural
[Edge Function] Tier validation: free (0) → neural (4) ✗
[Edge Function] Returning 403: Insufficient tier
[Popup] Error: Insufficient tier for neural analysis
```

---

## Browser Console Commands

### Check Current State
```javascript
// View all storage
chrome.storage.local.get(null, console.log);

// Check specific keys
chrome.storage.local.get([
  'mta_analysisMode',
  'mta_customPrompt',
  'mta_subscription',
  'mta_watchlist'
], console.log);
```

### Reset to Defaults
```javascript
// Clear all extension data
chrome.storage.local.clear(() => {
  console.log('Storage cleared');
  location.reload();
});

// Reset to Free tier
chrome.storage.local.set({
  mta_subscription: { tier: 'free', status: 'active' },
  mta_analysisMode: 'flash',
  mta_redactPII: true,
  mta_cacheResults: true,
  mta_soundEnabled: false,
  mta_customPrompt: ''
}, () => {
  location.reload();
});
```

### Test Notifications
```javascript
// Manually trigger toast
showToast('Test notification', 'success');
showToast('Warning message', 'warning');
showToast('Error occurred', 'error');

// Test upgrade dialog
showUpgradePrompt('deepdive', 'pro_plus');
```

---

## Visual Regression Checks

### CSS Styling
- [ ] Mode buttons have 6px gap between them
- [ ] Active mode has blue gradient + glow effect
- [ ] Locked modes have 50% opacity
- [ ] Settings panel slides smoothly (180ms)
- [ ] Pro badge has purple gradient
- [ ] All icons render correctly (no broken SVGs)
- [ ] Responsive layout works at 400px width

### Hover States
- [ ] Unlocked modes lift on hover (translateY -1px)
- [ ] Locked modes don't lift on hover
- [ ] Settings gear rotates on active state
- [ ] Buttons show pointer cursor when enabled
- [ ] Locked elements show not-allowed cursor

### Color Contrast
- [ ] All text readable (WCAG AA)
- [ ] Lock icons visible on locked buttons
- [ ] Active mode easily distinguishable
- [ ] Error messages high contrast

---

## Performance Checks

### Load Time
- [ ] Popup opens in <100ms
- [ ] Mode selector initializes in <50ms
- [ ] No visible layout shift

### Storage Operations
- [ ] Mode change saves instantly
- [ ] Settings update in <10ms
- [ ] No race conditions on rapid clicks

### Memory Usage
- [ ] No memory leaks on mode switching
- [ ] Settings panel doesn't create duplicate listeners
- [ ] Toast notifications clean up properly

---

## Security Validation

### Client-Side Checks
```javascript
// Try to manipulate mode via console
document.querySelector('[data-mode="neural"]').click();
// Should show upgrade prompt, not actually select

// Try to enable custom prompt
document.querySelector('.custom-prompt-input').disabled = false;
// Can type, but won't save or send to server

// Try to bypass watchlist limit
// (Requires manual testing - add items beyond limit)
```

### Server-Side Checks
```bash
# Test Edge Function directly (requires auth token)
curl -X POST https://your-project.supabase.co/functions/v1/analyze-tos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/terms",
    "text": "Sample text...",
    "analysisMode": "neural"
  }'

# Expected response (if Free tier):
# { "ok": false, "error": "Insufficient tier", "status": 403 }
```

---

## Automated Testing (Future)

### Unit Tests (TODO)
```javascript
// Test tier validation logic
describe('Mode Selector', () => {
  it('should lock modes based on tier', () => {
    const userTier = 'free';
    const lockedModes = getLockedModes(userTier);
    expect(lockedModes).toEqual(['standard', 'deepdive', 'neural']);
  });
});
```

### Integration Tests (TODO)
```javascript
// Test full flow with Playwright
test('Free user cannot access premium features', async ({ page }) => {
  await page.goto('chrome-extension://ID/popup.html');
  await page.click('[data-mode="neural"]');
  await expect(page.locator('.confirm-dialog')).toBeVisible();
  await expect(page.locator('.confirm-title')).toHaveText('Premium Feature');
});
```

---

## Troubleshooting

### Issue: Mode selector not visible
**Solution**: Check if `initModeSelector()` is called in `initMainApp()`

### Issue: All modes unlocked (Free tier)
**Solution**: Check `getSubscriptionData()` returns correct tier

### Issue: Settings don't persist
**Solution**: Verify `chrome.storage.local.set()` has no errors in console

### Issue: Custom prompt saves but doesn't apply
**Solution**: Check Edge Function receives `customPrompt` parameter

### Issue: Upgrade prompt shows wrong tier
**Solution**: Verify `MODE_TIER_MAP` matches Edge Function `modeTierMap`

### Issue: 403 errors even with correct tier
**Solution**: Check Supabase subscription table has correct tier value

---

## Sign-Off Checklist

Before marking complete:
- [ ] All visual elements render correctly
- [ ] All 4 modes functional (with tier checks)
- [ ] Settings panel works (toggle, save, persist)
- [ ] Premium features gated (export, compare, watchlist)
- [ ] Server-side validation prevents bypass
- [ ] No console errors on any action
- [ ] Storage operations work correctly
- [ ] Upgrade prompts navigate to subscription view
- [ ] Free tier experience is usable (Flash mode works)
- [ ] Agency tier has full access (all modes unlocked)

---

**Test Date**: ___________  
**Tester**: ___________  
**Browser**: Chrome _______  
**Extension Version**: _______  
**Result**: ☐ PASS | ☐ FAIL

**Notes**:
