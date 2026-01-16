/**
 * UseShield - SPA Router
 * Handles authentication flow and view routing
 */

import { isAuthenticated, login, logout, register, getCurrentUser } from './auth.js';
import { getSubscription, canAnalyze } from './subscription.js';

// View constants
const VIEWS = {
  AUTH: 'authView',
  PAYWALL: 'paywallView',
  MAIN: 'mainView'
};

// Current state
let currentView = null;
let currentUser = null;
let currentSubscription = null;

/**
 * Initialize the router and determine which view to show
 */
export async function initRouter() {
  console.log('[Router] Initializing...');

  try {
    // Step 1: Check authentication
    const authenticated = await isAuthenticated();
    console.log('[Router] Authenticated:', authenticated);

    if (!authenticated) {
      showView(VIEWS.AUTH);
      setupAuthHandlers();
      return;
    }

    // Step 2: Get user data
    currentUser = await getCurrentUser();
    console.log('[Router] Current user:', currentUser);

    // Step 3: Check subscription/usage limits
    const usageCheck = await canAnalyze();
    console.log('[Router] Usage check:', usageCheck);

    if (!usageCheck.allowed && usageCheck.reason === 'Usage limit reached') {
      currentSubscription = usageCheck.subscription;
      showView(VIEWS.PAYWALL);
      setupPaywallHandlers();
      return;
    }

    // Step 4: Show main app
    currentSubscription = usageCheck.subscription;
    showView(VIEWS.MAIN);
    // Main app handlers are set up in popup.js

  } catch (error) {
    console.error('[Router] Initialization error:', error);
    // On error, show auth view
    showView(VIEWS.AUTH);
    setupAuthHandlers();
  }
}

/**
 * Show a specific view and hide others
 */
function showView(viewId) {
  console.log('[Router] Showing view:', viewId);
  currentView = viewId;

  // Hide all views
  Object.values(VIEWS).forEach(view => {
    const element = document.getElementById(view);
    if (element) {
      element.hidden = true;
    }
  });

  // Show requested view
  const viewElement = document.getElementById(viewId);
  if (viewElement) {
    viewElement.hidden = false;
  }
}

/**
 * Set up authentication view handlers
 */
function setupAuthHandlers() {
  console.log('[Router] Setting up auth handlers');

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const showRegisterBtn = document.getElementById('showRegisterBtn');
  const showLoginBtn = document.getElementById('showLoginBtn');
  const showForgotPasswordBtn = document.getElementById('showForgotPasswordBtn');
  const backToLoginBtn = document.getElementById('backToLoginBtn');
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const sendResetBtn = document.getElementById('sendResetBtn');

  // Toggle between login and register forms
  showRegisterBtn?.addEventListener('click', () => {
    loginForm.hidden = true;
    registerForm.hidden = false;
    forgotPasswordForm && (forgotPasswordForm.hidden = true);
    clearErrors();
  });

  showLoginBtn?.addEventListener('click', () => {
    registerForm.hidden = true;
    loginForm.hidden = false;
    forgotPasswordForm && (forgotPasswordForm.hidden = true);
    clearErrors();
  });

  // Toggle to forgot password form
  showForgotPasswordBtn?.addEventListener('click', () => {
    loginForm.hidden = true;
    registerForm.hidden = true;
    forgotPasswordForm && (forgotPasswordForm.hidden = false);
    clearErrors();
  });

  backToLoginBtn?.addEventListener('click', () => {
    loginForm.hidden = false;
    registerForm.hidden = true;
    forgotPasswordForm && (forgotPasswordForm.hidden = true);
    clearErrors();
  });

  // Password toggle handlers
  setupPasswordToggles();

  // Handle login with loading spinner
  loginBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('authError');

    if (!email || !password) {
      showError(errorEl, 'Please enter both email and password');
      return;
    }

    setButtonLoading(loginBtn, true, 'Signing in...');

    try {
      const result = await login(email, password);

      if (result.success) {
        console.log('[Router] Login successful');
        await initRouter();
      } else {
        showError(errorEl, result.error || 'Login failed');
      }
    } catch (error) {
      console.error('[Router] Login error:', error);
      showError(errorEl, 'Network error. Please try again.');
    } finally {
      setButtonLoading(loginBtn, false, 'Sign In');
    }
  });

  // Handle register with loading spinner
  registerBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const errorEl = document.getElementById('registerError');

    if (!name || !email || !password) {
      showError(errorEl, 'Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      showError(errorEl, 'Password must be at least 8 characters');
      return;
    }

    setButtonLoading(registerBtn, true, 'Creating account...');

    try {
      const result = await register(name, email, password);

      if (result.success) {
        console.log('[Router] Registration successful');
        showError(errorEl, 'Account created! Please check your email to verify.', 'success');
        setTimeout(() => {
          registerForm.hidden = true;
          loginForm.hidden = false;
        }, 2000);
      } else {
        showError(errorEl, result.error || 'Registration failed');
      }
    } catch (error) {
      console.error('[Router] Registration error:', error);
      showError(errorEl, 'Network error. Please try again.');
    } finally {
      setButtonLoading(registerBtn, false, 'Create Account');
    }
  });

  // Handle forgot password - Send magic link
  sendResetBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    const errorEl = document.getElementById('forgotPasswordError');
    const successEl = document.getElementById('forgotPasswordSuccess');

    if (!email) {
      showError(errorEl, 'Please enter your email address');
      return;
    }

    setButtonLoading(sendResetBtn, true, 'Sending...');

    try {
      const { requestPasswordReset } = await import('./auth.js');
      const result = await requestPasswordReset(email);

      if (result.success) {
        console.log('[Router] Password reset email sent');
        errorEl && (errorEl.hidden = true);
        if (successEl) {
          successEl.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>Check your email! Click the link to reset your password on our website.</span>
          `;
          successEl.hidden = false;
        }
        // Clear the input
        document.getElementById('forgotEmail').value = '';
      } else {
        showError(errorEl, result.error || 'Failed to send reset email');
      }
    } catch (error) {
      console.error('[Router] Password reset error:', error);
      showError(errorEl, 'Network error. Please try again.');
    } finally {
      setButtonLoading(sendResetBtn, false, 'Send Reset Link');
    }
  });

  // Enter key handlers
  document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn?.click();
  });

  document.getElementById('registerPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') registerBtn?.click();
  });

  document.getElementById('forgotEmail')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendResetBtn?.click();
  });

  // Google Sign-In Handlers
  const handleGoogleSignIn = async (btn, errorEl) => {
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Connecting...</span>';

    chrome.runtime.sendMessage({ type: 'MTA_GOOGLE_LOGIN' }, async (response) => {
      const lastError = chrome.runtime.lastError;

      if (lastError) {
        if (lastError.message && lastError.message.includes('message port closed')) {
          console.log('[Router] Popup closed during auth - this is expected.');
          return;
        }

        console.error('Message error:', lastError);
        showError(errorEl, 'Connection failed');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        return;
      }

      if (response && response.success) {
        console.log('[Router] Google login successful (via background)');
        await initRouter();
      } else {
        if (response && response.error) {
          showError(errorEl, response.error);
        }
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    });
  };

  const googleLoginBtn = document.getElementById('googleLoginBtn');
  const googleRegisterBtn = document.getElementById('googleRegisterBtn');

  googleLoginBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    handleGoogleSignIn(googleLoginBtn, document.getElementById('authError'));
  });

  googleRegisterBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    handleGoogleSignIn(googleRegisterBtn, document.getElementById('registerError'));
  });
}

/**
 * Set up password toggle functionality
 */
function setupPasswordToggles() {
  const toggleBtns = document.querySelectorAll('.password-toggle');

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const wrapper = btn.closest('.input-wrapper');
      const input = wrapper?.querySelector('input');
      const eyeOpen = btn.querySelector('.eye-open');
      const eyeClosed = btn.querySelector('.eye-closed');

      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        if (eyeOpen && eyeClosed) {
          eyeOpen.style.display = isPassword ? 'none' : 'block';
          eyeClosed.style.display = isPassword ? 'block' : 'none';
        }
      }
    });
  });
}

/**
 * Set button loading state
 */
function setButtonLoading(btn, loading, text) {
  if (!btn) return;

  const btnText = btn.querySelector('.btn-text');
  const btnSpinner = btn.querySelector('.btn-spinner');

  btn.disabled = loading;

  if (btnText) {
    btnText.textContent = text;
  } else {
    btn.textContent = text;
  }

  if (btnSpinner) {
    btnSpinner.style.display = loading ? 'inline-block' : 'none';
  }
}

/**
 * Clear all error/success messages
 */
function clearErrors() {
  const messages = document.querySelectorAll('.auth-error, .auth-success');
  messages.forEach(el => el.hidden = true);
}

/**
 * Go to a specific step in password reset flow
 */
function goToResetStep(step) {
  // Update step indicators
  const steps = document.querySelectorAll('.reset-step');
  const lines = document.querySelectorAll('.reset-step-line');

  steps.forEach((s, idx) => {
    const stepNum = idx + 1;
    s.classList.remove('active', 'completed');
    if (stepNum < step) {
      s.classList.add('completed');
    } else if (stepNum === step) {
      s.classList.add('active');
    }
  });

  lines.forEach((line, idx) => {
    if (idx < step - 1) {
      line.classList.add('completed');
    } else {
      line.classList.remove('completed');
    }
  });

  // Show/hide step content
  document.getElementById('resetStep1').hidden = step !== 1;
  document.getElementById('resetStep2').hidden = step !== 2;
  document.getElementById('resetStep3').hidden = step !== 3;

  // Clear errors when changing steps
  clearErrors();
}

/**
 * Setup OTP input handlers
 */
function setupOtpInputs() {
  const inputs = document.querySelectorAll('.otp-input');

  inputs.forEach((input, idx) => {
    // Auto-focus next input on digit entry
    input.addEventListener('input', (e) => {
      const value = e.target.value;

      // Only allow digits
      e.target.value = value.replace(/[^0-9]/g, '');

      if (e.target.value.length === 1) {
        input.classList.add('filled');
        input.classList.remove('error');
        // Focus next input
        if (idx < inputs.length - 1) {
          inputs[idx + 1].focus();
        }
      } else {
        input.classList.remove('filled');
      }
    });

    // Handle backspace to focus previous
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        inputs[idx - 1].focus();
      }
      // On Enter, submit
      if (e.key === 'Enter') {
        document.getElementById('verifyCodeBtn')?.click();
      }
    });

    // Handle paste
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
      if (pasteData.length === 6) {
        inputs.forEach((inp, i) => {
          inp.value = pasteData[i] || '';
          if (pasteData[i]) inp.classList.add('filled');
        });
        inputs[5].focus();
      }
    });

    // Focus styling
    input.addEventListener('focus', () => {
      input.select();
    });
  });
}

/**
 * Get OTP value from inputs
 */
function getOtpValue() {
  let otp = '';
  for (let i = 1; i <= 6; i++) {
    otp += document.getElementById(`otpDigit${i}`)?.value || '';
  }
  return otp;
}

/**
 * Clear OTP inputs
 */
function clearOtpInputs() {
  for (let i = 1; i <= 6; i++) {
    const input = document.getElementById(`otpDigit${i}`);
    if (input) {
      input.value = '';
      input.classList.remove('filled', 'error');
    }
  }
}

/**
 * Mark OTP inputs as error
 */
function markOtpError(isError) {
  const inputs = document.querySelectorAll('.otp-input');
  inputs.forEach(input => {
    if (isError) {
      input.classList.add('error');
    } else {
      input.classList.remove('error');
    }
  });
}

/**
 * Reset password flow to initial state
 */
function resetPasswordFlow() {
  goToResetStep(1);
  document.getElementById('forgotEmail').value = '';
  clearOtpInputs();
  document.getElementById('resetNewPassword').value = '';
  document.getElementById('resetConfirmPassword').value = '';
  clearErrors();
}

/**
 * Set up paywall view handlers
 */
function setupPaywallHandlers() {
  console.log('[Router] Setting up paywall handlers');

  const logoutBtn = document.getElementById('logoutBtn');
  const pricingBtns = document.querySelectorAll('.pricing-btn[data-tier]');

  // Update usage display
  if (currentSubscription) {
    const usageText = document.getElementById('usageText');
    if (usageText) {
      const { scansUsed, scansLimit } = currentSubscription;
      usageText.textContent = `${scansUsed} / ${scansLimit} analyses used`;
    }
  }

  // Handle logout
  logoutBtn?.addEventListener('click', async () => {
    await logout();
    currentUser = null;
    currentSubscription = null;
    showView(VIEWS.AUTH);
    setupAuthHandlers();
  });

  // Handle plan selection
  pricingBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const tier = btn.getAttribute('data-tier');
      console.log('[Router] Selected tier:', tier);

      // TODO: Implement payment flow
      // For now, show alert
      alert(`Payment integration coming soon!\n\nYou selected: ${tier}\n\nPlease contact support to upgrade.`);

      // In production, this would:
      // 1. Open payment provider checkout
      // 2. Handle webhook callback
      // 3. Activate subscription
      // 4. Redirect to main view
    });
  });
}

/**
 * Show error message
 */
function showError(errorEl, message, type = 'error') {
  if (!errorEl) return;

  errorEl.textContent = message;
  errorEl.hidden = false;
  errorEl.className = type === 'success' ? 'auth-success' : 'auth-error';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorEl.hidden = true;
  }, 5000);
}

/**
 * Navigate to a specific view (for external calls)
 */
export function navigateTo(viewId) {
  if (VIEWS[viewId.toUpperCase()]) {
    showView(VIEWS[viewId.toUpperCase()]);

    // Set up handlers for the new view
    if (viewId === 'auth') {
      setupAuthHandlers();
    } else if (viewId === 'paywall') {
      setupPaywallHandlers();
    }
  }
}

/**
 * Get current user (for use in main app)
 */
export function getUser() {
  return currentUser;
}

/**
 * Get current subscription (for use in main app)
 */
export function getSubscriptionData() {
  return currentSubscription;
}

/**
 * Refresh subscription data
 */
export async function refreshSubscription() {
  try {
    const usageCheck = await canAnalyze();
    currentSubscription = usageCheck.subscription;

    // If usage limit reached, show paywall
    if (!usageCheck.allowed && usageCheck.reason === 'Usage limit reached') {
      showView(VIEWS.PAYWALL);
      setupPaywallHandlers();
    }

    return currentSubscription;
  } catch (error) {
    console.error('[Router] Error refreshing subscription:', error);
    return null;
  }
}
