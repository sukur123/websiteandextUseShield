// rateLimit.js - Rate limit handling with request queue

const RATE_LIMIT_KEY = 'mta_rate_limit';
const REQUEST_QUEUE_KEY = 'mta_request_queue';

// Rate limit configuration
const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 10,
  cooldownMs: 60000, // 1 minute
  maxRetries: 3,
  retryDelayMs: 2000,
  backoffMultiplier: 2
};

/**
 * Check if we're currently rate limited
 */
export async function isRateLimited() {
  const stored = await chrome.storage.local.get([RATE_LIMIT_KEY]);
  const rateLimit = stored[RATE_LIMIT_KEY];
  
  if (!rateLimit) return false;
  
  // Check if cooldown has expired
  if (Date.now() > rateLimit.cooldownUntil) {
    // Clear rate limit
    await chrome.storage.local.remove([RATE_LIMIT_KEY]);
    return false;
  }
  
  return true;
}

/**
 * Get remaining cooldown time in seconds
 */
export async function getRateLimitCooldown() {
  const stored = await chrome.storage.local.get([RATE_LIMIT_KEY]);
  const rateLimit = stored[RATE_LIMIT_KEY];
  
  if (!rateLimit || Date.now() > rateLimit.cooldownUntil) {
    return 0;
  }
  
  return Math.ceil((rateLimit.cooldownUntil - Date.now()) / 1000);
}

/**
 * Set rate limit after receiving 429 error
 */
export async function setRateLimited(retryAfterMs = null) {
  const cooldownMs = retryAfterMs || RATE_LIMIT_CONFIG.cooldownMs;
  
  await chrome.storage.local.set({
    [RATE_LIMIT_KEY]: {
      cooldownUntil: Date.now() + cooldownMs,
      hitAt: Date.now()
    }
  });
}

/**
 * Track API request for rate limiting
 */
export async function trackRequest() {
  const stored = await chrome.storage.local.get(['mta_request_history']);
  const history = stored.mta_request_history || [];
  
  // Add current request
  history.push(Date.now());
  
  // Remove requests older than 1 minute
  const oneMinuteAgo = Date.now() - 60000;
  const recentHistory = history.filter(t => t > oneMinuteAgo);
  
  await chrome.storage.local.set({ mta_request_history: recentHistory });
  
  // Check if we're approaching rate limit
  if (recentHistory.length >= RATE_LIMIT_CONFIG.maxRequestsPerMinute) {
    await setRateLimited();
    return false;
  }
  
  return true;
}

/**
 * Request queue for managing concurrent requests
 */
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }
  
  /**
   * Add request to queue
   */
  async add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        request,
        resolve,
        reject,
        retries: 0,
        addedAt: Date.now()
      });
      
      this.process();
    });
  }
  
  /**
   * Process queue
   */
  async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      // Check rate limit
      if (await isRateLimited()) {
        const cooldown = await getRateLimitCooldown();
        console.log(`Rate limited. Waiting ${cooldown}s...`);
        await this.sleep(cooldown * 1000);
        continue;
      }
      
      const item = this.queue.shift();
      
      try {
        // Track this request
        await trackRequest();
        
        // Execute the request
        const result = await item.request();
        item.resolve(result);
        
        // Small delay between requests to avoid bursting
        await this.sleep(200);
        
      } catch (error) {
        // Handle 429 specifically
        if (error.message && (error.message.includes('429') || error.message.includes('rate limit'))) {
          // Parse retry-after header if available
          const retryAfter = this.parseRetryAfter(error);
          await setRateLimited(retryAfter);
          
          // Re-queue the request if under retry limit
          if (item.retries < RATE_LIMIT_CONFIG.maxRetries) {
            item.retries++;
            const delay = RATE_LIMIT_CONFIG.retryDelayMs * Math.pow(RATE_LIMIT_CONFIG.backoffMultiplier, item.retries - 1);
            console.log(`Request failed (429). Retry ${item.retries}/${RATE_LIMIT_CONFIG.maxRetries} in ${delay}ms`);
            
            await this.sleep(delay);
            this.queue.unshift(item); // Add back to front of queue
          } else {
            item.reject(new Error('Rate limit exceeded. Please try again later.'));
          }
        } else {
          item.reject(error);
        }
      }
    }
    
    this.processing = false;
  }
  
  parseRetryAfter(error) {
    // Try to extract retry-after from error
    if (error.retryAfter) {
      return error.retryAfter * 1000;
    }
    return null;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing
    };
  }
  
  /**
   * Clear queue
   */
  clear() {
    const items = this.queue.splice(0);
    items.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
  }
}

// Singleton instance
export const requestQueue = new RequestQueue();

/**
 * Wrap an async function with rate limit handling
 */
export function withRateLimit(fn) {
  return async function(...args) {
    return requestQueue.add(() => fn(...args));
  };
}

/**
 * Get rate limit status for display
 */
export async function getRateLimitStatus() {
  const [limited, cooldown] = await Promise.all([
    isRateLimited(),
    getRateLimitCooldown()
  ]);
  
  const stored = await chrome.storage.local.get(['mta_request_history']);
  const history = stored.mta_request_history || [];
  const oneMinuteAgo = Date.now() - 60000;
  const recentRequests = history.filter(t => t > oneMinuteAgo).length;
  
  return {
    isLimited: limited,
    cooldownSeconds: cooldown,
    recentRequests,
    maxRequests: RATE_LIMIT_CONFIG.maxRequestsPerMinute,
    queueStatus: requestQueue.getStatus()
  };
}

/**
 * Show rate limit notification to user
 */
export async function showRateLimitNotification() {
  const cooldown = await getRateLimitCooldown();
  
  chrome.notifications.create('rate-limit', {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Rate Limit Reached',
    message: `Too many requests. Please wait ${cooldown} seconds before trying again.`,
    priority: 1
  });
}
