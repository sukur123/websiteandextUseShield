/**
 * Subscription Page Script
 * Handles PayPal integration using popup/redirect flow (CSP compatible)
 */

import { isAuthenticated, getCurrentUser } from './src/auth.js';
import { getSubscription, upgradeSubscription } from './src/subscription.js';
import { getClientId, getPlanId, getTierConfig, onSubscriptionApproved } from './src/paypal.js';

// Page state
let currentTier = 'free';
let currentUser = null;

// PayPal hosted checkout URLs (these open in new tabs, bypassing CSP)
const PAYPAL_CHECKOUT_URLS = {
  starter: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-5T3794135U299950GNFP6CSY',
  pro: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-6FX41678YY880601DNFP6FNA',
  pro_plus: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-44H56844BU4653255NFP6G3I',
  agency: 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-2W469222BB8893546NFP6IZQ'
};

/**
 * Initialize the subscription page
 */
async function init() {
  console.log('Initializing subscription page...');

  // Check authentication
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    showToast('Please login first', 'error');
    setTimeout(() => {
      window.location.href = 'popup.html';
    }, 1500);
    return;
  }

  // Get current user
  currentUser = await getCurrentUser();

  // Load subscription data
  await loadSubscriptionData();

  // Setup event listeners
  setupEventListeners();

  // Update UI
  updateUI();

  // Hide loading
  showLoading(false);
}

/**
 * Load subscription data from Supabase
 */
async function loadSubscriptionData() {
  try {
    const subscription = await getSubscription();
    if (subscription) {
      currentTier = subscription.tier || 'free';
    }
  } catch (error) {
    console.error('Error loading subscription:', error);
    currentTier = 'free';
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Back link
  const backLink = document.getElementById('backLink');
  if (backLink) {
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.close();
    });
  }

  // Plan buttons - Open PayPal in new tab
  document.querySelectorAll('.plan-btn[data-tier]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tier = e.currentTarget.dataset.tier;
      if (tier && tier !== currentTier && tier !== 'free') {
        handlePlanSelect(tier);
      }
    });
  });

  // FAQ accordions
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const isOpen = item.classList.contains('open');

      // Close all
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));

      // Toggle current
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });
}

/**
 * Handle plan selection - Opens PayPal checkout in new tab
 */
function handlePlanSelect(tier) {
  const checkoutUrl = PAYPAL_CHECKOUT_URLS[tier];

  if (!checkoutUrl) {
    showToast('Payment not available for this plan.', 'error');
    return;
  }

  // Open PayPal checkout in new tab
  chrome.tabs.create({ url: checkoutUrl }, (tab) => {
    showToast(`Opening PayPal checkout for ${formatTierName(tier)}...`, 'success');

    // Store pending upgrade info
    chrome.storage.local.set({
      pending_upgrade: {
        tier: tier,
        timestamp: Date.now()
      }
    });
  });
}

/**
 * Update UI based on current subscription
 */
function updateUI() {
  // Update current tier display
  const tierDisplay = document.getElementById('currentTierDisplay');
  if (tierDisplay) {
    tierDisplay.textContent = formatTierName(currentTier);
  }

  // Update pricing cards
  document.querySelectorAll('.pricing-card').forEach(card => {
    const tier = card.dataset.tier;
    const btn = card.querySelector('.plan-btn');
    const paypalContainer = card.querySelector('.paypal-button-container');

    // Hide PayPal container (we use redirect flow now)
    if (paypalContainer) {
      paypalContainer.style.display = 'none';
    }

    // Remove existing badges
    const existingBadge = card.querySelector('.card-badge.current');
    if (existingBadge) existingBadge.remove();

    card.classList.remove('current');

    if (tier === currentTier) {
      card.classList.add('current');

      // Add current plan badge
      const badge = document.createElement('div');
      badge.className = 'card-badge current';
      badge.textContent = 'Current Plan';
      card.appendChild(badge);

      // Update button
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Current Plan';
        btn.classList.remove('primary');
        btn.classList.add('secondary');
      }
    } else if (tier === 'free') {
      // Free tier - can't downgrade via this page
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Free Plan';
        btn.classList.remove('primary');
        btn.classList.add('secondary');
      }
    } else {
      // Show upgrade button
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          ${isUpgrade(tier) ? 'Upgrade to' : 'Switch to'} ${formatTierName(tier)}
        `;
        btn.classList.add('primary');
        btn.classList.remove('secondary');
      }
    }
  });
}

/**
 * Check if tier is an upgrade from current
 */
function isUpgrade(tier) {
  const tierOrder = ['free', 'starter', 'pro', 'pro_plus', 'agency'];
  return tierOrder.indexOf(tier) > tierOrder.indexOf(currentTier);
}

/**
 * Format tier name for display
 */
function formatTierName(tier) {
  const names = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    pro_plus: 'Pro+',
    agency: 'Agency'
  };
  return names[tier] || tier;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');

  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;
  toast.className = `toast show ${type}`;

  // Auto hide after 5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
}

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.toggle('show', show);
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', init);
