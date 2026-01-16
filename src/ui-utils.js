/**
 * Shared UI Utilities for Money Trap Analyzer Extension
 * Toast notifications, confirmation dialogs, and common UI patterns
 */

// ===== TOAST NOTIFICATION SYSTEM =====
const MTA_Toast = {
  container: null,
  
  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'mta-toast-container';
      this.container.setAttribute('role', 'alert');
      this.container.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.container);
    }
  },
  
  show(message, type = 'info', duration = 3000) {
    this.init();
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const toast = document.createElement('div');
    toast.className = 'mta-toast mta-toast-' + type;
    toast.innerHTML = `
      <span class="mta-toast-icon">${icons[type] || icons.info}</span>
      <span class="mta-toast-message">${message}</span>
      <button class="mta-toast-close" aria-label="Close notification">×</button>
    `;
    
    this.container.appendChild(toast);
    
    const closeBtn = toast.querySelector('.mta-toast-close');
    const removeToast = () => {
      toast.classList.add('mta-toast-removing');
      setTimeout(() => toast.remove(), 300);
    };
    
    closeBtn.addEventListener('click', removeToast);
    
    if (duration > 0) {
      setTimeout(removeToast, duration);
    }
    
    return toast;
  },
  
  success(message, duration) { return this.show(message, 'success', duration); },
  error(message, duration) { return this.show(message, 'error', duration); },
  warning(message, duration) { return this.show(message, 'warning', duration); },
  info(message, duration) { return this.show(message, 'info', duration); }
};

// ===== CONFIRMATION DIALOG =====
const MTA_Confirm = {
  show(options = {}) {
    return new Promise((resolve) => {
      const config = Object.assign({
        title: 'Confirm Action',
        message: 'Are you sure you want to continue?',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        type: 'warning' // 'warning', 'danger', 'info'
      }, options);
      
      const icons = {
        warning: '⚠️',
        danger: '🗑️',
        info: 'ℹ️'
      };
      
      const overlay = document.createElement('div');
      overlay.className = 'mta-confirm-overlay';
      overlay.innerHTML = `
        <div class="mta-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="mta-confirm-title">
          <div class="mta-confirm-icon" aria-hidden="true">${icons[config.type] || icons.warning}</div>
          <h3 class="mta-confirm-title" id="mta-confirm-title">${config.title}</h3>
          <p class="mta-confirm-message">${config.message}</p>
          <div class="mta-confirm-actions">
            <button class="mta-confirm-btn mta-confirm-cancel" type="button">${config.cancelText}</button>
            <button class="mta-confirm-btn mta-confirm-ok mta-confirm-${config.type}" type="button">${config.confirmText}</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('mta-visible'));
      
      const dialog = overlay.querySelector('.mta-confirm-dialog');
      const confirmBtn = overlay.querySelector('.mta-confirm-ok');
      const cancelBtn = overlay.querySelector('.mta-confirm-cancel');
      
      // Focus trap
      const focusable = dialog.querySelectorAll('button');
      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      
      const close = (result) => {
        overlay.classList.remove('mta-visible');
        setTimeout(() => overlay.remove(), 200);
        resolve(result);
      };
      
      confirmBtn.addEventListener('click', () => close(true));
      cancelBtn.addEventListener('click', () => close(false));
      
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
      });
      
      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          close(false);
          document.removeEventListener('keydown', keyHandler);
        }
        if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          } else if (!e.shiftKey && document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      };
      document.addEventListener('keydown', keyHandler);
      
      // Focus cancel button (safer default)
      cancelBtn.focus();
    });
  },
  
  delete(itemName = 'this item') {
    return this.show({
      title: 'Delete Item',
      message: `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
  },
  
  clearAll(itemType = 'items') {
    return this.show({
      title: 'Clear All',
      message: `Are you sure you want to clear all ${itemType}? This action cannot be undone.`,
      confirmText: 'Clear All',
      cancelText: 'Cancel',
      type: 'danger'
    });
  }
};

// ===== CSS STYLES (injected once) =====
const MTA_UIStyles = `
/* Toast Styles */
.mta-toast-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.mta-toast {
  background: #1a1a2e;
  color: white;
  padding: 14px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 30px rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
  animation: mtaToastIn 0.3s ease-out;
  max-width: 400px;
}

.mta-toast-success { background: #0f766e; }
.mta-toast-error { background: #b91c1c; }
.mta-toast-warning { background: #b45309; }
.mta-toast-info { background: #1e3a5f; }

.mta-toast-icon { font-size: 18px; flex-shrink: 0; }
.mta-toast-message { flex: 1; line-height: 1.4; }
.mta-toast-close {
  background: none;
  border: none;
  color: white;
  opacity: 0.7;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
}
.mta-toast-close:hover { opacity: 1; }

@keyframes mtaToastIn {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.mta-toast-removing {
  animation: mtaToastOut 0.3s ease-in forwards;
}

@keyframes mtaToastOut {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(20px); opacity: 0; }
}

/* Confirm Dialog Styles */
.mta-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100001;
  opacity: 0;
  transition: opacity 0.2s;
}

.mta-confirm-overlay.mta-visible { opacity: 1; }

.mta-confirm-dialog {
  background: white;
  border-radius: 16px;
  padding: 28px;
  max-width: 380px;
  width: 90%;
  text-align: center;
  transform: scale(0.9);
  transition: transform 0.2s;
  box-shadow: 0 25px 80px rgba(0,0,0,0.35);
}

.mta-confirm-overlay.mta-visible .mta-confirm-dialog {
  transform: scale(1);
}

.mta-confirm-icon {
  font-size: 52px;
  margin-bottom: 16px;
}

.mta-confirm-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 10px;
  color: #111;
}

.mta-confirm-message {
  font-size: 15px;
  color: #555;
  margin: 0 0 24px;
  line-height: 1.6;
}

.mta-confirm-actions {
  display: flex;
  gap: 12px;
}

.mta-confirm-btn {
  flex: 1;
  padding: 14px 20px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}

.mta-confirm-cancel {
  background: #f0f0f0;
  color: #333;
}

.mta-confirm-cancel:hover {
  background: #e0e0e0;
}

.mta-confirm-cancel:focus {
  outline: 2px solid #1e3a5f;
  outline-offset: 2px;
}

.mta-confirm-ok {
  background: #1e3a5f;
  color: white;
}

.mta-confirm-ok:hover {
  background: #152a45;
}

.mta-confirm-ok:focus {
  outline: 2px solid #1e3a5f;
  outline-offset: 2px;
}

.mta-confirm-danger {
  background: #b91c1c;
}

.mta-confirm-danger:hover {
  background: #991b1b;
}

.mta-confirm-warning {
  background: #b45309;
}

.mta-confirm-warning:hover {
  background: #92400e;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .mta-toast {
    background: #2d2d44;
  }
  
  .mta-confirm-dialog {
    background: #2d2d44;
  }
  
  .mta-confirm-title {
    color: #f0f0f0;
  }
  
  .mta-confirm-message {
    color: #b0b0b0;
  }
  
  .mta-confirm-cancel {
    background: #3d3d5c;
    color: #e0e0e0;
  }
  
  .mta-confirm-cancel:hover {
    background: #4d4d6c;
  }
}
`;

// Inject styles once
(function() {
  if (!document.getElementById('mta-ui-styles')) {
    const style = document.createElement('style');
    style.id = 'mta-ui-styles';
    style.textContent = MTA_UIStyles;
    document.head.appendChild(style);
  }
})();

// Export for use
if (typeof window !== 'undefined') {
  window.MTA_Toast = MTA_Toast;
  window.MTA_Confirm = MTA_Confirm;
}
