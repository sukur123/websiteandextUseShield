/**
 * Subscription Module - Supabase Integration
 * Handles subscription management with Supabase database
 * No backend server required - uses Supabase directly
 */

import { getCurrentUser, getSupabase } from './auth.js';

// Supabase Configuration
const SUPABASE_URL = 'https://fmptjjpwndojeywyacum.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcHRqanB3bmRvamV5d3lhY3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDIyNDUsImV4cCI6MjA4MzI3ODI0NX0.g8oiu_U5smCC8o8EKG4VYrvz-NTaYsB4hXmcdO_TTxo';

// Helper to get session token
async function getAuthToken() {
  const { supabase_session } = await chrome.storage.local.get(['supabase_session']);
  return supabase_session?.access_token || null;
}

// Helper to make authenticated Supabase requests
async function supabaseRequest(endpoint, options = {}) {
  const token = await getAuthToken();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.text();
    // Check for JWT expired
    if (error.includes('JWT expired')) {
      console.log('[Subscription] JWT expired, redirecting to login...');
      // Clear session locally to force logout/re-login state
      await chrome.storage.local.remove(['supabase_session']);
      throw new Error('Not authenticated. Please log in.');
    }
    throw new Error(`Supabase request failed: ${error}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Helper to call RPC functions
async function supabaseRPC(functionName, params = {}) {
  const token = await getAuthToken();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RPC call failed: ${error}`);
  }

  return response.json();
}

// Tier configurations
const TIER_CONFIG = {
  free: { scansLimit: 3, price: 0, period: 'week' },
  starter: { scansLimit: 15, price: 9.99, period: 'month' },
  pro: { scansLimit: 80, price: 29, period: 'month' },
  pro_plus: { scansLimit: 200, price: 60, period: 'month' },
  agency: { scansLimit: 300, price: 100, period: 'month' }
};

/**
 * Get current user's subscription from Supabase
 * @returns {Promise<Object|null>}
 */
export async function getSubscription() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Query subscriptions table via REST API
    const data = await supabaseRequest(
      `subscriptions?user_id=eq.${user.id}&status=eq.active&order=created_at.desc&limit=1`,
      { method: 'GET', headers: { 'Prefer': 'return=representation' } }
    );

    if (!data || data.length === 0) {
      // No subscription found - create free tier
      return await createFreeSubscription();
    }

    const subscription = data[0];

    // Store subscription data locally
    await chrome.storage.local.set({
      mta_tier: subscription.tier,
      mta_subscription: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        scansUsed: subscription.scans_used,
        scansLimit: subscription.scans_limit,
        expiresAt: subscription.expires_at,
        autoRenew: subscription.auto_renew
      }
    });

    console.log('[Subscription] Fetched subscription:', {
      tier: subscription.tier,
      status: subscription.status,
      scansUsed: subscription.scans_used,
      scansLimit: subscription.scans_limit
    });

    return {
      id: subscription.id,
      tier: subscription.tier,
      status: subscription.status,
      licenseKey: subscription.license_key,
      startDate: subscription.start_date,
      expiresAt: subscription.expires_at,
      scansUsed: subscription.scans_used,
      scansLimit: subscription.scans_limit,
      autoRenew: subscription.auto_renew
    };
  } catch (error) {
    console.error('Get subscription error:', error);
    return null;
  }
}

/**
 * Create free tier subscription for new users
 * @returns {Promise<Object>}
 */
export async function createFreeSubscription() {
  try {
    const supabase = getSupabase();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const config = TIER_CONFIG.free;
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 10); // Free never expires

    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        tier: 'free',
        status: 'active',
        scans_limit: config.scansLimit,
        scans_used: 0,
        expires_at: expiresAt.toISOString(),
        auto_renew: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Store locally
    await chrome.storage.local.set({
      mta_tier: 'free',
      mta_subscription: {
        id: data.id,
        tier: 'free',
        status: 'active',
        scansUsed: 0,
        scansLimit: config.scansLimit,
        expiresAt: data.expires_at,
        autoRenew: true
      }
    });

    return {
      id: data.id,
      tier: 'free',
      status: 'active',
      scansUsed: 0,
      scansLimit: config.scansLimit,
      expiresAt: data.expires_at
    };
  } catch (error) {
    console.error('Create free subscription error:', error);
    throw error;
  }
}

/**
 * Check if user can analyze (within usage limits)
 * @returns {Promise<{allowed: boolean, reason?: string, subscription?: Object}>}
 */
export async function canAnalyze() {
  try {
    const subscription = await getSubscription();

    if (!subscription) {
      return {
        allowed: false,
        reason: 'No subscription found'
      };
    }

    // Check if expired
    if (new Date(subscription.expiresAt) < new Date()) {
      return {
        allowed: false,
        reason: 'Subscription expired',
        subscription
      };
    }

    // Check usage limit
    if (subscription.scansUsed >= subscription.scansLimit) {
      return {
        allowed: false,
        reason: 'Usage limit reached',
        subscription
      };
    }

    return {
      allowed: true,
      subscription
    };
  } catch (error) {
    console.error('Can analyze check error:', error);
    return {
      allowed: false,
      reason: 'Error checking subscription'
    };
  }
}

/**
 * Record an analysis and increment usage counter
 * @param {string} url - URL analyzed
 * @param {number} riskScore - Risk score from analysis
 * @returns {Promise<{success: boolean, subscription?: Object, error?: string}>}
 */
export async function recordAnalysis(url, riskScore) {
  try {
    const supabase = getSupabase();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Use Supabase RPC function to increment usage
    const { data, error } = await supabase.rpc('increment_scan_usage', {
      p_user_id: user.id,
      p_url: url,
      p_risk_score: riskScore
    });

    if (error) {
      throw error;
    }

    // Update local storage
    if (data) {
      await chrome.storage.local.set({
        mta_subscription: {
          id: data.id,
          tier: data.tier,
          status: data.status,
          scansUsed: data.scans_used,
          scansLimit: data.scans_limit,
          expiresAt: data.expires_at,
          autoRenew: data.auto_renew
        }
      });
    }

    return {
      success: true,
      subscription: data
    };
  } catch (error) {
    console.error('Record analysis error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upgrade subscription to paid tier
 * @param {string} tier - Target tier (starter, pro, pro_plus, agency)
 * @param {string} paypalSubscriptionId - PayPal Subscription ID
 * @param {string} paypalPayerId - PayPal Payer ID (optional)
 * @returns {Promise<{success: boolean, subscription?: Object, error?: string}>}
 */
export async function upgradeSubscription(tier, paypalSubscriptionId, paypalPayerId = null) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    if (!TIER_CONFIG[tier]) {
      throw new Error('Invalid tier');
    }

    const config = TIER_CONFIG[tier];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

    // Update subscription via REST API
    const updateData = await supabaseRequest(
      `subscriptions?user_id=eq.${user.id}`,
      {
        method: 'PATCH',
        headers: {
          'Prefer': 'return=representation',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tier: tier,
          status: 'active',
          scans_limit: config.scansLimit,
          scans_used: 0,
          paypal_subscription_id: paypalSubscriptionId,
          paypal_payer_id: paypalPayerId,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    );

    const data = updateData && updateData[0] ? updateData[0] : null;

    // Update local storage
    await chrome.storage.local.set({
      mta_tier: tier,
      mta_subscription: {
        id: data?.id,
        tier: tier,
        status: 'active',
        scansUsed: 0,
        scansLimit: config.scansLimit,
        expiresAt: expiresAt.toISOString(),
        autoRenew: true
      }
    });

    console.log('[Subscription] Upgraded to tier:', tier);

    return {
      success: true,
      subscription: {
        tier: tier,
        status: 'active',
        scansLimit: config.scansLimit,
        expiresAt: expiresAt.toISOString()
      }
    };
  } catch (error) {
    console.error('Upgrade subscription error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Manually set subscription tier (for testing/debugging)
 * This only updates local storage without touching Supabase
 * @param {string} tier - Tier to set
 */
export async function setTierLocally(tier) {
  const config = TIER_CONFIG[tier];
  if (!config) {
    console.error('Invalid tier:', tier);
    return;
  }

  await chrome.storage.local.set({
    mta_tier: tier,
    mta_subscription: {
      tier: tier,
      status: 'active',
      scansUsed: 0,
      scansLimit: config.scansLimit,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: true
    }
  });

  console.log('[Subscription] Tier set locally to:', tier, 'with limit:', config.scansLimit);
}

/**
 * Cancel subscription (downgrade to free)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function cancelSubscription() {
  try {
    const supabase = getSupabase();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Set auto_renew to false and status to cancelled
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        auto_renew: false,
        status: 'cancelled'
      })
      .eq('user_id', user.id)
      .eq('status', 'active')
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update local storage
    await chrome.storage.local.set({
      mta_subscription: {
        tier: data.tier,
        status: 'cancelled',
        scansUsed: data.scans_used,
        scansLimit: data.scans_limit,
        expiresAt: data.expires_at,
        autoRenew: false
      }
    });

    return {
      success: true,
      message: `Subscription cancelled. Access continues until ${new Date(data.expires_at).toLocaleDateString()}`
    };
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sync subscription from Supabase (refresh local data)
 * @returns {Promise<{success: boolean, subscription?: Object, error?: string}>}
 */
export async function syncSubscription() {
  try {
    const subscription = await getSubscription();

    if (!subscription) {
      throw new Error('No subscription found');
    }

    return {
      success: true,
      subscription
    };
  } catch (error) {
    console.error('Sync subscription error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get usage statistics
 * @param {number} days - Number of days to look back (default 30)
 * @returns {Promise<Object>}
 */
export async function getUsageStats(days = 30) {
  try {
    const supabase = getSupabase();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .gte('analysis_date', startDate.toISOString())
      .order('analysis_date', { ascending: false });

    if (error) {
      throw error;
    }

    // Calculate statistics
    const stats = {
      totalScans: data.length,
      averageRiskScore: 0,
      highRiskCount: 0,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      recentScans: data.slice(0, 10)
    };

    if (data.length > 0) {
      const totalScore = data.reduce((sum, item) => sum + (item.risk_score || 0), 0);
      stats.averageRiskScore = Math.round(totalScore / data.length);

      data.forEach(item => {
        const score = item.risk_score || 0;
        if (score >= 70) stats.highRiskCount++;
        else if (score >= 40) stats.mediumRiskCount++;
        else stats.lowRiskCount++;
      });
    }

    return stats;
  } catch (error) {
    console.error('Get usage stats error:', error);
    return null;
  }
}

/**
 * Reset usage counter (for new billing period)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function resetUsageCounter() {
  try {
    const supabase = getSupabase();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update({ scans_used: 0 })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update local storage
    await chrome.storage.local.set({
      mta_subscription: {
        tier: data.tier,
        status: data.status,
        scansUsed: 0,
        scansLimit: data.scans_limit,
        expiresAt: data.expires_at,
        autoRenew: data.auto_renew
      }
    });

    return {
      success: true
    };
  } catch (error) {
    console.error('Reset usage error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
