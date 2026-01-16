# Lemon Squeezy Paywall Integration

## What's Been Added

### New Files

1. **`src/lemonsqueezy.js`** - Complete Lemon Squeezy integration module
   - Checkout initialization
   - License key activation & verification
   - Subscription management
   - Customer portal integration

2. **`subscription-success.html`** - Post-purchase success page
   - Displays activated tier
   - Shows license key
   - Copy-to-clipboard functionality
   - Auto-activation on return from checkout

3. **`LEMON-SQUEEZY-SETUP.md`** - Comprehensive setup guide
   - Step-by-step Lemon Squeezy configuration
   - Product/variant creation
   - Webhook setup (optional)
   - Testing instructions
   - Troubleshooting guide

### Modified Files

1. **`subscription.html`** - Added license activation UI
   - License key input field
   - Activation button
   - "Manage Subscription" button for active users
   - Toast notification container

2. **`subscription.js`** - Integrated Lemon Squeezy
   - Replaced Stripe checkout with Lemon Squeezy
   - Added license activation handler
   - Toast notification system
   - Check for existing subscriptions on load

3. **`src/types.js`** - Added Lemon Squeezy variant IDs
   - New `lemonsqueezyVariantId` field for each tier
   - Ready for configuration with actual IDs

4. **`.github/copilot-instructions.md`** - Updated documentation
   - Lemon Squeezy integration patterns
   - Checkout flow documentation
   - Testing checklist updates

## Quick Setup (5 Steps)

### 1. Create Lemon Squeezy Account
- Sign up at https://lemonsqueezy.com
- Create your store

### 2. Create Products
Create 4 product variants:
- **Starter**: $9.99/month
- **Pro**: $29/month  
- **Pro Plus**: $60/month
- **Agency**: $100/month

### 3. Configure Extension
Update `src/lemonsqueezy.js`:
```javascript
const LEMONSQUEEZY_CONFIG = {
  storeId: 'your-store-id',
  variantIds: {
    starter: '123456',    // Your variant IDs
    pro: '123457',
    pro_plus: '123458',
    agency: '123459'
  }
};
```

Update store subdomain:
```javascript
const checkoutUrl = new URL(`https://YOUR-STORE.lemonsqueezy.com/checkout/buy/${variantId}`);
```

### 4. Enable License Keys
- In Lemon Squeezy: Settings → License Keys
- Enable for all products
- Format: `XXXX-XXXX-XXXX-XXXX`
- Activation limit: 3 devices

### 5. Test
- Enable Test Mode in Lemon Squeezy
- Test checkout with card `4242 4242 4242 4242`
- Verify license key activation works

## How It Works

### Purchase Flow

```
User clicks "Upgrade" 
  ↓
Lemon Squeezy checkout opens (new tab)
  ↓
User completes payment
  ↓
License key sent via email
  ↓
User returns to extension
  ↓
Enters license key
  ↓
Extension calls activateLicense()
  ↓
Lemon Squeezy API validates
  ↓
Subscription stored locally
  ↓
Tier updated, features unlocked
```

### License Validation

The extension validates licenses using Lemon Squeezy's public API:

```javascript
// No API key required for validation
POST https://api.lemonsqueezy.com/v1/licenses/validate
Body: { "license_key": "XXXX-XXXX-XXXX-XXXX" }

Response:
{
  "valid": true,
  "license_key": {
    "status": "active",
    "expires_at": "2027-01-06T00:00:00Z"
  },
  "meta": {
    "custom_data": { "tier": "pro" }
  }
}
```

### Subscription Storage

After activation, subscription data is stored in `chrome.storage.local`:

```javascript
{
  mta_subscription: {
    licenseKey: "XXXX-XXXX-XXXX-XXXX",
    status: "active",
    tier: "pro",
    customerEmail: "user@example.com",
    expiresAt: "2027-01-06T00:00:00Z",
    variantId: "123457"
  },
  mta_tier: "pro",
  mta_license: "XXXX-XXXX-XXXX-XXXX"
}
```

## Customer Experience

### Upgrade Path
1. Click extension icon
2. See "3/3 scans used" message
3. Click "Upgrade" button
4. Choose plan (Starter, Pro, etc.)
5. Redirected to Lemon Squeezy checkout
6. Complete payment
7. Receive email with license key
8. Return to extension
9. Click "Already have a license?"
10. Paste key and activate
11. Immediately get increased limits

### Subscription Management
- Click "Manage Subscription" in extension
- Opens Lemon Squeezy customer portal
- Can update payment method
- Can cancel subscription
- Can view invoices

## Security Notes

✅ **Safe**:
- License validation uses public API (no secrets in extension)
- License keys stored locally only
- No payment processing in extension

⚠️ **Important**:
- Never hardcode API keys in extension
- Webhook signature verification should be server-side
- Consider backend proxy for enhanced security

## Advanced: Webhook Integration

For automated updates (optional):

1. Create backend endpoint (Vercel/Netlify/AWS Lambda)
2. Register webhook in Lemon Squeezy
3. Handle events:
   - `subscription_created` - Send welcome email
   - `subscription_updated` - Sync changes
   - `subscription_cancelled` - Notify user
   - `subscription_expired` - Revoke access

See `LEMON-SQUEEZY-SETUP.md` for webhook code examples.

## Testing

### Test Mode
```bash
# 1. Enable Test Mode in Lemon Squeezy dashboard
# 2. Use test payment details:
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits

# 3. Test license activation
# 4. Verify tier updates correctly
```

### Production
```bash
# 1. Create real products (copy from test mode)
# 2. Update variant IDs in code
# 3. Disable Test Mode
# 4. Test with real payment (small amount)
# 5. Submit extension to Chrome Web Store
```

## Troubleshooting

### "Payment system not configured"
→ Update variant IDs in `lemonsqueezy.js` (remove 'your-' prefix)

### License activation fails
→ Check license key format (no spaces)
→ Verify product has license keys enabled
→ Check activation limit

### Checkout doesn't open
→ Verify store subdomain is correct
→ Check variant IDs match Lemon Squeezy dashboard
→ Check browser console for errors

## Support

- **Lemon Squeezy Docs**: https://docs.lemonsqueezy.com
- **License API**: https://docs.lemonsqueezy.com/api/license-keys
- **Full Setup Guide**: See `LEMON-SQUEEZY-SETUP.md`

---

**Ready to go live?** Follow the setup guide and update your variant IDs!
