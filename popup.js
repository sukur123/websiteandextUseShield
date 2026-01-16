/**
 * UseShield - Main Popup Logic
 * SPA-style with authentication and subscription routing
 */

import { initRouter, navigateTo, getUser, getSubscriptionData, refreshSubscription } from './src/router.js';

// Initialize router when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initializing...');
  const loadingOverlay = document.getElementById('loadingOverlay');

  try {
    // Wait for router to fetch auth/subscription from Supabase
    await initRouter();
    initMainApp();
  } catch (error) {
    console.error('[Popup] Initialization error:', error);
  } finally {
    // Hide loading overlay with fade animation
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  }
});

const CATEGORY_NAMES = {
  auto_renewal: 'Auto-Renewal',
  cancellation: 'Cancellation',
  refund: 'Refund',
  trial: 'Trial',
  fees: 'Fees',
  price_change: 'Price Change',
  data_sharing: 'Data Sharing',
  data_selling: 'Data Selling',
  arbitration: 'Arbitration',
  class_action_waiver: 'Class Action',
  termination: 'Termination',
  liability: 'Liability',
  dark_pattern: 'Dark Pattern',
  other: 'Other'
};

const RISK_COLORS = {
  low: '#27ae60',
  medium: '#f39c12',
  high: '#e67e22',
  critical: '#e74c3c'
};

const RISK_LABELS = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical Risk'
};

// Sound notification frequencies for Web Audio API
const ALERT_SOUNDS = {
  low: { frequency: 440, duration: 150, type: 'sine' },      // A4 - pleasant
  medium: { frequency: 523, duration: 200, type: 'sine' },   // C5 - attention
  high: { frequency: 659, duration: 250, type: 'triangle' }, // E5 - warning
  critical: { frequency: 880, duration: 400, type: 'sawtooth' } // A5 - alert!
};

// Tier names for display
const TIER_NAMES = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  pro_plus: 'Pro Plus',
  agency: 'Agency'
};

// Tier features for feature gating
const TIER_FEATURES = {
  free: { watchlistSize: 2, exportEnabled: false, compareEnabled: false, alternativesEnabled: false },
  starter: { watchlistSize: 10, exportEnabled: true, compareEnabled: true, alternativesEnabled: true },
  pro: { watchlistSize: 50, exportEnabled: true, compareEnabled: true, alternativesEnabled: true },
  pro_plus: { watchlistSize: 100, exportEnabled: true, compareEnabled: true, alternativesEnabled: true },
  agency: { watchlistSize: 500, exportEnabled: true, compareEnabled: true, alternativesEnabled: true }
};

// Alternatives data (for high-risk services)
const ALTERNATIVE_CATEGORIES = {
  vpn: {
    name: 'VPN Services',
    services: [
      { name: 'NordVPN', url: 'https://nordvpn.com/?ref=useshield', trustScore: 85 },
      { name: 'ProtonVPN', url: 'https://protonvpn.com/?ref=useshield', trustScore: 90 }
    ]
  },
  cloud_storage: {
    name: 'Cloud Storage',
    services: [
      { name: 'pCloud', url: 'https://pcloud.com/?ref=useshield', trustScore: 88 },
      { name: 'Sync.com', url: 'https://sync.com/?ref=useshield', trustScore: 85 }
    ]
  },
  email: {
    name: 'Email',
    services: [
      { name: 'ProtonMail', url: 'https://proton.me/?ref=useshield', trustScore: 95 },
      { name: 'Tutanota', url: 'https://tutanota.com/?ref=useshield', trustScore: 90 }
    ]
  }
};

const analyzeBtn = document.getElementById('analyzeBtn');
const optionsBtn = document.getElementById('optionsBtn');
const watchlistBtn = document.getElementById('watchlistBtn');
const compareBtn = document.getElementById('compareBtn');
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const usageInfoEl = document.getElementById('usageInfo');
const cacheIndicatorEl = document.getElementById('cacheIndicator');
const pageTypeEl = document.getElementById('pageType');

const scoreSectionEl = document.getElementById('scoreSection');
const gaugeArcEl = document.getElementById('gaugeArc');
const scoreNumberEl = document.getElementById('scoreNumber');
const riskBadgeEl = document.getElementById('riskBadge');

const summarySectionEl = document.getElementById('summarySection');
const summaryTextEl = document.getElementById('summaryText');
const whatItMeansEl = document.getElementById('whatItMeans');
const whatToDoEl = document.getElementById('whatToDo');

const statsSectionEl = document.getElementById('statsSection');
const statCriticalEl = document.getElementById('statCritical');
const statHighEl = document.getElementById('statHigh');
const statMediumEl = document.getElementById('statMedium');
const statLowEl = document.getElementById('statLow');

const findingsSectionEl = document.getElementById('findingsSection');
const findingsCountEl = document.getElementById('findingsCount');
const findingsListEl = document.getElementById('findingsList');

const actionsSectionEl = document.getElementById('actionsSection');
const exportBtn = document.getElementById('exportBtn');
const addWatchlistBtn = document.getElementById('addWatchlistBtn');

// Progress Bar
const progressContainerEl = document.getElementById('progressContainer');
const progressFillEl = document.getElementById('progressFill');
const progressTextEl = document.getElementById('progressText');

// Quick Actions
const quickActionsSectionEl = document.getElementById('quickActionsSection');
const copyBtn = document.getElementById('copyBtn');
const shareBtn = document.getElementById('shareBtn');
const flagBtn = document.getElementById('flagBtn');
const refreshBtn = document.getElementById('refreshBtn');

let currentResult = null;
let skipCache = false; // Flag for refresh action
let lastErrorContext = null; // Store context for retry

function getUiIconSvg(name) {
  const icons = {
    check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    warning: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-15 6.36L3 15"/><path d="M3 15v6h6"/><path d="M3 12a9 9 0 0 1 15-6.36L21 9"/><path d="M21 9V3h-6"/></svg>',
    key: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1 7.78 7.78 5.5 5.5 0 0 1-7.78-7.78z"/><path d="M16 7l3 3"/><path d="M14 10l-9.5 9.5H2v-2.5L11.5 7.5"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    lightbulb: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.5.5 1 1.5 1 2h6c0-.5.5-1.5 1-2a7 7 0 0 0-4-12z"/></svg>'
  };

  return icons[name] || icons.info;
}

// ===== TOAST NOTIFICATION SYSTEM =====
function showToast(message, type = 'info', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const typeToIcon = {
    success: 'check',
    error: 'x',
    warning: 'warning',
    info: 'info'
  };

  const toast = document.createElement('div');
  toast.className = 'toast ' + type;

  const iconEl = document.createElement('span');
  iconEl.className = 'toast-icon';
  iconEl.innerHTML = getUiIconSvg(typeToIcon[type] || 'info');

  const msgEl = document.createElement('span');
  msgEl.className = 'toast-message';
  msgEl.textContent = String(message);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = getUiIconSvg('x');

  toast.appendChild(iconEl);
  toast.appendChild(msgEl);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  const removeToast = function () {
    toast.classList.add('removing');
    setTimeout(function () { toast.remove(); }, 300);
  };

  closeBtn.addEventListener('click', removeToast);

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }

  return toast;
}

// ===== CONFIRMATION DIALOG =====
function showConfirmDialog(options) {
  return new Promise(function (resolve) {
    const { title, message, confirmText, cancelText, type } = Object.assign({
      title: 'Confirm Action',
      message: 'Are you sure?',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      type: 'warning' // 'warning', 'danger', 'info'
    }, options);

    const icons = {
      warning: getUiIconSvg('warning'),
      danger: getUiIconSvg('trash'),
      info: getUiIconSvg('info')
    };

    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-icon" aria-hidden="true">${icons[type] || icons.warning}</div>
        <h3 class="confirm-title">${title}</h3>
        <p class="confirm-message">${message}</p>
        <div class="confirm-actions">
          <button class="confirm-btn cancel">${cancelText}</button>
          <button class="confirm-btn confirm ${type}">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(function () {
      overlay.classList.add('visible');
    });

    const confirmBtn = overlay.querySelector('.confirm-btn.confirm');
    const cancelBtn = overlay.querySelector('.confirm-btn.cancel');

    function close(result) {
      overlay.classList.remove('visible');
      setTimeout(function () { overlay.remove(); }, 300);
      resolve(result);
    }

    confirmBtn.addEventListener('click', function () { close(true); });
    cancelBtn.addEventListener('click', function () { close(false); });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close(false);
    });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        close(false);
        document.removeEventListener('keydown', handler);
      }
    });

    // Focus the cancel button by default (safer option)
    cancelBtn.focus();
    trapFocus(overlay.querySelector('.confirm-dialog'));
  });
}

function setStatus(text) {
  statusEl.textContent = text || '';
}

function setError(text, retryable = true) {
  errorEl.hidden = !text;
  if (!text) {
    errorEl.innerHTML = '';
    return;
  }

  // Determine error type and show appropriate message
  let errorType = 'unknown';
  let userMessage = text;
  let suggestion = '';

  if (text.includes('Not authenticated') || text.includes('Please log in')) {
    errorType = 'auth';
    userMessage = 'Authentication Required';
    suggestion = 'Please log in to analyze Terms of Service.';
  } else if (text.includes('API key') || text.includes('401') || text.includes('Unauthorized')) {
    errorType = 'auth';
    userMessage = 'Authentication Error';
    suggestion = 'Session expired. Please log in again.';
  } else if (text.includes('429') || text.includes('rate limit') || text.includes('quota')) {
    errorType = 'rate_limit';
    userMessage = 'Rate Limited';
    suggestion = 'Too many requests. Wait a moment and try again.';
  } else if (text.includes('timeout') || text.includes('TIMEOUT')) {
    errorType = 'timeout';
    userMessage = 'Request Timed Out';
    suggestion = 'The page may be too long. Try selecting specific text to analyze.';
  } else if (text.includes('network') || text.includes('Failed to fetch') || text.includes('ERR_')) {
    errorType = 'network';
    userMessage = 'Connection Error';
    suggestion = 'Check your internet connection and try again.';
  } else if (text.includes('No text') || text.includes('empty')) {
    errorType = 'no_content';
    userMessage = 'No Content Found';
    suggestion = 'This page doesn\'t have analyzable text content.';
    retryable = false;
  } else if (text.includes('limit') || text.includes('upgrade') || text.includes('Usage limit')) {
    errorType = 'usage_limit';
    userMessage = 'Scan Limit Reached';
    suggestion = 'You\'ve used all your scans. Upgrade for more.';
    retryable = false;
  }

  // Build error UI with retry option
  let html = `
    <div class="error-content">
      <div class="error-icon" aria-hidden="true">${getErrorIcon(errorType)}</div>
      <div class="error-text">
        <strong>${userMessage}</strong>
        ${suggestion ? `<p class="error-suggestion">${suggestion}</p>` : ''}
      </div>
    </div>
  `;

  if (retryable) {
    html += `
      <div class="error-actions">
        <button class="error-retry-btn" id="retryBtn">${getUiIconSvg('refresh')}<span>Try Again</span></button>
        ${errorType === 'auth' ? `<button class="error-settings-btn" id="errorLoginBtn">${getUiIconSvg('key')}<span>Log In</span></button>` : ''}
        ${errorType === 'usage_limit' ? `<button class="error-upgrade-btn" id="errorUpgradeBtn">${getUiIconSvg('bolt')}<span>Upgrade</span></button>` : ''}
      </div>
    `;
  }

  errorEl.innerHTML = html;

  // Add event listeners
  const retryBtn = document.getElementById('retryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', handleRetry);
  }

  const errorLoginBtn = document.getElementById('errorLoginBtn');
  if (errorLoginBtn) {
    errorLoginBtn.addEventListener('click', function () {
      // Navigate to auth view (login)
      if (typeof navigateTo === 'function') {
        navigateTo('auth');
      } else {
        // Fallback: show auth view directly
        const authView = document.getElementById('authView');
        const mainView = document.getElementById('mainView');
        if (authView && mainView) {
          authView.hidden = false;
          mainView.hidden = true;
        }
      }
    });
  }

  const errorUpgradeBtn = document.getElementById('errorUpgradeBtn');
  if (errorUpgradeBtn) {
    errorUpgradeBtn.addEventListener('click', function () {
      chrome.tabs.create({ url: 'subscription.html' });
    });
  }
}

function getErrorIcon(type) {
  const icons = {
    auth: getUiIconSvg('key'),
    rate_limit: getUiIconSvg('warning'),
    timeout: getUiIconSvg('warning'),
    network: getUiIconSvg('warning'),
    no_content: getUiIconSvg('info'),
    usage_limit: getUiIconSvg('bolt'),
    unknown: getUiIconSvg('x')
  };

  return icons[type] || icons.unknown;
}

async function handleRetry() {
  setError('');
  try {
    await analyzeCurrentPage();
  } catch (e) {
    setStatus('');
    setError(String((e && e.message) || e));
  } finally {
    analyzeBtn.disabled = false;
  }
}

let pollingInterval = null;

function updateProgress(percent, text) {
  if (progressContainerEl) progressContainerEl.hidden = false;
  if (progressFillEl) progressFillEl.style.width = percent + '%';
  if (progressTextEl && text) progressTextEl.textContent = text;
}

function hideProgress() {
  if (progressContainerEl) progressContainerEl.hidden = true;
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = null;
}

async function pollForStatus(url) {
  if (pollingInterval) clearInterval(pollingInterval);

  let attempts = 0;
  // Poll every 1 second
  pollingInterval = setInterval(async () => {
    attempts++;

    // Simulate progress while waiting
    const simulatedProgress = Math.min(95, 10 + (attempts * 2));
    updateProgress(simulatedProgress, 'Analyzing with AI...');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'MTA_GET_ANALYSIS_STATUS',
        payload: { url }
      });

      if (!response || response.status === 'none') {
        // Lost state? Or finished and cleared?
        // If we've been polling for a while, maybe it failed silently or was cleared
        if (attempts > 60) {
          hideProgress();
          setError('Analysis timed out or state lost.');
          analyzeBtn.disabled = false;
        }
        return;
      }

      if (response.status === 'complete') {
        hideProgress();
        analyzeBtn.disabled = false;
        renderResult(response.result, false);
        // Show alternatives if risk is high and we have alternatives
        if (response.result.riskLevel === 'high' || response.result.riskLevel === 'critical') {
          showAlternativesPrompt(url);
        }
        // Update usage display after analysis
        await updateUsageInfo();
      } else if (response.status === 'error') {
        hideProgress();
        analyzeBtn.disabled = false;
        setError(response.error || 'Analysis failed');
      }
      // If 'analyzing', continue polling

    } catch (e) {
      console.error('Polling error:', e);
      // Don't stop polling immediately on one error, could be temporary extension context invalidation
      if (attempts > 60) {
        hideProgress();
        analyzeBtn.disabled = false;
        setError('Analysis check failed: ' + e.message);
      }
    }
  }, 1000);
}

// ===== SOUND NOTIFICATIONS =====
let audioContext = null;

async function playAlertSound(riskLevel) {
  // Check if sound is enabled in settings
  const stored = await chrome.storage.local.get(['mta_soundEnabled']);
  if (stored.mta_soundEnabled === false) return; // Default is enabled

  const soundConfig = ALERT_SOUNDS[riskLevel] || ALERT_SOUNDS.medium;

  try {
    // Initialize AudioContext on demand (required for browser autoplay policy)
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = soundConfig.type;
    oscillator.frequency.value = soundConfig.frequency;

    // Envelope for nicer sound
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.02); // Attack
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + soundConfig.duration / 1000); // Decay

    oscillator.start(now);
    oscillator.stop(now + soundConfig.duration / 1000);

    // Play multiple beeps for critical
    if (riskLevel === 'critical') {
      setTimeout(function () {
        playBeep(soundConfig.frequency * 1.2, soundConfig.duration / 2);
      }, soundConfig.duration + 50);
    }
  } catch (e) {
    console.log('Could not play sound:', e);
  }
}

function playBeep(frequency, duration) {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  const now = audioContext.currentTime;
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.2, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);

  oscillator.start(now);
  oscillator.stop(now + duration / 1000);
}

function hideAllResults() {
  if (scoreSectionEl) scoreSectionEl.hidden = true;
  if (summarySectionEl) summarySectionEl.hidden = true;
  if (statsSectionEl) statsSectionEl.hidden = true;
  if (findingsSectionEl) findingsSectionEl.hidden = true;
  if (quickActionsSectionEl) quickActionsSectionEl.hidden = true;
  if (actionsSectionEl) actionsSectionEl.hidden = true;
  if (cacheIndicatorEl) cacheIndicatorEl.hidden = true;

  // Remove any existing alternatives section
  const existingAlts = document.querySelector('.alternatives-section');
  if (existingAlts) existingAlts.remove();

  // Remove skeleton if present
  const existingSkeleton = document.querySelector('.skeleton-section');
  if (existingSkeleton) existingSkeleton.remove();
}

// Show skeleton loading state
function showLoadingSkeleton() {
  hideAllResults();

  const skeleton = document.createElement('div');
  skeleton.className = 'skeleton-section';
  skeleton.innerHTML = `
    <div style="text-align: center; margin: 16px 0;">
      <div class="skeleton skeleton-gauge"></div>
      <div class="skeleton skeleton-badge"></div>
    </div>
    
    <div style="margin: 16px 0;">
      <div class="skeleton skeleton-summary-box"></div>
      <div class="skeleton skeleton-summary-box" style="background: linear-gradient(90deg, #fff8e1 25%, #fffde7 50%, #fff8e1 75%); background-size: 200% 100%;"></div>
      <div class="skeleton skeleton-summary-box" style="background: linear-gradient(90deg, #e8f5e9 25%, #f1f8e9 50%, #e8f5e9 75%); background-size: 200% 100%;"></div>
    </div>
    
    <div class="skeleton-stats-row">
      <div class="skeleton skeleton-stat"></div>
      <div class="skeleton skeleton-stat"></div>
      <div class="skeleton skeleton-stat"></div>
      <div class="skeleton skeleton-stat"></div>
    </div>
    
    <div style="margin: 16px 0;">
      <div class="skeleton skeleton-finding"></div>
      <div class="skeleton skeleton-finding"></div>
    </div>
  `;

  // Insert after controls section
  const controlsSection = document.querySelector('.controls');
  controlsSection.after(skeleton);
}

function updateGauge(score, riskLevel) {
  const maxDash = 157;
  const dashLength = (score / 100) * maxDash;
  gaugeArcEl.style.strokeDasharray = dashLength + ' ' + maxDash;
  gaugeArcEl.style.stroke = RISK_COLORS[riskLevel] || RISK_COLORS.medium;

  let current = 0;
  const step = Math.ceil(score / 20);
  const animate = function () {
    current = Math.min(current + step, score);
    scoreNumberEl.textContent = current;
    if (current < score) requestAnimationFrame(animate);
  };
  animate();

  // Play sound alert based on risk level
  playAlertSound(riskLevel);

  riskBadgeEl.textContent = RISK_LABELS[riskLevel] || 'Unknown';
  riskBadgeEl.className = 'risk-badge ' + riskLevel;
}

function updateStats(stats) {
  const bySeverity = (stats && stats.bySeverity) || {};
  statCriticalEl.textContent = bySeverity.critical || 0;
  statHighEl.textContent = bySeverity.high || 0;
  statMediumEl.textContent = bySeverity.medium || 0;
  statLowEl.textContent = bySeverity.low || 0;
}

function createFindingCard(finding) {
  const card = document.createElement('div');
  card.className = 'finding-card ' + finding.severity;

  const categoryName = CATEGORY_NAMES[finding.category] || finding.category;

  let html = '<div class="finding-header">' +
    '<div class="finding-title">' + escapeHtml(finding.title) + '</div>' +
    '<div class="finding-badges">' +
    '<span class="badge severity-' + finding.severity + '">' + finding.severity + '</span>' +
    '<span class="badge category">' + escapeHtml(categoryName) + '</span>' +
    '</div></div>' +
    '<div class="finding-summary">' + escapeHtml(finding.summary) + '</div>';

  if (finding.quote) {
    html += '<div class="finding-quote">"' + escapeHtml(finding.quote) + '"</div>';
  }
  if (finding.recommendation) {
    html += '<div class="finding-recommendation">' + escapeHtml(finding.recommendation) + '</div>';
  }

  card.innerHTML = html;
  return card;
}

function renderFindings(findings) {
  findingsListEl.innerHTML = '';
  findingsCountEl.textContent = '(' + findings.length + ')';

  if (findings.length === 0) {
    findingsListEl.innerHTML = '<p style="color: #888; text-align: center;">No concerning clauses found.</p>';
    return;
  }

  // Group findings by category
  const grouped = {};
  findings.forEach(function (finding) {
    const category = finding.category || 'other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(finding);
  });

  // Sort categories by highest severity in each group
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const maxSevA = Math.min(...grouped[a].map(f => severityOrder[f.severity] || 3));
    const maxSevB = Math.min(...grouped[b].map(f => severityOrder[f.severity] || 3));
    return maxSevA - maxSevB;
  });

  let delay = 0;
  sortedCategories.forEach(function (category) {
    const categoryFindings = grouped[category];
    const categoryName = CATEGORY_NAMES[category] || category;
    const highestSeverity = categoryFindings.reduce((max, f) => {
      const order = { critical: 3, high: 2, medium: 1, low: 0 };
      return order[f.severity] > order[max] ? f.severity : max;
    }, 'low');

    // Create collapsible category group
    const group = document.createElement('details');
    group.className = 'findings-group';
    group.open = true; // Open by default
    group.innerHTML = `
      <summary class="findings-group-header ${highestSeverity}">
        <span class="findings-group-title">${escapeHtml(categoryName)}</span>
        <span class="findings-group-count">${categoryFindings.length}</span>
      </summary>
      <div class="findings-group-content"></div>
    `;
    group.style.animationDelay = (delay * 0.05) + 's';

    const content = group.querySelector('.findings-group-content');
    categoryFindings.forEach(function (finding, i) {
      const card = createFindingCard(finding);
      content.appendChild(card);
    });

    findingsListEl.appendChild(group);
    delay++;
  });
}

function renderResult(data, fromCache) {
  currentResult = data;
  hideAllResults();

  if (cacheIndicatorEl) cacheIndicatorEl.hidden = !fromCache;

  if (scoreSectionEl) {
    scoreSectionEl.hidden = false;
    updateGauge(data.riskScore, data.riskLevel);
  }

  if (summarySectionEl) {
    summarySectionEl.hidden = false;
    if (summaryTextEl) summaryTextEl.textContent = data.summary || 'No summary available.';
    if (whatItMeansEl) whatItMeansEl.textContent = data.whatItMeans || '';
    if (whatToDoEl) whatToDoEl.textContent = data.whatToDo || '';
  }

  if (statsSectionEl) {
    statsSectionEl.hidden = false;
    updateStats(data.stats);
  }

  if (findingsSectionEl) {
    findingsSectionEl.hidden = false;
    renderFindings(data.findings || []);
  }

  if (quickActionsSectionEl) quickActionsSectionEl.hidden = false;
  if (actionsSectionEl) actionsSectionEl.hidden = false;
}

// Paywall modal for when usage is exceeded
function showPaywall(usageInfo) {
  const periodLabel = usageInfo.period === 'week' ? 'weekly' : 'monthly';
  const tierName = TIER_NAMES[usageInfo.tier] || usageInfo.tier;

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'paywall-overlay';
  overlay.innerHTML = `
    <div class="paywall-modal">
      <div class="paywall-icon" aria-hidden="true">${getUiIconSvg('lock')}</div>
      <h2>Scan Limit Reached</h2>
      <p class="paywall-message">
        You've used all ${usageInfo.limit} ${periodLabel} scans on the <strong>${tierName}</strong> plan.
      </p>
      <p class="paywall-reset">Your scans reset on <strong>${usageInfo.resetDate || 'the next period'}</strong></p>
      
      <div class="paywall-upgrade">
        <h3>Upgrade for More Scans</h3>
        <div class="upgrade-options">
          <div class="upgrade-option" data-tier="starter">
            <span class="upgrade-name">Starter</span>
            <span class="upgrade-price">$9.99/mo</span>
            <span class="upgrade-scans">15 scans</span>
          </div>
          <div class="upgrade-option recommended" data-tier="pro">
            <span class="upgrade-badge">Most Popular</span>
            <span class="upgrade-name">Pro</span>
            <span class="upgrade-price">$29/mo</span>
            <span class="upgrade-scans">80 scans</span>
          </div>
          <div class="upgrade-option" data-tier="pro_plus">
            <span class="upgrade-name">Pro Plus</span>
            <span class="upgrade-price">$60/mo</span>
            <span class="upgrade-scans">200 scans</span>
          </div>
        </div>
        <button class="paywall-btn upgrade" id="paywallUpgradeBtn">View All Plans</button>
      </div>
      
      <button class="paywall-btn close" id="paywallCloseBtn">Maybe Later</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(function () {
    overlay.classList.add('visible');
  });

  // Event handlers
  document.getElementById('paywallUpgradeBtn').addEventListener('click', function () {
    chrome.tabs.create({ url: 'subscription.html' });
    overlay.remove();
  });

  document.getElementById('paywallCloseBtn').addEventListener('click', function () {
    overlay.classList.remove('visible');
    setTimeout(function () { overlay.remove(); }, 300);
  });

  // Click on upgrade options
  overlay.querySelectorAll('.upgrade-option').forEach(function (opt) {
    opt.addEventListener('click', function () {
      const tier = this.dataset.tier;
      chrome.tabs.create({ url: 'subscription.html?tier=' + tier });
      overlay.remove();
    });
  });
}

// Show alternatives when site has high risk
async function showAlternativesPrompt(url) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');

    // Get alternatives from background
    const response = await chrome.runtime.sendMessage({
      type: 'MTA_GET_ALTERNATIVES',
      payload: { domain: domain, riskScore: currentResult ? currentResult.riskScore : 70 }
    });

    if (!response || !response.ok || !response.alternatives || response.alternatives.length === 0) {
      return;
    }

    // Remove existing alternatives section if any
    const existingSection = document.querySelector('.alternatives-section');
    if (existingSection) existingSection.remove();

    // Create alternatives section
    const section = document.createElement('div');
    section.className = 'alternatives-section';
    section.innerHTML = `
      <div class="alternatives-header">
        <span class="alternatives-icon" aria-hidden="true">${getUiIconSvg('lightbulb')}</span>
        <span>Better Alternatives Available</span>
      </div>
      <p class="alternatives-subtitle">${escapeHtml(response.reason || 'These services have better terms & privacy policies:')}</p>
      <div class="alternatives-list">
        ${response.alternatives.slice(0, 3).map(function (alt) {
      return `
            <div class="alternative-card" data-id="${alt.affiliateId || alt.name}">
              <div class="alt-name">${escapeHtml(alt.name)}</div>
              <div class="alt-score">
                <span class="alt-score-value">${alt.privacyScore || 85}/100</span>
                <span class="alt-score-label">Privacy Score</span>
              </div>
              <div class="alt-highlight">${escapeHtml(alt.highlight || alt.description || '')}</div>
              <a href="${alt.affiliateUrl || alt.url}" target="_blank" class="alt-link" data-id="${alt.affiliateId || alt.name}">
                Learn More →
              </a>
            </div>
          `;
    }).join('')}
      </div>
    `;

    // Insert after actions section
    actionsSectionEl.after(section);

    // Track affiliate clicks
    section.querySelectorAll('.alt-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        const altId = this.dataset.id;
        chrome.runtime.sendMessage({
          type: 'MTA_TRACK_AFFILIATE',
          payload: { alternativeId: altId, sourceDomain: domain }
        });
      });
    });

  } catch (e) {
    console.error('Failed to show alternatives:', e);
  }
}

async function updateUsageInfo() {
  try {
    // First, try to use subscription data from router (already fetched from Supabase)
    const subscription = getSubscriptionData();

    if (subscription && subscription.scansUsed !== undefined && subscription.scansLimit !== undefined) {
      // Use Supabase subscription data
      const tier = subscription.tier || 'free';
      const tierName = TIER_NAMES[tier] || tier;
      const periodLabel = tier === 'free' ? 'this week' : 'this month';
      const scansUsed = subscription.scansUsed;
      const scansLimit = subscription.scansLimit;
      const remaining = Math.max(0, scansLimit - scansUsed);

      if (tier === 'free') {
        usageInfoEl.innerHTML = `
          <span class="usage-text">${tierName}: ${scansUsed}/${scansLimit} scans ${periodLabel}</span>
          <button class="upgrade-link" id="upgradeBtn">Upgrade</button>
        `;
      } else {
        const resetDate = subscription.expiresAt
          ? new Date(subscription.expiresAt).toLocaleDateString()
          : 'Next period';
        usageInfoEl.innerHTML = `
          <span class="usage-text">${tierName}: ${scansUsed}/${scansLimit} scans ${periodLabel}</span>
          <span class="usage-reset">Resets: ${resetDate}</span>
        `;
      }

      console.log('[Popup] Usage from Supabase:', { tier, scansUsed, scansLimit, remaining });

      // Add upgrade button handler
      const upgradeBtn = document.getElementById('upgradeBtn');
      if (upgradeBtn) {
        upgradeBtn.addEventListener('click', function () {
          chrome.tabs.create({ url: 'subscription.html' });
        });
      }

      // Store for feature gating
      window.currentTier = tier;
      window.tierFeatures = TIER_FEATURES[tier] || {};
      return;
    }

    // Fallback: fetch via message to background (uses local storage)
    const usage = await chrome.runtime.sendMessage({ type: 'MTA_CHECK_USAGE' });
    if (usage && !usage.error) {
      const periodLabel = usage.period === 'week' ? 'this week' : 'this month';
      const tierName = usage.tierName || usage.tier;

      if (usage.tier === 'free') {
        usageInfoEl.innerHTML = `
          <span class="usage-text">${tierName}: ${usage.used}/${usage.limit} scans ${periodLabel}</span>
          <button class="upgrade-link" id="upgradeBtn">Upgrade</button>
        `;
      } else {
        usageInfoEl.innerHTML = `
          <span class="usage-text">${tierName}: ${usage.used}/${usage.limit} scans ${periodLabel}</span>
          <span class="usage-reset">Resets: ${usage.resetDate}</span>
        `;
      }

      // Add upgrade button handler
      const upgradeBtn = document.getElementById('upgradeBtn');
      if (upgradeBtn) {
        upgradeBtn.addEventListener('click', function () {
          chrome.tabs.create({ url: 'subscription.html' });
        });
      }

      // Store for feature gating
      window.currentTier = usage.tier;
      window.tierFeatures = usage.features || {};
    }
  } catch (e) {
    console.error('Failed to get usage:', e);
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function isNoReceiverError(err) {
  const msg = String((err && err.message) || err || '');
  return msg.includes('Receiving end does not exist') || msg.includes('Could not establish connection');
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['src/content.js']
  });
}

async function extractPageText(tabId) {
  const stored = await chrome.storage.local.get(['mta_redactPII']);

  try {
    const resp = await chrome.tabs.sendMessage(tabId, {
      type: 'MTA_EXTRACT_TEXT',
      options: { redactPII: stored.mta_redactPII !== false }
    });
    if (!resp || !resp.ok) {
      throw new Error((resp && resp.error) || 'Failed to extract page text');
    }
    return resp;
  } catch (e) {
    if (!isNoReceiverError(e)) throw e;
    await injectContentScript(tabId);
    const resp = await chrome.tabs.sendMessage(tabId, {
      type: 'MTA_EXTRACT_TEXT',
      options: { redactPII: stored.mta_redactPII !== false }
    });
    if (!resp || !resp.ok) {
      throw new Error((resp && resp.error) || 'Failed to extract page text');
    }
    return resp;
  }
}

async function analyzeCurrentPage() {
  setError('');
  hideAllResults();
  setStatus('');

  const tab = await getActiveTab();
  if (!tab || !tab.id) throw new Error('No active tab');
  if (!tab.url) throw new Error('No tab URL.');

  if (!/^https?:\/\//.test(tab.url)) {
    throw new Error('This page cannot be analyzed. Open a normal http(s) webpage.');
  }

  // Check if offline - try to load from offline cache
  if (!navigator.onLine) {
    setStatus('Offline - checking saved analyses...');
    try {
      const offlineResult = await chrome.runtime.sendMessage({
        type: 'MTA_GET_OFFLINE',
        payload: { url: tab.url }
      });

      if (offlineResult && offlineResult.data) {
        showResults(offlineResult.data, true);
        setStatus('');
        if (cacheIndicatorEl) {
          cacheIndicatorEl.hidden = false;
          cacheIndicatorEl.textContent = '📴 Loaded from offline cache';
        }
        return;
      } else {
        throw new Error('No offline data available for this page. Connect to internet to analyze.');
      }
    } catch (e) {
      throw new Error('You are offline and this page has not been saved. Connect to internet to analyze.');
    }
  }

  analyzeBtn.disabled = true;
  setStatus('Extracting page text...');

  let extracted;
  try {
    extracted = await extractPageText(tab.id);
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (msg.includes('Cannot access')) {
      throw new Error('Chrome blocked access to this page. Try a normal website.');
    }
    analyzeBtn.disabled = false;
    throw e;
  }

  if (extracted.pageTypes && extracted.pageTypes.length > 0 && extracted.pageTypes[0] !== 'unknown') {
    pageTypeEl.textContent = 'Detected: ' + extracted.pageTypes.join(', ');
  } else {
    pageTypeEl.textContent = '';
  }

  // Check usage limit before analysis
  const usageCheck = await chrome.runtime.sendMessage({ type: 'MTA_CHECK_USAGE' });
  if (usageCheck && usageCheck.remaining <= 0) {
    hideAllResults();
    setStatus('');
    analyzeBtn.disabled = false;
    showPaywall(usageCheck);
    return;
  }

  // Show loading state
  setStatus('Starting analysis...');
  updateProgress(5, 'Starting analysis...');

  // Start Async Analysis
  try {
    const analysisResponse = await chrome.runtime.sendMessage({
      type: 'MTA_START_ANALYSIS_ASYNC',
      payload: {
        url: extracted.url,
        title: extracted.title,
        text: extracted.text,
        pageType: extracted.pageTypes ? extracted.pageTypes[0] : 'unknown',
        skipCache: skipCache
      }
    });

    if (analysisResponse && analysisResponse.ok) {
      // Analysis started successfully, now poll
      pollForStatus(extracted.url);
    } else {
      throw new Error(analysisResponse.error || 'Failed to start analysis');
    }
  } catch (e) {
    analyzeBtn.disabled = false;
    hideProgress();
    throw e;
  }
}

function generateMarkdownReport(data) {
  const lines = [
    '# Money Trap Analysis Report',
    '',
    '**URL:** ' + data.url,
    '**Title:** ' + data.title,
    '**Analyzed:** ' + new Date(data.analyzedAt).toLocaleString(),
    '**Risk Score:** ' + data.riskScore + '/100 (' + data.riskLevel + ')',
    '',
    '## Summary',
    data.summary,
    '',
    '## What This Means For You',
    data.whatItMeans,
    '',
    '## What You Should Do',
    data.whatToDo,
    '',
    '## Findings (' + data.findings.length + ')',
    ''
  ];

  data.findings.forEach(function (f, i) {
    lines.push('### ' + (i + 1) + '. ' + f.title);
    lines.push('**Severity:** ' + f.severity + ' | **Category:** ' + (CATEGORY_NAMES[f.category] || f.category));
    lines.push('');
    lines.push(f.summary);
    if (f.quote) {
      lines.push('');
      lines.push('> "' + f.quote + '"');
    }
    if (f.recommendation) {
      lines.push('');
      lines.push('Recommendation: ' + f.recommendation);
    }
    lines.push('');
  });

  return lines.join('\n');
}

function downloadReport(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

analyzeBtn.addEventListener('click', async function () {
  try {
    await analyzeCurrentPage();
  } catch (e) {
    setStatus('');
    setError(String((e && e.message) || e));
  } finally {
    analyzeBtn.disabled = false;
  }
});

optionsBtn.addEventListener('click', function () {
  // Toggle the built-in settings panel instead of opening separate options page
  const settingsPanel = document.getElementById('settingsPanel');
  const settingsToggle = document.querySelector('.settings-toggle-btn');
  if (settingsPanel) {
    const isVisible = settingsPanel.style.display === 'block';
    settingsPanel.style.display = isVisible ? 'none' : 'block';
    if (settingsToggle) settingsToggle.classList.toggle('active', !isVisible);
  }
});

const historyBtn = document.getElementById('historyBtn');
if (historyBtn) {
  historyBtn.addEventListener('click', function () {
    chrome.tabs.create({ url: 'history.html' });
  });
}

const trendsBtn = document.getElementById('trendsBtn');
if (trendsBtn) {
  trendsBtn.addEventListener('click', function () {
    chrome.tabs.create({ url: 'trends.html' });
  });
}

watchlistBtn.addEventListener('click', function () {
  const subscription = getSubscriptionData();
  const userTier = subscription?.tier || 'free';
  const features = TIER_FEATURES[userTier] || TIER_FEATURES.free;

  // Watchlist is available to all tiers, but with size limits
  chrome.tabs.create({ url: 'watchlist.html' });
});

compareBtn.addEventListener('click', function () {
  const subscription = getSubscriptionData();
  const userTier = subscription?.tier || 'free';
  const features = TIER_FEATURES[userTier] || TIER_FEATURES.free;

  if (!features.compareEnabled) {
    showConfirmDialog({
      title: 'Premium Feature',
      message: 'Side-by-side comparison requires Starter tier or higher. Upgrade to unlock this feature!',
      confirmText: 'Upgrade Now',
      cancelText: 'Cancel',
      type: 'info'
    }).then(confirmed => {
      if (confirmed) {
        navigateTo('subscription');
      }
    });
    return;
  }

  chrome.tabs.create({ url: 'compare.html' });
});

exportBtn.addEventListener('click', function () {
  if (!currentResult) return;

  const subscription = getSubscriptionData();
  const userTier = subscription?.tier || 'free';
  const features = TIER_FEATURES[userTier] || TIER_FEATURES.free;

  // Show export modal
  const exportModal = document.getElementById('exportModal');
  const pdfLockBadge = document.getElementById('pdfLockBadge');
  const exportPdfBtn = document.getElementById('exportPDF');

  // Check if PDF is locked (only available for starter+)
  const pdfLocked = userTier === 'free';
  pdfLockBadge.hidden = !pdfLocked;
  exportPdfBtn.classList.toggle('locked', pdfLocked);

  exportModal.hidden = false;
});

// Export Modal Event Handlers
const exportModal = document.getElementById('exportModal');
const exportModalClose = document.getElementById('exportModalClose');

if (exportModalClose) {
  exportModalClose.addEventListener('click', function () {
    exportModal.hidden = true;
  });
}

// Close modal on overlay click
if (exportModal) {
  exportModal.addEventListener('click', function (e) {
    if (e.target === exportModal) {
      exportModal.hidden = true;
    }
  });
}

// Export as Markdown
const exportMarkdownBtn = document.getElementById('exportMarkdown');
if (exportMarkdownBtn) {
  exportMarkdownBtn.addEventListener('click', function () {
    if (!currentResult) return;

    const subscription = getSubscriptionData();
    const userTier = subscription?.tier || 'free';
    const features = TIER_FEATURES[userTier] || TIER_FEATURES.free;

    if (!features.exportEnabled) {
      exportModal.hidden = true;
      showConfirmDialog({
        title: 'Premium Feature',
        message: 'Export to Markdown requires Starter tier or higher. Upgrade to unlock this feature!',
        confirmText: 'Upgrade Now',
        cancelText: 'Cancel',
        type: 'info'
      }).then(confirmed => {
        if (confirmed) {
          navigateTo('subscription');
        }
      });
      return;
    }

    const markdown = generateMarkdownReport(currentResult);
    const domain = new URL(currentResult.url).hostname.replace(/\./g, '_');
    const filename = 'useshield-report_' + domain + '_' + Date.now() + '.md';
    downloadReport(markdown, filename);
    exportModal.hidden = true;
  });
}

// Export as JSON
const exportJSONBtn = document.getElementById('exportJSON');
if (exportJSONBtn) {
  exportJSONBtn.addEventListener('click', function () {
    if (!currentResult) return;

    const subscription = getSubscriptionData();
    const userTier = subscription?.tier || 'free';
    const features = TIER_FEATURES[userTier] || TIER_FEATURES.free;

    if (!features.exportEnabled) {
      exportModal.hidden = true;
      showConfirmDialog({
        title: 'Premium Feature',
        message: 'Export to JSON requires Starter tier or higher. Upgrade to unlock this feature!',
        confirmText: 'Upgrade Now',
        cancelText: 'Cancel',
        type: 'info'
      }).then(confirmed => {
        if (confirmed) {
          navigateTo('subscription');
        }
      });
      return;
    }

    const jsonContent = JSON.stringify(currentResult, null, 2);
    const domain = new URL(currentResult.url).hostname.replace(/\./g, '_');
    const filename = 'useshield-report_' + domain + '_' + Date.now() + '.json';

    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    exportModal.hidden = true;
  });
}

// Export as PDF
const exportPDFBtn = document.getElementById('exportPDF');
if (exportPDFBtn) {
  exportPDFBtn.addEventListener('click', function () {
    if (!currentResult) return;

    const subscription = getSubscriptionData();
    const userTier = subscription?.tier || 'free';

    // PDF requires at least starter tier
    if (userTier === 'free') {
      exportModal.hidden = true;
      showConfirmDialog({
        title: 'Premium Feature',
        message: 'PDF export requires Starter tier or higher. Upgrade to create print-ready reports!',
        confirmText: 'Upgrade Now',
        cancelText: 'Cancel',
        type: 'info'
      }).then(confirmed => {
        if (confirmed) {
          navigateTo('subscription');
        }
      });
      return;
    }

    // Generate HTML for PDF
    const html = generatePDFHTML(currentResult);

    // Open print dialog (native PDF export)
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load then trigger print
    printWindow.onload = function () {
      printWindow.print();
    };

    exportModal.hidden = true;
  });
}

// Save for Offline
const saveOfflineBtn = document.getElementById('saveOfflineBtn');
if (saveOfflineBtn) {
  saveOfflineBtn.addEventListener('click', async function () {
    if (!currentResult) return;

    try {
      // Save to offline storage via background
      await chrome.runtime.sendMessage({
        type: 'MTA_SAVE_OFFLINE',
        payload: {
          url: currentResult.url,
          data: currentResult
        }
      });

      saveOfflineBtn.textContent = 'Saved';
      setTimeout(function () {
        saveOfflineBtn.textContent = '💾 Save Offline';
      }, 2000);

      setStatus('Analysis saved for offline viewing');
      setTimeout(function () { setStatus(''); }, 3000);
    } catch (e) {
      setError('Failed to save for offline');
    }
  });
}

addWatchlistBtn.addEventListener('click', async function () {
  if (!currentResult) return;

  try {
    const subscription = getSubscriptionData();
    const userTier = subscription?.tier || 'free';
    const features = TIER_FEATURES[userTier] || TIER_FEATURES.free;

    const stored = await chrome.storage.local.get(['mta_watchlist']);
    const watchlist = stored.mta_watchlist || [];

    const exists = watchlist.some(function (item) { return item.url === currentResult.url; });
    if (exists) {
      setStatus('Already in watchlist!');
      setTimeout(function () { setStatus(''); }, 2000);
      return;
    }

    // Check watchlist size limit based on tier
    if (watchlist.length >= features.watchlistSize) {
      showConfirmDialog({
        title: 'Watchlist Limit Reached',
        message: `Your ${TIER_NAMES[userTier]} plan allows ${features.watchlistSize} watchlist items. Upgrade to add more!`,
        confirmText: 'Upgrade Now',
        cancelText: 'Cancel',
        type: 'info'
      }).then(confirmed => {
        if (confirmed) {
          navigateTo('subscription');
        }
      });
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      url: currentResult.url,
      domain: new URL(currentResult.url).hostname,
      title: currentResult.title,
      lastHash: currentResult.hash,
      lastChecked: Date.now(),
      addedAt: Date.now(),
      lastResult: currentResult,
      hasChanges: false
    };

    watchlist.push(newItem);
    await chrome.storage.local.set({ mta_watchlist: watchlist });

    setStatus('Added to watchlist!');
    setTimeout(function () { setStatus(''); }, 2000);
  } catch (e) {
    setError('Failed to add to watchlist: ' + e.message);
  }
});

// Subscription link handler
const subscriptionLink = document.getElementById('subscriptionLink');
if (subscriptionLink) {
  subscriptionLink.addEventListener('click', function (e) {
    e.preventDefault();
    chrome.tabs.create({ url: 'subscription.html' });
  });
}

// Account settings link handler
const accountSettingsLink = document.getElementById('accountSettingsLink');
if (accountSettingsLink) {
  accountSettingsLink.addEventListener('click', function (e) {
    e.preventDefault();
    chrome.tabs.create({ url: 'account-settings.html' });
  });
}

// Feedback link handler
const feedbackLink = document.getElementById('feedbackLink');
if (feedbackLink) {
  feedbackLink.addEventListener('click', function (e) {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://useshield.net/feedback' });
  });
}

// Quick Action: Copy Summary
copyBtn.addEventListener('click', async function () {
  if (!currentResult) return;

  const text = `Risk Score: ${currentResult.riskScore}/100 (${currentResult.riskLevel})\n\n` +
    `Summary: ${currentResult.summary}\n\n` +
    `What it means: ${currentResult.whatItMeans}\n\n` +
    `What to do: ${currentResult.whatToDo}`;

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.classList.add('success');
    copyBtn.querySelector('.quick-action-label').textContent = 'Copied!';
    setTimeout(function () {
      copyBtn.classList.remove('success');
      copyBtn.querySelector('.quick-action-label').textContent = 'Copy';
    }, 2000);
  } catch (e) {
    setError('Failed to copy to clipboard');
  }
});

// Quick Action: Share Report
shareBtn.addEventListener('click', async function () {
  if (!currentResult) return;

  const shareData = {
    title: `Money Trap Analysis: ${currentResult.title || 'Report'}`,
    text: `Risk Score: ${currentResult.riskScore}/100 - ${currentResult.summary}`,
    url: currentResult.url
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      // Fallback: copy URL to clipboard
      await navigator.clipboard.writeText(
        `${shareData.title}\n${shareData.text}\n${shareData.url}`
      );
      shareBtn.classList.add('success');
      shareBtn.querySelector('.quick-action-label').textContent = 'Copied!';
      setTimeout(function () {
        shareBtn.classList.remove('success');
        shareBtn.querySelector('.quick-action-label').textContent = 'Share';
      }, 2000);
    }
  } catch (e) {
    console.log('Share cancelled or failed');
  }
});

// Quick Action: Email Report
const emailBtn = document.getElementById('emailBtn');
if (emailBtn) {
  emailBtn.addEventListener('click', async function () {
    if (!currentResult) return;

    const riskLevel = currentResult.riskScore >= 70 ? 'CRITICAL' :
      currentResult.riskScore >= 50 ? 'HIGH' :
        currentResult.riskScore >= 30 ? 'MEDIUM' : 'LOW';

    const subject = encodeURIComponent(
      `[${riskLevel} RISK] Money Trap Analysis: ${currentResult.title || new URL(currentResult.url).hostname}`
    );

    // Build email body with findings
    let findingsText = '';
    if (currentResult.findings && currentResult.findings.length > 0) {
      findingsText = '\n\nKEY FINDINGS:\n' + currentResult.findings.slice(0, 5).map(function (f, i) {
        return `\n${i + 1}. [${(f.severity || 'medium').toUpperCase()}] ${f.title}\n   ${f.description || f.summary || ''}`;
      }).join('');
    }

    const body = encodeURIComponent(
      `MONEY TRAP ANALYSIS REPORT
================================

Risk Score: ${currentResult.riskScore}/100 (${riskLevel})

URL: ${currentResult.url}

SUMMARY:
${currentResult.summary}

WHAT THIS MEANS:
${currentResult.whatItMeans || 'N/A'}

RECOMMENDED ACTIONS:
${currentResult.whatToDo || 'Review the document carefully before agreeing.'}
${findingsText}

---
Generated by Money Trap Analyzer
https://useshield.net`
    );

    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');

    emailBtn.classList.add('success');
    emailBtn.querySelector('.quick-action-label').textContent = 'Opened!';
    setTimeout(function () {
      emailBtn.classList.remove('success');
      emailBtn.querySelector('.quick-action-label').textContent = 'Email';
    }, 2000);
  });
}

// Quick Action: Export PDF
const pdfBtn = document.getElementById('pdfBtn');
if (pdfBtn) {
  pdfBtn.addEventListener('click', async function () {
    if (!currentResult) return;

    pdfBtn.querySelector('.quick-action-label').textContent = 'Creating...';

    try {
      // Generate HTML for PDF
      const html = generatePDFHTML(currentResult);

      // Open print dialog (native PDF export)
      const printWindow = window.open('', '_blank');
      printWindow.document.write(html);
      printWindow.document.close();

      // Wait for content to load then trigger print
      printWindow.onload = function () {
        printWindow.print();
      };

      pdfBtn.classList.add('success');
      pdfBtn.querySelector('.quick-action-label').textContent = 'Done!';
      setTimeout(function () {
        pdfBtn.classList.remove('success');
        pdfBtn.querySelector('.quick-action-label').textContent = 'PDF';
      }, 2000);
    } catch (e) {
      console.error('PDF export failed:', e);
      pdfBtn.querySelector('.quick-action-label').textContent = 'PDF';
    }
  });
}

function generatePDFHTML(result) {
  const riskLevel = result.riskScore >= 70 ? 'Critical' :
    result.riskScore >= 50 ? 'High' :
      result.riskScore >= 30 ? 'Medium' : 'Low';
  const riskColor = result.riskScore >= 70 ? '#e74c3c' :
    result.riskScore >= 50 ? '#e67e22' :
      result.riskScore >= 30 ? '#f1c40f' : '#27ae60';

  const findingsHTML = (result.findings || []).map(function (f) {
    const severityColor = f.severity === 'critical' ? '#e74c3c' :
      f.severity === 'high' ? '#e67e22' :
        f.severity === 'medium' ? '#f1c40f' : '#3498db';
    return `
      <div style="margin-bottom: 15px; padding: 12px; border-left: 4px solid ${severityColor}; background: #f8f9fa;">
        <strong style="color: ${severityColor}; text-transform: uppercase; font-size: 11px;">${f.severity}</strong>
        <h4 style="margin: 5px 0; color: #333;">${escapeHtml(f.title)}</h4>
        <p style="margin: 5px 0; color: #666; font-size: 13px;">${escapeHtml(f.description)}</p>
        ${f.quote ? `<blockquote style="margin: 8px 0; padding: 8px; background: #eee; font-style: italic; font-size: 12px; border-radius: 4px;">"${escapeHtml(f.quote)}"</blockquote>` : ''}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Money Trap Analysis Report</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
        .logo { font-size: 18px; margin-bottom: 10px; font-weight: 700; letter-spacing: -0.01em; }
        .score-box { display: inline-block; padding: 20px 40px; border-radius: 10px; background: ${riskColor}20; border: 2px solid ${riskColor}; margin: 15px 0; }
        .score-number { font-size: 48px; font-weight: bold; color: ${riskColor}; }
        .score-label { display: block; font-size: 14px; color: #666; }
        .risk-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; background: ${riskColor}; color: white; font-weight: bold; }
        .section { margin: 25px 0; }
        .section h2 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .summary-box { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .meta { color: #888; font-size: 12px; margin-top: 30px; text-align: center; }
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">UseShield</div>
        <h1 style="margin: 0; color: #333;">Money Trap Analysis Report</h1>
        <p style="color: #666; margin: 5px 0;">${escapeHtml(result.title || result.url)}</p>
        <p style="color: #888; font-size: 12px;">${result.url}</p>
      </div>
      
      <div style="text-align: center;">
        <div class="score-box">
          <span class="score-number">${result.riskScore}</span>
          <span class="score-label">out of 100</span>
        </div>
        <div><span class="risk-badge">${riskLevel} Risk</span></div>
      </div>
      
      <div class="section">
        <h2>Summary</h2>
        <div class="summary-box">${escapeHtml(result.summary)}</div>
      </div>
      
      ${result.whatItMeans ? `
      <div class="section">
        <h2>What This Means</h2>
        <div class="summary-box">${escapeHtml(result.whatItMeans)}</div>
      </div>
      ` : ''}
      
      ${result.whatToDo ? `
      <div class="section">
        <h2>Recommended Actions</h2>
        <div class="summary-box">${escapeHtml(result.whatToDo)}</div>
      </div>
      ` : ''}
      
      <div class="section">
        <h2>Findings (${(result.findings || []).length})</h2>
        ${findingsHTML}
      </div>
      
      <div class="meta">
        <p>Generated by Money Trap Analyzer • ${new Date().toLocaleString()}</p>
        <p>https://useshield.net</p>
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Quick Action: Flag as Inaccurate
flagBtn.addEventListener('click', async function () {
  if (!currentResult) return;

  // Store flagged report for future review
  const stored = await chrome.storage.local.get(['mta_flagged_reports']);
  const flagged = stored.mta_flagged_reports || [];

  flagged.push({
    url: currentResult.url,
    riskScore: currentResult.riskScore,
    flaggedAt: Date.now(),
    summary: currentResult.summary
  });

  await chrome.storage.local.set({ mta_flagged_reports: flagged });

  flagBtn.classList.add('success');
  flagBtn.querySelector('.quick-action-label').textContent = 'Flagged!';
  setTimeout(function () {
    flagBtn.classList.remove('success');
    flagBtn.querySelector('.quick-action-label').textContent = 'Flag';
  }, 2000);

  setStatus('Thanks for the feedback! We\'ll review this analysis.');
  setTimeout(function () { setStatus(''); }, 3000);
});

// Quick Action: Refresh (skip cache)
refreshBtn.addEventListener('click', async function () {
  skipCache = true;
  try {
    await analyzeCurrentPage();
  } catch (e) {
    setStatus('');
    setError(String((e && e.message) || e));
  } finally {
    analyzeBtn.disabled = false;
    skipCache = false;
  }
});

// Trap focus in paywall modal
function trapFocus(element) {
  const focusable = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  element.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  first.focus();
}

// ===== MAIN APP INITIALIZATION (called by router after auth check) =====
function initMainApp() {
  console.log('[Popup] Initializing main app...');

  // Get user from router and display
  const user = getUser();
  if (user) {
    displayUserInfo(user);
  }

  // Initialize main app functionality
  initializeMainApp();

  // Initialize analysis mode selector and settings panel
  initModeSelector();

  // Setup keyboard shortcuts and effects
  setupKeyboardNavigation();
  setupButtonEffects();

  // Check offline status
  updateOfflineStatus();
  window.addEventListener('online', updateOfflineStatus);
  window.addEventListener('offline', updateOfflineStatus);

  // Dark mode toggle button
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn && window.UseShieldTheme) {
    themeToggleBtn.addEventListener('click', () => {
      window.UseShieldTheme.toggle();
    });
  }
}

async function initializeMainApp() {
  // Note: OpenAI API key is now managed by subscription system via Supabase
  await updateUsageInfo();
  await loadRecentAnalyses();

  // Check for active analysis
  try {
    const tab = await getActiveTab();
    if (tab && tab.url && /^https?:\/\//.test(tab.url)) {
      const response = await chrome.runtime.sendMessage({
        type: 'MTA_GET_ANALYSIS_STATUS',
        payload: { url: tab.url }
      });

      if (response && response.status === 'analyzing') {
        // Restore loading state
        setStatus('Analyzing with AI...');
        pollForStatus(tab.url);
      } else if (response && response.status === 'complete') {
        // Show result immediately
        renderResult(response.result, false);
      }
    }
  } catch (e) {
    console.log('Failed to check active analysis:', e);
  }
}

// ===== KEYBOARD NAVIGATION (extracted from inline listener) =====
function setupKeyboardNavigation() {
  document.addEventListener('keydown', function (e) {
    // ESC to close paywall/modals
    if (e.key === 'Escape') {
      const overlay = document.querySelector('.paywall-overlay') || document.querySelector('.confirm-overlay');
      if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(function () { overlay.remove(); }, 300);
      }
    }

    // Ctrl+Enter to analyze
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      if (!analyzeBtn.disabled) {
        analyzeBtn.click();
      }
    }

    // Keyboard shortcuts with Alt key
    if (e.altKey) {
      switch (e.key) {
        case 'a': // Alt+A to analyze
          e.preventDefault();
          if (!analyzeBtn.disabled) analyzeBtn.click();
          break;
        case 'h': // Alt+H for history
          e.preventDefault();
          historyBtn.click();
          break;
        case 's': // Alt+S for settings
          e.preventDefault();
          optionsBtn.click();
          break;
        case 'w': // Alt+W for watchlist
          e.preventDefault();
          watchlistBtn.click();
          break;
      }
    }
  });
}

// ===== BUTTON EFFECTS (extracted from inline listener) =====
function setupButtonEffects() {
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.primary-btn, .action-btn, .quick-action-btn, .icon-btn');
    if (!btn || btn.disabled) return;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';

    btn.appendChild(ripple);

    setTimeout(function () { ripple.remove(); }, 600);
  });
}

// ===== ANALYSIS MODE & SETTINGS PANEL =====
const MODE_TIER_MAP = {
  flash: 0,      // Free and above
  standard: 1,   // Starter and above
  deepdive: 3,   // Pro Plus and above
  neural: 4      // Agency only
};

const TIER_LEVEL_MAP = {
  free: 0,
  starter: 1,
  pro: 2,
  pro_plus: 3,
  agency: 4
};

async function initModeSelector() {
  const modeBtns = document.querySelectorAll('.mode-btn');
  const settingsToggleBtn = document.querySelector('.settings-toggle-btn');
  const settingsPanel = document.querySelector('.settings-panel');
  const customPromptGroup = document.querySelector('.custom-prompt-group');
  const customPromptInput = document.querySelector('.custom-prompt-input');

  // Get user tier from multiple sources (router subscription, local storage)
  const subscription = getSubscriptionData();
  let userTier = subscription?.tier;

  // Fallback: check local storage if router doesn't have tier
  if (!userTier) {
    const stored = await chrome.storage.local.get(['mta_tier', 'mta_subscription']);
    userTier = stored.mta_tier || stored.mta_subscription?.tier || 'free';
  }

  const userTierLevel = TIER_LEVEL_MAP[userTier] || 0;

  console.log('[Popup] Mode Selector - User tier:', userTier, 'Level:', userTierLevel);

  const storedData = await chrome.storage.local.get([
    'mta_analysisMode',
    'mta_customPrompt',
    'mta_redactPII',
    'mta_cacheResults',
    'mta_soundEnabled'
  ]);

  const currentMode = storedData.mta_analysisMode || 'flash';
  const customPrompt = storedData.mta_customPrompt || '';

  // Initialize checkboxes
  document.getElementById('redactPII').checked = storedData.mta_redactPII !== false; // default true
  document.getElementById('cacheResults').checked = storedData.mta_cacheResults !== false; // default true
  document.getElementById('soundEnabled').checked = storedData.mta_soundEnabled === true; // default false

  // Initialize custom prompt
  if (customPromptInput) {
    customPromptInput.value = customPrompt;
  }

  // Lock/unlock modes based on tier
  modeBtns.forEach(btn => {
    const mode = btn.dataset.mode;
    const requiredTier = MODE_TIER_MAP[mode];

    if (userTierLevel >= requiredTier) {
      btn.classList.remove('locked');
      // Hide lock icon if present
      const lockIcon = btn.querySelector('.lock-icon');
      if (lockIcon) {
        lockIcon.style.display = 'none';
      }
      // Set active mode
      if (mode === currentMode) {
        btn.classList.add('active');
      }
    } else {
      btn.classList.add('locked');
      // Show lock icon if present
      const lockIcon = btn.querySelector('.lock-icon');
      if (lockIcon) {
        lockIcon.style.display = '';
      }
      // Prevent selection
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const tierName = Object.keys(TIER_LEVEL_MAP).find(k => TIER_LEVEL_MAP[k] === requiredTier);
        showUpgradePrompt(mode, tierName);
      });
    }
  });

  // Mode selection handler (for unlocked modes)
  modeBtns.forEach(btn => {
    if (!btn.classList.contains('locked')) {
      btn.addEventListener('click', async function () {
        const mode = this.dataset.mode;

        // Update active state
        modeBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Save to storage
        await chrome.storage.local.set({ mta_analysisMode: mode });
        showToast(`Analysis mode set to ${mode.charAt(0).toUpperCase() + mode.slice(1)}`, 'success', 2000);
      });
    }
  });

  // Settings panel toggle
  if (settingsToggleBtn && settingsPanel) {
    settingsToggleBtn.addEventListener('click', function () {
      const isVisible = settingsPanel.style.display === 'block';
      settingsPanel.style.display = isVisible ? 'none' : 'block';
      this.classList.toggle('active', !isVisible);
    });

    // Initially hide settings panel
    settingsPanel.style.display = 'none';
  }

  // Checkbox handlers
  document.getElementById('redactPII')?.addEventListener('change', async function () {
    await chrome.storage.local.set({ mta_redactPII: this.checked });
  });

  document.getElementById('cacheResults')?.addEventListener('change', async function () {
    await chrome.storage.local.set({ mta_cacheResults: this.checked });
  });

  document.getElementById('soundEnabled')?.addEventListener('change', async function () {
    await chrome.storage.local.set({ mta_soundEnabled: this.checked });
  });

  // Lock/unlock custom prompt based on tier
  const canUseCustomPrompt = userTierLevel >= 3; // Pro Plus and above
  if (customPromptInput) {
    customPromptInput.disabled = !canUseCustomPrompt;

    if (canUseCustomPrompt) {
      customPromptGroup?.classList.remove('locked');

      // Save custom prompt on change
      customPromptInput.addEventListener('input', async function () {
        const value = this.value.trim();
        await chrome.storage.local.set({ mta_customPrompt: value });
      });
    } else {
      customPromptGroup?.classList.add('locked');

      // Show upgrade prompt when trying to use
      customPromptInput.addEventListener('click', function (e) {
        if (this.disabled) {
          e.preventDefault();
          showUpgradePrompt('custom-prompt', 'pro_plus');
        }
      });
    }
  }
}

function showUpgradePrompt(feature, requiredTier) {
  const tierDisplayName = TIER_NAMES[requiredTier] || requiredTier;
  const featureDisplayName = feature === 'custom-prompt'
    ? 'Custom Prompts'
    : feature.charAt(0).toUpperCase() + feature.slice(1) + ' Analysis';

  showConfirmDialog({
    title: 'Premium Feature',
    message: `${featureDisplayName} requires ${tierDisplayName} tier or higher. Would you like to upgrade?`,
    confirmText: 'Upgrade Now',
    cancelText: 'Maybe Later',
    type: 'info'
  }).then(confirmed => {
    if (confirmed) {
      navigateTo('subscription');
    }
  });
}

// ===== OFFLINE STATUS =====
function updateOfflineStatus() {
  const banner = document.getElementById('offlineBanner');
  if (!navigator.onLine) {
    banner.classList.remove('hidden');
    showToast('You are offline. Only cached analyses available.', 'warning', 5000);
  } else {
    banner.classList.add('hidden');
  }
}

// ===== RECENT ANALYSES =====
async function loadRecentAnalyses() {
  const recentSection = document.getElementById('recentSection');
  const recentList = document.getElementById('recentList');

  try {
    const stored = await chrome.storage.local.get(['mta_analysis_history']);
    const history = stored.mta_analysis_history || [];

    if (history.length === 0) {
      recentSection.hidden = true;
      return;
    }

    // Get last 3 analyses
    const recent = history
      .sort((a, b) => b.analyzedAt - a.analyzedAt)
      .slice(0, 3);

    recentList.innerHTML = recent.map(item => {
      const domain = item.url ? new URL(item.url).hostname.replace('www.', '') : 'Unknown';
      const timeAgo = getTimeAgo(item.analyzedAt);
      return `
        <div class="recent-item" data-url="${escapeHtml(item.url || '')}">
          <div class="recent-score ${item.riskLevel || 'medium'}">${item.riskScore || '?'}</div>
          <div class="recent-info">
            <div class="recent-domain">${escapeHtml(domain)}</div>
            <div class="recent-time">${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    recentList.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        if (url) {
          chrome.tabs.create({ url: url });
        }
      });
    });

    recentSection.hidden = false;
  } catch (e) {
    console.error('Failed to load recent analyses:', e);
    recentSection.hidden = true;
  }
}

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  return new Date(timestamp).toLocaleDateString();
}

// ===== USER INFO DISPLAY =====
function displayUserInfo(user) {
  // Create or update user info section in the main footer (bottom)
  const userSection = document.getElementById('userSection');
  if (!userSection) return;

  userSection.hidden = false;
  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
  const displayName = escapeHtml(user.name || 'User');
  const email = escapeHtml(user.email || '');

  userSection.innerHTML = `
    <div class="user-chip" title="${email}">
      <div class="user-avatar" aria-hidden="true">${initial}</div>
      <div class="user-name" aria-label="Signed in as ${displayName}">${displayName}</div>
      <button class="user-logout-btn" id="userLogoutBtn" type="button" title="Sign out" aria-label="Sign out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </button>
    </div>
  `;

  // Add logout handler
  const logoutBtn = document.getElementById('userLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function () {
      const confirmed = await showConfirmDialog({
        title: 'Logout',
        message: 'Are you sure you want to logout?',
        confirmText: 'Logout',
        cancelText: 'Cancel',
        type: 'warning'
      });

      if (confirmed) {
        try {
          const { logout } = await import('./src/auth.js');
          await logout();
          // Use router to navigate back to auth view
          navigateTo('auth');
          showToast('Logged out successfully', 'success');
        } catch (e) {
          showToast('Logout failed: ' + e.message, 'error');
        }
      }
    });
  }
}
