/**
 * Onboarding Flow - UseShield
 * External JavaScript file for CSP compliance (Manifest V3)
 */

let currentSlide = 1;
const totalSlides = 5;

function showSlide(n) {
  document.querySelectorAll('.slide').forEach(function (slide) {
    slide.classList.remove('active');
  });
  document.getElementById('slide' + n).classList.add('active');

  // Update dots
  document.querySelectorAll('.dot').forEach(function (dot, index) {
    dot.classList.remove('active', 'completed');
    if (index + 1 === n) {
      dot.classList.add('active');
    } else if (index + 1 < n) {
      dot.classList.add('completed');
    }
  });

  currentSlide = n;
}

function nextSlide() {
  if (currentSlide < totalSlides) {
    showSlide(currentSlide + 1);
  }
}

function prevSlide() {
  if (currentSlide > 1) {
    showSlide(currentSlide - 1);
  }
}

function toggleOption(el) {
  el.classList.toggle('selected');
  const checkbox = el.querySelector('input');
  checkbox.checked = !checkbox.checked;
}

function openSignup() {
  // Open registration page and move to next slide
  chrome.tabs.create({ url: 'register.html' });
  nextSlide();
}

async function savePreferences() {
  const autoScan = document.getElementById('optAutoScan').checked;
  const redactPII = document.getElementById('optRedactPII').checked;
  const alerts = document.getElementById('optAlerts').checked;

  await chrome.storage.local.set({
    mta_autoScan: autoScan,
    mta_redactPII: redactPII,
    mta_watchlistAlerts: alerts
  });

  nextSlide();
}

async function completeOnboarding() {
  await chrome.storage.local.set({
    mta_onboarding_completed: true,
    mta_onboarding_completed_at: Date.now()
  });
  window.close();
}

async function skipOnboarding() {
  await chrome.storage.local.set({
    mta_onboarding_skipped: true,
    mta_onboarding_completed: true
  });
  window.close();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Slide 1 buttons
  const getStartedBtn = document.getElementById('getStartedBtn');
  const skipSetupLink = document.getElementById('skipSetupLink');
  
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', nextSlide);
  }
  if (skipSetupLink) {
    skipSetupLink.addEventListener('click', function(e) {
      e.preventDefault();
      skipOnboarding();
    });
  }

  // Slide 2 buttons
  const backBtn2 = document.getElementById('backBtn2');
  const createAccountBtn = document.getElementById('createAccountBtn');
  const signupLaterLink = document.getElementById('signupLaterLink');
  
  if (backBtn2) {
    backBtn2.addEventListener('click', prevSlide);
  }
  if (createAccountBtn) {
    createAccountBtn.addEventListener('click', openSignup);
  }
  if (signupLaterLink) {
    signupLaterLink.addEventListener('click', function(e) {
      e.preventDefault();
      nextSlide();
    });
  }

  // Slide 3 buttons
  const backBtn3 = document.getElementById('backBtn3');
  const continueBtn3 = document.getElementById('continueBtn3');
  
  if (backBtn3) {
    backBtn3.addEventListener('click', prevSlide);
  }
  if (continueBtn3) {
    continueBtn3.addEventListener('click', savePreferences);
  }

  // Checkbox options
  document.querySelectorAll('.checkbox-option').forEach(function(option) {
    option.addEventListener('click', function() {
      toggleOption(this);
    });
  });

  // Slide 4 buttons
  const backBtn4 = document.getElementById('backBtn4');
  const almostDoneBtn = document.getElementById('almostDoneBtn');
  
  if (backBtn4) {
    backBtn4.addEventListener('click', prevSlide);
  }
  if (almostDoneBtn) {
    almostDoneBtn.addEventListener('click', nextSlide);
  }

  // Slide 5 buttons
  const startAnalyzingBtn = document.getElementById('startAnalyzingBtn');
  
  if (startAnalyzingBtn) {
    startAnalyzingBtn.addEventListener('click', completeOnboarding);
  }

  // Check if already completed (for debugging)
  chrome.storage.local.get(['mta_onboarding_completed']).then(function (stored) {
    // Onboarding state is checked but no action needed
    console.log('[Onboarding] Completed status:', stored.mta_onboarding_completed);
  });
});
