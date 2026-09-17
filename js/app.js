// Main Entry Point for Search with SEM
// Initializes the application and coordinates modules

import { initAnalytics } from './analytics.js';
import { initUI } from './ui.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize analytics
  initAnalytics();
  
  // Initialize UI
  await initUI();
  
  // Register service worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
      console.log('Service Worker registered');
    } catch (error) {
      console.warn('Service Worker registration failed:', error);
    }
  }
});

// Handle install prompt (for PWA)
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // Show install button or notification
  showInstallPrompt();
});

// Show install prompt
function showInstallPrompt() {
  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.style.display = 'block';
    installBtn.onclick = () => {
      // Hide the button
      installBtn.style.display = 'none';
      
      // Show the install prompt
      deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
        }
        deferredPrompt = null;
      });
    };
  }
}

// Check if app is installed
function checkInstalled() {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    // App is installed as PWA
    console.log('App is running as standalone PWA');
    return true;
  }
  return false;
}

// Export for use in other modules
export { checkInstalled };
