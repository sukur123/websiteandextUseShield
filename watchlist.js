const watchlistEl = document.getElementById('watchlist');
const emptyEl = document.getElementById('empty');
const backLinkEl = document.getElementById('backLink');
const sortSelect = document.getElementById('sortSelect');

backLinkEl.addEventListener('click', function(e) {
  e.preventDefault();
  window.close();
});

function getScoreClass(level) {
  return 'score-' + (level || 'medium');
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { 
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
}

function sortWatchlist(list) {
  const sortOrder = sortSelect ? sortSelect.value : 'added-desc';
  
  return [...list].sort((a, b) => {
    const scoreA = a.lastResult ? (a.lastResult.riskScore || 0) : 0;
    const scoreB = b.lastResult ? (b.lastResult.riskScore || 0) : 0;
    
    switch (sortOrder) {
      case 'added-asc':
        return (a.addedAt || 0) - (b.addedAt || 0);
      case 'added-desc':
        return (b.addedAt || 0) - (a.addedAt || 0);
      case 'score-desc':
        return scoreB - scoreA;
      case 'score-asc':
        return scoreA - scoreB;
      case 'domain-asc':
        return (a.domain || '').localeCompare(b.domain || '');
      case 'changes':
        return (b.hasChanges ? 1 : 0) - (a.hasChanges ? 1 : 0);
      default:
        return (b.addedAt || 0) - (a.addedAt || 0);
    }
  });
}

function createItemCard(item) {
  const card = document.createElement('div');
  card.className = 'item';
  card.dataset.id = item.id;
  
  const result = item.lastResult || {};
  const scoreClass = getScoreClass(result.riskLevel);
  
  let html = '<div class="item-header">' +
    '<div>' +
    '<div class="item-title">' + escapeHtml(item.title || item.url) + '</div>' +
    '<div class="item-domain">' + escapeHtml(item.domain) + '</div>' +
    '</div>' +
    '<div>' +
    '<span class="item-score ' + scoreClass + '">' + (result.riskScore || '?') + '/100</span>';
  
  if (item.hasChanges) {
    html += '<span class="changes-badge">Changed!</span>';
  }
  
  html += '</div></div>' +
    '<div class="item-meta">' +
    'Added: ' + formatDate(item.addedAt) + ' | Last checked: ' + formatDate(item.lastChecked) +
    '</div>' +
    '<div class="item-actions">' +
    '<button class="btn" data-action="open">Open Page</button>' +
    '<button class="btn" data-action="recheck">Re-check</button>' +
    '<button class="btn" data-action="view">View Report</button>' +
    '<button class="btn btn-danger" data-action="remove">Remove</button>' +
    '</div>';
  
  card.innerHTML = html;
  return card;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

async function loadWatchlist() {
  const stored = await chrome.storage.local.get(['mta_watchlist']);
  const watchlist = stored.mta_watchlist || [];
  
  watchlistEl.innerHTML = '';
  
  if (watchlist.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  
  emptyEl.hidden = true;
  
  const sorted = sortWatchlist(watchlist);
  sorted.forEach(function(item) {
    const card = createItemCard(item);
    watchlistEl.appendChild(card);
  });
}

// Add event listener for sort change
if (sortSelect) {
  sortSelect.addEventListener('change', loadWatchlist);
}

watchlistEl.addEventListener('click', async function(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  
  const card = btn.closest('.item');
  const id = card.dataset.id;
  const action = btn.dataset.action;
  
  const stored = await chrome.storage.local.get(['mta_watchlist']);
  const watchlist = stored.mta_watchlist || [];
  const item = watchlist.find(function(i) { return i.id === id; });
  
  if (!item) return;
  
  if (action === 'open') {
    chrome.tabs.create({ url: item.url });
  } else if (action === 'view') {
    if (item.lastResult) {
      const json = JSON.stringify(item.lastResult, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      chrome.tabs.create({ url: url });
    }
  } else if (action === 'remove') {
    const confirmed = await MTA_Confirm.delete('this site from watchlist');
    if (!confirmed) return;
    
    const newList = watchlist.filter(function(i) { return i.id !== id; });
    await chrome.storage.local.set({ mta_watchlist: newList });
    loadWatchlist();
    MTA_Toast.success('Site removed from watchlist');
  } else if (action === 'recheck') {
    btn.textContent = 'Checking...';
    btn.disabled = true;
    // Open the page and trigger analysis
    chrome.tabs.create({ url: item.url, active: true });
  }
});

loadWatchlist();
