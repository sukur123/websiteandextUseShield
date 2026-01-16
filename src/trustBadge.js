/**
 * Trust Badge System
 * Generates embeddable trust badges for websites that pass analysis
 */

const BADGE_STYLES = {
  light: {
    bg: '#ffffff',
    text: '#0f172a',
    accent: '#1e3a5f'
  },
  dark: {
    bg: '#1a1a2e',
    text: '#ffffff',
    accent: '#0d9488'
  },
  minimal: {
    bg: 'transparent',
    text: '#0f172a',
    accent: '#0f766e'
  }
};

const BADGE_SIZES = {
  small: { width: 120, height: 40, fontSize: 10 },
  medium: { width: 180, height: 50, fontSize: 12 },
  large: { width: 240, height: 60, fontSize: 14 }
};

/**
 * Generate a trust badge for a website
 */
export function generateTrustBadge({ domain, score, verifiedAt, style = 'light', size = 'medium' }) {
  const styleConfig = BADGE_STYLES[style] || BADGE_STYLES.light;
  const sizeConfig = BADGE_SIZES[size] || BADGE_SIZES.medium;
  
  const riskLevel = getRiskLevel(score);
  const statusColor = getStatusColor(riskLevel);
  const statusText = getStatusText(riskLevel);
  
  const verifiedDate = new Date(verifiedAt).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });
  
  // Generate SVG badge
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${sizeConfig.width}" height="${sizeConfig.height}" viewBox="0 0 ${sizeConfig.width} ${sizeConfig.height}">
  <defs>
    <linearGradient id="badgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a5f"/>
      <stop offset="100%" style="stop-color:#0d9488"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${sizeConfig.width}" height="${sizeConfig.height}" rx="8" fill="${styleConfig.bg}" stroke="#e0e0e0" stroke-width="1"/>
  
  <!-- Shield Icon -->
  <g transform="translate(10, ${(sizeConfig.height - 24) / 2})">
    <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V8.26l7-3.89v8.63z" fill="url(#badgeGradient)"/>
  </g>
  
  <!-- Text -->
  <text x="42" y="${sizeConfig.height / 2 - 4}" font-family="system-ui, sans-serif" font-size="${sizeConfig.fontSize}" font-weight="600" fill="${styleConfig.text}">
    Verified by UseShield
  </text>
  <text x="42" y="${sizeConfig.height / 2 + 10}" font-family="system-ui, sans-serif" font-size="${sizeConfig.fontSize - 2}" fill="${statusColor}">
    ${statusText} · ${verifiedDate}
  </text>
  
  <!-- Score circle -->
  <circle cx="${sizeConfig.width - 25}" cy="${sizeConfig.height / 2}" r="15" fill="${statusColor}" opacity="0.15"/>
  <text x="${sizeConfig.width - 25}" y="${sizeConfig.height / 2 + 4}" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="${statusColor}" text-anchor="middle">
    ${score}
  </text>
</svg>`.trim();
  
  return {
    svg,
    html: generateHtmlEmbed(domain, score, style, size),
    markdown: generateMarkdownEmbed(domain, score)
  };
}

/**
 * Generate HTML embed code
 */
function generateHtmlEmbed(domain, score, style, size) {
  const badgeUrl = `https://useshield.net/badge/${encodeURIComponent(domain)}?style=${style}&size=${size}`;
  const verifyUrl = `https://useshield.net/verify/${encodeURIComponent(domain)}`;
  
  return `<!-- UseShield Trust Badge -->
<a href="${verifyUrl}" target="_blank" rel="noopener" title="Verified by UseShield - Trust Score: ${score}">
  <img src="${badgeUrl}" alt="UseShield Verified" style="border:none;"/>
</a>`;
}

/**
 * Generate Markdown embed
 */
function generateMarkdownEmbed(domain, score) {
  const badgeUrl = `https://useshield.net/badge/${encodeURIComponent(domain)}`;
  const verifyUrl = `https://useshield.net/verify/${encodeURIComponent(domain)}`;
  
  return `[![UseShield Verified - Score: ${score}](${badgeUrl})](${verifyUrl})`;
}

/**
 * Get risk level from score
 */
function getRiskLevel(score) {
  if (score <= 25) return 'excellent';
  if (score <= 50) return 'good';
  if (score <= 75) return 'fair';
  return 'poor';
}

/**
 * Get status color based on risk level
 */
function getStatusColor(riskLevel) {
  const colors = {
    excellent: '#27ae60',
    good: '#2ecc71',
    fair: '#f39c12',
    poor: '#e74c3c'
  };
  return colors[riskLevel] || '#888';
}

/**
 * Get status text
 */
function getStatusText(riskLevel) {
  const texts = {
    excellent: 'Excellent Terms',
    good: 'Good Terms',
    fair: 'Fair Terms',
    poor: 'Review Needed'
  };
  return texts[riskLevel] || 'Verified';
}

/**
 * Store badge verification (for tracking)
 */
export async function storeBadgeVerification({ domain, score, url }) {
  const stored = await chrome.storage.local.get(['mta_badge_verifications']);
  const verifications = stored.mta_badge_verifications || {};
  
  verifications[domain] = {
    score,
    url,
    verifiedAt: Date.now(),
    expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000) // 90 days
  };
  
  await chrome.storage.local.set({ mta_badge_verifications: verifications });
  
  return verifications[domain];
}

/**
 * Get badge verification status
 */
export async function getBadgeVerification(domain) {
  const stored = await chrome.storage.local.get(['mta_badge_verifications']);
  const verifications = stored.mta_badge_verifications || {};
  
  const verification = verifications[domain];
  if (!verification) return null;
  
  // Check if expired
  if (verification.expiresAt < Date.now()) {
    return { ...verification, expired: true };
  }
  
  return { ...verification, expired: false };
}

/**
 * Generate badge embed page URL
 */
export function getBadgePageUrl(domain) {
  return `https://useshield.net/badge-generator?domain=${encodeURIComponent(domain)}`;
}
