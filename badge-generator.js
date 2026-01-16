// Trust Badge Generator - White-label badge creation

const state = {
  tier: 'free',
  style: 'standard',
  companyName: 'Acme Inc',
  websiteUrl: 'https://example.com',
  bgColor: '#1e3a5f',
  textColor: '#ffffff',
  score: '2',
  customScore: '',
  whiteLabel: false
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  checkAccess();
  setupEventListeners();
  updatePreview();
});

async function loadData() {
  const result = await chrome.storage.local.get(['mta_tier']);
  state.tier = result.mta_tier || 'free';
}

function checkAccess() {
  const upgradeRequired = document.getElementById('upgradeRequired');
  const whitelabelOption = document.getElementById('whitelabelOption');
  
  // White-label only for pro_plus and agency
  const hasWhiteLabel = state.tier === 'pro_plus' || state.tier === 'agency';
  
  if (!hasWhiteLabel) {
    // Show upgrade banner but still allow basic badge creation
    upgradeRequired.hidden = false;
    whitelabelOption.style.opacity = '0.5';
    document.getElementById('whiteLabel').disabled = true;
  }
}

function setupEventListeners() {
  // Back link
  document.getElementById('backLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.close();
  });
  
  // Badge style selection
  document.querySelectorAll('.badge-style-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.badge-style-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      state.style = option.dataset.style;
      updatePreview();
    });
  });
  
  // Score options
  document.querySelectorAll('.score-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.score-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      
      const customInput = document.getElementById('customScore');
      if (option.dataset.score === 'custom') {
        customInput.style.display = 'block';
        state.score = state.customScore || '3';
      } else {
        customInput.style.display = 'none';
        state.score = option.dataset.score;
      }
      updatePreview();
    });
  });
  
  // Custom score input
  document.getElementById('customScore').addEventListener('input', (e) => {
    state.customScore = e.target.value;
    state.score = e.target.value.split('/')[0] || '3';
    updatePreview();
  });
  
  // Text inputs
  document.getElementById('companyName').addEventListener('input', (e) => {
    state.companyName = e.target.value;
    updatePreview();
  });
  
  document.getElementById('websiteUrl').addEventListener('input', (e) => {
    state.websiteUrl = e.target.value;
    updatePreview();
  });
  
  // Color inputs
  const bgColor = document.getElementById('bgColor');
  const bgColorText = document.getElementById('bgColorText');
  const textColor = document.getElementById('textColor');
  const textColorText = document.getElementById('textColorText');
  
  bgColor.addEventListener('input', (e) => {
    state.bgColor = e.target.value;
    bgColorText.value = e.target.value;
    updatePreview();
  });
  
  bgColorText.addEventListener('input', (e) => {
    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
      state.bgColor = e.target.value;
      bgColor.value = e.target.value;
      updatePreview();
    }
  });
  
  textColor.addEventListener('input', (e) => {
    state.textColor = e.target.value;
    textColorText.value = e.target.value;
    updatePreview();
  });
  
  textColorText.addEventListener('input', (e) => {
    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
      state.textColor = e.target.value;
      textColor.value = e.target.value;
      updatePreview();
    }
  });
  
  // White label toggle
  document.getElementById('whiteLabel').addEventListener('change', (e) => {
    state.whiteLabel = e.target.checked;
    updatePreview();
  });
  
  // Copy code button
  document.getElementById('copyCodeBtn').addEventListener('click', async () => {
    const code = document.getElementById('embedCode').textContent;
    await navigator.clipboard.writeText(code);
    
    const btn = document.getElementById('copyCodeBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy Code', 2000);
  });
}

function updatePreview() {
  const preview = document.getElementById('badgePreview');
  const embedCode = document.getElementById('embedCode');
  
  // Get score display
  const scoreDisplay = state.customScore || `${state.score}/10`;
  const scoreNum = parseInt(state.score);
  
  // Get icon based on style
  let icon = '🛡️';
  if (state.style === 'minimal') icon = '✓';
  if (state.style === 'detailed') icon = '📊';
  
  // Get subtitle
  let subtitle = state.whiteLabel ? state.companyName : 'Verified by Shield';
  if (state.style === 'detailed') {
    subtitle = state.whiteLabel ? `${state.companyName} - Low Risk` : 'Verified by Shield - Low Risk';
  }
  
  // Update preview
  preview.style.background = state.bgColor;
  preview.style.color = state.textColor;
  
  if (state.style === 'minimal') {
    preview.innerHTML = `
      <span class="badge-icon" style="font-size: 20px; font-weight: bold;">${icon}</span>
      <span class="badge-text">
        <span class="badge-title" style="font-size: 13px;">Risk: ${scoreDisplay}</span>
      </span>
    `;
  } else if (state.style === 'detailed') {
    const riskLevel = scoreNum <= 3 ? 'Low' : scoreNum <= 6 ? 'Medium' : 'High';
    preview.innerHTML = `
      <span class="badge-icon">${icon}</span>
      <span class="badge-text">
        <span class="badge-title">ToS Risk Score: ${scoreDisplay}</span>
        <span class="badge-subtitle">${subtitle}</span>
        <span class="badge-subtitle" style="display: block; margin-top: 2px; font-size: 10px;">Risk Level: ${riskLevel}</span>
      </span>
    `;
  } else {
    preview.innerHTML = `
      <span class="badge-icon">${icon}</span>
      <span class="badge-text">
        <span class="badge-title">ToS Risk Score: ${scoreDisplay}</span>
        <span class="badge-subtitle">${subtitle}</span>
      </span>
    `;
  }
  
  // Generate embed code
  const htmlCode = generateEmbedCode();
  embedCode.textContent = htmlCode;
}

function generateEmbedCode() {
  const scoreDisplay = state.customScore || `${state.score}/10`;
  const scoreNum = parseInt(state.score);
  
  let icon = '🛡️';
  if (state.style === 'minimal') icon = '✓';
  if (state.style === 'detailed') icon = '📊';
  
  let subtitle = state.whiteLabel ? escapeHtml(state.companyName) : 'Verified by Shield';
  
  // Build inline styles
  const containerStyle = `display:inline-flex;align-items:center;gap:10px;padding:12px 20px;border-radius:8px;background:${state.bgColor};color:${state.textColor};font-family:system-ui,-apple-system,sans-serif;text-decoration:none;`;
  
  if (state.style === 'minimal') {
    return `<!-- Shield Trust Badge -->
<a href="https://useshield.net/verify?url=${encodeURIComponent(state.websiteUrl)}" 
   target="_blank" 
   style="${containerStyle}">
  <span style="font-size:20px;font-weight:bold;">${icon}</span>
  <span style="font-size:13px;">Risk: ${scoreDisplay}</span>
</a>`;
  }
  
  if (state.style === 'detailed') {
    const riskLevel = scoreNum <= 3 ? 'Low' : scoreNum <= 6 ? 'Medium' : 'High';
    return `<!-- Shield Trust Badge -->
<a href="https://useshield.net/verify?url=${encodeURIComponent(state.websiteUrl)}" 
   target="_blank" 
   style="${containerStyle}">
  <span style="font-size:24px;">${icon}</span>
  <span style="text-align:left;">
    <span style="display:block;font-weight:600;font-size:14px;">ToS Risk Score: ${scoreDisplay}</span>
    <span style="display:block;font-size:11px;opacity:0.8;">${subtitle}</span>
    <span style="display:block;font-size:10px;opacity:0.7;margin-top:2px;">Risk Level: ${riskLevel}</span>
  </span>
</a>`;
  }
  
  // Standard style
  return `<!-- Shield Trust Badge -->
<a href="https://useshield.net/verify?url=${encodeURIComponent(state.websiteUrl)}" 
   target="_blank" 
   style="${containerStyle}">
  <span style="font-size:24px;">${icon}</span>
  <span style="text-align:left;">
    <span style="display:block;font-weight:600;font-size:14px;">ToS Risk Score: ${scoreDisplay}</span>
    <span style="display:block;font-size:11px;opacity:0.8;">${subtitle}</span>
  </span>
</a>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
