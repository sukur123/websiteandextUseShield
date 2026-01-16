/**
 * Alternatives & Affiliate System
 * Suggests better alternatives when analyzing services with poor terms
 */

import { AlternativeCategories } from './types.js';

// Service category mappings based on domain keywords
const DOMAIN_CATEGORIES = {
  // VPN
  'vpn': 'vpn',
  'nord': 'vpn',
  'express': 'vpn',
  'surfshark': 'vpn',
  'pia': 'vpn',
  'private': 'vpn',
  
  // Cloud Storage
  'dropbox': 'cloud_storage',
  'drive': 'cloud_storage',
  'onedrive': 'cloud_storage',
  'box': 'cloud_storage',
  'mega': 'cloud_storage',
  'sync': 'cloud_storage',
  'icloud': 'cloud_storage',
  
  // Email
  'mail': 'email',
  'gmail': 'email',
  'outlook': 'email',
  'yahoo': 'email',
  'proton': 'email',
  
  // Password Managers
  'lastpass': 'password_manager',
  'password': 'password_manager',
  '1password': 'password_manager',
  'dashlane': 'password_manager',
  'keeper': 'password_manager',
  
  // Hosting
  'hosting': 'hosting',
  'godaddy': 'hosting',
  'bluehost': 'hosting',
  'hostinger': 'hosting',
  'namecheap': 'hosting',
  'cloudflare': 'hosting',
  'aws': 'hosting',
  'azure': 'hosting',
  'vercel': 'hosting',
  'netlify': 'hosting'
};

/**
 * Detect service category from URL/domain
 */
export function detectServiceCategory(url) {
  if (!url) return null;
  
  try {
    const domain = new URL(url).hostname.toLowerCase();
    
    for (const [keyword, category] of Object.entries(DOMAIN_CATEGORIES)) {
      if (domain.includes(keyword)) {
        return category;
      }
    }
  } catch (e) {
    // Invalid URL
  }
  
  return null;
}

/**
 * Get alternative suggestions for a service
 * Only shown when risk score is high (>= 60)
 */
export function getAlternatives(url, riskScore) {
  // Only suggest alternatives for risky services
  if (riskScore < 60) return null;
  
  const category = detectServiceCategory(url);
  if (!category || !AlternativeCategories[category]) return null;
  
  const categoryData = AlternativeCategories[category];
  
  // Filter out the current service
  const currentDomain = new URL(url).hostname.toLowerCase();
  const alternatives = categoryData.services.filter(service => {
    const serviceDomain = new URL(service.url).hostname.toLowerCase();
    return !currentDomain.includes(serviceDomain) && !serviceDomain.includes(currentDomain);
  });
  
  if (alternatives.length === 0) return null;
  
  return {
    category: categoryData.name,
    reason: getRiskReason(riskScore),
    alternatives: alternatives.slice(0, 3).map(alt => ({
      ...alt,
      affiliateUrl: buildAffiliateUrl(alt.url, alt.affiliateId)
    }))
  };
}

/**
 * Build affiliate URL with tracking
 */
function buildAffiliateUrl(baseUrl, affiliateId) {
  if (!affiliateId) return baseUrl;
  
  const url = new URL(baseUrl);
  url.searchParams.set('ref', affiliateId);
  url.searchParams.set('utm_source', 'useshield');
  url.searchParams.set('utm_medium', 'extension');
  url.searchParams.set('utm_campaign', 'alternatives');
  return url.toString();
}

/**
 * Get reason text based on risk score
 */
function getRiskReason(riskScore) {
  if (riskScore >= 80) {
    return 'This service has critical issues in their terms. Consider these consumer-friendly alternatives:';
  } else if (riskScore >= 70) {
    return 'This service has significant concerns. Here are some better alternatives:';
  } else {
    return 'This service has some issues. You might want to consider:';
  }
}

/**
 * Track affiliate click (for analytics)
 */
export async function trackAffiliateClick(service, affiliateId) {
  // Store click for analytics
  const stored = await chrome.storage.local.get(['mta_affiliate_clicks']);
  const clicks = stored.mta_affiliate_clicks || [];
  
  clicks.push({
    service,
    affiliateId,
    timestamp: Date.now()
  });
  
  // Keep last 100 clicks
  if (clicks.length > 100) {
    clicks.shift();
  }
  
  await chrome.storage.local.set({ mta_affiliate_clicks: clicks });
  
  // In production, also send to analytics backend
  // fetch('https://api.useshield.net/analytics/affiliate-click', { ... });
}

/**
 * Get affiliate statistics (for admin/reporting)
 */
export async function getAffiliateStats() {
  const stored = await chrome.storage.local.get(['mta_affiliate_clicks']);
  const clicks = stored.mta_affiliate_clicks || [];
  
  const stats = {};
  clicks.forEach(click => {
    const key = click.service;
    stats[key] = (stats[key] || 0) + 1;
  });
  
  return {
    totalClicks: clicks.length,
    byService: stats,
    last30Days: clicks.filter(c => c.timestamp > Date.now() - 30 * 24 * 60 * 60 * 1000).length
  };
}
