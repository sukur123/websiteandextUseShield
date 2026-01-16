/**
 * Subscription Module with Backend Integration
 * Handles subscription purchases, activation, and sync with database
 */

import { getAuthToken, getCurrentUser, isAuthenticated } from './auth.js';

// Backend API endpoint
const API_BASE_URL = 'https://api.useshield.net'; // Change to your backend

/**
 * Purchase a subscription plan
 * @param {string} tierId - The tier to purchase (starter, pro, pro_plus, agency)
 * @returns {Promise<{ success: boolean, checkoutUrl: string|null, error: string|null }>}
 */
export async function purchasePlan(tierId) {
  try {
    const token = await getAuthToken();
    const user = await getCurrentUser();
    
    if (!token || !user) {
      return {
        success: false,
        checkoutUrl: null,
        error: 'Please login first to purchase a subscription'
      };
    }

    // Get extension ID for return URLs
    const extensionId = chrome.runtime.id;
    const successUrl = `https://${extensionId}.chromiumapp.org/subscription-success.html`;
    const cancelUrl = `https://${extensionId}.chromiumapp.org/subscription.html`;

    // Call backend to create checkout session
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tierId,
        successUrl,
        cancelUrl,
        userEmail: user.email
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        checkoutUrl: null,
        error: data.message || 'Failed to create checkout session'
      };
    }

    return {
      success: true,
      checkoutUrl: data.checkoutUrl,
      error: null
    };
  } catch (error) {
    console.error('Purchase plan error:', error);
    return {
      success: false,
      checkoutUrl: null,
      error: error.message || 'Network error. Please try again.'
    };
  }
}

/**
 * Activate subscription with license key
 * @param {string} licenseKey - License key from Lemon Squeezy
 * @returns {Promise<{ success: boolean, subscription: Object|null, error: string|null }>}
 */
export async function activateSubscription(licenseKey) {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      return {
        success: false,
        subscription: null,
        error: 'Please login first to activate subscription'
      };
    }

    // Call backend to activate subscription
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/activate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        licenseKey,
        deviceInfo: {
          extensionId: chrome.runtime.id,
          browser: 'Chrome',
          platform: navigator.platform
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        subscription: null,
        error: data.message || 'Activation failed'
      };
    }

    // Store subscription data locally
    await chrome.storage.local.set({
      mta_subscription: data.subscription,
      mta_tier: data.subscription.tier,
      mta_license: licenseKey
    });

    // Reset usage for new tier
    await chrome.storage.local.set({
      mta_usage: {
        periodStart: new Date().toISOString().slice(0, 10),
        analysisCount: 0,
        tier: data.subscription.tier
      }
    });

    return {
      success: true,
      subscription: data.subscription,
      error: null
    };
  } catch (error) {
    console.error('Subscription activation error:', error);
    return {
      success: false,
      subscription: null,
      error: error.message || 'Network error. Please try again.'
    };
  }
}

/**
 * Get current subscription from backend
 * @returns {Promise<{ success: boolean, subscription: Object|null }>}
 */
export async function getSubscription() {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      return { success: false, subscription: null };
    }

    const response = await fetch(`${API_BASE_URL}/api/subscriptions/current`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return { success: false, subscription: null };
    }

    const data = await response.json();

    // Sync subscription data locally
    if (data.subscription) {
      await chrome.storage.local.set({
        mta_subscription: data.subscription,
        mta_tier: data.subscription.tier || 'free'
      });
    }

    return {
      success: true,
      subscription: data.subscription
    };
  } catch (error) {
    console.error('Get subscription error:', error);
    return { success: false, subscription: null };
  }
}

/**
 * Cancel subscription
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function cancelSubscription() {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${API_BASE_URL}/api/subscriptions/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Cancellation failed' };
    }

    // Update local subscription status
    const stored = await chrome.storage.local.get(['mta_subscription']);
    if (stored.mta_subscription) {
      stored.mta_subscription.status = 'cancelled';
      stored.mta_subscription.cancelledAt = Date.now();
      await chrome.storage.local.set({ mta_subscription: stored.mta_subscription });
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update payment method
 * @returns {Promise<{ success: boolean, updateUrl: string|null, error: string|null }>}
 */
export async function updatePaymentMethod() {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      return { success: false, updateUrl: null, error: 'Not authenticated' };
    }

    const response = await fetch(`${API_BASE_URL}/api/subscriptions/update-payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, updateUrl: null, error: data.message || 'Failed to get update URL' };
    }

    return {
      success: true,
      updateUrl: data.updateUrl,
      error: null
    };
  } catch (error) {
    console.error('Update payment method error:', error);
    return { success: false, updateUrl: null, error: error.message };
  }
}

/**
 * Get subscription history
 * @returns {Promise<{ success: boolean, history: Array, error: string|null }>}
 */
export async function getSubscriptionHistory() {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      return { success: false, history: [], error: 'Not authenticated' };
    }

    const response = await fetch(`${API_BASE_URL}/api/subscriptions/history`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, history: [], error: data.message || 'Failed to get history' };
    }

    return {
      success: true,
      history: data.history || [],
      error: null
    };
  } catch (error) {
    console.error('Get subscription history error:', error);
    return { success: false, history: [], error: error.message };
  }
}

/**
 * Sync local subscription with backend
 * Should be called periodically to ensure subscription is up to date
 * @returns {Promise<void>}
 */
export async function syncSubscription() {
  const authenticated = await isAuthenticated();
  
  if (!authenticated) {
    // Not logged in, reset to free tier
    await chrome.storage.local.set({ mta_tier: 'free' });
    await chrome.storage.local.remove(['mta_subscription', 'mta_license']);
    return;
  }

  // Fetch latest subscription from backend
  await getSubscription();
}

/**
 * Handle post-purchase callback
 * Called after successful payment from Lemon Squeezy
 * @param {string} orderId - Order ID from Lemon Squeezy
 * @param {string} licenseKey - License key (if available)
 * @returns {Promise<{ success: boolean, subscription: Object|null }>}
 */
export async function handlePostPurchase(orderId, licenseKey = null) {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      return { success: false, subscription: null };
    }

    // Notify backend of successful purchase
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/verify-purchase`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderId,
        licenseKey,
        source: 'lemon_squeezy'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, subscription: null };
    }

    // Store subscription data
    await chrome.storage.local.set({
      mta_subscription: data.subscription,
      mta_tier: data.subscription.tier,
      mta_license: data.subscription.licenseKey
    });

    // Reset usage
    await chrome.storage.local.set({
      mta_usage: {
        periodStart: new Date().toISOString().slice(0, 10),
        analysisCount: 0,
        tier: data.subscription.tier
      }
    });

    return { success: true, subscription: data.subscription };
  } catch (error) {
    console.error('Post-purchase handler error:', error);
    return { success: false, subscription: null };
  }
}
