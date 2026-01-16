/**
 * Severity levels for findings
 */
export const Severity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Categories of clauses to detect
 */
export const Category = {
  AUTO_RENEWAL: 'auto_renewal',
  CANCELLATION: 'cancellation',
  REFUND: 'refund',
  TRIAL: 'trial',
  FEES: 'fees',
  PRICE_CHANGE: 'price_change',
  DATA_SHARING: 'data_sharing',
  DATA_SELLING: 'data_selling',
  ARBITRATION: 'arbitration',
  CLASS_ACTION_WAIVER: 'class_action_waiver',
  TERMINATION: 'termination',
  LIABILITY: 'liability',
  DARK_PATTERN: 'dark_pattern',
  OTHER: 'other'
};

/**
 * Category display names and icons
 */
export const CategoryMeta = {
  [Category.AUTO_RENEWAL]: { name: 'Auto-Renewal', icon: '🔄', color: '#e74c3c' },
  [Category.CANCELLATION]: { name: 'Cancellation', icon: '🚫', color: '#e67e22' },
  [Category.REFUND]: { name: 'Refund', icon: '💸', color: '#f39c12' },
  [Category.TRIAL]: { name: 'Free Trial', icon: '⏱️', color: '#9b59b6' },
  [Category.FEES]: { name: 'Hidden Fees', icon: '💰', color: '#e74c3c' },
  [Category.PRICE_CHANGE]: { name: 'Price Changes', icon: '📈', color: '#e67e22' },
  [Category.DATA_SHARING]: { name: 'Data Sharing', icon: '📤', color: '#3498db' },
  [Category.DATA_SELLING]: { name: 'Data Selling', icon: '🏷️', color: '#e74c3c' },
  [Category.ARBITRATION]: { name: 'Arbitration', icon: '⚖️', color: '#8e44ad' },
  [Category.CLASS_ACTION_WAIVER]: { name: 'Class Action Waiver', icon: '🚷', color: '#c0392b' },
  [Category.TERMINATION]: { name: 'Account Termination', icon: '🔒', color: '#7f8c8d' },
  [Category.LIABILITY]: { name: 'Liability Limits', icon: '🛡️', color: '#95a5a6' },
  [Category.DARK_PATTERN]: { name: 'Dark Pattern', icon: '🎭', color: '#2c3e50' },
  [Category.OTHER]: { name: 'Other', icon: '📋', color: '#bdc3c7' }
};

/**
 * Severity weights for risk score calculation
 */
export const SeverityWeight = {
  [Severity.LOW]: 5,
  [Severity.MEDIUM]: 15,
  [Severity.HIGH]: 30,
  [Severity.CRITICAL]: 50
};

/**
 * @typedef {Object} Clause
 * @property {string} id - Unique identifier
 * @property {string} category - One of Category values
 * @property {string} severity - One of Severity values
 * @property {string} title - Short title of the issue
 * @property {string} summary - Plain language explanation
 * @property {string} quote - Exact quote from the document
 * @property {string} recommendation - What user should do
 * @property {string} [location] - Where in document (section name if available)
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {string} url - Analyzed URL
 * @property {string} title - Page title
 * @property {number} riskScore - 0-100 overall risk score
 * @property {string} riskLevel - low/medium/high/critical
 * @property {string} summary - Plain language overall summary
 * @property {string} whatItMeans - "What this means for you"
 * @property {string} whatToDo - "What you should do"
 * @property {Clause[]} findings - Array of detected clauses
 * @property {Object} stats - Category counts
 * @property {number} analyzedAt - Timestamp
 * @property {string} [hash] - Hash of page content for caching
 */

/**
 * @typedef {Object} WatchlistItem
 * @property {string} id - Unique identifier
 * @property {string} url - URL being watched
 * @property {string} domain - Domain name
 * @property {string} title - Page title
 * @property {string} lastHash - Hash of last analyzed content
 * @property {number} lastChecked - Last check timestamp
 * @property {number} addedAt - When added to watchlist
 * @property {AnalysisResult} [lastResult] - Last analysis result
 * @property {boolean} hasChanges - Whether changes detected since last check
 */

/**
 * @typedef {Object} UsageData
 * @property {string} periodStart - Start of current period (YYYY-MM-DD)
 * @property {number} analysisCount - Number of analyses this period
 * @property {string} tier - subscription tier
 */

/**
 * Subscription Tiers with Pricing
 */
export const SubscriptionTiers = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'week',
    scansPerPeriod: 3,
    features: {
      watchlistSize: 2,
      exportEnabled: false,
      compareEnabled: false,
      alertsEnabled: false,
      alternativesEnabled: false,
      apiAccess: false,
      prioritySupport: false,
      teamMembers: 0,
      trustBadge: false
    },
    stripePriceId: null,
    lemonsqueezyVariantId: null,
    popular: false
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 9.99,
    period: 'month',
    scansPerPeriod: 15,
    features: {
      watchlistSize: 10,
      exportEnabled: true,
      compareEnabled: true,
      alertsEnabled: true,
      alternativesEnabled: true,
      apiAccess: false,
      prioritySupport: false,
      teamMembers: 0,
      trustBadge: false
    },
    stripePriceId: 'price_starter_monthly',
    lemonsqueezyVariantId: 'your-starter-variant-id', // Replace with actual Lemon Squeezy variant ID
    popular: false
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 29,
    period: 'month',
    scansPerPeriod: 80,
    features: {
      watchlistSize: 50,
      exportEnabled: true,
      compareEnabled: true,
      alertsEnabled: true,
      alternativesEnabled: true,
      apiAccess: false,
      prioritySupport: true,
      teamMembers: 0,
      trustBadge: false
    },
    stripePriceId: 'price_pro_monthly',
    lemonsqueezyVariantId: 'your-pro-variant-id', // Replace with actual Lemon Squeezy variant ID
    popular: true
  },
  pro_plus: {
    id: 'pro_plus',
    name: 'Pro Plus',
    price: 60,
    period: 'month',
    scansPerPeriod: 200,
    features: {
      watchlistSize: 100,
      exportEnabled: true,
      compareEnabled: true,
      alertsEnabled: true,
      alternativesEnabled: true,
      apiAccess: true,
      prioritySupport: true,
      teamMembers: 3,
      trustBadge: true
    },
    stripePriceId: 'price_pro_plus_monthly',
    lemonsqueezyVariantId: 'your-pro-plus-variant-id', // Replace with actual Lemon Squeezy variant ID
    popular: false
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    price: 100,
    period: 'month',
    scansPerPeriod: 300,
    features: {
      watchlistSize: 500,
      exportEnabled: true,
      compareEnabled: true,
      alertsEnabled: true,
      alternativesEnabled: true,
      apiAccess: true,
      prioritySupport: true,
      teamMembers: 10,
      trustBadge: true,
      whiteLabel: true,
      bulkAnalysis: true
    },
    stripePriceId: 'price_agency_monthly',
    lemonsqueezyVariantId: 'your-agency-variant-id', // Replace with actual Lemon Squeezy variant ID
    popular: false
  }
};

/**
 * Legacy TierLimits for backward compatibility
 */
export const TierLimits = {
  free: { dailyAnalyses: 3, watchlistSize: 2, exportEnabled: false, compareEnabled: false, alertsEnabled: false },
  starter: { dailyAnalyses: 15, watchlistSize: 10, exportEnabled: true, compareEnabled: true, alertsEnabled: true },
  pro: { dailyAnalyses: 80, watchlistSize: 50, exportEnabled: true, compareEnabled: true, alertsEnabled: true },
  pro_plus: { dailyAnalyses: 200, watchlistSize: 100, exportEnabled: true, compareEnabled: true, alertsEnabled: true },
  agency: { dailyAnalyses: 300, watchlistSize: 500, exportEnabled: true, compareEnabled: true, alertsEnabled: true }
};

/**
 * Alternative service suggestions with affiliate data
 */
export const AlternativeCategories = {
  vpn: {
    name: 'VPN Services',
    services: [
      { name: 'NordVPN', url: 'https://nordvpn.com', affiliateId: 'useshield', trustScore: 85 },
      { name: 'ExpressVPN', url: 'https://expressvpn.com', affiliateId: 'useshield', trustScore: 82 },
      { name: 'ProtonVPN', url: 'https://protonvpn.com', affiliateId: 'useshield', trustScore: 90 }
    ]
  },
  cloud_storage: {
    name: 'Cloud Storage',
    services: [
      { name: 'pCloud', url: 'https://pcloud.com', affiliateId: 'useshield', trustScore: 88 },
      { name: 'Sync.com', url: 'https://sync.com', affiliateId: 'useshield', trustScore: 85 },
      { name: 'Tresorit', url: 'https://tresorit.com', affiliateId: 'useshield', trustScore: 92 }
    ]
  },
  email: {
    name: 'Email Providers',
    services: [
      { name: 'ProtonMail', url: 'https://proton.me', affiliateId: 'useshield', trustScore: 95 },
      { name: 'Tutanota', url: 'https://tutanota.com', affiliateId: 'useshield', trustScore: 90 },
      { name: 'Fastmail', url: 'https://fastmail.com', affiliateId: 'useshield', trustScore: 85 }
    ]
  },
  password_manager: {
    name: 'Password Managers',
    services: [
      { name: 'Bitwarden', url: 'https://bitwarden.com', affiliateId: 'useshield', trustScore: 95 },
      { name: '1Password', url: 'https://1password.com', affiliateId: 'useshield', trustScore: 88 },
      { name: 'Dashlane', url: 'https://dashlane.com', affiliateId: 'useshield', trustScore: 82 }
    ]
  },
  hosting: {
    name: 'Web Hosting',
    services: [
      { name: 'Cloudflare', url: 'https://cloudflare.com', affiliateId: 'useshield', trustScore: 85 },
      { name: 'DigitalOcean', url: 'https://digitalocean.com', affiliateId: 'useshield', trustScore: 88 },
      { name: 'Vercel', url: 'https://vercel.com', affiliateId: 'useshield', trustScore: 90 }
    ]
  }
};

/**
 * Risk level thresholds
 */
export const RiskThresholds = {
  low: 25,
  medium: 50,
  high: 75
  // above 75 = critical
};

/**
 * Get risk level from score
 */
export function getRiskLevel(score) {
  if (score <= RiskThresholds.low) return 'low';
  if (score <= RiskThresholds.medium) return 'medium';
  if (score <= RiskThresholds.high) return 'high';
  return 'critical';
}

/**
 * Risk level colors
 */
export const RiskLevelColors = {
  low: '#27ae60',
  medium: '#f39c12',
  high: '#e67e22',
  critical: '#e74c3c'
};
