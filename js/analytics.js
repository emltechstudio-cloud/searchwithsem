// Analytics Engine for Search with SEM
// Privacy-first telemetry with offline support

import { ANALYTICS_ENDPOINTS, VISITOR_ID_KEY, EVENT_QUEUE_KEY, USER_AGENT } from './config.js';

// Generate anonymous visitor ID using SHA-256 hash
async function generateVisitorId() {
  try {
    // Use a combination of user agent and timestamp for uniqueness
    const identifier = `${navigator.userAgent}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(identifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32); // Use first 32 chars for visitor ID
  } catch (error) {
    console.warn('Failed to generate SHA-256 hash, using fallback:', error);
    // Fallback: use crypto.randomUUID if available
    return crypto.randomUUID?.() || `v-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }
}

// Initialize visitor ID
let visitorIdPromise = null;

async function getVisitorId() {
  if (!visitorIdPromise) {
    visitorIdPromise = (async () => {
      let visitorId = localStorage.getItem(VISITOR_ID_KEY);
      if (!visitorId) {
        visitorId = await generateVisitorId();
        localStorage.setItem(VISITOR_ID_KEY, visitorId);
      }
      return visitorId;
    })();
  }
  return visitorIdPromise;
}

// Get country code from IP (placeholder - in production this would be done server-side)
async function getCountryCode() {
  // For now, return a default or try to detect from browser locale
  try {
    // Try to get from navigator.language (e.g., 'en-NG' -> 'NG')
    const lang = navigator.language || '';
    const countryMatch = lang.match(/-([A-Z]{2})/);
    if (countryMatch) {
      return countryMatch[1];
    }
    // Default to NG for Nigeria
    return 'NG';
  } catch {
    return 'NG';
  }
}

// Event types
export const EVENT_TYPES = {
  SEM_OPEN: 'sem_open',
  SEM_SEARCH: 'sem_search',
  SEM_SAVE: 'sem_save',
  SEM_SHARE: 'sem_share',
  SEM_READER: 'sem_reader'
};

// Queue for offline events
function getEventQueue() {
  try {
    const queue = localStorage.getItem(EVENT_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch {
    return [];
  }
}

function saveEventQueue(queue) {
  try {
    localStorage.setItem(EVENT_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to save event queue:', error);
  }
}

// Log an event
export async function logEvent(eventType, metadata = {}) {
  try {
    const visitorId = await getVisitorId();
    const countryCode = await getCountryCode();
    
    const payload = {
      event_type: eventType,
      visitor: visitorId,
      country_code: countryCode,
      ...metadata
    };

    // Try to send immediately
    try {
      await fetch(ANALYTICS_ENDPOINTS.logEvent, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT
        },
        body: JSON.stringify(payload),
        keepalive: true // Ensure delivery even if tab closes
      });
      return true;
    } catch (error) {
      console.warn('Failed to send event, queueing for later:', error);
      // Queue for later
      const queue = getEventQueue();
      queue.push(payload);
      saveEventQueue(queue);
      return false;
    }
  } catch (error) {
    console.error('Failed to log event:', error);
    return false;
  }
}

// Sync queued events when online
async function syncEvents() {
  const queue = getEventQueue();
  if (queue.length === 0) return;

  try {
    // Send all queued events
    await Promise.all(
      queue.map(payload =>
        fetch(ANALYTICS_ENDPOINTS.logEvent, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': USER_AGENT
          },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {}) // Don't fail the whole batch for one error
      )
    );
    
    // Clear queue on success
    saveEventQueue([]);
    console.log(`Synced ${queue.length} queued events`);
  } catch (error) {
    console.warn('Failed to sync events:', error);
  }
}

// Setup online/offline listeners
export function initAnalytics() {
  // Sync when coming online
  window.addEventListener('online', syncEvents);
  
  // Periodically sync (every 5 minutes)
  setInterval(syncEvents, 5 * 60 * 1000);
  
  // Sync on page load if online
  if (navigator.onLine) {
    setTimeout(syncEvents, 2000);
  }
}

// Check backend health
export async function checkHealth() {
  try {
    const response = await fetch(ANALYTICS_ENDPOINTS.health, {
      headers: { 'User-Agent': USER_AGENT }
    });
    return response.ok;
  } catch {
    return false;
  }
}
