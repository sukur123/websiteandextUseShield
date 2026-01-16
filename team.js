// Team Dashboard - Agency tier team management

const TIER_LIMITS = {
  free: 3,
  starter: 15,
  pro: 80,
  pro_plus: 200,
  agency: 300
};

const state = {
  tier: 'free',
  members: [],
  activity: []
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
    'mta_team_members',
    'mta_team_activity',
    'mta_usage'
  ]);
  
  state.tier = result.mta_tier || 'free';
  state.members = result.mta_team_members || [];
  state.activity = result.mta_team_activity || [];
  state.usage = result.mta_usage || { count: 0, resetDate: null };
  
  // Add owner if no members exist
  if (state.members.length === 0 && state.tier === 'agency') {
    state.members = [{
      id: 'owner',
      name: 'You (Owner)',
      email: 'owner@team.com',
      role: 'admin',
      scansUsed: state.usage.count || 0,
      status: 'active',
      joinedAt: Date.now()
    }];
    await saveMembers();
  }
}

function checkAccess() {
  const upgradeRequired = document.getElementById('upgradeRequired');
  const teamContent = document.getElementById('teamContent');
  const tierBadge = document.getElementById('tierBadge');
  
  tierBadge.textContent = state.tier.replace('_', ' ').toUpperCase();
  
  if (state.tier !== 'agency') {
    upgradeRequired.hidden = false;
    teamContent.style.display = 'none';
  }
}

function render() {
  if (state.tier !== 'agency') return;
  
  renderStats();
  renderMembers();
  renderActivity();
}

function renderStats() {
  const totalScans = state.members.reduce((sum, m) => sum + (m.scansUsed || 0), 0);
  const limit = TIER_LIMITS[state.tier];
  const activeThisWeek = state.members.filter(m => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return m.lastActive && m.lastActive > weekAgo;
  }).length;
  
  document.getElementById('memberCount').textContent = state.members.length;
  document.getElementById('totalScans').textContent = totalScans;
  document.getElementById('scansRemaining').textContent = Math.max(0, limit - totalScans);
  document.getElementById('activeMembers').textContent = activeThisWeek || state.members.filter(m => m.status === 'active').length;
}

function renderMembers() {
  const tbody = document.getElementById('membersList');
  const emptyState = document.getElementById('emptyMembers');
  
  if (state.members.length === 0) {
    tbody.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  
  emptyState.hidden = true;
  
  tbody.innerHTML = state.members.map(member => `
    <tr data-id="${member.id}">
      <td>
        <div class="member-info">
          <div class="member-avatar">${getInitials(member.name)}</div>
          <div>
            <div class="member-name">${escapeHtml(member.name)}</div>
            <div class="member-email">${escapeHtml(member.email)}</div>
          </div>
        </div>
      </td>
      <td><span class="role-badge role-${member.role}">${capitalize(member.role)}</span></td>
      <td>${member.scansUsed || 0}</td>
      <td class="status-${member.status}">${capitalize(member.status)}</td>
      <td>
        ${member.id !== 'owner' ? `
          <button class="btn btn-sm" onclick="editMember('${member.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="removeMember('${member.id}')">Remove</button>
        ` : '<span style="color: #888; font-size: 12px;">Owner</span>'}
      </td>
    </tr>
  `).join('');
}

function renderActivity() {
  const container = document.getElementById('activityList');
  const emptyState = document.getElementById('emptyActivity');
  
  // Generate sample activity if none exists
  if (state.activity.length === 0) {
    state.activity = generateSampleActivity();
  }
  
  if (state.activity.length === 0) {
    container.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  
  emptyState.hidden = true;
  
  container.innerHTML = state.activity.slice(0, 20).map(item => `
    <div class="activity-item">
      <div class="activity-icon">${getActivityIcon(item.type)}</div>
      <div class="activity-content">
        <div class="activity-text">${escapeHtml(item.text)}</div>
        <div class="activity-time">${formatTimeAgo(item.timestamp)}</div>
      </div>
    </div>
  `).join('');
}

function generateSampleActivity() {
  const activities = [];
  const owner = state.members.find(m => m.id === 'owner');
  
  if (owner && owner.scansUsed > 0) {
    activities.push({
      type: 'scan',
      text: `${owner.name} performed ${owner.scansUsed} scan(s)`,
      timestamp: Date.now() - 3600000
    });
  }
  
  return activities;
}

function setupEventListeners() {
  const inviteBtn = document.getElementById('inviteBtn');
  const inviteForm = document.getElementById('inviteForm');
  const sendInviteBtn = document.getElementById('sendInviteBtn');
  const cancelInviteBtn = document.getElementById('cancelInviteBtn');
  const backLink = document.getElementById('backLink');
  
  backLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.close();
  });
  
  inviteBtn.addEventListener('click', () => {
    inviteForm.hidden = false;
    inviteBtn.hidden = true;
  });
  
  cancelInviteBtn.addEventListener('click', () => {
    inviteForm.hidden = true;
    inviteBtn.hidden = false;
    document.getElementById('inviteEmail').value = '';
  });
  
  sendInviteBtn.addEventListener('click', async () => {
    const email = document.getElementById('inviteEmail').value.trim();
    const role = document.getElementById('inviteRole').value;
    
    if (!email || !validateEmail(email)) {
      alert('Please enter a valid email address');
      return;
    }
    
    // Check if already invited
    if (state.members.some(m => m.email.toLowerCase() === email.toLowerCase())) {
      alert('This email is already on your team');
      return;
    }
    
    // Add member
    const newMember = {
      id: 'member_' + Date.now(),
      name: email.split('@')[0],
      email: email,
      role: role,
      scansUsed: 0,
      status: 'pending',
      joinedAt: Date.now()
    };
    
    state.members.push(newMember);
    await saveMembers();
    
    // Log activity
    await logActivity('invite', `Invited ${email} as ${role}`);
    
    // Reset form
    inviteForm.hidden = true;
    inviteBtn.hidden = false;
    document.getElementById('inviteEmail').value = '';
    
    render();
    
    alert(`Invitation sent to ${email}!\n\n(In production, this would send an email with an invite link)`);
  });
}

// Member actions
window.editMember = async function(memberId) {
  const member = state.members.find(m => m.id === memberId);
  if (!member) return;
  
  const newRole = prompt('Change role to (admin/member/viewer):', member.role);
  if (!newRole || !['admin', 'member', 'viewer'].includes(newRole)) return;
  
  member.role = newRole;
  await saveMembers();
  await logActivity('role_change', `Changed ${member.name}'s role to ${newRole}`);
  render();
};

window.removeMember = async function(memberId) {
  const member = state.members.find(m => m.id === memberId);
  if (!member) return;
  
  if (!confirm(`Remove ${member.name} from the team?`)) return;
  
  state.members = state.members.filter(m => m.id !== memberId);
  await saveMembers();
  await logActivity('remove', `Removed ${member.name} from team`);
  render();
};

// Helpers
async function saveMembers() {
  await chrome.storage.local.set({ mta_team_members: state.members });
}

async function logActivity(type, text) {
  state.activity.unshift({
    type,
    text,
    timestamp: Date.now()
  });
  
  // Keep only last 100 activities
  state.activity = state.activity.slice(0, 100);
  await chrome.storage.local.set({ mta_team_activity: state.activity });
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getActivityIcon(type) {
  const icons = {
    scan: '🔍',
    invite: '✉️',
    role_change: '🔄',
    remove: '❌',
    join: '👋'
  };
  return icons[type] || '📋';
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(timestamp).toLocaleDateString();
}
