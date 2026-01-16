import { Category, Severity, getRiskLevel } from './types.js';
import { calculateRiskScore, getStats, generatePlainLanguageSummary, sortFindingsBySeverity } from './riskScore.js';
import { hashText, getCached, setCache, saveForOffline, getOfflineResult, isOffline, getAllOfflineResults, getOfflineStats } from './cache.js';
import { checkUsageLimit, incrementUsage, getUsageDisplayInfo } from './usage.js';
import { buildAnalysisPrompt, validateAnalysisResponse } from './prompts.js';
import { getAlternatives, trackAffiliateClick } from './alternatives.js';
import { isRateLimited, getRateLimitCooldown, setRateLimited, trackRequest, getRateLimitStatus } from './rateLimit.js';
import { signInWithGoogle } from './auth.js';

// ============================================
// ANALYSIS STATE PERSISTENCE
// ============================================

// Map to track active analysis by URL
// { url: { status: 'analyzing'|'complete'|'error', startTime: number, result: object, error: string } }
const activeAnalyses = new Map();

/**
 * Handle new async analysis request
 */
async function handleStartAnalysisAsync(msg, sendResponse) {
  const { payload } = msg;
  const url = payload.url;

  if (!url) {
    sendResponse({ ok: false, error: 'No URL provided' });
    return;
  }

  // Set initial state
  activeAnalyses.set(url, {
    status: 'analyzing',
    startTime: Date.now(),
    result: null,
    error: null
  });

  // Respond immediately that we started
  sendResponse({ ok: true, status: 'started' });

  // Start the actual analysis
  handleAnalyze({ payload }, (response) => {
    // This callback runs when analysis finishes
    if (response.ok) {
      activeAnalyses.set(url, {
        status: 'complete',
        result: response.data,
        completedAt: Date.now()
      });
    } else {
      activeAnalyses.set(url, {
        status: 'error',
        error: response.error || 'Analysis failed',
        completedAt: Date.now()
      });
    }

    // Auto-clear from memory after 30 minutes to prevent leaks
    setTimeout(() => {
      if (activeAnalyses.has(url)) {
        activeAnalyses.delete(url);
      }
    }, 30 * 60 * 1000);
  });
}

/**
 * Get status of an ongoing or recently completed analysis
 */
function handleGetAnalysisStatus(msg, sendResponse) {
  const { url } = msg.payload;
  if (!url || !activeAnalyses.has(url)) {
    sendResponse({ status: 'none' });
    return;
  }

  sendResponse(activeAnalyses.get(url));
}


// ============================================
// SERVICE WORKER KEEP-ALIVE (PERSISTENCE)
// ============================================

/**
 * Keep the service worker alive by setting up periodic alarms
 * This prevents the service worker from being terminated during long operations
 */
const KEEP_ALIVE_ALARM = 'mta-keep-alive';
const KEEP_ALIVE_INTERVAL = 25; // seconds (service workers timeout at 30s)

// ... (rest of file)


// Main message handler update
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'MTA_ANALYZE_TEXT') {
    handleAnalyze(msg, sendResponse);
    return true;
  }

  // NEW: Async analysis start
  if (msg?.type === 'MTA_START_ANALYSIS_ASYNC') {
    handleStartAnalysisAsync(msg, sendResponse);
    return true;
  }

  // NEW: Check status
  if (msg?.type === 'MTA_GET_ANALYSIS_STATUS') {
    handleGetAnalysisStatus(msg, sendResponse);
    return true;
  }

  // NEW: Google Login (Background)
  if (msg?.type === 'MTA_GOOGLE_LOGIN') {
    signInWithGoogle()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (msg?.type === 'MTA_CHECK_USAGE') {
    getUsageDisplayInfo().then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  // ... (rest of messages)
});

// Track if we have an active operation
let activeOperations = 0;

function startKeepAlive() {
  activeOperations++;
  if (activeOperations === 1) {
    // Start keep-alive alarm
    chrome.alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: KEEP_ALIVE_INTERVAL / 60 });
  }
}

function stopKeepAlive() {
  activeOperations = Math.max(0, activeOperations - 1);
  if (activeOperations === 0) {
    // Stop keep-alive alarm when no active operations
    chrome.alarms.clear(KEEP_ALIVE_ALARM);
  }
}

// Listen for keep-alive alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    // Just logging keeps the worker alive
    console.log('[MTA] Keep-alive ping at', new Date().toISOString());
  }
});

// Also use ports for longer operations
function createLongLivedPort() {
  try {
    const port = chrome.runtime.connect({ name: 'mta-keepalive' });
    port.onDisconnect.addListener(() => {
      // Reconnect if needed
      if (activeOperations > 0) {
        setTimeout(createLongLivedPort, 1000);
      }
    });
    return port;
  } catch (e) {
    // Ignore connection errors
    return null;
  }
}

// ============================================
// ONBOARDING CHECK ON INSTALL
// ============================================
chrome.runtime.onInstalled.addListener(async (details) => {
  // Show onboarding for new installs
  if (details.reason === 'install') {
    const stored = await chrome.storage.local.get(['mta_onboarding_completed']);
    if (!stored.mta_onboarding_completed) {
      // Open onboarding page
      chrome.tabs.create({ url: 'onboarding.html' });
    }
  }

  // Create context menu items
  chrome.contextMenus.create({
    id: 'analyzeThisPage',
    title: '🛡️ Analyze this page for money traps',
    contexts: ['page', 'link']
  });

  chrome.contextMenus.create({
    id: 'analyzeSelection',
    title: '🛡️ Analyze selected text',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'analyzeThisPage') {
    // Open popup or analyze directly
    const url = info.linkUrl || tab.url;
    await handleContextMenuAnalysis(tab.id, url);
  } else if (info.menuItemId === 'analyzeSelection') {
    // Analyze selected text directly
    await handleSelectionAnalysis(tab.id, info.selectionText);
  }
});

/**
 * Handle context menu analysis request
 */
async function handleContextMenuAnalysis(tabId, url) {
  try {
    // Show notification that analysis is starting
    await chrome.action.setBadgeText({ text: '...' });
    await chrome.action.setBadgeBackgroundColor({ color: '#1e3a5f' });

    // Extract page text
    const [{ result: pageText }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body.innerText
    });

    if (!pageText || pageText.length < 100) {
      await chrome.action.setBadgeText({ text: '!' });
      await chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
      return;
    }

    // Trigger analysis via message (reuse existing flow)
    const result = await analyzeTextDirectly({ url, text: pageText, title: '' });

    if (result && result.ok) {
      // Show risk score on badge
      const score = result.data.riskScore;
      const color = score >= 70 ? '#e74c3c' : score >= 40 ? '#f39c12' : '#27ae60';
      await chrome.action.setBadgeText({ text: String(score) });
      await chrome.action.setBadgeBackgroundColor({ color });
    } else {
      await chrome.action.setBadgeText({ text: '!' });
      await chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
    }

    // Clear badge after 10 seconds
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 10000);
  } catch (e) {
    console.error('Context menu analysis failed:', e);
    await chrome.action.setBadgeText({ text: '!' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
  }
}

/**
 * Analyze selected text directly
 */
async function handleSelectionAnalysis(tabId, selectionText) {
  if (!selectionText || selectionText.length < 50) {
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#f39c12' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
    return;
  }

  try {
    await chrome.action.setBadgeText({ text: '...' });
    await chrome.action.setBadgeBackgroundColor({ color: '#1e3a5f' });

    const tab = await chrome.tabs.get(tabId);
    const result = await analyzeTextDirectly({
      url: tab.url,
      text: selectionText,
      title: 'Selected Text Analysis'
    });

    if (result && result.ok) {
      const score = result.data.riskScore;
      const color = score >= 70 ? '#e74c3c' : score >= 40 ? '#f39c12' : '#27ae60';
      await chrome.action.setBadgeText({ text: String(score) });
      await chrome.action.setBadgeBackgroundColor({ color });
    }

    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 10000);
  } catch (e) {
    console.error('Selection analysis failed:', e);
    await chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * Direct analysis function for context menu (bypasses message passing)
 */
async function analyzeTextDirectly(payload) {
  return new Promise((resolve) => {
    handleAnalyze({ payload }, resolve);
  });
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'analyze-page') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id && /^https?:\/\//.test(tab.url)) {
      await handleContextMenuAnalysis(tab.id, tab.url);
    }
  }
});

// ============================================
// ALARMS & WATCHLIST
// ============================================

// Set up daily alarm for watchlist checks
chrome.alarms.create('watchlistCheck', { periodInMinutes: 1440 }); // Once per day

// Listen for alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'watchlistCheck') {
    await checkWatchlistForChanges();
  }
});

/**
 * Check all watchlist items for ToS changes
 */
async function checkWatchlistForChanges() {
  const { mta_watchlist, mta_watchlistAlerts } = await chrome.storage.local.get(['mta_watchlist', 'mta_watchlistAlerts']);

  if (!mta_watchlist || mta_watchlist.length === 0) return;
  if (mta_watchlistAlerts === false) return; // User disabled alerts

  for (const item of mta_watchlist) {
    try {
      const response = await fetch(item.url);
      const html = await response.text();
      const newHash = hashText(html);

      if (item.contentHash && item.contentHash !== newHash) {
        // Content has changed!
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: 'ToS Changed!',
          message: `${item.domain}'s Terms of Service has been updated. Click to analyze.`
        }).catch(() => {
          // Fallback if icon not found
          chrome.notifications.create({
            type: 'basic',
            title: 'ToS Changed!',
            message: `${item.domain}'s Terms of Service has been updated. Click to analyze.`
          });
        });

        // Update the item
        item.hasChanges = true;
        item.lastChecked = Date.now();
        item.contentHash = newHash;
      } else {
        item.lastChecked = Date.now();
        item.contentHash = newHash;
        item.hasChanges = false;
      }
    } catch (e) {
      console.error(`Failed to check ${item.url}:`, e);
    }
  }

  await chrome.storage.local.set({ mta_watchlist });
}

function clampText(text, maxChars) {
  if (!text) return '';
  if (!maxChars || maxChars <= 0) return text;
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}

function safeJsonParse(s) {
  // Try to extract JSON from markdown code blocks if present
  let cleaned = s.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch {
    return { ok: false };
  }
}

function extractOutputTextFromResponsesApi(json) {
  if (typeof json?.output_text === 'string' && json.output_text.trim()) {
    return json.output_text.trim();
  }

  const output = json?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'output_text' && typeof c?.text === 'string') {
            return c.text.trim();
          }
        }
      }
    }
  }

  return '';
}

/**
 * Sleep helper for retries
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call Supabase Edge Function to analyze ToS (API key is secure server-side)
 */
async function callAnalysisEdgeFunction({ url, text, title, maxChars = 20000, analysisMode = 'standard', customPrompt = '' }) {
  const SUPABASE_URL = 'https://fmptjjpwndojeywyacum.supabase.co';
  const edgeUrl = `${SUPABASE_URL}/functions/v1/analyze-tos`;

  console.log('[Background] Analysis parameters:', {
    url,
    textLength: text?.length || 0,
    maxChars,
    analysisMode,
    hasCustomPrompt: !!customPrompt
  });

  /**
   * Refresh user session using refresh token
   */
  async function refreshUserSession(refreshToken) {
    const SUPABASE_URL = 'https://fmptjjpwndojeywyacum.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcHRqanB3bmRvamV5d3lhY3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDIyNDUsImV4cCI6MjA4MzI3ODI0NX0.g8oiu_U5smCC8o8EKG4VYrvz-NTaYsB4hXmcdO_TTxo';

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!response.ok) {
        // If 400/401, the refresh token is invalid/expired
        if (response.status >= 400 && response.status < 500) {
          console.error('[Background] Refresh token invalid/expired.');
          // Clear session to force re-login
          await chrome.storage.local.remove(['supabase_session']);
          return null;
        }
        throw new Error(`Refresh failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.access_token) {
        // Update stored session
        const newSession = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
          expires_at: data.expires_at,
          user: data.user // Might contain updated user info
        };

        await chrome.storage.local.set({ supabase_session: newSession });
        return newSession;
      }
      return null;

    } catch (e) {
      console.error('[Background] Refresh error:', e);
      return null;
    }
  }

  // Get user session token (stored as supabase_session by auth.js)
  const { supabase_session } = await chrome.storage.local.get(['supabase_session']);

  console.log('[Background] Session check:', {
    hasSession: !!supabase_session,
    hasAccessToken: !!(supabase_session?.access_token),
    tokenPreview: supabase_session?.access_token?.substring(0, 20) + '...',
    sessionKeys: supabase_session ? Object.keys(supabase_session) : [],
    fullSession: supabase_session // Show full session for debugging
  });

  // Parse the JWT header to see time and refresh if needed
  let accessToken = supabase_session?.access_token;
  let refreshToken = supabase_session?.refresh_token;
  let isExpired = false;

  if (accessToken) {
    try {
      const parts = accessToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        // Check if expired or expiring in less than 5 minutes
        const expTime = payload.exp * 1000;
        isExpired = expTime < (Date.now() + 5 * 60 * 1000);

        console.log('[Background] JWT Status:', {
          expiresAt: new Date(expTime).toISOString(),
          isExpired,
          timeLeft: Math.round((expTime - Date.now()) / 1000) + 's'
        });
      }
    } catch (e) {
      console.error('[Background] Failed to parse JWT:', e);
      isExpired = true; // Assume expired if invalid
    }
  }

  // Attempt refresh if expired
  if (isExpired && refreshToken) {
    console.log('[Background] Token expired, attempting refresh...');
    try {
      const newSession = await refreshUserSession(refreshToken);
      if (newSession && newSession.access_token) {
        console.log('[Background] Token refresh successful');
        accessToken = newSession.access_token;
        // Update local vars for the request below
        supabase_session.access_token = accessToken;
      } else {
        throw new Error('Refresh failed (null session)');
      }
    } catch (e) {
      console.error('[Background] Token refresh failed:', e);
      // STOP HERE. Do not proceed with an expired token.
      throw new Error('Not authenticated. Session expired. Please log in again.');
    }
  } else if (isExpired) {
    // Expired and no refresh token
    throw new Error('Not authenticated. Session expired. Please log in again.');
  }

  if (!accessToken) {
    throw new Error('Not authenticated. Please log in.');
  }

  try {
    console.log('[Background] Calling Edge Function:', edgeUrl);

    const resp = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcHRqanB3bmRvamV5d3lhY3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDIyNDUsImV4cCI6MjA4MzI3ODI0NX0.g8oiu_U5smCC8o8EKG4VYrvz-NTaYsB4hXmcdO_TTxo'
      },
      body: JSON.stringify({
        url,
        text,
        title,
        maxChars,
        analysisMode,
        customPrompt
      })
    });

    console.log('[Background] Edge Function response status:', resp.status);

    let json;
    try {
      json = await resp.json();
      console.log('[Background] Edge Function response:', json);
    } catch (parseError) {
      const textResponse = await resp.text();
      console.error('[Background] Failed to parse JSON. Raw response:', textResponse);
      throw new Error(`Server returned invalid response: ${textResponse.substring(0, 100)}`);
    }

    if (resp.status === 429) {
      // Usage limit reached
      throw new Error(json.message || 'Usage limit reached. Please upgrade your plan.');
    }

    if (!resp.ok) {
      const errorMsg = json.error || json.message || `Analysis failed (${resp.status})`;
      console.error('[Background] Edge Function error:', errorMsg, JSON.stringify(json));
      throw new Error(errorMsg);
    }

    if (!json.success || !json.data) {
      throw new Error('Invalid response from analysis service');
    }

    return json.data;
  } catch (e) {
    console.error('[Background] Edge function call failed:', e);
    throw e;
  }
}

/**
 * Validate and normalize findings (backup validation)
 * Maps Edge Function fields to popup expected fields:
 * - clause -> quote (and generates title from it)
 * - explanation -> summary
 */
function validateFindings(findings) {
  if (!Array.isArray(findings)) return [];

  const validCategories = new Set(Object.values(Category));
  const validSeverities = new Set(Object.values(Severity));

  return findings
    .filter(f => f && typeof f === 'object')
    .map((f, i) => {
      // Edge Function returns "clause" and "explanation"
      // Popup expects "title", "summary", "quote"
      const clause = f.clause || f.quote || '';
      const explanation = f.explanation || f.summary || f.description || '';

      // Generate title from category if not provided
      const categoryTitle = f.category ? f.category.replace(/_/g, ' ').toLowerCase() : 'issue';
      const title = f.title || `${f.severity || 'Medium'} ${categoryTitle} concern`;

      return {
        id: f.id || `finding-${i + 1}`,
        category: validCategories.has(f.category) ? f.category : Category.OTHER,
        severity: (validSeverities.has(f.severity?.toUpperCase?.()) ? f.severity.toUpperCase() :
          validSeverities.has(f.severity) ? f.severity : Severity.MEDIUM),
        title: title,
        summary: explanation,
        quote: clause,
        recommendation: f.recommendation || '',
        location: f.location || null
      };
    });
}

/**
 * Main message handler
 */


/**
 * Handle getting alternative service recommendations
 */
async function handleGetAlternatives(msg, sendResponse) {
  try {
    const { domain, riskScore } = msg.payload || {};
    if (!domain) {
      sendResponse({ ok: false, error: 'No domain provided' });
      return;
    }

    // Build a URL for the domain and get alternatives
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    const alternatives = getAlternatives(url, riskScore || 70); // Default to high risk score to show alternatives

    if (!alternatives) {
      sendResponse({ ok: true, alternatives: [] });
      return;
    }

    sendResponse({
      ok: true,
      category: alternatives.category,
      reason: alternatives.reason,
      alternatives: alternatives.alternatives
    });
  } catch (e) {
    sendResponse({ ok: false, error: e.message });
  }
}

/**
 * Handle affiliate click tracking
 */
async function handleTrackAffiliate(msg, sendResponse) {
  try {
    const { alternativeId, sourceDomain } = msg.payload || {};
    await trackAffiliateClick(sourceDomain, alternativeId);
    sendResponse({ ok: true });
  } catch (e) {
    sendResponse({ ok: false, error: e.message });
  }
}

async function handleAnalyze(msg, sendResponse) {
  // Start keep-alive for this long operation
  startKeepAlive();

  try {
    // Check usage limits first
    const usageCheck = await checkUsageLimit();
    if (!usageCheck.allowed) {
      const periodLabel = usageCheck.period === 'week' ? 'weekly' : 'monthly';
      stopKeepAlive();
      sendResponse({
        ok: false,
        error: `You've used all ${usageCheck.limit} ${periodLabel} scans. Upgrade for more!`,
        usageLimited: true,
        tier: usageCheck.tier,
        tierName: usageCheck.tierName,
        limit: usageCheck.limit,
        used: usageCheck.used,
        period: usageCheck.period,
        resetDate: usageCheck.resetDate,
        remaining: usageCheck.remaining
      });
      return;
    }

    const {
      maxChars,
      mta_redactPII,
      mta_cacheResults,
      mta_analysisMode,
      mta_customPrompt
    } = await chrome.storage.local.get([
      'maxChars',
      'mta_redactPII',
      'mta_cacheResults',
      'mta_analysisMode',
      'mta_customPrompt'
    ]);

    // API key is now managed securely on Supabase Edge Function
    // No need to check for API key here - authentication is handled by session token
    const payload = msg.payload || {};
    const shouldCache = mta_cacheResults !== false && !payload.skipCache; // Default true, but skip if requested

    let text = clampText(String(payload.text || ''), Number(maxChars || 20000));
    if (!text.trim()) {
      stopKeepAlive();
      sendResponse({ ok: false, error: 'No text found on this page.' });
      return;
    }

    // Check cache if enabled and not skipped
    const contentHash = hashText(text);
    if (shouldCache && !payload.skipCache) {
      const cached = await getCached(contentHash);
      if (cached) {
        sendResponse({ ok: true, data: cached, fromCache: true });
        return;
      }
    }

    // Call Supabase Edge Function (handles authentication, usage limits, and OpenAI call)
    const analysisData = await callAnalysisEdgeFunction({
      url: String(payload.url || ''),
      text,
      title: String(payload.title || ''),
      maxChars: Number(maxChars || 20000),
      analysisMode: String(mta_analysisMode || payload.analysisMode || 'standard'),
      customPrompt: String(mta_customPrompt || '')
    });

    // Edge Function returns validated data with usage info
    // Validate and normalize findings to map Edge Function fields to popup expected fields
    const validatedFindings = validateFindings(analysisData.findings || []);
    const sortedFindings = sortFindingsBySeverity(validatedFindings);
    const stats = getStats(sortedFindings);
    const riskLevel = getRiskLevel(analysisData.riskScore || 0);

    const result = {
      url: payload.url,
      title: payload.title,
      riskScore: analysisData.riskScore || 0,
      riskLevel,
      // Use whatItMeans as summary if summary is not provided
      summary: analysisData.summary || analysisData.whatItMeans || 'Analysis complete.',
      whatItMeans: analysisData.whatItMeans || '',
      whatToDo: analysisData.whatToDo || '',
      documentType: analysisData.documentType || 'unknown',
      companyName: analysisData.companyName || 'Unknown',
      positives: analysisData.positives || [],
      redFlags: analysisData.redFlags || [],
      findings: sortedFindings,
      stats,
      analyzedAt: Date.now(),
      hash: contentHash,
      scans_used: analysisData.scans_used,
      scans_limit: analysisData.scans_limit
    }

    // Cache the result if caching is enabled
    if (shouldCache) {
      await setCache(contentHash, result);
    }

    // Increment usage
    await incrementUsage();

    // Save to history
    await saveToHistory(result);

    // Update badge with risk score
    await updateBadgeWithScore(result.riskScore);

    stopKeepAlive();
    sendResponse({ ok: true, data: result });
  } catch (e) {
    stopKeepAlive();
    sendResponse({ ok: false, error: String(e?.message || e) });
  }
}

/**
 * Save analysis to history
 */
async function saveToHistory(result) {
  try {
    const stored = await chrome.storage.local.get(['mta_analysis_history']);
    const history = stored.mta_analysis_history || [];

    // Check if this URL is already in history
    const existingIndex = history.findIndex(item => item.url === result.url);
    if (existingIndex >= 0) {
      // Update existing entry
      history[existingIndex] = result;
    } else {
      // Add new entry
      history.unshift(result);
    }

    // Keep only last 100 entries
    if (history.length > 100) {
      history.length = 100;
    }

    await chrome.storage.local.set({ mta_analysis_history: history });
  } catch (e) {
    console.error('Failed to save to history:', e);
  }
}

/**
 * Update extension badge with risk score
 */
async function updateBadgeWithScore(score) {
  try {
    const color = score >= 70 ? '#e74c3c' : score >= 40 ? '#f39c12' : '#27ae60';
    await chrome.action.setBadgeText({ text: String(score) });
    await chrome.action.setBadgeBackgroundColor({ color });

    // Clear badge after 30 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 30000);
  } catch (e) {
    console.error('Failed to update badge:', e);
  }
}
