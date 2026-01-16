/**
 * UseShield Theme Manager
 * Handles dark/light mode toggle with persistent storage
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'mta_theme';
    const THEME_DARK = 'dark';
    const THEME_LIGHT = 'light';
    const THEME_SYSTEM = 'system';

    /**
     * Get the current system preference
     */
    function getSystemPreference() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_DARK : THEME_LIGHT;
    }

    /**
     * Apply theme to document
     */
    function applyTheme(theme) {
        const effectiveTheme = theme === THEME_SYSTEM ? getSystemPreference() : theme;
        document.documentElement.setAttribute('data-theme', effectiveTheme);

        // Update meta theme-color for mobile browsers
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = effectiveTheme === THEME_DARK ? '#0F172A' : '#1e3a5f';
        }

        // Dispatch event for any listeners
        window.dispatchEvent(new CustomEvent('themechange', {
            detail: { theme: effectiveTheme, setting: theme }
        }));
    }

    /**
     * Get stored theme preference
     */
    async function getStoredTheme() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([STORAGE_KEY], (result) => {
                    resolve(result[STORAGE_KEY] || THEME_SYSTEM);
                });
            } else {
                // Fallback to localStorage for non-extension pages
                resolve(localStorage.getItem(STORAGE_KEY) || THEME_SYSTEM);
            }
        });
    }

    /**
     * Save theme preference
     */
    async function saveTheme(theme) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({ [STORAGE_KEY]: theme });
        } else {
            localStorage.setItem(STORAGE_KEY, theme);
        }
    }

    /**
     * Toggle between light and dark
     */
    async function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === THEME_DARK ? THEME_LIGHT : THEME_DARK;
        await saveTheme(newTheme);
        applyTheme(newTheme);
        return newTheme;
    }

    /**
     * Set specific theme
     */
    async function setTheme(theme) {
        if (![THEME_DARK, THEME_LIGHT, THEME_SYSTEM].includes(theme)) {
            console.warn('[Theme] Invalid theme:', theme);
            return;
        }
        await saveTheme(theme);
        applyTheme(theme);
    }

    /**
     * Initialize theme on page load
     */
    async function initTheme() {
        // Apply immediately to prevent flash
        const storedTheme = await getStoredTheme();
        applyTheme(storedTheme);

        // Listen for system preference changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', async () => {
            const currentSetting = await getStoredTheme();
            if (currentSetting === THEME_SYSTEM) {
                applyTheme(THEME_SYSTEM);
            }
        });

        // Listen for storage changes from other tabs/pages
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local' && changes[STORAGE_KEY]) {
                    applyTheme(changes[STORAGE_KEY].newValue);
                }
            });
        }

        console.log('[Theme] Initialized:', storedTheme);
    }

    /**
     * Create and inject theme toggle button
     */
    function createThemeToggle(container) {
        if (!container) return;

        const button = document.createElement('button');
        button.className = 'theme-toggle-btn';
        button.setAttribute('aria-label', 'Toggle dark mode');
        button.innerHTML = `
      <svg class="theme-icon theme-icon-light" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
      <svg class="theme-icon theme-icon-dark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    `;

        button.addEventListener('click', toggleTheme);
        container.appendChild(button);

        return button;
    }

    // Initialize immediately
    initTheme();

    // Expose API globally
    window.UseShieldTheme = {
        toggle: toggleTheme,
        set: setTheme,
        get: getStoredTheme,
        init: initTheme,
        createToggle: createThemeToggle,
        DARK: THEME_DARK,
        LIGHT: THEME_LIGHT,
        SYSTEM: THEME_SYSTEM
    };
})();
