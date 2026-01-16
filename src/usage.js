import { SubscriptionTiers, TierLimits } from './types.js';

const USAGE_KEY = 'mta_usage';
const TIER_KEY = 'mta_tier';
const SUBSCRIPTION_KEY = 'mta_subscription';

/**
 * Get current date string YYYY-MM-DD
 */
function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Get the start of the current week (Monday)
 */
function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

/**
 * Get the start of the current month
 */
function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Get period start based on tier
 */
function getPeriodStart(tier) {
  const tierConfig = SubscriptionTiers[tier] || SubscriptionTiers.free;
  return tierConfig.period === 'week' ? getWeekStart() : getMonthStart();
}

/**
 * Get current usage data with period-aware tracking
 * @returns {Promise<{ periodStart: string, analysisCount: number, tier: string, period: string }>}
 */
export async function getUsage() {
  const stored = await chrome.storage.local.get([USAGE_KEY, TIER_KEY, SUBSCRIPTION_KEY]);
  const tier = stored[TIER_KEY] || 'free';
  const tierConfig = SubscriptionTiers[tier] || SubscriptionTiers.free;
  const currentPeriodStart = getPeriodStart(tier);
  
  let usage = stored[USAGE_KEY];
  
  // Reset usage if we're in a new period
  if (!usage || usage.periodStart !== currentPeriodStart || usage.tier !== tier) {
    usage = { 
      periodStart: currentPeriodStart, 
      analysisCount: 0,
      tier: tier
    };
    await chrome.storage.local.set({ [USAGE_KEY]: usage });
  }

  return { 
    ...usage, 
    tier,
    period: tierConfig.period,
    limit: tierConfig.scansPerPeriod
  };
}

/**
 * Increment usage count
 */
export async function incrementUsage() {
  const usage = await getUsage();
  usage.analysisCount += 1;
  await chrome.storage.local.set({ 
    [USAGE_KEY]: { 
      periodStart: usage.periodStart, 
      analysisCount: usage.analysisCount,
      tier: usage.tier
    } 
  });
  return usage;
}

/**
 * Check if user can perform analysis
 * @returns {Promise<{ allowed: boolean, remaining: number, tier: string, limit: number, period: string, resetDate: string }>}
 */
export async function checkUsageLimit() {
  const usage = await getUsage();
  const tierConfig = SubscriptionTiers[usage.tier] || SubscriptionTiers.free;
  const limit = tierConfig.scansPerPeriod;
  const remaining = Math.max(0, limit - usage.analysisCount);
  
  // Calculate when the period resets
  let resetDate;
  if (tierConfig.period === 'week') {
    const weekStart = new Date(usage.periodStart);
    weekStart.setDate(weekStart.getDate() + 7);
    resetDate = weekStart.toISOString().slice(0, 10);
  } else {
    const monthStart = new Date(usage.periodStart);
    monthStart.setMonth(monthStart.getMonth() + 1);
    resetDate = monthStart.toISOString().slice(0, 10);
  }
  
  return {
    allowed: usage.analysisCount < limit,
    remaining,
    used: usage.analysisCount,
    tier: usage.tier,
    tierName: tierConfig.name,
    limit,
    period: tierConfig.period,
    resetDate,
    features: tierConfig.features
  };
}

/**
 * Get subscription status
 */
export async function getSubscription() {
  const stored = await chrome.storage.local.get([SUBSCRIPTION_KEY, TIER_KEY]);
  const tier = stored[TIER_KEY] || 'free';
  const subscription = stored[SUBSCRIPTION_KEY] || null;
  const tierConfig = SubscriptionTiers[tier] || SubscriptionTiers.free;
  
  return {
    tier,
    tierConfig,
    subscription,
    isActive: tier !== 'free' && subscription?.status === 'active',
    expiresAt: subscription?.expiresAt || null
  };
}

/**
 * Set subscription (called after successful payment)
 */
export async function setSubscription({ tier, stripeSubscriptionId, stripeCustomerId, expiresAt }) {
  if (!SubscriptionTiers[tier]) {
    throw new Error(`Invalid tier: ${tier}`);
  }
  
  const subscription = {
    tier,
    stripeSubscriptionId,
    stripeCustomerId,
    status: 'active',
    createdAt: Date.now(),
    expiresAt
  };
  
  await chrome.storage.local.set({ 
    [TIER_KEY]: tier,
    [SUBSCRIPTION_KEY]: subscription,
    // Reset usage for new subscription
    [USAGE_KEY]: {
      periodStart: getPeriodStart(tier),
      analysisCount: 0,
      tier
    }
  });
  
  return subscription;
}

/**
 * Cancel subscription (downgrade to free)
 */
export async function cancelSubscription() {
  await chrome.storage.local.set({
    [TIER_KEY]: 'free',
    [SUBSCRIPTION_KEY]: null,
    [USAGE_KEY]: {
      periodStart: getWeekStart(),
      analysisCount: 0,
      tier: 'free'
    }
  });
}

/**
 * Get tier capabilities
 */
export async function getTierCapabilities() {
  const stored = await chrome.storage.local.get([TIER_KEY]);
  const tier = stored[TIER_KEY] || 'free';
  const tierConfig = SubscriptionTiers[tier] || SubscriptionTiers.free;
  return { tier, ...tierConfig.features, scansPerPeriod: tierConfig.scansPerPeriod };
}

/**
 * Check if a feature is available for current tier
 */
export async function hasFeature(featureName) {
  const capabilities = await getTierCapabilities();
  return !!capabilities[featureName];
}

/**
 * Set user tier (for testing / manual upgrade)
 */
export async function setTier(tier) {
  if (!SubscriptionTiers[tier]) {
    throw new Error(`Invalid tier: ${tier}`);
  }
  await chrome.storage.local.set({ 
    [TIER_KEY]: tier,
    [USAGE_KEY]: {
      periodStart: getPeriodStart(tier),
      analysisCount: 0,
      tier
    }
  });
}

/**
 * Reset usage (for testing)
 */
export async function resetUsage() {
  const tier = (await chrome.storage.local.get([TIER_KEY]))[TIER_KEY] || 'free';
  await chrome.storage.local.set({
    [USAGE_KEY]: {
      periodStart: getPeriodStart(tier),
      analysisCount: 0,
      tier
    }
  });
}

/**
 * Get all subscription tiers for display
 */
export function getAllTiers() {
  return Object.values(SubscriptionTiers);
}

/**
 * Get formatted usage info for UI display
 * This is an alias for checkUsageLimit with additional formatting
 */
export async function getUsageDisplayInfo() {
  return await checkUsageLimit();
}
