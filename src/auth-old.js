/**
 * Authentication Module
 * Handles user registration, login, and session management
 */

// Backend API endpoint - UPDATE THIS WITH YOUR ACTUAL BACKEND URL
const API_BASE_URL = 'https://api.useshield.net'; // Change to your backend

// Storage keys
const AUTH_TOKEN_KEY = 'mta_auth_token';
const USER_KEY = 'mta_user';
const SESSION_KEY = 'mta_session';

/**
 * Register a new user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} name - User's full name
 * @returns {Promise<{ success: boolean, user: Object, token: string, error: string }>}
 */
export async function register(email, password, name) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        name,
        extensionVersion: chrome.runtime.getManifest().version,
        source: 'chrome_extension'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        user: null,
        token: null,
        error: data.message || 'Registration failed'
      };
    }

    // Store auth token and user data
    await chrome.storage.local.set({
      [AUTH_TOKEN_KEY]: data.token,
      [USER_KEY]: data.user,
      [SESSION_KEY]: {
        userId: data.user.id,
        email: data.user.email,
        loginAt: Date.now()
      }
    });

    // Sync subscription tier from user data
    if (data.user.subscription) {
      await chrome.storage.local.set({
        mta_tier: data.user.subscription.tier || 'free',
        mta_subscription: data.user.subscription
      });
    }

    return {
      success: true,
      user: data.user,
      token: data.token,
      error: null
    };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      user: null,
      token: null,
      error: error.message || 'Network error. Please try again.'
    };
  }
}

/**
 * Login existing user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<{ success: boolean, user: Object, token: string, error: string }>}
 */
export async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        extensionVersion: chrome.runtime.getManifest().version
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        user: null,
        token: null,
        error: data.message || 'Login failed'
      };
    }

    // Store auth token and user data
    await chrome.storage.local.set({
      [AUTH_TOKEN_KEY]: data.token,
      [USER_KEY]: data.user,
      [SESSION_KEY]: {
        userId: data.user.id,
        email: data.user.email,
        loginAt: Date.now()
      }
    });

    // Sync subscription tier from user data
    if (data.user.subscription) {
      await chrome.storage.local.set({
        mta_tier: data.user.subscription.tier || 'free',
        mta_subscription: data.user.subscription
      });
    } else {
      await chrome.storage.local.set({ mta_tier: 'free' });
    }

    return {
      success: true,
      user: data.user,
      token: data.token,
      error: null
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      user: null,
      token: null,
      error: error.message || 'Network error. Please try again.'
    };
  }
}

/**
 * Logout user
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    const stored = await chrome.storage.local.get([AUTH_TOKEN_KEY]);
    const token = stored[AUTH_TOKEN_KEY];

    if (token) {
      // Notify backend of logout
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }).catch(() => {}); // Ignore errors
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear all auth data
    await chrome.storage.local.remove([
      AUTH_TOKEN_KEY,
      USER_KEY,
      SESSION_KEY,
      'mta_subscription',
      'mta_license'
    ]);
    
    // Reset to free tier
    await chrome.storage.local.set({ mta_tier: 'free' });
  }
}

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const stored = await chrome.storage.local.get([AUTH_TOKEN_KEY, SESSION_KEY]);
  return !!(stored[AUTH_TOKEN_KEY] && stored[SESSION_KEY]);
}

/**
 * Get current user data
 * @returns {Promise<Object|null>}
 */
export async function getCurrentUser() {
  const stored = await chrome.storage.local.get([USER_KEY]);
  return stored[USER_KEY] || null;
}

/**
 * Get auth token
 * @returns {Promise<string|null>}
 */
export async function getAuthToken() {
  const stored = await chrome.storage.local.get([AUTH_TOKEN_KEY]);
  return stored[AUTH_TOKEN_KEY] || null;
}

/**
 * Refresh user data from backend
 * @returns {Promise<{ success: boolean, user: Object|null }>}
 */
export async function refreshUserData() {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      return { success: false, user: null };
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // Token might be invalid
      if (response.status === 401) {
        await logout();
      }
      return { success: false, user: null };
    }

    const data = await response.json();

    // Update stored user data
    await chrome.storage.local.set({
      [USER_KEY]: data.user
    });

    // Sync subscription tier
    if (data.user.subscription) {
      await chrome.storage.local.set({
        mta_tier: data.user.subscription.tier || 'free',
        mta_subscription: data.user.subscription
      });
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Refresh user data error:', error);
    return { success: false, user: null };
  }
}

/**
 * Verify email with code
 * @param {string} code - Verification code from email
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function verifyEmail(code) {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Verification failed' };
    }

    // Refresh user data
    await refreshUserData();

    return { success: true, error: null };
  } catch (error) {
    console.error('Email verification error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Request password reset
 * @param {string} email - User's email
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function requestPasswordReset(email) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Request failed' };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Password reset request error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reset password with token
 * @param {string} token - Reset token from email
 * @param {string} newPassword - New password
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function resetPassword(token, newPassword) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token, newPassword })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Reset failed' };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user profile
 * @param {Object} updates - Profile updates
 * @returns {Promise<{ success: boolean, user: Object|null, error: string|null }>}
 */
export async function updateProfile(updates) {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      return { success: false, user: null, error: 'Not authenticated' };
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, user: null, error: data.message || 'Update failed' };
    }

    // Update stored user data
    await chrome.storage.local.set({
      [USER_KEY]: data.user
    });

    return { success: true, user: data.user, error: null };
  } catch (error) {
    console.error('Profile update error:', error);
    return { success: false, user: null, error: error.message };
  }
}

/**
 * Change password
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function changePassword(currentPassword, newPassword) {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Password change failed' };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Password change error:', error);
    return { success: false, error: error.message };
  }
}
