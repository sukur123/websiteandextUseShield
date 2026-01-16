/**
 * Content script for Money Trap Analyzer
 * Extracts clean, readable text from pages with boilerplate removal and optional PII redaction
 */

/**
 * Common patterns to remove (navigation, footers, etc.)
 */
const BOILERPLATE_SELECTORS = [
  'nav', 'header', 'footer', 'aside',
  '.nav', '.navigation', '.menu', '.sidebar',
  '.footer', '.header', '.cookie-banner', '.cookie-notice',
  '.ad', '.ads', '.advertisement', '.social-share',
  '.comments', '.related-posts', '.recommended',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '#cookie-banner', '#cookie-consent', '#gdpr-banner'
];

/**
 * Selectors that likely contain main content
 */
const CONTENT_SELECTORS = [
  'main', 'article', '[role="main"]',
  '.content', '.main-content', '.post-content', '.article-content',
  '.terms', '.privacy', '.legal', '.policy',
  '#content', '#main', '#main-content'
];

/**
 * PII patterns for redaction
 */
const PII_PATTERNS = [
  // Email addresses
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
  // Phone numbers (various formats)
  { regex: /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g, replacement: '[PHONE]' },
  // SSN
  { regex: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, replacement: '[SSN]' },
  // Credit card numbers
  { regex: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g, replacement: '[CARD]' },
  // IP addresses
  { regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP]' }
];

/**
 * Normalize whitespace
 */
function normalizeWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Remove boilerplate elements from a cloned document
 */
function removeBoilerplate(doc) {
  for (const selector of BOILERPLATE_SELECTORS) {
    try {
      const elements = doc.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    } catch (e) {
      // Invalid selector, skip
    }
  }
}

/**
 * Try to find main content container
 */
function findMainContent(doc) {
  for (const selector of CONTENT_SELECTORS) {
    try {
      const el = doc.querySelector(selector);
      if (el && el.innerText && el.innerText.trim().length > 500) {
        return el;
      }
    } catch (e) {
      // Invalid selector, skip
    }
  }
  return null;
}

/**
 * Extract text from lists with proper formatting
 */
function extractListText(element) {
  const lists = element.querySelectorAll('ul, ol');
  lists.forEach(list => {
    const items = list.querySelectorAll('li');
    items.forEach((item, i) => {
      const prefix = list.tagName === 'OL' ? (i + 1) + '. ' : '• ';
      item.textContent = prefix + item.textContent;
    });
  });
}

/**
 * Redact PII from text
 */
function redactPII(text) {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern.regex, pattern.replacement);
  }
  return result;
}

/**
 * Extract clean page text
 */
function getPageText(options = {}) {
  const { redact = false } = options;
  
  const title = document.title || '';
  
  // Clone the body to avoid modifying the actual page
  const clonedBody = document.body.cloneNode(true);
  
  // Remove scripts, styles, and hidden elements
  const removeElements = clonedBody.querySelectorAll(
    'script, style, noscript, iframe, svg, canvas, video, audio, img, [hidden], [style*="display: none"], [style*="display:none"]'
  );
  removeElements.forEach(el => el.remove());
  
  // Remove boilerplate
  removeBoilerplate(clonedBody);
  
  // Try to find main content
  let contentElement = findMainContent(clonedBody);
  if (!contentElement) {
    contentElement = clonedBody;
  }
  
  // Format lists
  extractListText(contentElement);
  
  // Get text
  let text = contentElement.innerText || '';
  
  // Normalize whitespace but preserve some structure
  text = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
  
  // Remove duplicate blank lines
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Normalize remaining whitespace
  text = normalizeWhitespace(text);
  
  // Optionally redact PII
  if (redact) {
    text = redactPII(text);
  }
  
  // Add title to beginning
  const fullText = title + '\n\n' + text;
  
  return { title, text: fullText };
}

/**
 * Detect if current page is likely a terms/privacy page
 */
function detectPageType() {
  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();
  const h1 = document.querySelector('h1')?.textContent?.toLowerCase() || '';
  
  const patterns = {
    terms: /terms|tos|conditions|agreement|eula/,
    privacy: /privacy|data protection|gdpr/,
    refund: /refund|return|cancellation|money back/,
    billing: /billing|payment|pricing|subscription/,
    cookie: /cookie|tracking/
  };
  
  const types = [];
  const combined = url + ' ' + title + ' ' + h1;
  
  for (const [type, regex] of Object.entries(patterns)) {
    if (regex.test(combined)) {
      types.push(type);
    }
  }
  
  return types.length > 0 ? types : ['unknown'];
}

/**
 * Get page metadata
 */
function getPageMetadata() {
  return {
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title,
    pageTypes: detectPageType(),
    language: document.documentElement.lang || 'unknown',
    lastModified: document.lastModified
  };
}

/**
 * Message listener
 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'MTA_EXTRACT_TEXT') {
    try {
      const options = msg.options || {};
      const { title, text } = getPageText({ redact: options.redactPII });
      const metadata = getPageMetadata();
      
      sendResponse({
        ok: true,
        url: metadata.url,
        domain: metadata.domain,
        title,
        text,
        pageTypes: metadata.pageTypes,
        metadata
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
    return true;
  }
  
  if (msg?.type === 'MTA_GET_METADATA') {
    try {
      sendResponse({ ok: true, metadata: getPageMetadata() });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
    return true;
  }
});

/**
 * Auto-scan functionality - automatically analyze ToS/Privacy pages
 */
async function checkAutoScan() {
  try {
    // Check if auto-scan is enabled
    const stored = await chrome.storage.local.get(['mta_autoScan', 'openaiApiKey']);
    
    if (!stored.mta_autoScan || !stored.openaiApiKey) {
      return; // Auto-scan disabled or no API key
    }
    
    // Detect if this is a ToS/Privacy page
    const pageTypes = detectPageType();
    const isRelevantPage = pageTypes.some(type => 
      ['terms', 'privacy', 'eula', 'refund', 'pricing'].includes(type)
    );
    
    if (!isRelevantPage) {
      return; // Not a relevant page type
    }
    
    // Check if we've already analyzed this URL recently
    const url = window.location.href;
    const cacheKey = 'mta_autoscan_' + btoa(url).slice(0, 32);
    const cacheData = await chrome.storage.local.get([cacheKey]);
    
    if (cacheData[cacheKey]) {
      const lastScan = cacheData[cacheKey];
      const hoursSinceScan = (Date.now() - lastScan) / (1000 * 60 * 60);
      if (hoursSinceScan < 24) {
        return; // Already scanned within 24 hours
      }
    }
    
    // Show a subtle indicator that auto-scan is running
    showAutoScanIndicator();
    
    // Trigger analysis via background script
    const { title, text } = getPageText({ redact: true });
    
    const result = await chrome.runtime.sendMessage({
      type: 'MTA_ANALYZE_TEXT',
      payload: {
        url: url,
        title: title,
        text: text,
        pageType: pageTypes[0],
        autoScan: true
      }
    });
    
    // Mark as scanned
    await chrome.storage.local.set({ [cacheKey]: Date.now() });
    
    // Show result indicator
    if (result && result.ok) {
      showAutoScanResult(result.data);
    } else {
      hideAutoScanIndicator();
    }
    
  } catch (e) {
    console.error('Auto-scan failed:', e);
    hideAutoScanIndicator();
  }
}

/**
 * Show auto-scan indicator
 */
function showAutoScanIndicator() {
  // Remove existing indicator if any
  hideAutoScanIndicator();
  
  const indicator = document.createElement('div');
  indicator.id = 'mta-autoscan-indicator';
  indicator.innerHTML = `
    <style>
      #mta-autoscan-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #1e3a5f 0%, #0d9488 100%);
        color: white;
        padding: 12px 16px;
        border-radius: 12px;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 20px rgba(30, 58, 95, 0.35);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: mta-slide-in 0.3s ease-out;
      }
      @keyframes mta-slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes mta-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      #mta-autoscan-indicator .mta-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: mta-spin 0.8s linear infinite;
      }
    </style>
    <div class="mta-spinner"></div>
    <span>🛡️ Scanning for money traps...</span>
  `;
  document.body.appendChild(indicator);
}

/**
 * Hide auto-scan indicator
 */
function hideAutoScanIndicator() {
  const indicator = document.getElementById('mta-autoscan-indicator');
  if (indicator) {
    indicator.remove();
  }
}

/**
 * Show auto-scan result
 */
function showAutoScanResult(data) {
  hideAutoScanIndicator();
  
  const riskColors = {
    low: '#27ae60',
    medium: '#f39c12',
    high: '#e67e22',
    critical: '#e74c3c'
  };
  
  const result = document.createElement('div');
  result.id = 'mta-autoscan-result';
  result.innerHTML = `
    <style>
      #mta-autoscan-result {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        color: #333;
        padding: 16px;
        border-radius: 12px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 2147483647;
        max-width: 320px;
        animation: mta-slide-in 0.3s ease-out;
        border-left: 4px solid ${riskColors[data.riskLevel] || riskColors.medium};
      }
      #mta-autoscan-result .mta-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      #mta-autoscan-result .mta-title {
        font-weight: 600;
        font-size: 14px;
      }
      #mta-autoscan-result .mta-score {
        background: ${riskColors[data.riskLevel] || riskColors.medium};
        color: white;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: 700;
        font-size: 12px;
      }
      #mta-autoscan-result .mta-summary {
        color: #666;
        line-height: 1.4;
        margin-bottom: 12px;
      }
      #mta-autoscan-result .mta-actions {
        display: flex;
        gap: 8px;
      }
      #mta-autoscan-result .mta-btn {
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.15s;
      }
      #mta-autoscan-result .mta-btn-primary {
        background: linear-gradient(135deg, #1e3a5f 0%, #0d9488 100%);
        color: white;
      }
      #mta-autoscan-result .mta-btn-secondary {
        background: #f5f5f5;
        color: #333;
      }
      #mta-autoscan-result .mta-btn:hover {
        transform: translateY(-1px);
      }
      #mta-autoscan-result .mta-close {
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: #999;
        padding: 4px;
      }
      @media (prefers-color-scheme: dark) {
        #mta-autoscan-result {
          background: #2d2d44;
          color: #e0e0e0;
        }
        #mta-autoscan-result .mta-summary { color: #a0a0a0; }
        #mta-autoscan-result .mta-btn-secondary { background: #3d3d5c; color: #e0e0e0; }
      }
    </style>
    <button class="mta-close" id="mta-close-btn">×</button>
    <div class="mta-header">
      <span class="mta-title">🛡️ Money Trap Analysis</span>
      <span class="mta-score">${data.riskScore}/100</span>
    </div>
    <div class="mta-summary">${truncateText(data.summary, 150)}</div>
    <div class="mta-actions">
      <button class="mta-btn mta-btn-primary" id="mta-view-btn">View Full Report</button>
      <button class="mta-btn mta-btn-secondary" id="mta-dismiss-btn">Dismiss</button>
    </div>
  `;
  
  document.body.appendChild(result);
  
  // Event handlers
  document.getElementById('mta-close-btn').addEventListener('click', hideAutoScanResult);
  document.getElementById('mta-dismiss-btn').addEventListener('click', hideAutoScanResult);
  document.getElementById('mta-view-btn').addEventListener('click', () => {
    // Open extension popup (can't directly, so we'll show a message)
    chrome.runtime.sendMessage({ type: 'MTA_OPEN_POPUP' });
    hideAutoScanResult();
  });
  
  // Auto-hide after 30 seconds
  setTimeout(hideAutoScanResult, 30000);
}

/**
 * Hide auto-scan result
 */
function hideAutoScanResult() {
  const result = document.getElementById('mta-autoscan-result');
  if (result) {
    result.style.animation = 'mta-slide-out 0.3s ease-in forwards';
    setTimeout(() => result.remove(), 300);
  }
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text || '';
  return text.slice(0, maxLength).trim() + '...';
}

// Run auto-scan after page load
if (document.readyState === 'complete') {
  setTimeout(checkAutoScan, 2000);
} else {
  window.addEventListener('load', () => setTimeout(checkAutoScan, 2000));
}
