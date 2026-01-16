/**
 * PayPal Subscriptions Integration Module
 * Handles checkout, subscription management for UseShield
 * Replaces Lemon Squeezy integration
 */

// PayPal Configuration
// Replace these with your actual Plan IDs from developer.paypal.com
const PAYPAL_CONFIG = {
    // Set to 'sandbox' for testing, 'production' for live
    mode: 'sandbox',

    // Your PayPal Client ID (from developer.paypal.com)
    clientId: {
        sandbox: 'AUbiL9A0Me2_ikZ8ZmDrIQ7FVG_QxTsqQhjhE6CsvaIZyvcACpHmb6z7q5jR62NngBNZUwLqMW6grJae',
        production: 'YOUR_PRODUCTION_CLIENT_ID'
    },

    // Subscription Plan IDs (create these in PayPal dashboard)
    planIds: {
        starter: {
            sandbox: 'P-5T3794135U299950GNFP6CSY',
            production: 'P-STARTER-PRODUCTION-PLAN-ID'
        },
        pro: {
            sandbox: 'P-6FX41678YY880601DNFP6FNA',
            production: 'P-PRO-PRODUCTION-PLAN-ID'
        },
        pro_plus: {
            sandbox: 'P-44H56844BU4653255NFP6G3I',
            production: 'P-PROPLUS-PRODUCTION-PLAN-ID'
        },
        agency: {
            sandbox: 'P-2W469222BB8893546NFP6IZQ',
            production: 'P-AGENCY-PRODUCTION-PLAN-ID'
        }
    },

    // Tier configuration matching database schema
    tierConfig: {
        free: { scansLimit: 3, price: 0, period: 'week', analysisModes: ['flash'] },
        starter: { scansLimit: 15, price: 9.99, period: 'month', analysisModes: ['flash', 'standard'] },
        pro: { scansLimit: 80, price: 29, period: 'month', analysisModes: ['flash', 'standard', 'deepdive'] },
        pro_plus: { scansLimit: 200, price: 59, period: 'month', analysisModes: ['flash', 'standard', 'deepdive'] },
        agency: { scansLimit: 300, price: 99, period: 'month', analysisModes: ['flash', 'standard', 'deepdive', 'neural'] }
    }
};

// Storage keys
const PAYPAL_SUBSCRIPTION_KEY = 'mta_paypal_subscription';

/**
 * Get the current PayPal mode (sandbox or production)
 * @returns {'sandbox' | 'production'}
 */
export function getPayPalMode() {
    return PAYPAL_CONFIG.mode;
}

/**
 * Get PayPal Client ID for current mode
 * @returns {string}
 */
export function getClientId() {
    return PAYPAL_CONFIG.clientId[PAYPAL_CONFIG.mode];
}

/**
 * Get PayPal Subscription Plan ID for a tier
 * @param {string} tierId - Tier name (starter, pro, pro_plus, agency)
 * @returns {string | null}
 */
export function getPlanId(tierId) {
    const tierPlan = PAYPAL_CONFIG.planIds[tierId];
    if (!tierPlan) return null;
    return tierPlan[PAYPAL_CONFIG.mode];
}

/**
 * Get tier configuration
 * @param {string} tierId - Tier name
 * @returns {Object | null}
 */
export function getTierConfig(tierId) {
    return PAYPAL_CONFIG.tierConfig[tierId] || null;
}

/**
 * Get all tier configurations
 * @returns {Object}
 */
export function getAllTiers() {
    return PAYPAL_CONFIG.tierConfig;
}

/**
 * Check if a tier has access to an analysis mode
 * @param {string} tierId - Tier name
 * @param {string} mode - Analysis mode (flash, standard, deepdive, neural)
 * @returns {boolean}
 */
export function tierHasAccessToMode(tierId, mode) {
    const tier = PAYPAL_CONFIG.tierConfig[tierId];
    if (!tier) return false;
    return tier.analysisModes.includes(mode);
}

/**
 * Create a PayPal subscription order
 * This is called by the PayPal SDK's createSubscription callback
 * @param {string} tierId - The tier to subscribe to
 * @returns {string} Plan ID for PayPal SDK
 */
export function createSubscriptionOrder(tierId) {
    const planId = getPlanId(tierId);
    if (!planId || planId.startsWith('P-') === false || planId.includes('SANDBOX') || planId.includes('PRODUCTION')) {
        throw new Error(`PayPal Plan ID not configured for tier: ${tierId}. Please set up plans in PayPal Developer Dashboard.`);
    }
    return planId;
}

/**
 * Handle successful subscription approval
 * Called after user approves subscription in PayPal popup
 * @param {Object} data - PayPal subscription data
 * @param {string} tierId - The tier that was subscribed to
 * @returns {Promise<{success: boolean, subscription?: Object, error?: string}>}
 */
export async function onSubscriptionApproved(data, tierId) {
    try {
        const subscriptionId = data.subscriptionID;
        const orderId = data.orderID;

        if (!subscriptionId) {
            throw new Error('No subscription ID returned from PayPal');
        }

        // Store subscription data locally
        const subscriptionData = {
            paypalSubscriptionId: subscriptionId,
            paypalOrderId: orderId,
            tier: tierId,
            status: 'active',
            createdAt: new Date().toISOString(),
            tierConfig: getTierConfig(tierId)
        };

        await chrome.storage.local.set({
            [PAYPAL_SUBSCRIPTION_KEY]: subscriptionData,
            mta_tier: tierId
        });

        console.log('PayPal subscription activated:', subscriptionData);

        return {
            success: true,
            subscription: subscriptionData
        };
    } catch (error) {
        console.error('Failed to process PayPal subscription:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get stored PayPal subscription
 * @returns {Promise<Object | null>}
 */
export async function getStoredSubscription() {
    const stored = await chrome.storage.local.get([PAYPAL_SUBSCRIPTION_KEY]);
    return stored[PAYPAL_SUBSCRIPTION_KEY] || null;
}

/**
 * Clear stored PayPal subscription (for logout/cancel)
 * @returns {Promise<void>}
 */
export async function clearStoredSubscription() {
    await chrome.storage.local.remove([PAYPAL_SUBSCRIPTION_KEY]);
    await chrome.storage.local.set({ mta_tier: 'free' });
}

/**
 * Get PayPal subscription details from API
 * Note: This requires server-side implementation for production
 * For client-side, we trust our stored data + webhook updates
 * @param {string} subscriptionId - PayPal subscription ID
 * @returns {Promise<Object | null>}
 */
export async function getSubscriptionDetails(subscriptionId) {
    // In a client-only setup, we can't securely call PayPal API
    // This would need a backend proxy or Supabase Edge Function
    // For now, return stored data
    const stored = await getStoredSubscription();
    if (stored && stored.paypalSubscriptionId === subscriptionId) {
        return stored;
    }
    return null;
}

/**
 * Generate PayPal SDK script URL
 * @returns {string}
 */
export function getPayPalScriptUrl() {
    const clientId = getClientId();
    const mode = getPayPalMode();
    const intent = 'subscription';
    const vault = 'true';

    // PayPal SDK URL with subscription intent
    return `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=${vault}&intent=${intent}`;
}

/**
 * Check if PayPal SDK is loaded
 * @returns {boolean}
 */
export function isPayPalSDKLoaded() {
    return typeof window !== 'undefined' && window.paypal !== undefined;
}

/**
 * Generate PayPal subscription buttons configuration
 * @param {string} containerId - DOM element ID to render buttons into
 * @param {string} tierId - Tier to subscribe to
 * @param {Object} callbacks - Callback functions {onApprove, onError, onCancel}
 * @returns {Object} PayPal Buttons configuration
 */
export function getButtonsConfig(containerId, tierId, callbacks = {}) {
    return {
        style: {
            shape: 'rect',
            color: 'blue',
            layout: 'vertical',
            label: 'subscribe'
        },
        createSubscription: function (data, actions) {
            const planId = getPlanId(tierId);
            if (!planId) {
                throw new Error(`Plan ID not configured for tier: ${tierId}`);
            }
            return actions.subscription.create({
                plan_id: planId
            });
        },
        onApprove: async function (data, actions) {
            const result = await onSubscriptionApproved(data, tierId);
            if (callbacks.onApprove) {
                callbacks.onApprove(result);
            }
        },
        onError: function (err) {
            console.error('PayPal subscription error:', err);
            if (callbacks.onError) {
                callbacks.onError(err);
            }
        },
        onCancel: function (data) {
            console.log('PayPal subscription cancelled by user');
            if (callbacks.onCancel) {
                callbacks.onCancel(data);
            }
        }
    };
}

/**
 * Get customer portal URL for managing PayPal subscriptions
 * @returns {string}
 */
export function getCustomerPortalUrl() {
    return 'https://www.paypal.com/myaccount/autopay/';
}

/**
 * Open PayPal customer portal in new tab
 */
export function openCustomerPortal() {
    chrome.tabs.create({ url: getCustomerPortalUrl() });
}

// Export configuration for external use
export { PAYPAL_CONFIG };
