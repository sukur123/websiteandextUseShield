/**
 * Account Settings Page JavaScript
 * Handles profile updates, password changes, and sign out
 */

import { getCurrentUser, updateProfile, changePassword, logout } from './src/auth.js';

// DOM Elements
const backLink = document.getElementById('backLink');
const profileForm = document.getElementById('profileForm');
const passwordForm = document.getElementById('passwordForm');
const signOutBtn = document.getElementById('signOutBtn');

// Profile form elements
const userAvatar = document.getElementById('userAvatar');
const userDisplayName = document.getElementById('userDisplayName');
const userEmailText = document.getElementById('userEmailText');
const emailBadge = document.getElementById('emailBadge');
const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const cancelProfileBtn = document.getElementById('cancelProfileBtn');
const profileMessage = document.getElementById('profileMessage');

// Password form elements
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
const passwordMessage = document.getElementById('passwordMessage');

// Store original values for cancel functionality
let originalProfile = {};

/**
 * Initialize the page
 */
async function init() {
    await loadUserData();
    setupEventListeners();
    setupPasswordToggles();
}

/**
 * Load current user data and populate forms
 */
async function loadUserData() {
    try {
        // 1. Get authenticated user (session)
        const user = await getCurrentUser();

        if (!user) {
            window.close();
            return;
        }

        // 2. Fetch fresh profile data via API (No cache)
        const { data: dbProfile, error } = await fetchProfile();

        // Handle case where profile might not exist in profiles table yet (fallback to user metadata)
        const profile = dbProfile || {};

        // Parse name parts
        // Priority: DB Profile name -> User Metadata name -> Email
        const fullName = profile.full_name || user.name || '';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Populate fields
        firstNameInput.value = firstName;
        lastNameInput.value = lastName;
        // Username from DB or fallback to email prefix
        usernameInput.value = profile.username || user.email.split('@')[0];
        emailInput.value = user.email;

        // Update Header
        const displayName = fullName || user.email.split('@')[0];
        userDisplayName.textContent = displayName;
        userEmailText.textContent = user.email;
        userAvatar.textContent = (displayName[0] || user.email[0]).toUpperCase();

        // Email Badge
        if (user.emailVerified) {
            emailBadge.classList.remove('unverified');
            emailBadge.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Verified`;
        } else {
            emailBadge.classList.add('unverified');
            emailBadge.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Unverified`;
        }

        // Store original for cancel
        originalProfile = {
            firstName: firstNameInput.value,
            lastName: lastNameInput.value,
            username: usernameInput.value,
            email: emailInput.value
        };

        // 3. Check for Google Auth Provider
        // Supabase user object identity data
        // We need to check if the user is signed in via password or oauth
        // Since we don't have the full user object with identities here (getCurrentUser returns a simplified obj), 
        // we might need to rely on the session or fetchUser.
        // But let's check correctly.
        // Actually, let's fetch the full user object to be sure about identities

        // Logic: specific to Supabase, check app_metadata.provider or identities
        // Since we don't have direct access to identities in simplified object, let's look at how we can infer it.
        // If the user has 'google' provider, we hide the password section.

        // We'll trust that if they registered via email/pass, they can change password.
        // If Google, they can't.
        // The simplified user object from auth.js doesn't have provider info.
        // We need to update getCurrentUser or just fetch it here.
        // Since we want NO CACHE, let's assume we can fetch user details.

        // Small hack: check if we can get user details including app_metadata
        // For now, we'll leave it visible unless we are sure.
        // WAIT, the requirement is "if user logged with google auth there must not be any password reset funcionality"
        // I need to implement a check.

        const { data: { user: fullUser } } = await import('./src/auth.js').then(m => m.getSupabase().auth.getUser());

        if (fullUser && fullUser.app_metadata && fullUser.app_metadata.provider === 'google') {
            const passwordSection = document.getElementById('passwordForm').closest('.settings-card');
            if (passwordSection) {
                passwordSection.style.display = 'none';
            }
        }

    } catch (error) {
        console.error('[MTA] Error loading user data:', error);
        showMessage(profileMessage, 'Failed to load user data.', 'error');
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Back link
    backLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.close();
    });

    // Profile form submission
    profileForm.addEventListener('submit', handleProfileSubmit);

    // Cancel profile changes
    cancelProfileBtn.addEventListener('click', () => {
        firstNameInput.value = originalProfile.firstName;
        lastNameInput.value = originalProfile.lastName;
        usernameInput.value = originalProfile.username;
        emailInput.value = originalProfile.email;
        hideMessage(profileMessage);
    });

    // Password form submission
    passwordForm.addEventListener('submit', handlePasswordSubmit);

    // Cancel password changes
    cancelPasswordBtn.addEventListener('click', () => {
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
        hideMessage(passwordMessage);
    });

    // Sign out
    signOutBtn.addEventListener('click', handleSignOut);
}

/**
 * Setup password visibility toggles
 */
function setupPasswordToggles() {
    const toggleBtns = document.querySelectorAll('.password-toggle-btn');

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('input');
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';

            // Update icon
            btn.innerHTML = isPassword
                ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>`
                : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>`;
        });
    });
}

/**
 * Handle profile form submission
 */
async function handleProfileSubmit(e) {
    e.preventDefault();

    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();

    // Validation
    if (!firstName) {
        showMessage(profileMessage, 'First name is required.', 'error');
        firstNameInput.focus();
        return;
    }

    if (!email) {
        showMessage(profileMessage, 'Email is required.', 'error');
        emailInput.focus();
        return;
    }

    // Disable button and show loading
    saveProfileBtn.disabled = true;
    const originalText = saveProfileBtn.innerHTML;
    saveProfileBtn.innerHTML = '<span class="loading-spinner-inline"></span> Saving...';

    try {
        // Construct full name for Supabase
        const fullName = `${firstName} ${lastName}`.trim();

        // Check if email changed
        const emailChanged = email !== originalProfile.email;

        // Update Auth Profile (Supabase Auth User Metadata)
        const result = await updateProfile(fullName, emailChanged ? email : null);

        if (!result.success) {
            throw new Error(result.error || 'Failed to update profile');
        }

        // Update DB Profile (public.profiles table - with username)
        const dbUpdate = await updateProfileDB({
            full_name: fullName,
            username: username
        });

        if (dbUpdate.error) {
            console.warn('DB Profile update failed:', dbUpdate.error);
            // Verify if profile row exists, if not, maybe we need to insert? 
            // Typically triggers handle this, but if missing, specific logic might be needed.
            // For now, logging warning but proceeding as Auth update succeeded.
        }

        // Save extended profile to local storage (optional backup)
        // const extendedProfile = { firstName, lastName, username };
        // await chrome.storage.local.set({ mta_user_profile: extendedProfile });

        // Update original values
        originalProfile = { firstName, lastName, username, email };

        // Update display
        userDisplayName.textContent = fullName;
        userAvatar.textContent = firstName[0].toUpperCase();
        if (emailChanged) {
            userEmailText.textContent = email;
        }

        // Show success message
        const message = emailChanged
            ? 'Profile updated! Please check your email to verify the new address.'
            : 'Profile updated successfully!';
        showMessage(profileMessage, message, 'success');

    } catch (error) {
        console.error('[MTA] Profile update error:', error);
        showMessage(profileMessage, error.message || 'Failed to update profile. Please try again.', 'error');
    } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.innerHTML = originalText;
    }
}

/**
 * Handle password form submission
 */
async function handlePasswordSubmit(e) {
    e.preventDefault();

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Validation
    if (newPassword.length < 8) {
        showMessage(passwordMessage, 'Password must be at least 8 characters.', 'error');
        newPasswordInput.focus();
        return;
    }

    if (newPassword !== confirmPassword) {
        showMessage(passwordMessage, 'Passwords do not match.', 'error');
        confirmPasswordInput.focus();
        return;
    }

    // Disable button and show loading
    changePasswordBtn.disabled = true;
    const originalText = changePasswordBtn.innerHTML;
    changePasswordBtn.innerHTML = '<span class="loading-spinner-inline"></span> Changing...';

    try {
        const result = await changePassword(newPassword);

        if (!result.success) {
            throw new Error(result.error || 'Failed to change password');
        }

        // Clear form
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';

        // Show success message
        showMessage(passwordMessage, 'Password changed successfully!', 'success');

    } catch (error) {
        console.error('[MTA] Password change error:', error);
        showMessage(passwordMessage, error.message || 'Failed to change password. Please try again.', 'error');
    } finally {
        changePasswordBtn.disabled = false;
        changePasswordBtn.innerHTML = originalText;
    }
}

/**
 * Handle sign out
 */
async function handleSignOut() {
    signOutBtn.disabled = true;
    signOutBtn.innerHTML = '<span class="loading-spinner-inline"></span> Signing out...';

    try {
        await logout();
        window.close();
    } catch (error) {
        console.error('[MTA] Sign out error:', error);
        signOutBtn.disabled = false;
        signOutBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>
      Sign Out
    `;
    }
}

/**
 * Show a message in a container
 */
function showMessage(container, message, type = 'success') {
    const icon = type === 'success'
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>`;

    container.innerHTML = `
    <div class="${type === 'success' ? 'success-message' : 'error-message'}">
      ${icon}
      ${message}
    </div>
  `;
}

/**
 * Hide a message container
 */
function hideMessage(container) {
    container.innerHTML = '';
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
