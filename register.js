/**
 * Register Page - UseShield
 * External JavaScript file for CSP compliance (Manifest V3)
 */

import { register, isAuthenticated } from './src/auth.js';

// DOM Elements
const form = document.getElementById('registerForm');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const registerBtn = document.getElementById('registerBtn');
const alertError = document.getElementById('alertError');
const alertErrorText = document.getElementById('alertErrorText');

const nameError = document.getElementById('nameError');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const confirmPasswordError = document.getElementById('confirmPasswordError');
const confirmPasswordSuccess = document.getElementById('confirmPasswordSuccess');
const passwordStrengthFill = document.getElementById('passwordStrengthFill');
const passwordStrengthText = document.getElementById('passwordStrengthText');

// Validation functions
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
    return password.length >= 8;
}

function checkPasswordStrength(password) {
    if (password.length === 0) return null;

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
}

function showError(message) {
    alertErrorText.textContent = message;
    alertError.classList.add('show');
}

function hideError() {
    alertError.classList.remove('show');
}

function validateConfirmPassword() {
    if (confirmPasswordInput.value !== passwordInput.value) {
        confirmPasswordInput.classList.add('error');
        confirmPasswordInput.classList.remove('success');
        confirmPasswordError.classList.add('show');
        confirmPasswordSuccess.classList.remove('show');
        return false;
    } else if (confirmPasswordInput.value.length > 0) {
        confirmPasswordInput.classList.remove('error');
        confirmPasswordInput.classList.add('success');
        confirmPasswordError.classList.remove('show');
        confirmPasswordSuccess.classList.add('show');
        return true;
    }
    return false;
}

// Real-time validation
nameInput.addEventListener('blur', () => {
    if (!nameInput.value.trim()) {
        nameInput.classList.add('error');
        nameError.classList.add('show');
    } else {
        nameInput.classList.remove('error');
        nameError.classList.remove('show');
    }
});

emailInput.addEventListener('blur', () => {
    if (emailInput.value && !validateEmail(emailInput.value)) {
        emailInput.classList.add('error');
        emailError.classList.add('show');
    } else {
        emailInput.classList.remove('error');
        emailError.classList.remove('show');
    }
});

passwordInput.addEventListener('input', () => {
    const strength = checkPasswordStrength(passwordInput.value);

    passwordStrengthFill.className = 'password-strength-fill';
    if (strength) {
        passwordStrengthFill.classList.add(strength);
        passwordStrengthText.textContent = `Strength: ${strength.charAt(0).toUpperCase() + strength.slice(1)}`;
    } else {
        passwordStrengthText.textContent = '';
    }

    if (passwordInput.value && !validatePassword(passwordInput.value)) {
        passwordInput.classList.add('error');
        passwordError.classList.add('show');
    } else {
        passwordInput.classList.remove('error');
        passwordError.classList.remove('show');
    }

    // Re-validate confirm password if it has value
    if (confirmPasswordInput.value) {
        validateConfirmPassword();
    }
});

confirmPasswordInput.addEventListener('input', validateConfirmPassword);
confirmPasswordInput.addEventListener('blur', validateConfirmPassword);

// Form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Validation
    let hasError = false;

    if (!name) {
        nameInput.classList.add('error');
        nameError.classList.add('show');
        hasError = true;
    }

    if (!validateEmail(email)) {
        emailInput.classList.add('error');
        emailError.classList.add('show');
        hasError = true;
    }

    if (!validatePassword(password)) {
        passwordInput.classList.add('error');
        passwordError.classList.add('show');
        hasError = true;
    }

    if (password !== confirmPassword) {
        confirmPasswordInput.classList.add('error');
        confirmPasswordError.classList.add('show');
        hasError = true;
    }

    if (hasError) return;

    // Disable button and show loading
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<span class="loading-spinner"></span> Creating account...';

    try {
        const result = await register(name, email, password);

        if (result.success) {
            // Redirect to popup or onboarding
            window.location.href = 'popup.html';
        } else {
            showError(result.error || 'Registration failed. Please try again.');
        }
    } catch (error) {
        showError('Network error. Please check your connection and try again.');
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Create Account';
    }
});

// Check if already logged in
isAuthenticated().then(authenticated => {
    if (authenticated) {
        window.location.href = 'popup.html';
    }
});
