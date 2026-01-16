const CACHE_KEY = 'mta_analysis_cache';
const OFFLINE_CACHE_KEY = 'mta_offline_cache';
const CACHE_MAX_SIZE = 50;
const OFFLINE_MAX_SIZE = 100; // Keep more for offline
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const OFFLINE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days for offline

/**
 * Simple hash function for text content
 * @param {string} text
 * @returns {string} hash
 */
export function hashText(text) {
  let hash = 0;
  const str = text.slice(0, 10000); // Only hash first 10k chars for speed
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Get cached analysis result
 * @param {string} hash - Content hash
 * @returns {Promise<Object|null>}
 */
export async function getCached(hash) {
  const stored = await chrome.storage.local.get([CACHE_KEY]);
  const cache = stored[CACHE_KEY] || {};
  
  const entry = cache[hash];
  if (!entry) return null;
  
  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    // Expired
    delete cache[hash];
    await chrome.storage.local.set({ [CACHE_KEY]: cache });
    return null;
  }
  
  return entry.data;
}

/**
 * Store analysis result in cache
 * @param {string} hash - Content hash
 * @param {Object} data - Analysis result
 */
export async function setCache(hash, data) {
  const stored = await chrome.storage.local.get([CACHE_KEY]);
  let cache = stored[CACHE_KEY] || {};
  
  // Prune old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= CACHE_MAX_SIZE) {
    // Remove oldest entries
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - CACHE_MAX_SIZE + 1);
    for (const [key] of toRemove) {
      delete cache[key];
    }
  }
  
  cache[hash] = {
    timestamp: Date.now(),
    data
  };
  
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

/**
 * Clear entire cache
 */
export async function clearCache() {
  await chrome.storage.local.remove([CACHE_KEY]);
}

/**
 * Get cache stats
 * @returns {Promise<{ size: number, oldest: number|null }>}
 */
export async function getCacheStats() {
  const stored = await chrome.storage.local.get([CACHE_KEY]);
  const cache = stored[CACHE_KEY] || {};
  const entries = Object.values(cache);
  
  return {
    size: entries.length,
    oldest: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null
  };
}

// ===== OFFLINE MODE =====

/**
 * Check if browser is offline
 */
export function isOffline() {
  return !navigator.onLine;
}

/**
 * Save result to offline cache (longer TTL, larger storage)
 */
export async function saveForOffline(url, data) {
  const stored = await chrome.storage.local.get([OFFLINE_CACHE_KEY]);
  let cache = stored[OFFLINE_CACHE_KEY] || {};
  
  // Use URL as key for offline cache
  const key = hashText(url);
  
  // Prune old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= OFFLINE_MAX_SIZE) {
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - OFFLINE_MAX_SIZE + 1);
    for (const [k] of toRemove) {
      delete cache[k];
    }
  }
  
  cache[key] = {
    timestamp: Date.now(),
    url: url,
    data: data,
    savedAt: new Date().toISOString()
  };
  
  await chrome.storage.local.set({ [OFFLINE_CACHE_KEY]: cache });
}

/**
 * Get result from offline cache
 */
export async function getOfflineResult(url) {
  const stored = await chrome.storage.local.get([OFFLINE_CACHE_KEY]);
  const cache = stored[OFFLINE_CACHE_KEY] || {};
  const key = hashText(url);
  
  const entry = cache[key];
  if (!entry) return null;
  
  // Check TTL (30 days for offline)
  if (Date.now() - entry.timestamp > OFFLINE_TTL_MS) {
    delete cache[key];
    await chrome.storage.local.set({ [OFFLINE_CACHE_KEY]: cache });
    return null;
  }
  
  return {
    ...entry.data,
    fromOffline: true,
    cachedAt: entry.savedAt
  };
}

/**
 * Get all offline cached analyses
 */
export async function getAllOfflineResults() {
  const stored = await chrome.storage.local.get([OFFLINE_CACHE_KEY]);
  const cache = stored[OFFLINE_CACHE_KEY] || {};
  
  const results = [];
  const now = Date.now();
  
  for (const [key, entry] of Object.entries(cache)) {
    // Skip expired
    if (now - entry.timestamp > OFFLINE_TTL_MS) continue;
    
    results.push({
      key,
      url: entry.url,
      data: entry.data,
      savedAt: entry.savedAt,
      timestamp: entry.timestamp
    });
  }
  
  // Sort by most recent
  results.sort((a, b) => b.timestamp - a.timestamp);
  
  return results;
}

/**
 * Remove item from offline cache
 */
export async function removeOfflineResult(url) {
  const stored = await chrome.storage.local.get([OFFLINE_CACHE_KEY]);
  const cache = stored[OFFLINE_CACHE_KEY] || {};
  const key = hashText(url);
  
  if (cache[key]) {
    delete cache[key];
    await chrome.storage.local.set({ [OFFLINE_CACHE_KEY]: cache });
    return true;
  }
  return false;
}

/**
 * Get offline cache stats
 */
export async function getOfflineStats() {
  const stored = await chrome.storage.local.get([OFFLINE_CACHE_KEY]);
  const cache = stored[OFFLINE_CACHE_KEY] || {};
  const entries = Object.values(cache);
  
  // Calculate approximate size in KB
  const sizeBytes = JSON.stringify(cache).length;
  const sizeKB = Math.round(sizeBytes / 1024);
  
  return {
    count: entries.length,
    maxCount: OFFLINE_MAX_SIZE,
    sizeKB: sizeKB,
    oldest: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null,
    newest: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : null
  };
}

/**
 * Clear offline cache
 */
export async function clearOfflineCache() {
  await chrome.storage.local.remove([OFFLINE_CACHE_KEY]);
}
