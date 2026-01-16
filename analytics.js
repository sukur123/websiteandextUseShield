// Analytics Dashboard - Usage tracking and insights

const state = {
  history: [],
  dateRange: '7d',
  stats: {
    totalScans: 0,
    avgRiskScore: 0,
    uniqueSites: 0,
    highRiskCount: 0
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupEventListeners();
  render();
});

async function loadData() {
  const result = await chrome.storage.local.get(['mta_history']);
  state.history = result.mta_history || [];
}

function setupEventListeners() {
  document.getElementById('backLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.close();
  });
  
  // Date range buttons
  document.querySelectorAll('.date-range button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.date-range button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.dateRange = btn.dataset.range;
      render();
    });
  });
}

function getFilteredHistory() {
  const now = Date.now();
  let cutoff = 0;
  
  switch (state.dateRange) {
    case '7d':
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case '30d':
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
      break;
    default:
      cutoff = 0;
  }
  
  return state.history.filter(item => item.timestamp >= cutoff);
}

function calculateStats(filtered) {
  const stats = {
    totalScans: filtered.length,
    avgRiskScore: 0,
    uniqueSites: 0,
    highRiskCount: 0
  };
  
  if (filtered.length === 0) return stats;
  
  // Calculate average risk score
  const scores = filtered.map(item => {
    const match = item.riskScore?.match(/(\d+)/);
    return match ? parseInt(match[1]) : 5;
  });
  stats.avgRiskScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  
  // Count unique sites
  const domains = new Set(filtered.map(item => getDomain(item.url)));
  stats.uniqueSites = domains.size;
  
  // Count high risk
  stats.highRiskCount = scores.filter(s => s >= 7).length;
  
  return stats;
}

function render() {
  const filtered = getFilteredHistory();
  const stats = calculateStats(filtered);
  
  // Update stat cards
  document.getElementById('totalScans').textContent = stats.totalScans;
  document.getElementById('avgRiskScore').textContent = stats.avgRiskScore + '/10';
  document.getElementById('uniqueSites').textContent = stats.uniqueSites;
  document.getElementById('highRiskCount').textContent = stats.highRiskCount;
  
  // Calculate trend
  const trendEl = document.getElementById('scansTrend');
  if (state.dateRange !== 'all' && filtered.length > 0) {
    const halfPoint = filtered.length / 2;
    const recentHalf = filtered.slice(0, Math.floor(halfPoint)).length;
    const olderHalf = filtered.slice(Math.floor(halfPoint)).length;
    if (olderHalf > 0) {
      const trend = ((recentHalf - olderHalf) / olderHalf * 100).toFixed(0);
      trendEl.textContent = `${trend >= 0 ? '+' : ''}${trend}%`;
      trendEl.className = `stat-card-trend ${trend >= 0 ? 'up' : 'down'}`;
    }
  }
  
  renderScansChart(filtered);
  renderRiskDistribution(filtered);
  renderTopSites(filtered);
  renderHighRiskSites(filtered);
}

function renderScansChart(filtered) {
  const container = document.getElementById('scansChart');
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="chart-placeholder"><span class="icon">📊</span><span>No data yet</span></div>';
    return;
  }
  
  // Group by day
  const days = {};
  const numDays = state.dateRange === '7d' ? 7 : state.dateRange === '30d' ? 30 : 90;
  
  // Initialize days
  for (let i = numDays - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    days[key] = 0;
  }
  
  // Count scans per day
  filtered.forEach(item => {
    const key = new Date(item.timestamp).toISOString().split('T')[0];
    if (days[key] !== undefined) {
      days[key]++;
    }
  });
  
  // Find max for scaling
  const values = Object.values(days);
  const max = Math.max(...values, 1);
  
  // Render bars
  const entries = Object.entries(days);
  const showLabels = entries.length <= 14;
  
  container.innerHTML = entries.map(([date, count], i) => {
    const height = (count / max) * 180;
    const label = new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
    return `
      <div class="bar" style="height: ${Math.max(height, 2)}px;" title="${label}: ${count} scans">
        ${count > 0 ? `<span class="bar-value">${count}</span>` : ''}
        ${showLabels && i % 2 === 0 ? `<span class="bar-label">${label}</span>` : ''}
      </div>
    `;
  }).join('');
}

function renderRiskDistribution(filtered) {
  const container = document.getElementById('riskDistribution');
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="chart-placeholder"><span class="icon">🎯</span><span>No data yet</span></div>';
    return;
  }
  
  // Count by risk level
  const distribution = { low: 0, medium: 0, high: 0 };
  
  filtered.forEach(item => {
    const match = item.riskScore?.match(/(\d+)/);
    const score = match ? parseInt(match[1]) : 5;
    if (score <= 3) distribution.low++;
    else if (score <= 6) distribution.medium++;
    else distribution.high++;
  });
  
  const total = filtered.length;
  
  container.innerHTML = `
    <div style="display: flex; height: 30px; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
      <div style="width: ${(distribution.low / total) * 100}%; background: #22c55e;" title="Low Risk"></div>
      <div style="width: ${(distribution.medium / total) * 100}%; background: #f59e0b;" title="Medium Risk"></div>
      <div style="width: ${(distribution.high / total) * 100}%; background: #ef4444;" title="High Risk"></div>
    </div>
    <div class="pie-legend">
      <div class="pie-item">
        <div class="pie-color" style="background: #22c55e;"></div>
        <span class="pie-label">Low Risk (1-3)</span>
        <span class="pie-value">${distribution.low} (${((distribution.low / total) * 100).toFixed(0)}%)</span>
      </div>
      <div class="pie-item">
        <div class="pie-color" style="background: #f59e0b;"></div>
        <span class="pie-label">Medium Risk (4-6)</span>
        <span class="pie-value">${distribution.medium} (${((distribution.medium / total) * 100).toFixed(0)}%)</span>
      </div>
      <div class="pie-item">
        <div class="pie-color" style="background: #ef4444;"></div>
        <span class="pie-label">High Risk (7-10)</span>
        <span class="pie-value">${distribution.high} (${((distribution.high / total) * 100).toFixed(0)}%)</span>
      </div>
    </div>
  `;
}

function renderTopSites(filtered) {
  const tbody = document.getElementById('topSitesBody');
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888; padding: 24px;">No data yet</td></tr>';
    return;
  }
  
  // Group by domain
  const domains = {};
  filtered.forEach(item => {
    const domain = getDomain(item.url);
    if (!domains[domain]) {
      domains[domain] = { count: 0, scores: [], lastScanned: 0 };
    }
    domains[domain].count++;
    const match = item.riskScore?.match(/(\d+)/);
    if (match) domains[domain].scores.push(parseInt(match[1]));
    domains[domain].lastScanned = Math.max(domains[domain].lastScanned, item.timestamp);
  });
  
  // Sort by count
  const sorted = Object.entries(domains)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  
  tbody.innerHTML = sorted.map(([domain, data]) => {
    const avgScore = data.scores.length > 0 
      ? (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1)
      : '-';
    return `
      <tr>
        <td class="domain-cell">${escapeHtml(domain)}</td>
        <td>${data.count}</td>
        <td><span class="score-badge ${getScoreClass(avgScore)}">${avgScore}/10</span></td>
        <td>${formatTimeAgo(data.lastScanned)}</td>
      </tr>
    `;
  }).join('');
}

function renderHighRiskSites(filtered) {
  const tbody = document.getElementById('highRiskBody');
  
  // Filter high risk only
  const highRisk = filtered
    .filter(item => {
      const match = item.riskScore?.match(/(\d+)/);
      return match && parseInt(match[1]) >= 7;
    })
    .sort((a, b) => {
      const scoreA = parseInt(a.riskScore?.match(/(\d+)/)?.[1] || 0);
      const scoreB = parseInt(b.riskScore?.match(/(\d+)/)?.[1] || 0);
      return scoreB - scoreA;
    })
    .slice(0, 10);
  
  if (highRisk.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888; padding: 24px;">No high-risk sites found 🎉</td></tr>';
    return;
  }
  
  tbody.innerHTML = highRisk.map(item => {
    const topFinding = item.findings?.[0]?.title || '-';
    return `
      <tr>
        <td class="domain-cell">${escapeHtml(getDomain(item.url))}</td>
        <td><span class="score-badge score-high">${item.riskScore}</span></td>
        <td>${escapeHtml(topFinding)}</td>
        <td>${formatTimeAgo(item.timestamp)}</td>
      </tr>
    `;
  }).join('');
}

// Helpers
function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function getScoreClass(score) {
  const num = parseFloat(score);
  if (isNaN(num)) return '';
  if (num <= 3) return 'score-low';
  if (num <= 6) return 'score-medium';
  return 'score-high';
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
