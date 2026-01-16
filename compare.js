// Enhanced Compare Page - Side-by-side ToS comparison with service suggestions

// Popular services by category
const SERVICES_BY_CATEGORY = {
  streaming: [
    { name: 'Netflix', url: 'https://www.netflix.com/terms', icon: '🎬' },
    { name: 'Spotify', url: 'https://www.spotify.com/legal/end-user-agreement/', icon: '🎵' },
    { name: 'Disney+', url: 'https://www.disneyplus.com/legal/subscriber-agreement', icon: '🏰' },
    { name: 'YouTube', url: 'https://www.youtube.com/t/terms', icon: '▶️' },
    { name: 'Hulu', url: 'https://www.hulu.com/subscriber_agreement', icon: '📺' },
    { name: 'Amazon Prime', url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=508088', icon: '📦' }
  ],
  cloud: [
    { name: 'Dropbox', url: 'https://www.dropbox.com/terms', icon: '📦' },
    { name: 'Google Drive', url: 'https://policies.google.com/terms', icon: '🔵' },
    { name: 'iCloud', url: 'https://www.apple.com/legal/internet-services/icloud/', icon: '☁️' },
    { name: 'OneDrive', url: 'https://www.microsoft.com/en-us/servicesagreement', icon: '💙' },
    { name: 'Box', url: 'https://www.box.com/legal/termsofservice', icon: '📁' }
  ],
  social: [
    { name: 'Facebook', url: 'https://www.facebook.com/terms.php', icon: '📘' },
    { name: 'Instagram', url: 'https://help.instagram.com/581066165581870', icon: '📷' },
    { name: 'Twitter/X', url: 'https://twitter.com/tos', icon: '🐦' },
    { name: 'TikTok', url: 'https://www.tiktok.com/legal/terms-of-service', icon: '🎵' },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/legal/user-agreement', icon: '💼' },
    { name: 'Reddit', url: 'https://www.redditinc.com/policies/user-agreement', icon: '🤖' }
  ],
  productivity: [
    { name: 'Notion', url: 'https://www.notion.so/Terms-and-Privacy-28ffdd083dc3473e9c2da6ec011b58ac', icon: '📝' },
    { name: 'Slack', url: 'https://slack.com/terms-of-service', icon: '💬' },
    { name: 'Zoom', url: 'https://explore.zoom.us/en/terms/', icon: '📹' },
    { name: 'Microsoft 365', url: 'https://www.microsoft.com/en-us/servicesagreement', icon: '📊' },
    { name: 'Trello', url: 'https://www.atlassian.com/legal/cloud-terms-of-service', icon: '📋' },
    { name: 'Asana', url: 'https://asana.com/terms', icon: '✅' }
  ],
  shopping: [
    { name: 'Amazon', url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=508088', icon: '📦' },
    { name: 'eBay', url: 'https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement', icon: '🛒' },
    { name: 'Shopify', url: 'https://www.shopify.com/legal/terms', icon: '🛍️' },
    { name: 'Etsy', url: 'https://www.etsy.com/legal/terms-of-use', icon: '🎨' },
    { name: 'Walmart', url: 'https://www.walmart.com/help/article/walmart-com-terms-of-use/3b75080af40340d6bbd596f116fae5a0', icon: '🏪' }
  ],
  finance: [
    { name: 'PayPal', url: 'https://www.paypal.com/us/legalhub/useragreement-full', icon: '💳' },
    { name: 'Venmo', url: 'https://venmo.com/legal/us-user-agreement/', icon: '💵' },
    { name: 'Cash App', url: 'https://cash.app/legal/us/en-us/tos', icon: '💸' },
    { name: 'Stripe', url: 'https://stripe.com/legal/ssa', icon: '💰' },
    { name: 'Coinbase', url: 'https://www.coinbase.com/legal/user_agreement', icon: '🪙' }
  ]
};

const state = {
  resultA: null,
  resultB: null,
  selectedCategory: 'streaming',
  selectedServices: { A: null, B: null }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  renderServiceSuggestions();
});

function setupEventListeners() {
  // Back link
  document.getElementById('backLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.close();
  });
  
  // Category chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      state.selectedCategory = chip.dataset.category;
      renderServiceSuggestions();
    });
  });
  
  // Analyze buttons
  document.getElementById('analyzeA').addEventListener('click', () => analyzeUrl('A'));
  document.getElementById('analyzeB').addEventListener('click', () => analyzeUrl('B'));
  
  // URL inputs - allow Enter to trigger analysis
  document.getElementById('urlA').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyzeUrl('A');
  });
  document.getElementById('urlB').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyzeUrl('B');
  });
}

function renderServiceSuggestions() {
  const container = document.getElementById('serviceSuggestions');
  const services = SERVICES_BY_CATEGORY[state.selectedCategory] || [];
  
  container.innerHTML = services.map(service => `
    <button class="service-btn" data-url="${service.url}" data-name="${service.name}">
      <span class="service-icon">${service.icon}</span>
      ${service.name}
    </button>
  `).join('');
  
  // Add click listeners
  container.querySelectorAll('.service-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      const name = btn.dataset.name;
      
      // Determine which panel to populate
      const urlA = document.getElementById('urlA').value;
      const urlB = document.getElementById('urlB').value;
      
      if (!urlA || state.selectedServices.A?.name === name) {
        document.getElementById('urlA').value = url;
        state.selectedServices.A = { name, url };
        updateServiceButtonStates();
        analyzeUrl('A');
      } else if (!urlB || state.selectedServices.B?.name === name) {
        document.getElementById('urlB').value = url;
        state.selectedServices.B = { name, url };
        updateServiceButtonStates();
        analyzeUrl('B');
      } else {
        // Both filled, replace B
        document.getElementById('urlB').value = url;
        state.selectedServices.B = { name, url };
        updateServiceButtonStates();
        analyzeUrl('B');
      }
    });
  });
}

function updateServiceButtonStates() {
  document.querySelectorAll('.service-btn').forEach(btn => {
    const url = btn.dataset.url;
    const isSelected = 
      (state.selectedServices.A && state.selectedServices.A.url === url) ||
      (state.selectedServices.B && state.selectedServices.B.url === url);
    btn.classList.toggle('selected', isSelected);
  });
}

async function analyzeUrl(panel) {
  const input = document.getElementById(`url${panel}`);
  const resultContainer = document.getElementById(`result${panel}`);
  const analyzeBtn = document.getElementById(`analyze${panel}`);
  const url = input.value.trim();
  
  if (!url) {
    resultContainer.innerHTML = '<div class="status" style="color: #e74c3c;">Please enter a URL</div>';
    return;
  }
  
  // Show loading state
  resultContainer.innerHTML = '<div class="status loading">🔍 Analyzing...</div>';
  analyzeBtn.disabled = true;
  
  try {
    // Fetch page content
    const response = await fetch(url);
    const html = await response.text();
    
    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove scripts, styles, etc.
    doc.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());
    
    const text = doc.body?.innerText || '';
    const title = doc.title || url;
    
    if (text.length < 100) {
      throw new Error('Not enough content found on page');
    }
    
    // Send to background for analysis
    const result = await new Promise((resolve, reject) => {
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
    
    // Store result
    if (panel === 'A') {
      state.resultA = { ...result.data, url, title };
    } else {
      state.resultB = { ...result.data, url, title };
    }
    
    // Render result
    renderResult(panel);
    
    // Check if both results are ready for comparison
    if (state.resultA && state.resultB) {
      compareResults();
    }
    
  } catch (error) {
    resultContainer.innerHTML = `<div class="status" style="color: #e74c3c;">❌ ${error.message}</div>`;
  } finally {
    analyzeBtn.disabled = false;
  }
}

function renderResult(panel) {
  const result = panel === 'A' ? state.resultA : state.resultB;
  const container = document.getElementById(`result${panel}`);
  
  if (!result) {
    container.innerHTML = '<div class="status">No result</div>';
    return;
  }
  
  const score = result.riskScore || 0;
  const riskLevel = getRiskLevel(score);
  
  container.innerHTML = `
    <div class="score-display">
      <div class="score-big" style="color: ${getRiskColor(score)}">${score}</div>
      <div class="score-label">Risk Score (out of 100)</div>
      <span class="risk-badge risk-${riskLevel}">${capitalize(riskLevel)} Risk</span>
    </div>
    
    <div class="summary">${escapeHtml(result.summary || 'No summary available')}</div>
    
    <h4 style="font-size: 14px; margin: 16px 0 8px;">Key Findings (${result.findings?.length || 0})</h4>
    <div class="findings-mini">
      ${(result.findings || []).slice(0, 5).map(f => `
        <div class="finding-mini ${f.severity || 'medium'}">
          <div class="finding-title">${escapeHtml(f.title)}</div>
          <div>${escapeHtml(f.description?.slice(0, 100) || '')}...</div>
        </div>
      `).join('')}
      ${(result.findings?.length || 0) > 5 ? `<div class="status">+${result.findings.length - 5} more findings</div>` : ''}
    </div>
  `;
}

function compareResults() {
  const panelA = document.getElementById('panelA');
  const panelB = document.getElementById('panelB');
  const summarySection = document.getElementById('comparisonSummary');
  
  // Remove previous winner/loser classes
  panelA.classList.remove('winner', 'loser');
  panelB.classList.remove('winner', 'loser');
  
  const scoreA = state.resultA.riskScore || 0;
  const scoreB = state.resultB.riskScore || 0;
  
  // Lower score is better
  if (scoreA < scoreB) {
    panelA.classList.add('winner');
    panelB.classList.add('loser');
  } else if (scoreB < scoreA) {
    panelB.classList.add('winner');
    panelA.classList.add('loser');
  }
  
  // Update comparison summary
  summarySection.hidden = false;
  
  document.getElementById('serviceAName').textContent = getServiceName(state.resultA.url);
  document.getElementById('serviceBName').textContent = getServiceName(state.resultB.url);
  
  const tbody = document.getElementById('comparisonBody');
  tbody.innerHTML = `
    <tr>
      <td>Risk Score</td>
      <td class="${scoreA <= scoreB ? 'better' : 'worse'}">${scoreA}/100</td>
      <td class="${scoreB <= scoreA ? 'better' : 'worse'}">${scoreB}/100</td>
    </tr>
    <tr>
      <td>Risk Level</td>
      <td>${capitalize(getRiskLevel(scoreA))}</td>
      <td>${capitalize(getRiskLevel(scoreB))}</td>
    </tr>
    <tr>
      <td>Total Issues Found</td>
      <td class="${(state.resultA.findings?.length || 0) <= (state.resultB.findings?.length || 0) ? 'better' : 'worse'}">${state.resultA.findings?.length || 0}</td>
      <td class="${(state.resultB.findings?.length || 0) <= (state.resultA.findings?.length || 0) ? 'better' : 'worse'}">${state.resultB.findings?.length || 0}</td>
    </tr>
    <tr>
      <td>Critical Issues</td>
      <td class="${countBySeverity(state.resultA, 'critical') <= countBySeverity(state.resultB, 'critical') ? 'better' : 'worse'}">${countBySeverity(state.resultA, 'critical')}</td>
      <td class="${countBySeverity(state.resultB, 'critical') <= countBySeverity(state.resultA, 'critical') ? 'better' : 'worse'}">${countBySeverity(state.resultB, 'critical')}</td>
    </tr>
    <tr>
      <td>High-Severity Issues</td>
      <td class="${countBySeverity(state.resultA, 'high') <= countBySeverity(state.resultB, 'high') ? 'better' : 'worse'}">${countBySeverity(state.resultA, 'high')}</td>
      <td class="${countBySeverity(state.resultB, 'high') <= countBySeverity(state.resultA, 'high') ? 'better' : 'worse'}">${countBySeverity(state.resultB, 'high')}</td>
    </tr>
  `;
}

// Helper functions
function getRiskLevel(score) {
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 75) return 'high';
  return 'critical';
}

function getRiskColor(score) {
  if (score <= 25) return '#27ae60';
  if (score <= 50) return '#f39c12';
  if (score <= 75) return '#e67e22';
  return '#e74c3c';
}

function getServiceName(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    // Check if it matches any known service
    for (const category of Object.values(SERVICES_BY_CATEGORY)) {
      for (const service of category) {
        if (service.url.includes(hostname) || url.includes(service.name.toLowerCase())) {
          return service.name;
        }
      }
    }
    return hostname;
  } catch {
    return 'Unknown';
  }
}

function countBySeverity(result, severity) {
  return (result.findings || []).filter(f => f.severity === severity).length;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
