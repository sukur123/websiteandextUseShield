/**
 * Authentication Module - Supabase Integration
 * Handles user registration, login, logout, and session management
 * Uses Supabase REST API (no external dependencies)
 */

// Supabase Configuration
const SUPABASE_URL = 'https://fmptjjpwndojeywyacum.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcHRqanB3bmRvamV5d3lhY3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDIyNDUsImV4cCI6MjA4MzI3ODI0NX0.g8oiu_U5smCC8o8EKG4VYrvz-NTaYsB4hXmcdO_TTxo';

/**
 * Simple Supabase client using fetch API
 */
const supabase = {
  auth: {
    async signUp({ email, password, options = {} }) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          email,
          password,
          data: options.data || {}
        })
      });
      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: data.error || data };
      }

      // Supabase returns user in response, session may be null (email confirmation required)
      return {
        data: {
          user: data.user || data,
          session: data.session || null
        },
        error: null
      };
    },

    async signInWithPassword({ email, password }) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.access_token) {
        return {
          data: {
            user: data.user,
            session: {
              access_token: data.access_token,
              refresh_token: data.refresh_token,
              expires_in: data.expires_in,
              expires_at: data.expires_at
            }
          },
          error: null
        };
      }
      return { data: null, error: data.error || { message: 'Login failed' } };
    },

    async signOut() {
      const session = await getStoredSession();
      if (session?.access_token) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': SUPABASE_ANON_KEY
          }
        });
      }
      return { error: null };
    },

    async getSession() {
      const session = await getStoredSession();
      return { data: { session }, error: null };
    },

    async getUser() {
      const session = await getStoredSession();
      if (!session?.access_token) {
        return { data: { user: null }, error: null };
      }

      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        }
      });

      if (response.ok) {
        const user = await response.json();
        return { data: { user }, error: null };
      }
      return { data: { user: null }, error: null };
    },

    async updateUser(updates) {
      const session = await getStoredSession();
      if (!session?.access_token) {
        return { data: null, error: { message: 'Not authenticated' } };
      }

      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: data.error || { message: data.msg || 'Update failed' } };
      }

      return { data: { user: data }, error: null };
    },

    async resetPasswordForEmail(email, options = {}) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          email,
          redirect_to: options.redirectTo
        })
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || { message: 'Password reset failed' } };
      }

      return { error: null };
    },

    async resend({ type, email }) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ type, email })
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || { message: 'Resend failed' } };
      }

      return { error: null };
    },

    async signInWithOtp({ email, options = {} }) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          email,
          create_user: false,
          ...options
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || { message: data.msg || 'Failed to send OTP' } };
      }

      return { data, error: null };
    },

    async verifyOtp({ email, token, type = 'email' }) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          email,
          token,
          type
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: data.error || { message: data.msg || 'Invalid or expired code' } };
      }

      // If successful, we get session data
      if (data.access_token) {
        await setStoredSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
          expires_at: data.expires_at
        });
      }

      return { data, error: null };
    }
  }
};

// Helper functions for session storage
async function getStoredSession() {
  const { supabase_session } = await chrome.storage.local.get(['supabase_session']);
  return supabase_session || null;
}

async function setStoredSession(session) {
  if (session) {
    await chrome.storage.local.set({ supabase_session: session });
  } else {
    await chrome.storage.local.remove(['supabase_session']);
  }
}

/**
 * Get the Supabase client instance
 * @returns {Object} The supabase client
 */
function getSupabaseClient() {
  return supabase;
}

/**
 * Register a new user with Supabase
 * @param {string} email - User's email address  
 * @param {string} password - User's password
 * @param {string} name - User's full name
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 */
export async function register(name, email, password) {
  try {
    // Sign up with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name
        }
      }
    });

    if (error) {
      throw new Error(error.message || JSON.stringify(error));
    }

    if (!data || !data.user) {
      throw new Error('Registration failed - no user data returned');
    }

    // Store user data locally
    await chrome.storage.local.set({
      mta_user: {
        id: data.user.id,
        email: data.user.email,
        name: name,
        emailVerified: data.user.email_confirmed_at ? true : false
      }
    });

    // Supabase session is automatically managed
    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: name,
        emailVerified: data.user.email_confirmed_at ? true : false
      },
      message: 'Registration successful! Please check your email to verify your account.'
    };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Login user with Supabase
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 */
export async function login(email, password) {
  try {
    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user || !data.session) {
      throw new Error('Login failed - invalid credentials');
    }

    // Get user metadata (name)
    const userName = data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User';

    // Store session
    await setStoredSession(data.session);

    // Store user data locally
    await chrome.storage.local.set({
      mta_user: {
        id: data.user.id,
        email: data.user.email,
        name: userName,
        emailVerified: data.user.email_confirmed_at ? true : false
      }
    });

    // Supabase session is automatically managed
    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: userName,
        emailVerified: data.user.email_confirmed_at ? true : false
      }
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Login with Google OAuth via Supabase
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 */
export async function signInWithGoogle() {
  try {
    const redirectUrl = chrome.identity.getRedirectURL();
    console.log('Redirect URL:', redirectUrl);

    // Construct OAuth URL
    const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;

    // Launch Chrome Identity flow
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }

    // Parse the response URL to get the access token
    // The URL will be like: https://<extension-id>.chromiumapp.org/#access_token=...&refresh_token=...
    const url = new URL(responseUrl);
    const hash = url.hash.substring(1); // Remove the '#'
    const params = new URLSearchParams(hash);

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = params.get('expires_in');
    const tokenType = params.get('token_type');

    // Debug logging
    await chrome.storage.local.set({
      mta_auth_debug_last_attempt: {
        time: Date.now(),
        // responseUrl: responseUrl.substring(0, 50) + '...', // redact
        hasAccessToken: !!accessToken,
        error: params.get('error'),
        errorDescription: params.get('error_description')
      }
    });

    if (!accessToken) {
      const error = params.get('error');
      const errorDesc = params.get('error_description');
      throw new Error(errorDesc || error || 'No access token found in response');
    }

    // We need to get the user details using the access token
    // Create a temporary session object
    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: parseInt(expiresIn || '3600'),
      expires_at: Math.floor(Date.now() / 1000) + parseInt(expiresIn || '3600'),
      token_type: tokenType || 'bearer'
    };

    // Store session
    await setStoredSession(session);

    // Fetch user details
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error('Failed to fetch user details: ' + (error?.message || 'Unknown error'));
    }

    const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';

    const userObj = {
      id: user.id,
      email: user.email,
      name: userName,
      emailVerified: user.email_confirmed_at ? true : false
    };

    // Store user data locally
    await chrome.storage.local.set({ mta_user: userObj });

    return {
      success: true,
      user: userObj
    };

  } catch (error) {
    console.error('Google Sign-In error:', error);
    return {
      success: false,
      error: error.message || 'Google Sign-In failed'
    };
  }
}

/**
 * Logout current user from Supabase
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function logout() {
  try {
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Supabase logout error:', error);
    }

    // Clear local storage and session
    await setStoredSession(null);
    await chrome.storage.local.remove(['mta_user', 'mta_subscription', 'mta_tier']);

    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if user is authenticated with Supabase
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  try {
    // Check Supabase session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return false;
    }

    // Also check local storage for user data
    const stored = await chrome.storage.local.get(['mta_user']);

    if (!stored.mta_user) {
      // Session exists but local data missing - restore it
      const userName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User';

      await chrome.storage.local.set({
        mta_user: {
          id: session.user.id,
          email: session.user.email,
          name: userName,
          emailVerified: session.user.email_confirmed_at ? true : false
        }
      });
    }

    return true;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}

/**
 * Get current authenticated user
 * @returns {Promise<Object|null>}
 */
export async function getCurrentUser() {
  try {
    const stored = await chrome.storage.local.get(['mta_user']);

    if (stored.mta_user) {
      return stored.mta_user;
    }

    // If not in local storage, try to get from Supabase session
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      const userName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User';
      const user = {
        id: session.user.id,
        email: session.user.email,
        name: userName,
        emailVerified: session.user.email_confirmed_at ? true : false
      };

      // Store for future use
      await chrome.storage.local.set({ mta_user: user });
      return user;
    }

    return null;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

/**
 * Get Supabase access token
 * @returns {Promise<string|null>}
 */
export async function getAuthToken() {
  try {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('Get token error:', error);
    return null;
  }
}

/**
 * Get Supabase client instance
 * @returns {Object} Supabase client
 */
export function getSupabase() {
  return getSupabaseClient();
}

/**
 * Refresh user data from Supabase
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 */
export async function refreshUserData() {
  try {
    const supabase = getSupabaseClient();

    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      throw new Error('Not authenticated');
    }

    const userName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User';

    const user = {
      id: session.user.id,
      email: session.user.email,
      name: userName,
      emailVerified: session.user.email_confirmed_at ? true : false
    };

    // Update local storage
    await chrome.storage.local.set({ mta_user: user });

    return {
      success: true,
      user: user
    };
  } catch (error) {
    console.error('Refresh user data error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Resend verification email
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function resendVerificationEmail() {
  try {
    const user = await getCurrentUser();

    if (!user || !user.email) {
      throw new Error('No user email found');
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      message: 'Verification email sent! Please check your inbox.'
    };
  } catch (error) {
    console.error('Resend verification error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Request password reset with Supabase
 * @param {string} email - User's email address
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function requestPasswordReset(email) {
  try {
    const supabase = getSupabaseClient();

    // Don't use redirectTo - Supabase will handle reset on its own site
    // Chrome blocks navigation to chrome-extension:// URLs from email links
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      message: 'Password reset email sent! Please check your inbox.'
    };
  } catch (error) {
    console.error('Password reset request error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update user profile with Supabase
 * @param {string} name - New name
 * @param {string} email - New email (optional)
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 */
export async function updateProfile(name, email) {
  try {
    const supabase = getSupabaseClient();

    const updates = {
      data: {
        name: name
      }
    };

    if (email) {
      updates.email = email;
    }

    const { data, error } = await supabase.auth.updateUser(updates);

    if (error) {
      throw new Error(error.message);
    }

    const userName = data.user.user_metadata?.name || name;

    const updatedUser = {
      id: data.user.id,
      email: data.user.email,
      name: userName,
      emailVerified: data.user.email_confirmed_at ? true : false
    };

    // Update local storage
    await chrome.storage.local.set({ mta_user: updatedUser });

    return {
      success: true,
      user: updatedUser,
      message: email ? 'Profile updated! Please verify your new email.' : 'Profile updated successfully!'
    };
  } catch (error) {
    console.error('Update profile error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Change user password with Supabase
 * @param {string} newPassword - New password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function changePassword(newPassword) {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      message: 'Password changed successfully!'
    };
  } catch (error) {
    console.error('Change password error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send OTP for password reset
 * @param {string} email - User's email address
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendPasswordResetOtp(email) {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      message: 'Verification code sent! Please check your email.'
    };
  } catch (error) {
    console.error('Send OTP error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send verification code'
    };
  }
}

/**
 * Verify OTP and establish session for password reset
 * @param {string} email - User's email address
 * @param {string} token - 6-digit OTP code
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyPasswordResetOtp(email, token) {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      message: 'Code verified! You can now reset your password.',
      data
    };
  } catch (error) {
    console.error('Verify OTP error:', error);
    return {
      success: false,
      error: error.message || 'Invalid or expired code'
    };
  }
}
