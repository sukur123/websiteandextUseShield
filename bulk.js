// Bulk Analysis - Batch URL analysis for Pro+ tiers

const TIER_LIMITS = {
  free: 3,
  starter: 15,
  pro: 80,
  pro_plus: 200,
  agency: 300
};

const state = {
  tier: 'free',
  usage: { count: 0, resetDate: null },
  urls: [],
  results: [],
  isAnalyzing: false,
  isPaused: false,
  currentIndex: 0,
  abortController: null
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  checkAccess();
  setupEventListeners();
  updateUI();
});

async function loadData() {
  const result = await chrome.storage.local.get(['mta_tier', 'mta_usage', 'mta_bulk_results']);
  state.tier = result.mta_tier || 'free';
  state.usage = result.mta_usage || { count: 0, resetDate: null };
  state.results = result.mta_bulk_results || [];

  // Check if usage needs reset
  if (state.usage.resetDate) {
    const resetDate = new Date(state.usage.resetDate);
    if (new Date() > resetDate) {
      state.usage = { count: 0, resetDate: getNextResetDate() };
      await chrome.storage.local.set({ mta_usage: state.usage });
    }
  }
}

function checkAccess() {
  const upgradeRequired = document.getElementById('upgradeRequired');
  const bulkContent = document.getElementById('bulkContent');
  const tierBadge = document.getElementById('tierBadge');

  tierBadge.textContent = state.tier.replace('_', ' ').toUpperCase();

  // Bulk analysis available for pro and above
  const hasBulk = ['pro', 'pro_plus', 'agency'].includes(state.tier);

  if (!hasBulk) {
    upgradeRequired.hidden = false;
    bulkContent.style.display = 'none';
  }
}

function setupEventListeners() {
  document.getElementById('backLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.close();
  });

  // URL input
  const urlInput = document.getElementById('urlInput');
  urlInput.addEventListener('input', () => {
    state.urls = parseUrls(urlInput.value);
    updateUrlCount();
  });

  // Action buttons
  document.getElementById('startAnalysisBtn').addEventListener('click', startAnalysis);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('sampleBtn').addEventListener('click', loadSampleUrls);
  document.getElementById('cancelBtn').addEventListener('click', cancelAnalysis);
  document.getElementById('pauseBtn').addEventListener('click', togglePause);

  // Export buttons
  document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
  document.getElementById('exportJsonBtn').addEventListener('click', exportJson);

  // Load previous results if any
  if (state.results.length > 0) {
    renderResults();
  }
}

function parseUrls(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && isValidUrl(line))
    .slice(0, 50); // Max 50 URLs
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function updateUrlCount() {
  const limit = TIER_LIMITS[state.tier];
  const remaining = Math.max(0, limit - state.usage.count);

  document.getElementById('urlCount').textContent = `${state.urls.length} URLs entered`;
  document.getElementById('scansRemaining').textContent = `Scans remaining: ${remaining}`;
}

function updateUI() {
  updateUrlCount();
}

async function startAnalysis() {
  if (state.urls.length === 0) {
    alert('Please enter at least one valid URL');
    return;
  }

  const limit = TIER_LIMITS[state.tier];
  const remaining = limit - state.usage.count;

  if (state.urls.length > remaining) {
    alert(`You only have ${remaining} scans remaining. Please reduce the number of URLs or upgrade your plan.`);
    return;
  }

  // Reset results for new batch
  state.results = state.urls.map(url => ({
    url,
    status: 'pending',
    score: null,
    findings: [],
    error: null,
    timestamp: null
  }));

  state.isAnalyzing = true;
  state.isPaused = false;
  state.currentIndex = 0;

  // Show progress section
  document.getElementById('progressSection').hidden = false;
  document.getElementById('startAnalysisBtn').disabled = true;

  renderResults();

  // Start processing
  await processQueue();
}

async function processQueue() {
  while (state.currentIndex < state.results.length && state.isAnalyzing) {
    if (state.isPaused) {
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }

    const result = state.results[state.currentIndex];
    result.status = 'analyzing';
    renderResults();
    updateProgress();

    try {
      const analysis = await analyzeUrl(result.url);
      result.status = 'complete';
      result.score = analysis.riskScore;
      result.findings = analysis.findings || [];
      result.timestamp = Date.now();

      // Update usage
      state.usage.count++;
      await chrome.storage.local.set({ mta_usage: state.usage });

    } catch (error) {
      result.status = 'error';
      result.error = error.message;
    }

    state.currentIndex++;
    renderResults();
    updateProgress();

    // Save results periodically
    await chrome.storage.local.set({ mta_bulk_results: state.results });

    // Small delay between requests
    if (state.currentIndex < state.results.length) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  state.isAnalyzing = false;
  document.getElementById('progressSection').hidden = true;
  document.getElementById('startAnalysisBtn').disabled = false;
  document.getElementById('exportButtons').hidden = false;
  updateUrlCount();
}

async function analyzeUrl(url) {
  // Fetch page content
  const response = await fetch(url);
  const html = await response.text();

  // Parse HTML and extract text
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove scripts and styles
  doc.querySelectorAll('script, style, noscript').forEach(el => el.remove());

  const text = doc.body?.innerText || '';
  const title = doc.title || url;

  if (text.length < 100) {
    throw new Error('Not enough content to analyze');
  }

  // Send to background for analysis using standard payload format
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'MTA_ANALYZE_TEXT', payload: { url, title, text: text.slice(0, 50000) } },
      response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      }
    );
  });
}

function cancelAnalysis() {
  state.isAnalyzing = false;
  state.isPaused = false;

  // Mark remaining as cancelled
  state.results.forEach(result => {
    if (result.status === 'pending' || result.status === 'analyzing') {
      result.status = 'error';
      result.error = 'Cancelled';
    }
  });

  document.getElementById('progressSection').hidden = true;
  document.getElementById('startAnalysisBtn').disabled = false;
  renderResults();
}

function togglePause() {
  state.isPaused = !state.isPaused;
  document.getElementById('pauseBtn').textContent = state.isPaused ? 'Resume' : 'Pause';
}

function updateProgress() {
  const completed = state.results.filter(r => r.status === 'complete' || r.status === 'error').length;
  const total = state.results.length;
  const percent = total > 0 ? (completed / total) * 100 : 0;

  document.getElementById('progressFill').style.width = `${percent}%`;
  document.getElementById('progressText').textContent = `${completed} of ${total} completed`;
}

function renderResults() {
  const table = document.getElementById('resultsTable');
  const tbody = document.getElementById('resultsBody');
  const empty = document.getElementById('emptyResults');
  const exportBtns = document.getElementById('exportButtons');

  if (state.results.length === 0) {
    table.hidden = true;
    empty.hidden = false;
    exportBtns.hidden = true;
    return;
  }

  table.hidden = false;
  empty.hidden = true;

  const hasCompleted = state.results.some(r => r.status === 'complete');
  exportBtns.hidden = !hasCompleted || state.isAnalyzing;

  tbody.innerHTML = state.results.map((result, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="url-cell">
        <a href="${escapeHtml(result.url)}" target="_blank">${escapeHtml(truncateUrl(result.url))}</a>
      </td>
      <td><span class="status-badge status-${result.status}">${capitalize(result.status)}</span></td>
      <td>${result.score ? `<span class="score-badge ${getScoreClass(result.score)}">${result.score}</span>` : '-'}</td>
      <td class="findings-preview">${result.findings.length > 0 ? escapeHtml(result.findings[0]?.title || '') : (result.error || '-')}</td>
      <td>
        ${result.status === 'complete' ? `<button class="btn btn-sm" onclick="viewDetails(${index})">View</button>` : ''}
      </td>
    </tr>
  `).join('');
}

window.viewDetails = function (index) {
  const result = state.results[index];
  if (!result || result.status !== 'complete') return;

  const details = `URL: ${result.url}
Risk Score: ${result.score}

Findings:
${result.findings.map((f, i) => `${i + 1}. [${f.severity?.toUpperCase()}] ${f.title}
   ${f.description}`).join('\n\n')}`;

  alert(details);
};

function clearAll() {
  document.getElementById('urlInput').value = '';
  state.urls = [];
  state.results = [];
  updateUrlCount();
  renderResults();
  chrome.storage.local.remove('mta_bulk_results');
}

function loadSampleUrls() {
  const sampleUrls = [
    'https://www.spotify.com/legal/end-user-agreement/',
    'https://www.netflix.com/terms',
    'https://www.amazon.com/gp/help/customer/display.html?nodeId=508088'
  ];

  document.getElementById('urlInput').value = sampleUrls.join('\n');
  state.urls = sampleUrls;
  updateUrlCount();
}

function exportCsv() {
  const headers = ['URL', 'Status', 'Risk Score', 'Findings Count', 'Top Finding', 'Analyzed At'];
  const rows = state.results.map(r => [
    r.url,
    r.status,
    r.score || '',
    r.findings.length,
    r.findings[0]?.title || '',
    r.timestamp ? new Date(r.timestamp).toISOString() : ''
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  downloadFile(csv, 'bulk-analysis.csv', 'text/csv');
}

function exportJson() {
  const json = JSON.stringify(state.results, null, 2);
  downloadFile(json, 'bulk-analysis.json', 'application/json');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Helpers
function truncateUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 30
      ? parsed.pathname.slice(0, 30) + '...'
      : parsed.pathname;
    return parsed.hostname + path;
  } catch {
    return url.slice(0, 50);
  }
}

function getScoreClass(score) {
  if (!score) return '';
  const num = parseInt(score);
  if (num <= 3) return 'score-low';
  if (num <= 6) return 'score-medium';
  return 'score-high';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getNextResetDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}
