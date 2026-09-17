// Service Worker for Search with SEM
// Enhanced caching and offline support

const CACHE = 'sem-v3';

// Static assets to cache
const STATIC = [
  './app.html',
  './index.html',
  './install.html',
  './manifest.json',
  './icon.svg',
  './apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-brands-400.woff2'
];

// API endpoints to cache with network-first strategy
const API_PATTERNS = [
  'wikipedia.org',
  'wikimedia.org',
  'api.duckduckgo.com'
];

// Install: Cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).catch(() => {})
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Handle requests with different strategies
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Wikipedia and DuckDuckGo APIs: network first, cache fallback
  if (API_PATTERNS.some(pattern => url.includes(pattern))) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Clone and cache successful responses
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => {
          // Return cached response if available
          return caches.match(e.request);
        })
    );
    return;
  }

  // Static assets: cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Return cached if available
      if (cached) {
        return cached;
      }
      // Otherwise fetch from network and cache
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// Periodically clean up old cache entries
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'CLEANUP_CACHE') {
    const cache = await caches.open(CACHE);
    const keys = await cache.keys();
    
    // Keep only the most recent entries (limit to 100)
    if (keys.length > 100) {
      const keysToDelete = keys.slice(0, keys.length - 100);
      await Promise.all(keysToDelete.map(key => cache.delete(key)));
    }
  }
});
