# SPA Testing Guide

## Quick Start Testing

### 1. Load Extension in Chrome

```bash
1. Open Chrome
2. Go to chrome://extensions
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select: /home/sukur/Desktop/aiadvice/money-trap-analyzer-extension/chrome-extension/
```

### 2. Test Authentication Flow

#### Test Login (New User - Should Show Auth View)
```
1. Click extension icon
2. Should show: Blue gradient background with login form
3. Verify: Email input, Password input, "Sign In" button
4. Verify: "Don't have an account? Create one" link at bottom
```

#### Test Registration
```
1. Click "Create Account"
2. Form should switch to register view
3. Verify: Name, Email, Password inputs
4. Enter test data:
   - Name: Test User
   - Email: test@example.com
   - Password: testpass123
5. Click "Create Account"
6. Should show: Green success message "Account created! Please check your email to verify."
7. After 2 seconds: Auto-switches back to login form
```

#### Test Login Validation
```
1. Leave email empty → Submit
2. Should show: Red error "Please enter both email and password"
3. Enter invalid email: "notanemail"
4. Should show: Error from Supabase
```

### 3. Test View Transitions

#### Auth → Main (After Login)
```
1. Login with valid credentials (if you have Supabase set up)
2. Router should check subscription
3. Should show: Main app view (analyze button, etc.)
4. Verify: User info in header (avatar, name, email)
5. Verify: Logout button in header
```

#### Main → Paywall (Usage Limit)
```
Note: This requires manual testing by exhausting usage limit
1. Use extension 3 times (free tier limit)
2. Try to analyze 4th time
3. Should show: Paywall view with pricing grid
4. Verify: 5 pricing cards (Free, Starter, Pro, Pro Plus, Agency)
5. Verify: "Pro" card has gold "Recommended" badge
6. Verify: Usage text shows "3 / 3 analyses used"
```

#### Logout Flow
```
1. In main view, click logout button (top right)
2. Should show: Confirmation dialog
3. Click "Logout"
4. Should show: Auth view (back to login form)
5. Should show: Green toast "Logged out successfully"
```

### 4. Test UI Elements

#### Auth View Styling
```
✓ Background: Blue gradient (#2563EB to #4338CA)
✓ Container: White with shadow, centered, 380px wide
✓ Inputs: Clean, rounded, blue focus border
✓ Button: Blue gradient with hover lift effect
✓ Logo: UseShield with blue accent
✓ Form toggle link: Blue color, underline on hover
```

#### Paywall View Styling
```
✓ Background: Blue gradient
✓ Container: White with shadow
✓ Pricing grid: 5 columns (auto-fit, responsive)
✓ Cards: White with hover shadow and lift
✓ Recommended badge: Gold gradient, top-right position
✓ Prices: Large, bold
✓ Features: Checkmarks, readable list
✓ Buttons: Blue with hover effect
```

#### Main View
```
✓ Unchanged from original design
✓ User section: Added at top with avatar
✓ Logout button: Icon button, hover effect
```

### 5. Dark Mode Testing

#### Enable Dark Mode
```
Chrome: Settings → Appearance → Theme → Dark
OR
System: Set OS to dark mode
```

#### Verify Dark Mode Styles
```
Auth View:
✓ Background: Darker blue gradient
✓ Container: Dark slate (#0F172A)
✓ Inputs: Dark background, light text
✓ Borders: Subtle light borders
✓ Error: Red with transparency
✓ Success: Green with transparency

Paywall View:
✓ Cards: Dark background
✓ Text: Light color
✓ Borders: Subtle
✓ Hover: Still visible

Main View:
✓ Uses existing dark mode styles
```

### 6. Keyboard Navigation

```
Auth View:
✓ Tab through inputs
✓ Enter in password field → Submit form
✓ Escape → Close any modals

Main View:
✓ Alt+A → Analyze
✓ Alt+H → History
✓ Alt+S → Settings
✓ Alt+W → Watchlist
✓ Ctrl+Enter → Analyze
```

### 7. Error Scenarios

#### Network Error
```
1. Disconnect internet
2. Try to login
3. Should show: "Network error. Please try again."
4. Message should have red background
```

#### Invalid Credentials
```
1. Enter wrong password
2. Should show: "Invalid credentials" (from Supabase)
3. Button should return to normal state (not loading)
```

#### Session Expiration
```
1. Login successfully
2. Manually clear chrome.storage.local (DevTools → Application → Storage)
3. Close and reopen extension
4. Should show: Auth view (session expired)
```

### 8. Console Checks

Open DevTools (F12) → Console

#### Expected Console Logs
```
[Router] Initializing...
[Router] Authenticated: false
[Router] Showing view: authView
[Router] Setting up auth handlers
```

After login:
```
[Router] Login successful
[Router] Initializing...
[Router] Authenticated: true
[Router] Current user: {id: "...", email: "..."}
[Router] Usage check: {allowed: true, subscription: {...}}
[Router] Showing view: mainView
[Popup] Initializing main app...
```

#### No Errors Should Appear
```
✗ Uncaught TypeError
✗ Failed to load module
✗ Cannot read property
```

### 9. Browser Compatibility

Test in different Chrome versions:
```
✓ Chrome 88+
✓ Chrome Beta
✓ Chromium
✓ Edge (Chromium-based)
```

### 10. Performance Checks

#### View Switching Speed
```
1. Login
2. Logout
3. Login again
Should be: Instant (< 100ms)
No page flicker or loading
```

#### Memory Usage
```
DevTools → Memory → Take snapshot
Before: ~10MB
After 10 view switches: Should not increase significantly
Check for: Memory leaks
```

## Manual Testing Checklist

### Authentication
- [ ] Unauthenticated users see login form
- [ ] Register form appears when clicking "Create Account"
- [ ] Login form validation works
- [ ] Register form validation works
- [ ] Password minimum 8 chars enforced
- [ ] Success message shows after registration
- [ ] Form auto-switches after registration
- [ ] Login redirects to main/paywall view
- [ ] Logout returns to auth view
- [ ] Logout confirmation dialog works

### Routing
- [ ] Router initializes on popup open
- [ ] View switching is smooth (no flicker)
- [ ] Only one view visible at a time
- [ ] Auth view shows when not authenticated
- [ ] Paywall view shows when limit reached
- [ ] Main view shows when authenticated + has usage
- [ ] navigateTo() function works
- [ ] Browser refresh maintains state

### UI/UX
- [ ] Blue gradient background on auth/paywall
- [ ] Forms are centered and readable
- [ ] Inputs have proper focus states
- [ ] Buttons have hover effects
- [ ] Loading spinners appear during submission
- [ ] Error messages are red and visible
- [ ] Success messages are green and visible
- [ ] Messages auto-hide after 5 seconds
- [ ] Pricing cards are responsive
- [ ] Recommended badge appears correctly
- [ ] Dark mode looks good
- [ ] Transitions are smooth

### Edge Cases
- [ ] Offline mode shows appropriate message
- [ ] Network errors handled gracefully
- [ ] Invalid inputs show errors
- [ ] Duplicate email registration fails correctly
- [ ] Empty form submission shows validation
- [ ] Session expiration redirects to auth
- [ ] Rapid clicking doesn't break state
- [ ] Multiple tabs don't conflict

## Debugging Tips

### Check Router State
```javascript
// In console (popup DevTools)
import('./src/router.js').then(r => {
  console.log('User:', r.getUser());
  console.log('Subscription:', r.getSubscriptionData());
});
```

### Check Storage
```javascript
// In console
chrome.storage.local.get(null, (data) => {
  console.log('Storage:', data);
});
```

### Force View Change
```javascript
// In console
import('./src/router.js').then(r => {
  r.navigateTo('auth'); // or 'paywall' or 'main'
});
```

### Check Supabase Connection
```javascript
// In console
import('./src/auth.js').then(auth => {
  auth.isAuthenticated().then(isAuth => {
    console.log('Authenticated:', isAuth);
  });
});
```

## Known Issues to Check

1. **Module Import Errors**: If you see "Failed to resolve module", check that:
   - Script tag has `type="module"`
   - Import paths start with `./`
   - Files exist in correct locations

2. **View Not Showing**: If popup is blank, check:
   - All views have `hidden` attribute initially
   - Router is calling `showView()` correctly
   - No CSS `display: none` overriding visibility

3. **Auth Not Working**: If login fails silently, check:
   - Supabase credentials in `src/auth.js`
   - Network tab in DevTools for API errors
   - Console for error messages

4. **Styling Issues**: If styles don't apply, check:
   - `auth-styles.css` is linked in `popup.html`
   - CSS class names match between HTML and CSS
   - No conflicting styles in `popup.css`

## Success Criteria

✅ Extension loads without errors
✅ Auth view appears for logged-out users
✅ Login works and shows main/paywall view
✅ Register creates account and shows success
✅ Logout returns to auth view
✅ Paywall view shows when limit reached
✅ Main view works as before
✅ Dark mode works for all views
✅ No console errors
✅ View transitions are smooth
✅ All buttons functional

---

**Testing Date:** December 2024
**Tester:** [Your Name]
**Browser Version:** Chrome [version]
**OS:** [Your OS]
