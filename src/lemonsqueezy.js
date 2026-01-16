/**
 * Lemon Squeezy Integration Module
 * Handles checkout, subscription management, and license verification
 */

// Lemon Squeezy Configuration
// Replace these with your actual values from https://app.lemonsqueezy.com
const LEMONSQUEEZY_CONFIG = {
  storeId: 'your-store-id', // Replace with your store ID
  variantIds: {
    starter: 'your-starter-variant-id',
    pro: 'your-pro-variant-id',
    pro_plus: 'your-pro-plus-variant-id',
    agency: 'your-agency-variant-id'
  },
  apiKey: '', // Store API key in chrome.storage.sync for security
  webhookSecret: '' // For webhook signature verification
};

// Storage keys
const SUBSCRIPTION_KEY = 'mta_subscription';
const LICENSE_KEY = 'mta_license';
const LS_API_KEY = 'mta_lemonsqueezy_api_key';

/**
 * Initialize Lemon Squeezy checkout for a tier
 * @param {string} tierId - The tier to purchase (starter, pro, pro_plus, agency)
 * @param {string} userEmail - User's email for checkout prefill
 * @returns {Promise<void>}
 */
export async function initiateCheckout(tierId, userEmail = '') {
  const variantId = LEMONSQUEEZY_CONFIG.variantIds[tierId];
  
  if (!variantId || variantId.startsWith('your-')) {
    console.error('Lemon Squeezy variant ID not configured for tier:', tierId);
    throw new Error('Payment system not configured. Please contact support.');
  }

  // Get extension ID for return URLs
  const extensionId = chrome.runtime.id;
  const successUrl = `https://${extensionId}.chromiumapp.org/subscription-success.html`;
  const cancelUrl = `https://${extensionId}.chromiumapp.org/subscription.html`;

  // Build Lemon Squeezy checkout URL
  const checkoutUrl = new URL(`https://useshield.lemonsqueezy.com/checkout/buy/${variantId}`);
  
  // Add checkout parameters
  checkoutUrl.searchParams.append('checkout[email]', userEmail);
  checkoutUrl.searchParams.append('checkout[custom][extension_id]', extensionId);
  checkoutUrl.searchParams.append('checkout[custom][tier]', tierId);
  
  // Embed mode for better UX (opens in overlay)
  checkoutUrl.searchParams.append('embed', '1');
  checkoutUrl.searchParams.append('media', '0'); // Disable media
  checkoutUrl.searchParams.append('logo', '0'); // Use default logo
  checkoutUrl.searchParams.append('desc', '0'); // Hide description
  checkoutUrl.searchParams.append('discount', '0'); // Disable discount field (optional)
  
  // Open checkout in new tab
  chrome.tabs.create({ url: checkoutUrl.toString() });
}

/**
 * Verify license key with Lemon Squeezy API
 * @param {string} licenseKey - License key to verify
 * @returns {Promise<{ valid: boolean, subscription: Object|null, error: string|null }>}
 */
export async function verifyLicense(licenseKey) {
  try {
    const stored = await chrome.storage.sync.get([LS_API_KEY]);
    const apiKey = stored[LS_API_KEY];
    
    if (!apiKey) {
      // Try to use hardcoded key (not recommended for production)
      if (!LEMONSQUEEZY_CONFIG.apiKey) {
        return { valid: false, subscription: null, error: 'API key not configured' };
      }
    }

    // Call Lemon Squeezy license validation API
    const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        license_key: licenseKey
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { 
        valid: false, 
        subscription: null, 
        error: errorData.error || 'License validation failed' 
      };
    }

    const data = await response.json();
    
    // Check if license is valid and active
    const isValid = data.valid === true && data.license_key?.status === 'active';
    
    if (isValid) {
      // Extract subscription info
      const subscription = {
        licenseKey: licenseKey,
        status: data.license_key.status,
        tier: data.meta?.custom_data?.tier || 'pro', // Default to pro if not specified
        customerName: data.meta?.customer_name,
        customerEmail: data.meta?.customer_email,
        expiresAt: data.license_key.expires_at,
        activatedAt: data.license_key.activation_date,
        variantId: data.meta?.variant_id,
        productId: data.meta?.product_id,
        orderId: data.meta?.order_id
      };
      
      // Store subscription data
      await chrome.storage.local.set({ 
        [SUBSCRIPTION_KEY]: subscription,
        [LICENSE_KEY]: licenseKey
      });
      
      // Update tier based on subscription
      await chrome.storage.local.set({ mta_tier: subscription.tier });
      
      return { valid: true, subscription, error: null };
    } else {
      return { 
        valid: false, 
        subscription: null, 
        error: data.license_key?.status || 'License is not active' 
      };
    }
  } catch (error) {
    console.error('License verification error:', error);
    return { valid: false, subscription: null, error: error.message };
  }
}

/**
 * Activate license key
 * @param {string} licenseKey - License key to activate
 * @param {string} instanceName - Name for this activation (e.g., "Chrome on MacBook")
 * @returns {Promise<{ success: boolean, subscription: Object|null, error: string|null }>}
 */
export async function activateLicense(licenseKey, instanceName = 'Chrome Extension') {
  try {
    const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        license_key: licenseKey,
        instance_name: instanceName
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { 
        success: false, 
        subscription: null, 
        error: errorData.error || 'License activation failed' 
      };
    }

    const data = await response.json();
    
    if (data.activated) {
      // Verify and store the license
      return await verifyLicense(licenseKey);
    } else {
      return { 
        success: false, 
        subscription: null, 
        error: data.error || 'License activation failed' 
      };
    }
  } catch (error) {
    console.error('License activation error:', error);
    return { success: false, subscription: null, error: error.message };
  }
}

/**
 * Deactivate license key (useful for transferring to another device)
 * @param {string} licenseKey - License key to deactivate
 * @param {string} instanceId - Instance ID to deactivate
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function deactivateLicense(licenseKey, instanceId) {
  try {
    const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        license_key: licenseKey,
        instance_id: instanceId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'License deactivation failed' };
    }

    const data = await response.json();
    return { success: data.deactivated === true, error: null };
  } catch (error) {
    console.error('License deactivation error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current subscription from storage
 * @returns {Promise<Object|null>}
 */
export async function getSubscription() {
  const stored = await chrome.storage.local.get([SUBSCRIPTION_KEY]);
  return stored[SUBSCRIPTION_KEY] || null;
}

/**
 * Check if user has active subscription
 * @returns {Promise<boolean>}
 */
export async function hasActiveSubscription() {
  const subscription = await getSubscription();
  
  if (!subscription) return false;
  
  // Check expiry if present
  if (subscription.expiresAt) {
    const expiryDate = new Date(subscription.expiresAt);
    if (expiryDate < new Date()) {
      return false; // Expired
    }
  }
  
  return subscription.status === 'active';
}

/**
 * Refresh subscription status (re-verify license)
 * @returns {Promise<{ valid: boolean, subscription: Object|null }>}
 */
export async function refreshSubscription() {
  const stored = await chrome.storage.local.get([LICENSE_KEY]);
  const licenseKey = stored[LICENSE_KEY];
  
  if (!licenseKey) {
    return { valid: false, subscription: null };
  }
  
  return await verifyLicense(licenseKey);
}

/**
 * Cancel/remove subscription from local storage
 * (User must cancel via Lemon Squeezy customer portal)
 * @returns {Promise<void>}
 */
export async function clearSubscription() {
  await chrome.storage.local.remove([SUBSCRIPTION_KEY, LICENSE_KEY]);
  await chrome.storage.local.set({ mta_tier: 'free' });
}

/**
 * Get customer portal URL for managing subscription
 * @returns {string}
 */
export function getCustomerPortalUrl() {
  return 'https://app.lemonsqueezy.com/my-orders';
}

/**
 * Handle webhook events from Lemon Squeezy
 * This would typically be handled by a backend service
 * For extension-only approach, webhooks can update a cloud function
 * that the extension periodically checks
 * 
 * @param {Object} event - Webhook event data
 * @returns {Promise<void>}
 */
export async function handleWebhook(event) {
  // Note: Webhooks should be handled server-side
  // This is a placeholder for client-side event handling
  
  const eventType = event.meta?.event_name;
  
  switch (eventType) {
    case 'order_created':
      console.log('New order created:', event.data);
      break;
      
    case 'subscription_created':
      console.log('Subscription created:', event.data);
      // Trigger license activation flow
      break;
      
    case 'subscription_updated':
      console.log('Subscription updated:', event.data);
      // Refresh subscription status
      await refreshSubscription();
      break;
      
    case 'subscription_cancelled':
      console.log('Subscription cancelled:', event.data);
      // Update local status (keep access until expiry)
      break;
      
    case 'subscription_expired':
      console.log('Subscription expired:', event.data);
      await clearSubscription();
      break;
      
    default:
      console.log('Unhandled webhook event:', eventType);
  }
}

/**
 * Open Lemon Squeezy customer portal for subscription management
 */
export function openCustomerPortal() {
  chrome.tabs.create({ url: getCustomerPortalUrl() });
}

/**
 * Validate webhook signature (for backend implementation)
 * @param {string} payload - Raw webhook payload
 * @param {string} signature - X-Signature header from Lemon Squeezy
 * @returns {boolean}
 */
export async function validateWebhookSignature(payload, signature) {
  // This should be implemented server-side
  // Example using Web Crypto API:
  
  const secret = LEMONSQUEEZY_CONFIG.webhookSecret;
  if (!secret) return false;
  
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );
    
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return computedSignature === signature;
  } catch (error) {
    console.error('Signature validation error:', error);
    return false;
  }
}
