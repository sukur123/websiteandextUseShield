// API Access Page - Pro+ tier API key management

const TIER_LIMITS = {
  free: 0,
  starter: 0,
  pro: 0,
  pro_plus: 200,
  agency: 300
};

const state = {
  tier: 'free',
  apiKeys: [],
  apiUsage: {
    today: 0,
    month: 0,
    avgResponseTime: 0
  },
  showKey: false
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  checkAccess();
  render();
  setupEventListeners();
});

async function loadData() {
  const result = await chrome.storage.local.get([
    'mta_tier',
    'mta_api_keys',
    'mta_api_usage'
  ]);
  
  state.tier = result.mta_tier || 'free';
  state.apiKeys = result.mta_api_keys || [];
  state.apiUsage = result.mta_api_usage || { today: 0, month: 0, avgResponseTime: 0 };
}

function checkAccess() {
  const upgradeRequired = document.getElementById('upgradeRequired');
  const apiContent = document.getElementById('apiContent');
  const tierBadge = document.getElementById('tierBadge');
  
  tierBadge.textContent = state.tier.replace('_', ' ').toUpperCase();
  
  const hasApiAccess = state.tier === 'pro_plus' || state.tier === 'agency';
  
  if (!hasApiAccess) {
    upgradeRequired.hidden = false;
    apiContent.style.display = 'none';
  }
}

function render() {
  if (state.tier !== 'pro_plus' && state.tier !== 'agency') return;
  
  renderApiKey();
  renderUsage();
  renderKeyList();
}

function renderApiKey() {
  const display = document.getElementById('apiKeyDisplay');
  const toggleBtn = document.getElementById('toggleKeyBtn');
  
  const activeKey = state.apiKeys.find(k => k.active);
  
  if (activeKey) {
    if (state.showKey) {
      display.textContent = activeKey.key;
      display.classList.remove('hidden');
      toggleBtn.textContent = 'Hide';
    } else {
      display.textContent = '••••••••••••••••••••••••••••••••';
      display.classList.add('hidden');
      toggleBtn.textContent = 'Show';
    }
  } else {
    display.textContent = 'No API key generated yet';
    display.classList.add('hidden');
  }
}

function renderUsage() {
  document.getElementById('apiCallsToday').textContent = state.apiUsage.today;
  document.getElementById('apiCallsMonth').textContent = state.apiUsage.month;
  document.getElementById('apiLimit').textContent = TIER_LIMITS[state.tier];
  document.getElementById('avgResponseTime').textContent = `${state.apiUsage.avgResponseTime || 0}ms`;
}

function renderKeyList() {
  const container = document.getElementById('keyList');
  
  if (state.apiKeys.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = `
    <h4 style="margin-top: 16px; margin-bottom: 12px; font-size: 14px;">Your API Keys</h4>
    ${state.apiKeys.map(key => `
      <div class="key-item">
        <div>
          <div class="key-name">${key.name || 'API Key'} ${key.active ? '✓ Active' : ''}</div>
          <div class="key-created">Created: ${new Date(key.createdAt).toLocaleDateString()}</div>
        </div>
        <div>
          ${!key.active ? `<button class="btn btn-sm" onclick="activateKey('${key.id}')">Activate</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="deleteKey('${key.id}')">Delete</button>
        </div>
      </div>
    `).join('')}
  `;
}

function setupEventListeners() {
  document.getElementById('backLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.close();
  });
  
  document.getElementById('toggleKeyBtn').addEventListener('click', () => {
    state.showKey = !state.showKey;
    renderApiKey();
  });
  
  document.getElementById('copyKeyBtn').addEventListener('click', async () => {
    const activeKey = state.apiKeys.find(k => k.active);
    if (!activeKey) {
      alert('No API key to copy. Generate one first.');
      return;
    }
    
    await navigator.clipboard.writeText(activeKey.key);
    
    const btn = document.getElementById('copyKeyBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  });
  
  document.getElementById('generateKeyBtn').addEventListener('click', async () => {
    const keyName = prompt('Give this API key a name (optional):', `Key ${state.apiKeys.length + 1}`);
    if (keyName === null) return;
    
    // Generate a random API key
    const newKey = {
      id: 'key_' + Date.now(),
      key: generateApiKey(),
      name: keyName || `Key ${state.apiKeys.length + 1}`,
      active: state.apiKeys.length === 0, // First key is active by default
      createdAt: Date.now()
    };
    
    state.apiKeys.push(newKey);
    await saveKeys();
    render();
    
    // Show the new key
    state.showKey = true;
    renderApiKey();
    
    alert('New API key generated! Make sure to copy it somewhere safe.');
  });
  
  document.getElementById('revokeKeyBtn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to revoke ALL API keys? This cannot be undone.')) return;
    
    state.apiKeys = [];
    await saveKeys();
    render();
    
    alert('All API keys have been revoked.');
  });
}

// Key management
window.activateKey = async function(keyId) {
  state.apiKeys.forEach(k => k.active = k.id === keyId);
  await saveKeys();
  render();
};

window.deleteKey = async function(keyId) {
  const key = state.apiKeys.find(k => k.id === keyId);
  if (!key) return;
  
  if (!confirm(`Delete API key "${key.name}"?`)) return;
  
  state.apiKeys = state.apiKeys.filter(k => k.id !== keyId);
  
  // If deleted key was active, activate first remaining key
  if (key.active && state.apiKeys.length > 0) {
    state.apiKeys[0].active = true;
  }
  
  await saveKeys();
  render();
};

// Helpers
function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'mta_';
  let key = prefix;
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

async function saveKeys() {
  await chrome.storage.local.set({ mta_api_keys: state.apiKeys });
}
