// History page JavaScript

const searchInput = document.getElementById('searchInput');
const riskFilter = document.getElementById('riskFilter');
const sortSelect = document.getElementById('sortSelect');
const historyList = document.getElementById('historyList');
const emptyState = document.getElementById('emptyState');
const clearAllBtn = document.getElementById('clearAllBtn');
const backLink = document.getElementById('backLink');

// Pagination elements
const paginationEl = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfoEl = document.getElementById('pageInfo');

const totalAnalysesEl = document.getElementById('totalAnalyses');
const avgRiskScoreEl = document.getElementById('avgRiskScore');
const highRiskCountEl = document.getElementById('highRiskCount');

let allHistory = [];
let searchDebounceTimer = null;
let currentPage = 1;
const ITEMS_PER_PAGE = 20;

/**
 * Load history from storage
 */
async function loadHistory() {
  const stored = await chrome.storage.local.get(['mta_analysis_history']);
  allHistory = stored.mta_analysis_history || [];
  
  currentPage = 1; // Reset to first page on load
  updateStats();
  renderHistory();
}

/**
 * Save history to storage
 */
async function saveHistory() {
  await chrome.storage.local.set({ mta_analysis_history: allHistory });
}

/**
 * Update statistics
 */
function updateStats() {
  totalAnalysesEl.textContent = allHistory.length;
  
  if (allHistory.length > 0) {
    const avgScore = Math.round(
      allHistory.reduce((sum, item) => sum + (item.riskScore || 0), 0) / allHistory.length
    );
    avgRiskScoreEl.textContent = avgScore;
    
    const highRisk = allHistory.filter(item => 
      item.riskLevel === 'high' || item.riskLevel === 'critical'
    ).length;
    highRiskCountEl.textContent = highRisk;
  } else {
    avgRiskScoreEl.textContent = '0';
    highRiskCountEl.textContent = '0';
  }
}

/**
 * Get domain from URL for sorting
 */
function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace('www.', '').toLowerCase();
  } catch {
    return url ? url.toLowerCase() : '';
  }
}

/**
 * Filter and sort history based on search, risk level, and sort order
 */
function getFilteredHistory() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const riskLevel = riskFilter.value;
  const sortOrder = sortSelect ? sortSelect.value : 'date-desc';
  
  let filtered = allHistory.filter(item => {
    // Search filter
    const matchesSearch = !searchTerm || 
      (item.url && item.url.toLowerCase().includes(searchTerm)) ||
      (item.title && item.title.toLowerCase().includes(searchTerm));
    
    // Risk level filter
    let matchesRisk = true;
    if (riskLevel === 'critical') {
      matchesRisk = item.riskLevel === 'critical';
    } else if (riskLevel === 'high') {
      matchesRisk = item.riskLevel === 'high' || item.riskLevel === 'critical';
    } else if (riskLevel === 'medium') {
      matchesRisk = item.riskLevel !== 'low';
    } else if (riskLevel === 'low') {
      matchesRisk = item.riskLevel === 'low';
    }
    
    return matchesSearch && matchesRisk;
  });
  
  // Apply sorting
  filtered.sort((a, b) => {
    switch (sortOrder) {
      case 'date-asc':
        return (a.analyzedAt || 0) - (b.analyzedAt || 0);
      case 'date-desc':
        return (b.analyzedAt || 0) - (a.analyzedAt || 0);
      case 'score-desc':
        return (b.riskScore || 0) - (a.riskScore || 0);
      case 'score-asc':
        return (a.riskScore || 0) - (b.riskScore || 0);
      case 'domain-asc':
        return getDomainFromUrl(a.url).localeCompare(getDomainFromUrl(b.url));
      case 'domain-desc':
        return getDomainFromUrl(b.url).localeCompare(getDomainFromUrl(a.url));
      default:
        return (b.analyzedAt || 0) - (a.analyzedAt || 0);
    }
  });
  
  return filtered;
}

/**
 * Format date for display
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 7) {
    return diffDays + ' days ago';
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Render history items with pagination
 */
function renderHistory() {
  const filtered = getFilteredHistory();
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  
  // Ensure current page is valid
  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);
  
  if (filtered.length === 0) {
    historyList.innerHTML = '';
    emptyState.hidden = false;
    paginationEl.hidden = true;
    
    if (allHistory.length > 0) {
      emptyState.querySelector('.empty-state-title').textContent = 'No Results';
      emptyState.querySelector('.empty-state-text').textContent = 'Try adjusting your search or filters.';
    } else {
      emptyState.querySelector('.empty-state-title').textContent = 'No Analysis History';
      emptyState.querySelector('.empty-state-text').textContent = 'Start analyzing pages to build your history.';
    }
    return;
  }
  
  emptyState.hidden = true;
  
  // Get items for current page
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pageItems = filtered.slice(startIndex, endIndex);
  
  historyList.innerHTML = pageItems.map((item, index) => `
    <div class="history-item" data-index="${allHistory.indexOf(item)}">
      <div class="risk-score ${item.riskLevel || 'medium'}">
        ${item.riskScore || '?'}
      </div>
      <div class="item-details">
        <div class="item-title">${escapeHtml(item.title || 'Untitled')}</div>
        <div class="item-url">${escapeHtml(item.url || '')}</div>
        <div class="item-meta">
          ${formatDate(item.analyzedAt)} • ${item.findings ? item.findings.length : 0} findings
        </div>
      </div>
      <div class="item-actions">
        <button class="item-btn view-btn" data-index="${allHistory.indexOf(item)}">View</button>
        <button class="item-btn delete" data-index="${allHistory.indexOf(item)}">Delete</button>
      </div>
    </div>
  `).join('');
  
  // Update pagination UI
  if (totalPages > 1) {
    paginationEl.hidden = false;
    pageInfoEl.textContent = `Page ${currentPage} of ${totalPages} (${filtered.length} items)`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  } else {
    paginationEl.hidden = true;
  }
  
  // Add event listeners
  historyList.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      viewAnalysis(parseInt(btn.dataset.index));
    });
  });
  
  historyList.querySelectorAll('.delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteAnalysis(parseInt(btn.dataset.index));
    });
  });
  
  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      viewAnalysis(parseInt(item.dataset.index));
    });
  });
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Quick View Modal elements
const quickViewModal = document.getElementById('quickViewModal');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const modalUrl = document.getElementById('modalUrl');
const modalScoreValue = document.getElementById('modalScoreValue');
const modalScoreLabel = document.getElementById('modalScoreLabel');
const modalDate = document.getElementById('modalDate');
const modalSummary = document.getElementById('modalSummary');
const modalFindingsList = document.getElementById('modalFindingsList');
const modalOpenPage = document.getElementById('modalOpenPage');
const modalReanalyze = document.getElementById('modalReanalyze');
const modalExport = document.getElementById('modalExport');

let currentViewItem = null;

/**
 * View a specific analysis in quick-view modal
 */
async function viewAnalysis(index) {
  const item = allHistory[index];
  if (!item) return;
  
  currentViewItem = item;
  
  // Populate modal
  modalTitle.textContent = item.title || 'Untitled';
  modalUrl.textContent = item.url || '';
  modalScoreValue.textContent = item.riskScore || '?';
  modalScoreValue.className = 'modal-score-value ' + (item.riskLevel || 'medium');
  modalScoreLabel.textContent = (item.riskLevel || 'unknown') + ' risk';
  modalDate.textContent = 'Analyzed: ' + formatDate(item.analyzedAt);
  modalSummary.textContent = item.summary || 'No summary available.';
  
  // Render findings
  const findings = item.findings || [];
  if (findings.length > 0) {
    modalFindingsList.innerHTML = findings.slice(0, 5).map(f => `
      <div class="modal-finding ${f.severity || 'medium'}">
        <div class="modal-finding-title">${escapeHtml(f.title || 'Finding')}</div>
        <div class="modal-finding-summary">${escapeHtml(f.summary || '')}</div>
      </div>
    `).join('');
    if (findings.length > 5) {
      modalFindingsList.innerHTML += `<p style="font-size:12px;color:#666;text-align:center;">+ ${findings.length - 5} more findings</p>`;
    }
  } else {
    modalFindingsList.innerHTML = '<p style="font-size:12px;color:#888;">No findings recorded.</p>';
  }
  
  // Show modal
  quickViewModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Close quick-view modal
 */
function closeModal() {
  quickViewModal.classList.remove('active');
  document.body.style.overflow = '';
  currentViewItem = null;
}

// Modal event listeners
if (modalClose) {
  modalClose.addEventListener('click', closeModal);
}
if (quickViewModal) {
  quickViewModal.addEventListener('click', function(e) {
    if (e.target === quickViewModal) closeModal();
  });
}
if (modalOpenPage) {
  modalOpenPage.addEventListener('click', function() {
    if (currentViewItem && currentViewItem.url) {
      chrome.tabs.create({ url: currentViewItem.url });
    }
  });
}
if (modalReanalyze) {
  modalReanalyze.addEventListener('click', function() {
    if (currentViewItem && currentViewItem.url) {
      closeModal();
      chrome.tabs.create({ url: currentViewItem.url, active: true });
    }
  });
}
if (modalExport) {
  modalExport.addEventListener('click', function() {
    if (currentViewItem) {
      const json = JSON.stringify(currentViewItem, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'analysis-' + (currentViewItem.url ? new URL(currentViewItem.url).hostname : 'report') + '.json';
      a.click();
      URL.revokeObjectURL(url);
      MTA_Toast.success('Report exported');
    }
  });
}
// Close on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && quickViewModal && quickViewModal.classList.contains('active')) {
    closeModal();
  }
});

/**
 * Delete a specific analysis
 */
async function deleteAnalysis(index) {
  const confirmed = await MTA_Confirm.delete('this analysis');
  if (!confirmed) return;
  
  allHistory.splice(index, 1);
  await saveHistory();
  updateStats();
  renderHistory();
  MTA_Toast.success('Analysis deleted');
}

/**
 * Clear all history
 */
async function clearAllHistory() {
  const confirmed = await MTA_Confirm.clearAll('analysis history');
  if (!confirmed) return;
  
  allHistory = [];
  await saveHistory();
  updateStats();
  renderHistory();
  MTA_Toast.success('History cleared');
}

// Event listeners with debounce for search
searchInput.addEventListener('input', function() {
  // Debounce search input (300ms)
  clearTimeout(searchDebounceTimer);
  currentPage = 1; // Reset to first page on search
  searchDebounceTimer = setTimeout(renderHistory, 300);
});
riskFilter.addEventListener('change', function() {
  currentPage = 1; // Reset to first page on filter
  renderHistory();
});
if (sortSelect) {
  sortSelect.addEventListener('change', function() {
    currentPage = 1; // Reset to first page on sort
    renderHistory();
  });
}
clearAllBtn.addEventListener('click', clearAllHistory);

// Pagination event listeners
if (prevPageBtn) {
  prevPageBtn.addEventListener('click', function() {
    if (currentPage > 1) {
      currentPage--;
      renderHistory();
      historyList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}
if (nextPageBtn) {
  nextPageBtn.addEventListener('click', function() {
    const filtered = getFilteredHistory();
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
      currentPage++;
      renderHistory();
      historyList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

backLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.close();
});

// Initialize
loadHistory();
