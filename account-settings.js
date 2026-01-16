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
        const user = await getCurrentUser();

        if (!user) {
            // Not logged in, redirect to popup
            window.close();
            return;
        }

        // Parse name into first/last name
        const nameParts = (user.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Get additional metadata if available
        const { mta_user_profile } = await chrome.storage.local.get(['mta_user_profile']);
        const profile = mta_user_profile || {};

        // Populate form fields
        firstNameInput.value = profile.firstName || firstName;
        lastNameInput.value = profile.lastName || lastName;
        usernameInput.value = profile.username || user.email.split('@')[0];
        emailInput.value = user.email;

        // Update header display
        const displayFirstName = profile.firstName || firstName;
        const displayLastName = profile.lastName || lastName;
        const displayName = displayFirstName
            ? `${displayFirstName} ${displayLastName}`.trim()
            : user.name || user.email.split('@')[0];

        userDisplayName.textContent = displayName;
        userEmailText.textContent = user.email;

        // Avatar initial
        userAvatar.textContent = (displayFirstName || user.email)[0].toUpperCase();

        // Email verification badge
        if (user.emailVerified) {
            emailBadge.classList.remove('unverified');
            emailBadge.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Verified
      `;
        } else {
            emailBadge.classList.add('unverified');
            emailBadge.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        Unverified
      `;
        }

        // Store original values
        originalProfile = {
            firstName: firstNameInput.value,
            lastName: lastNameInput.value,
            username: usernameInput.value,
            email: emailInput.value
        };

    } catch (error) {
        console.error('[MTA] Error loading user data:', error);
        showMessage(profileMessage, 'Failed to load user data. Please try again.', 'error');
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

        // Update profile
        const result = await updateProfile(fullName, emailChanged ? email : null);

        if (!result.success) {
            throw new Error(result.error || 'Failed to update profile');
        }

        // Save extended profile to local storage
        const extendedProfile = { firstName, lastName, username };
        await chrome.storage.local.set({ mta_user_profile: extendedProfile });

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
