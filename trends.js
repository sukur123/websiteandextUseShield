// trends.js - Risk Score Trend Tracking

const siteSelect = document.getElementById('siteSelect');
const trendContent = document.getElementById('trendContent');
const emptyState = document.getElementById('emptyState');
const siteName = document.getElementById('siteName');
const trendBadge = document.getElementById('trendBadge');
const trendChart = document.getElementById('trendChart');
const currentScore = document.getElementById('currentScore');
const avgScore = document.getElementById('avgScore');
const changeAmount = document.getElementById('changeAmount');
const analysisCount = document.getElementById('analysisCount');
const timelineList = document.getElementById('timelineList');
const insightsList = document.getElementById('insightsList');
const backLink = document.getElementById('backLink');

// Store history data
let historyData = [];
let sitesWithTrends = {};

// Back link handler
backLink.addEventListener('click', function(e) {
  e.preventDefault();
  window.close();
});

// Load and process history
async function loadHistory() {
  try {
    const stored = await chrome.storage.local.get(['mta_history']);
    historyData = stored.mta_history || [];
    
    // Group by domain
    sitesWithTrends = {};
    historyData.forEach(function(item) {
      try {
        const domain = new URL(item.url).hostname;
        if (!sitesWithTrends[domain]) {
          sitesWithTrends[domain] = [];
        }
        sitesWithTrends[domain].push(item);
      } catch (e) {
        // Invalid URL, skip
      }
    });
    
    // Sort each site's history by date
    Object.keys(sitesWithTrends).forEach(function(domain) {
      sitesWithTrends[domain].sort(function(a, b) {
        return a.timestamp - b.timestamp;
      });
    });
    
    // Filter to only sites with multiple analyses
    const multiAnalysisSites = Object.keys(sitesWithTrends).filter(function(domain) {
      return sitesWithTrends[domain].length >= 1; // Show all for now, >= 2 for strict trends
    });
    
    // Populate dropdown
    populateSiteSelector(multiAnalysisSites);
    
    if (multiAnalysisSites.length === 0) {
      emptyState.hidden = false;
      trendContent.hidden = true;
    }
  } catch (e) {
    console.error('Failed to load history:', e);
  }
}

function populateSiteSelector(sites) {
  // Clear existing options except first
  while (siteSelect.options.length > 1) {
    siteSelect.remove(1);
  }
  
  // Sort sites by number of analyses
  sites.sort(function(a, b) {
    return sitesWithTrends[b].length - sitesWithTrends[a].length;
  });
  
  sites.forEach(function(domain) {
    const count = sitesWithTrends[domain].length;
    const option = document.createElement('option');
    option.value = domain;
    option.textContent = `${domain} (${count} ${count === 1 ? 'analysis' : 'analyses'})`;
    siteSelect.appendChild(option);
  });
}

// Site selection handler
siteSelect.addEventListener('change', function() {
  const domain = siteSelect.value;
  if (domain && sitesWithTrends[domain]) {
    showTrendData(domain, sitesWithTrends[domain]);
    trendContent.hidden = false;
    emptyState.hidden = true;
  } else {
    trendContent.hidden = true;
    emptyState.hidden = Object.keys(sitesWithTrends).length === 0;
  }
});

function getRiskClass(score) {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function showTrendData(domain, analyses) {
  siteName.textContent = domain;
  
  // Calculate stats
  const scores = analyses.map(function(a) { return a.riskScore || 0; });
  const current = scores[scores.length - 1];
  const first = scores[0];
  const avg = Math.round(scores.reduce(function(a, b) { return a + b; }, 0) / scores.length);
  
  // Determine trend
  let trendType = 'new';
  let change = 0;
  
  if (analyses.length >= 2) {
    change = current - first;
    if (change > 10) {
      trendType = 'worsened';
    } else if (change < -10) {
      trendType = 'improved';
    } else {
      trendType = 'stable';
    }
  }
  
  // Update badge
  trendBadge.className = 'trend-badge ' + trendType;
  const trendLabels = {
    improved: '↓ Improved',
    worsened: '↑ Worsened',
    stable: '→ Stable',
    new: '★ New'
  };
  trendBadge.textContent = trendLabels[trendType];
  
  // Update stats
  currentScore.textContent = current;
  avgScore.textContent = avg;
  analysisCount.textContent = analyses.length;
  
  // Change display
  if (analyses.length >= 2) {
    const changeSign = change > 0 ? '+' : '';
    changeAmount.textContent = changeSign + change;
    changeAmount.className = 'trend-stat-value ' + (change > 0 ? 'up' : change < 0 ? 'down' : '');
  } else {
    changeAmount.textContent = '—';
    changeAmount.className = 'trend-stat-value';
  }
  
  // Build chart
  buildChart(analyses);
  
  // Build timeline
  buildTimeline(analyses);
  
  // Generate insights
  generateInsights(domain, analyses);
}

function buildChart(analyses) {
  trendChart.innerHTML = '';
  
  // Show last 10 analyses max
  const displayAnalyses = analyses.slice(-10);
  const maxScore = 100;
  
  displayAnalyses.forEach(function(analysis, index) {
    const score = analysis.riskScore || 0;
    const height = Math.max(10, (score / maxScore) * 180); // Max height 180px
    const riskClass = getRiskClass(score);
    
    const container = document.createElement('div');
    container.className = 'chart-bar-container';
    
    const valueLabel = document.createElement('div');
    valueLabel.className = 'chart-bar-value';
    valueLabel.textContent = score;
    
    const bar = document.createElement('div');
    bar.className = 'chart-bar ' + riskClass;
    bar.style.height = height + 'px';
    bar.title = `Score: ${score} on ${new Date(analysis.timestamp).toLocaleDateString()}`;
    
    const dateLabel = document.createElement('div');
    dateLabel.className = 'chart-bar-label';
    dateLabel.textContent = formatShortDate(analysis.timestamp);
    
    container.appendChild(valueLabel);
    container.appendChild(bar);
    container.appendChild(dateLabel);
    trendChart.appendChild(container);
  });
}

function buildTimeline(analyses) {
  timelineList.innerHTML = '';
  
  // Show in reverse chronological order
  const reversed = analyses.slice().reverse();
  
  reversed.forEach(function(analysis, index) {
    const prevAnalysis = reversed[index + 1];
    const score = analysis.riskScore || 0;
    const prevScore = prevAnalysis ? (prevAnalysis.riskScore || 0) : null;
    
    const item = document.createElement('div');
    item.className = 'timeline-item';
    
    // Date
    const dateEl = document.createElement('div');
    dateEl.className = 'timeline-date';
    dateEl.textContent = formatDate(analysis.timestamp);
    
    // Score circle
    const scoreEl = document.createElement('div');
    scoreEl.className = 'timeline-score ' + getRiskClass(score);
    scoreEl.textContent = score;
    
    // Change indicator
    const changeEl = document.createElement('div');
    changeEl.className = 'timeline-change';
    
    if (prevScore !== null) {
      const diff = score - prevScore;
      const arrow = document.createElement('span');
      arrow.className = 'timeline-arrow';
      
      const diffText = document.createElement('span');
      diffText.className = 'timeline-diff';
      
      if (diff > 0) {
        arrow.className += ' up';
        arrow.textContent = '↑';
        diffText.className += ' up';
        diffText.textContent = '+' + diff + ' points';
      } else if (diff < 0) {
        arrow.className += ' down';
        arrow.textContent = '↓';
        diffText.className += ' down';
        diffText.textContent = diff + ' points';
      } else {
        arrow.className += ' same';
        arrow.textContent = '→';
        diffText.textContent = 'No change';
      }
      
      changeEl.appendChild(arrow);
      changeEl.appendChild(diffText);
    } else {
      changeEl.innerHTML = '<span style="color:#888;font-size:12px">First analysis</span>';
    }
    
    item.appendChild(dateEl);
    item.appendChild(scoreEl);
    item.appendChild(changeEl);
    timelineList.appendChild(item);
  });
}

function generateInsights(domain, analyses) {
  insightsList.innerHTML = '';
  const insights = [];
  
  const scores = analyses.map(function(a) { return a.riskScore || 0; });
  const current = scores[scores.length - 1];
  const avg = Math.round(scores.reduce(function(a, b) { return a + b; }, 0) / scores.length);
  const max = Math.max.apply(null, scores);
  const min = Math.min.apply(null, scores);
  
  // Insight: Current vs average
  if (current > avg + 10) {
    insights.push({
      icon: '⚠️',
      text: `Current risk score (${current}) is significantly higher than the average (${avg}). The terms may have recently become less favorable.`
    });
  } else if (current < avg - 10) {
    insights.push({
      icon: '✅',
      text: `Current risk score (${current}) is lower than average (${avg}). Recent changes appear to be more user-friendly.`
    });
  }
  
  // Insight: Volatility
  const range = max - min;
  if (range > 30 && analyses.length >= 3) {
    insights.push({
      icon: '📊',
      text: `This site has shown significant variation in risk scores (${min} to ${max}). Their terms may change frequently.`
    });
  }
  
  // Insight: Trend direction
  if (analyses.length >= 3) {
    const recentScores = scores.slice(-3);
    const isIncreasing = recentScores[2] > recentScores[1] && recentScores[1] > recentScores[0];
    const isDecreasing = recentScores[2] < recentScores[1] && recentScores[1] < recentScores[0];
    
    if (isIncreasing) {
      insights.push({
        icon: '📈',
        text: 'Risk scores have been consistently increasing. Consider reviewing their latest terms carefully.'
      });
    } else if (isDecreasing) {
      insights.push({
        icon: '📉',
        text: 'Risk scores have been consistently decreasing. This site appears to be improving their terms.'
      });
    }
  }
  
  // Insight: High risk alert
  if (current >= 70) {
    insights.push({
      icon: '🚨',
      text: 'This site currently has a CRITICAL risk score. Exercise extreme caution with any financial commitments.'
    });
  }
  
  // Insight: Recommendation
  if (analyses.length === 1) {
    insights.push({
      icon: '💡',
      text: 'Analyze this site again in the future to track how their terms change over time.'
    });
  }
  
  // Default insight if none generated
  if (insights.length === 0) {
    insights.push({
      icon: '📋',
      text: `You have analyzed ${domain} ${analyses.length} time(s). The risk score has remained relatively stable.`
    });
  }
  
  // Render insights
  insights.forEach(function(insight) {
    const item = document.createElement('div');
    item.className = 'insight-item';
    item.innerHTML = `
      <span class="insight-icon">${insight.icon}</span>
      <span class="insight-text">${insight.text}</span>
    `;
    insightsList.appendChild(item);
  });
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatShortDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

// Initialize
loadHistory();
