# Lemon Squeezy Integration Setup Guide

## Overview

This extension uses [Lemon Squeezy](https://lemonsqueezy.com) for subscription management and payments. This guide will walk you through setting up your Lemon Squeezy account and configuring the extension.

## Prerequisites

1. A Lemon Squeezy account (sign up at https://lemonsqueezy.com)
2. Chrome extension uploaded (for testing return URLs)

## Step 1: Create Products & Variants in Lemon Squeezy

### 1.1 Create Your Store
1. Log into Lemon Squeezy dashboard
2. Create a new store (e.g., "UseShield")
3. Configure store settings (currency, tax, etc.)

### 1.2 Create Products
Create 4 separate products (or use variants of one product):

**Option A: Single Product with Variants (Recommended)**
1. Navigate to **Products** → **New Product**
2. Name: "UseShield Subscription"
3. Description: Premium features for ToS analysis
4. Create variants:
   - **Starter**: $9.99/month
   - **Pro**: $29/month
   - **Pro Plus**: $60/month
   - **Agency**: $100/month

**Option B: Separate Products**
Create 4 individual products with single variants each.

### 1.3 Get Variant IDs
1. Click on each product/variant
2. Copy the **Variant ID** (format: `variant_xxxxx`)
3. Save these IDs for configuration

## Step 2: Configure Extension

### 2.1 Update Lemon Squeezy Configuration

Open `chrome-extension/src/lemonsqueezy.js` and update:

```javascript
const LEMONSQUEEZY_CONFIG = {
  storeId: 'your-store-id', // From Settings → General
  variantIds: {
    starter: '123456',    // Replace with actual variant ID
    pro: '123457',        // Replace with actual variant ID
    pro_plus: '123458',   // Replace with actual variant ID
    agency: '123459'      // Replace with actual variant ID
  },
  apiKey: '', // Optional: For server-side verification
  webhookSecret: '' // For webhook signature verification
};
```

### 2.2 Update Store Subdomain

In `lemonsqueezy.js`, find the `initiateCheckout` function and replace:

```javascript
const checkoutUrl = new URL(`https://useshield.lemonsqueezy.com/checkout/buy/${variantId}`);
```

With your actual store subdomain:

```javascript
const checkoutUrl = new URL(`https://YOUR-STORE.lemonsqueezy.com/checkout/buy/${variantId}`);
```

### 2.3 Update types.js

Open `chrome-extension/src/types.js` and update the `lemonsqueezyVariantId` fields:

```javascript
export const SubscriptionTiers = {
  // ... free tier
  starter: {
    // ... other config
    lemonsqueezyVariantId: '123456', // Your actual variant ID
  },
  // ... repeat for pro, pro_plus, agency
};
```

## Step 3: Configure Checkout Settings

### 3.1 Customize Checkout Page
1. In Lemon Squeezy dashboard → **Products** → click your product
2. Go to **Checkout** tab
3. Configure:
   - **Logo**: Upload your extension logo
   - **Theme**: Match your extension colors
   - **Button text**: "Subscribe Now"
   - **Success message**: "Thank you for subscribing!"

### 3.2 Set Up License Keys
1. Go to **Settings** → **License Keys**
2. Enable license key generation for your products
3. Configure license key format (e.g., `XXXX-XXXX-XXXX-XXXX`)
4. Set activation limits (e.g., 3 devices)

### 3.3 Configure Email Templates
1. Go to **Settings** → **Email**
2. Customize the order confirmation email to include:
   - Welcome message
   - License key (use `{license_key}` variable)
   - Activation instructions
   - Link to extension

Example email template:
```
Thanks for subscribing to UseShield {plan_name}!

Your license key is: {license_key}

To activate:
1. Open the UseShield extension
2. Click on "Upgrade" 
3. Enter your license key
4. Start protecting yourself from unfair terms!

Need help? Email support@useshield.net
```

## Step 4: Set Up Webhooks (Optional but Recommended)

### 4.1 Create Webhook Endpoint
Create a backend endpoint to receive Lemon Squeezy webhooks. Example using Vercel/Netlify Functions:

```javascript
// api/webhooks/lemonsqueezy.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-signature'];
  const payload = JSON.stringify(req.body);
  
  // Verify signature (see lemonsqueezy.js validateWebhookSignature)
  // ... verification code
  
  const event = req.body;
  const eventType = event.meta.event_name;
  
  // Handle different events
  switch (eventType) {
    case 'subscription_created':
      // Send welcome email, analytics, etc.
      break;
    case 'subscription_cancelled':
      // Send cancellation email
      break;
    case 'subscription_expired':
      // Revoke access
      break;
  }
  
  res.status(200).json({ received: true });
}
```

### 4.2 Register Webhook in Lemon Squeezy
1. Go to **Settings** → **Webhooks**
2. Click **Add Endpoint**
3. URL: `https://your-backend.com/api/webhooks/lemonsqueezy`
4. Events: Select all subscription events
5. Save and copy the **Signing Secret**
6. Add signing secret to `LEMONSQUEEZY_CONFIG.webhookSecret`

## Step 5: Testing

### 5.1 Enable Test Mode
1. In Lemon Squeezy dashboard, toggle **Test Mode** (top right)
2. Create test products/variants (these won't charge real money)
3. Use test payment details:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits

### 5.2 Test Checkout Flow
1. Load your extension in Chrome
2. Navigate to **Upgrade** page
3. Click "Upgrade Now" on a plan
4. Complete checkout with test card
5. Verify:
   - Checkout opens correctly
   - License key is generated
   - Email is sent
   - Extension activates subscription

### 5.3 Test License Activation
1. Copy license key from email
2. Open extension → Upgrade → "Already have a license?"
3. Paste license key and click "Activate"
4. Verify tier is updated correctly

## Step 6: Go Live

### 6.1 Disable Test Mode
1. Create real products/variants (copy settings from test mode)
2. Update variant IDs in extension code
3. Toggle off **Test Mode** in Lemon Squeezy
4. Test with real (small amount) payment

### 6.2 Submit Extension
1. Update extension version
2. Build extension: `cd chrome-extension && zip -r ../extension.zip .`
3. Submit to Chrome Web Store
4. Add privacy policy and support links

## Step 7: Customer Management

### Managing Subscriptions
Customers can manage their subscriptions at:
```
https://app.lemonsqueezy.com/my-orders
```

You can add a "Manage Subscription" button that opens this URL.

### Viewing Analytics
Lemon Squeezy dashboard provides:
- Revenue tracking
- Subscriber counts
- Churn rate
- Refund statistics

## Troubleshooting

### License Activation Fails
**Issue**: "License validation failed"

**Solutions**:
1. Check if license key is correct (no spaces)
2. Verify product has license keys enabled
3. Check activation limit not exceeded
4. Ensure extension can reach `api.lemonsqueezy.com`

### Checkout Doesn't Open
**Issue**: Clicking "Upgrade" does nothing

**Solutions**:
1. Check browser console for errors
2. Verify variant IDs are correct
3. Ensure store subdomain is correct
4. Check popup blocker isn't blocking tab

### Subscription Not Activating After Payment
**Issue**: Payment successful but tier not updated

**Solutions**:
1. Check license key was sent in email
2. Manually activate with license key
3. Verify webhooks are working (if using)
4. Check browser console on success page

## Security Best Practices

1. **Never hardcode API keys** in extension code
2. **Use HTTPS** for all webhook endpoints
3. **Verify webhook signatures** server-side
4. **Rate limit** license activation attempts
5. **Log all subscription changes** for audit trail

## Support Resources

- [Lemon Squeezy Documentation](https://docs.lemonsqueezy.com/)
- [License API Reference](https://docs.lemonsqueezy.com/api/license-keys)
- [Webhook Events](https://docs.lemonsqueezy.com/guides/developer-guide/webhooks)

## Migration from Stripe (if applicable)

If migrating from Stripe:

1. **Export customer data** from Stripe
2. **Create equivalent products** in Lemon Squeezy
3. **Email existing customers** with migration instructions
4. **Grandfather existing subscriptions** (honor until renewal)
5. **Update extension code** to support both during transition
6. **Sunset Stripe** after all customers migrated

---

**Need help?** Contact Lemon Squeezy support or check their documentation at https://docs.lemonsqueezy.com
