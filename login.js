/**
 * UseShield Login Page - External JavaScript
 * For CSP compliance with Manifest V3
 */

import { login, isAuthenticated } from './src/auth.js';

const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const alertError = document.getElementById('alertError');
const alertErrorText = document.getElementById('alertErrorText');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');

// Form validation
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
    return password.length >= 8;
}

function showError(message) {
    alertErrorText.textContent = message;
    alertError.classList.add('show');
}

function hideError() {
    alertError.classList.remove('show');
}

emailInput.addEventListener('blur', () => {
    if (emailInput.value && !validateEmail(emailInput.value)) {
        emailInput.classList.add('error');
        emailError.classList.add('show');
    } else {
        emailInput.classList.remove('error');
        emailError.classList.remove('show');
    }
});

passwordInput.addEventListener('blur', () => {
    if (passwordInput.value && !validatePassword(passwordInput.value)) {
        passwordInput.classList.add('error');
        passwordError.classList.add('show');
    } else {
        passwordInput.classList.remove('error');
        passwordError.classList.remove('show');
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validation
    if (!validateEmail(email)) {
        emailInput.classList.add('error');
        emailError.classList.add('show');
        return;
    }

    if (!validatePassword(password)) {
        passwordInput.classList.add('error');
        passwordError.classList.add('show');
        return;
    }

    // Disable button and show loading
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="loading-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;"></span> Signing in...';

    try {
        const result = await login(email, password);

        if (result.success) {
            // Redirect to popup or subscription page
            window.location.href = 'popup.html';
        } else {
            showError(result.error || 'Login failed. Please try again.');
        }
    } catch (error) {
        showError('Network error. Please check your connection and try again.');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
    }
});

// Check if already logged in
isAuthenticated().then(authenticated => {
    if (authenticated) {
        window.location.href = 'popup.html';
    }
});
