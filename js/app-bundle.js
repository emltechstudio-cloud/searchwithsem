// Search with SEM - Bundled Version
// This file combines all modules into one for file:// protocol compatibility

// ============================================
// Configuration
// ============================================
const API_BASE = "https://emltechstudio-eml-core-api.hf.space";
const WIKI_API = "https://en.wikipedia.org/api/rest_v1";
const DDG_API = "https://api.duckduckgo.com";
const AUTO_SAVE_KEY = "sem-auto-save";
const THEME_KEY = "sem-theme";
const VISITOR_ID_KEY = "sem-visitor-id";
const EVENT_QUEUE_KEY = "sem-event-queue";
const APP_VERSION = "2.0.0";
const USER_AGENT = `SearchWithSEM/${APP_VERSION}`;

const WIKI_ENDPOINTS = {
  summary: (title) => `${WIKI_API}/page/summary/${encodeURIComponent(title)}`,
  mediaList: (title) => `${WIKI_API}/page/media-list/${encodeURIComponent(title)}`,
  related: (title) => `${WIKI_API}/page/related/${encodeURIComponent(title)}`,
  trending: () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${WIKI_API}/feed/featured/${y}/${m}/${d}`;
  },
  fullArticle: (title) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`
};

const DDG_ENDPOINTS = {
  instantAnswer: (query) => `${DDG_API}/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`
};

const ANALYTICS_ENDPOINTS = {
  logEvent: `${API_BASE}/sem/event`,
  health: `${API_BASE}/sem/health`
};

// ============================================
// Analytics Engine
// ============================================
const EVENT_TYPES = {
  SEM_OPEN: 'sem_open',
  SEM_SEARCH: 'sem_search',
  SEM_SAVE: 'sem_save',
  SEM_SHARE: 'sem_share',
  SEM_READER: 'sem_reader'
};

// Generate anonymous visitor ID
async function generateVisitorId() {
  try {
    const identifier = `${navigator.userAgent}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(identifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32);
  } catch (error) {
    return crypto.randomUUID?.() || `v-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }
}

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

async function getCountryCode() {
  try {
    const lang = navigator.language || '';
    const countryMatch = lang.match(/-([A-Z]{2})/);
    if (countryMatch) return countryMatch[1];
    return 'NG';
  } catch {
    return 'NG';
  }
}

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

async function logEvent(eventType, metadata = {}) {
  try {
    const visitorId = await getVisitorId();
    const countryCode = await getCountryCode();
    const payload = { event_type: eventType, visitor: visitorId, country_code: countryCode, ...metadata };
    
    try {
      await fetch(ANALYTICS_ENDPOINTS.logEvent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
        body: JSON.stringify(payload),
        keepalive: true
      });
      return true;
    } catch (error) {
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

async function syncEvents() {
  const queue = getEventQueue();
  if (queue.length === 0) return;
  try {
    await Promise.all(queue.map(payload =>
      fetch(ANALYTICS_ENDPOINTS.logEvent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {})
    ));
    saveEventQueue([]);
  } catch (error) {
    console.warn('Failed to sync events:', error);
  }
}

function initAnalytics() {
  window.addEventListener('online', syncEvents);
  setInterval(syncEvents, 5 * 60 * 1000);
  if (navigator.onLine) setTimeout(syncEvents, 2000);
}

// ============================================
// Store Module
// ============================================
const DB_NAME = 'SearchWithSEM';
const TOPICS_STORE = 'topics';
const SETTINGS_STORE = 'settings';
let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 2);
      request.onerror = reject;
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(TOPICS_STORE)) {
          const store = db.createObjectStore(TOPICS_STORE, { keyPath: 'id' });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('savedAt', 'savedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      };
    });
  }
  return dbPromise;
}

async function saveTopic(topic) {
  const db = await getDB();
  const now = new Date().toISOString();
  const topicToSave = {
    id: topic.id || crypto.randomUUID(),
    title: topic.title,
    summary: topic.summary || '',
    coverImage: topic.coverImage || '',
    url: topic.url || '',
    tags: topic.tags || [],
    note: topic.note || '',
    savedAt: now,
    lastRead: now,
    isAutoSaved: topic.isAutoSaved || false
  };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(TOPICS_STORE, 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = reject;
    tx.objectStore(TOPICS_STORE).put(topicToSave);
  });
  return topicToSave;
}

async function getTopics(query = '', tag = null) {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(TOPICS_STORE, 'readonly');
    const store = tx.objectStore(TOPICS_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      let topics = request.result.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      if (query) {
        const queryLower = query.toLowerCase();
        topics = topics.filter(t => 
          t.title.toLowerCase().includes(queryLower) ||
          t.note.toLowerCase().includes(queryLower) ||
          t.summary.toLowerCase().includes(queryLower)
        );
      }
      if (tag) {
        topics = topics.filter(t => t.tags.includes(tag));
      }
      resolve(topics);
    };
    request.onerror = () => resolve([]);
  });
}

async function deleteTopic(id) {
  const db = await getDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(TOPICS_STORE, 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = reject;
    tx.objectStore(TOPICS_STORE).delete(id);
  });
}

async function isTopicSaved(title) {
  const topics = await getTopics();
  return topics.some(t => t.title === title);
}

async function getSetting(key, defaultValue = null) {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const request = tx.objectStore(SETTINGS_STORE).get(key);
    request.onsuccess = () => resolve(request.result ? request.result.value : defaultValue);
    request.onerror = () => resolve(defaultValue);
  });
}

async function setSetting(key, value) {
  const db = await getDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = reject;
    tx.objectStore(SETTINGS_STORE).put({ key, value });
  });
}

function getCache(key) {
  try {
    const data = localStorage.getItem(`sem-cache-${key}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function setCache(key, value, ttl) {
  try {
    const data = { value, timestamp: Date.now() };
    if (ttl) data.expires = Date.now() + ttl;
    localStorage.setItem(`sem-cache-${key}`, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to set cache:', error);
  }
}

function addToHistory(query) {
  try {
    const history = JSON.parse(localStorage.getItem('sem-history') || '[]');
    const index = history.findIndex(h => h.query === query);
    if (index > -1) history.splice(index, 1);
    history.unshift({ query, timestamp: Date.now() });
    if (history.length > 50) history.length = 50;
    localStorage.setItem('sem-history', JSON.stringify(history));
  } catch (error) {
    console.error('Failed to add to history:', error);
  }
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('sem-history') || '[]');
  } catch {
    return [];
  }
}

function clearHistory() {
  try {
    localStorage.removeItem('sem-history');
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
}

// ============================================
// Wikipedia API Service
// ============================================
const CACHE_TTL = 60 * 60 * 1000;

async function searchWikipedia(query) {
  const cacheKey = `wiki-summary-${query}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  
  try {
    const response = await fetch(WIKI_ENDPOINTS.summary(query), { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) throw new Error(`Wikipedia API error: ${response.status}`);
    const data = await response.json();
    if (data.type && data.type.includes('not_found')) throw new Error('Topic not found');
    setCache(cacheKey, data, CACHE_TTL);
    return data;
  } catch (error) {
    console.error('Failed to fetch Wikipedia summary:', error);
    throw error;
  }
}

function processMediaList(data) {
  return (data.items || [])
    .filter(item => {
      if (item.type !== 'image') return false;
      const title = (item.title || '').toLowerCase();
      return !title.includes('icon') && !title.includes('commons-logo') && 
             !title.includes('wikimedia') && (item.srcset || []).length > 0;
    })
    .map(item => {
      const srcset = item.srcset || [];
      const best = srcset[srcset.length - 1]?.src || srcset[0]?.src;
      if (!best) return null;
      return {
        src: best.startsWith('//') ? 'https:' + best : best,
        title: item.caption?.text || (item.title || '').replace('File:', '').replace(/_/g, ' ').split('.')[0]
      };
    })
    .filter(Boolean);
}

function processSearchImages(data) {
  return Object.values(data.query?.pages || {})
    .filter(page => page.thumbnail)
    .map(page => ({ src: page.thumbnail.source, title: page.title }));
}

async function getImages(title) {
  const cacheKey = `wiki-images-${title}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  
  try {
    const response = await fetch(WIKI_ENDPOINTS.mediaList(title), { headers: { 'User-Agent': USER_AGENT } });
    if (response.ok) {
      const data = await response.json();
      const images = processMediaList(data);
      if (images.length > 0) {
        setCache(cacheKey, images, CACHE_TTL);
        return images;
      }
    }
    
    const searchResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?origin=*&action=query&generator=search&gsrsearch=${encodeURIComponent(title)}&gsrlimit=16&prop=pageimages&pithumbsize=800&format=json`,
      { headers: { 'User-Agent': USER_AGENT } }
    );
    const searchData = await searchResponse.json();
    const images = processSearchImages(searchData);
    setCache(cacheKey, images, CACHE_TTL);
    return images;
  } catch (error) {
    console.error('Failed to fetch Wikipedia images:', error);
    return [];
  }
}

async function getRelatedTopics(title) {
  const cacheKey = `wiki-related-${title}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  
  try {
    const response = await fetch(WIKI_ENDPOINTS.related(title), { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return [];
    const data = await response.json();
    const related = (data.pages || []).slice(0, 10).map(page => ({
      title: page.titles?.normalized || page.title,
      description: page.description || '',
      url: page.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
    }));
    setCache(cacheKey, related, CACHE_TTL);
    return related;
  } catch (error) {
    console.error('Failed to fetch related topics:', error);
    return [];
  }
}

async function getFullArticle(title) {
  const cacheKey = `wiki-full-${title}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  
  try {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (!response.ok) {
      const mobileResponse = await fetch(`https://en.m.wikipedia.org/wiki/${encodeURIComponent(title)}?printable=yes`, {
        headers: { 'User-Agent': USER_AGENT }
      });
      if (mobileResponse.ok) {
        const html = await mobileResponse.text();
        setCache(cacheKey, html, CACHE_TTL);
        return html;
      }
      throw new Error('Failed to fetch article');
    }
    const html = await response.text();
    setCache(cacheKey, html, CACHE_TTL);
    return html;
  } catch (error) {
    console.error('Failed to fetch full article:', error);
    return `<p>Unable to load the full article. Please check your internet connection.</p>`;
  }
}

async function getTrendingTopics() {
  const cacheKey = 'wiki-trending';
  const cached = getCache(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 15 * 60 * 1000)) {
    return cached.value;
  }
  
  try {
    const response = await fetch(WIKI_ENDPOINTS.trending(), { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return fallbackTrending();
    const data = await response.json();
    const topics = (data.mostread?.articles || [])
      .filter(a => !a.title.includes(':'))
      .slice(0, 10)
      .map(a => a.titles?.normalized || a.title.replace(/_/g, ' '));
    if (topics.length > 0) {
      setCache(cacheKey, topics, 15 * 60 * 1000);
      return topics;
    }
    return fallbackTrending();
  } catch (error) {
    console.error('Failed to fetch trending topics:', error);
    return fallbackTrending();
  }
}

function fallbackTrending() {
  return ['Artificial Intelligence', 'Climate Change', 'Quantum Physics', 'Solar System', 'DNA', 'Ancient Rome'];
}

async function getCoverImage(title) {
  try {
    const images = await getImages(title);
    if (images.length > 0) return images[0].src;
    const response = await fetch(WIKI_ENDPOINTS.summary(title), { headers: { 'User-Agent': USER_AGENT } });
    const data = await response.json();
    return data.thumbnail?.source || '';
  } catch (error) {
    return '';
  }
}

// ============================================
// DuckDuckGo Service
// ============================================
async function getInstantAnswer(query) {
  const cacheKey = `ddg-ia-${query}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  
  try {
    const response = await fetch(DDG_ENDPOINTS.instantAnswer(query), { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return null;
    const data = await response.json();
    let answer = data.Abstract || data.Answer || data.Definition || null;
    if (answer) setCache(cacheKey, answer, CACHE_TTL);
    return answer;
  } catch (error) {
    console.error('Failed to fetch DuckDuckGo instant answer:', error);
    return null;
  }
}

// ============================================
// Share Module
// ============================================
async function shareTopic(topic) {
  const shareData = {
    title: `Search with SEM: ${topic.title}`,
    text: `${topic.title}\n\n${(topic.summary || topic.title).substring(0, 200)}...`,
    url: topic.url || `https://searchwithsem.afric.site/?topic=${encodeURIComponent(topic.title)}`
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      logEvent(EVENT_TYPES.SEM_SHARE, { topic: topic.title });
      return;
    }
    await navigator.clipboard.writeText(shareData.text + '\n' + shareData.url);
    showToast('Link copied to clipboard! Share it anywhere.');
    logEvent(EVENT_TYPES.SEM_SHARE, { topic: topic.title, method: 'clipboard' });
  } catch (error) {
    if (error.name !== 'AbortError') {
      try {
        await navigator.clipboard.writeText(shareData.text + '\n' + shareData.url);
        showToast('Link copied to clipboard!');
      } catch (clipboardError) {
        showToast('Unable to share. Please try again.');
      }
    }
  }
}

// ============================================
// UI Module
// ============================================
let state = {
  currentView: 'home',
  currentTopic: null,
  currentImages: [],
  currentRelated: [],
  currentNote: '',
  lbIndex: 0,
  isOnline: navigator.onLine,
  autoSave: false,
  theme: 'light'
};

let elements = {};
let recognition = null;
let isListening = false;
let autoSaveTimeout = null;

function cacheElements() {
  elements = {
    loading: document.getElementById('loading'),
    loadingText: document.getElementById('loadingText'),
    header: document.querySelector('header'),
    headerLogo: document.getElementById('headerLogo'),
    searchWrap: document.querySelector('.search-wrap'),
    searchInput: document.getElementById('searchInput'),
    voiceBtn: document.getElementById('voiceBtn'),
    searchBtn: document.getElementById('searchBtn'),
    autoSaveIndicator: document.getElementById('autoSaveIndicator'),
    onlineIndicator: document.getElementById('onlineIndicator'),
    main: document.querySelector('main'),
    homeScreen: document.getElementById('homeScreen'),
    homeLogo: document.getElementById('homeLogo'),
    homeSub: document.querySelector('.home-sub'),
    librarySection: document.querySelector('.library-section'),
    libraryGrid: document.getElementById('libraryGrid'),
    trendingSection: document.querySelector('.trending-section'),
    trendingChips: document.getElementById('trendingChips'),
    topicScreen: document.getElementById('topicScreen'),
    topicCover: document.getElementById('topicCover'),
    topicTitle: document.getElementById('topicTitle'),
    topicSubtitle: document.getElementById('topicSubtitle'),
    quickFact: document.getElementById('quickFact'),
    quickFactContent: document.getElementById('quickFactContent'),
    quickFactToggle: document.getElementById('quickFactToggle'),
    wikiSummary: document.getElementById('wikiSummary'),
    imagesStrip: document.getElementById('imagesStrip'),
    imagesStripContainer: document.querySelector('.images-strip-container'),
    readFullBtn: document.getElementById('readFullBtn'),
    relatedChips: document.getElementById('relatedChips'),
    userNote: document.getElementById('userNote'),
    saveBtn: document.getElementById('saveBtn'),
    shareBtn: document.getElementById('shareBtn'),
    readerScreen: document.getElementById('readerScreen'),
    readerContent: document.getElementById('readerContent'),
    readerClose: document.getElementById('readerClose'),
    readerTitle: document.getElementById('readerTitle'),
    libraryScreen: document.getElementById('libraryScreen'),
    librarySearch: document.getElementById('librarySearch'),
    libraryTags: document.getElementById('libraryTags'),
    libraryResults: document.getElementById('libraryResults'),
    librarySearchClear: document.getElementById('librarySearchClear'),
    lightbox: document.getElementById('lightbox'),
    lbImg: document.getElementById('lbImg'),
    lbCaption: document.getElementById('lbCaption'),
    lbCounter: document.getElementById('lbCounter'),
    lbClose: document.getElementById('lbClose'),
    lbPrev: document.getElementById('lbPrev'),
    lbNext: document.getElementById('lbNext'),
    footer: document.querySelector('footer'),
    homeBtn: document.getElementById('homeBtn'),
    libraryBtn: document.getElementById('libraryBtn'),
    historyBtn: document.getElementById('historyBtn'),
    themeBtn: document.getElementById('themeBtn'),
    themeIcon: document.getElementById('themeIcon'),
    historyPanel: document.getElementById('historyPanel'),
    historyList: document.getElementById('historyList'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    closeHistoryBtn: document.getElementById('closeHistoryBtn'),
    firstRunModal: document.getElementById('firstRunModal'),
    firstRunOverlay: document.getElementById('firstRunOverlay'),
    firstRunYes: document.getElementById('firstRunYes'),
    firstRunNo: document.getElementById('firstRunNo')
  };
}

async function loadSettings() {
  state.autoSave = (await getSetting(AUTO_SAVE_KEY, false)) === true;
  state.theme = await getSetting(THEME_KEY, 'light');
  applyTheme(state.theme);
  if (elements.autoSaveIndicator) {
    elements.autoSaveIndicator.textContent = state.autoSave ? 'Auto-Save: ON' : 'Auto-Save: OFF';
  }
  const firstRun = await getSetting('firstRun', true);
  if (firstRun) {
    showFirstRunModal();
    await setSetting('firstRun', false);
  }
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
  }
  if (elements.themeIcon) {
    elements.themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

function setupEventListeners() {
  if (elements.searchInput) {
    elements.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performSearch();
    });
  }
  if (elements.searchBtn) {
    elements.searchBtn.addEventListener('click', performSearch);
  }
  if (elements.voiceBtn) {
    elements.voiceBtn.addEventListener('click', toggleVoice);
  }
  if (elements.homeBtn) {
    elements.homeBtn.addEventListener('click', () => showView('home'));
  }
  if (elements.libraryBtn) {
    elements.libraryBtn.addEventListener('click', () => showView('library'));
  }
  if (elements.historyBtn) {
    elements.historyBtn.addEventListener('click', () => toggleHistoryPanel());
  }
  if (elements.themeBtn) {
    elements.themeBtn.addEventListener('click', toggleTheme);
  }
  if (elements.headerLogo) {
    elements.headerLogo.addEventListener('click', () => showView('home'));
  }
  if (elements.homeLogo) {
    elements.homeLogo.addEventListener('click', () => showView('home'));
  }
  if (elements.readFullBtn) {
    elements.readFullBtn.addEventListener('click', openReader);
  }
  if (elements.saveBtn) {
    elements.saveBtn.addEventListener('click', saveCurrentTopic);
  }
  if (elements.shareBtn) {
    elements.shareBtn.addEventListener('click', shareCurrentTopic);
  }
  if (elements.quickFactToggle) {
    elements.quickFactToggle.addEventListener('click', toggleQuickFact);
  }
  if (elements.userNote) {
    elements.userNote.addEventListener('input', (e) => {
      state.currentNote = e.target.value;
      if (state.currentTopic) debounceAutoSave();
    });
  }
  if (elements.readerClose) {
    elements.readerClose.addEventListener('click', () => showView('topic'));
  }
  if (elements.lbClose) {
    elements.lbClose.addEventListener('click', closeLightbox);
  }
  if (elements.lbPrev) {
    elements.lbPrev.addEventListener('click', () => shiftLb(-1));
  }
  if (elements.lbNext) {
    elements.lbNext.addEventListener('click', () => shiftLb(1));
  }
  if (elements.lightbox) {
    elements.lightbox.addEventListener('click', (e) => {
      if (e.target === elements.lightbox) closeLightbox();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (elements.lightbox?.classList.contains('active')) {
      if (e.key === 'ArrowLeft') shiftLb(-1);
      else if (e.key === 'ArrowRight') shiftLb(1);
      else if (e.key === 'Escape') closeLightbox();
    } else if (e.key === 'Escape') {
      closeHistoryPanel();
    }
  });
  let touchX = 0;
  if (elements.lightbox) {
    elements.lightbox.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    elements.lightbox.addEventListener('touchend', (e) => {
      const diff = touchX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 48) shiftLb(diff > 0 ? 1 : -1);
    });
  }
  document.addEventListener('click', (e) => {
    if (elements.historyPanel && !elements.historyPanel.contains(e.target) && 
        e.target !== elements.historyBtn && !elements.historyBtn?.contains(e.target)) {
      closeHistoryPanel();
    }
  });
  if (elements.librarySearch) {
    elements.librarySearch.addEventListener('input', (e) => renderLibrary(e.target.value));
  }
  if (elements.librarySearchClear) {
    elements.librarySearchClear.addEventListener('click', () => {
      if (elements.librarySearch) {
        elements.librarySearch.value = '';
        renderLibrary('');
      }
    });
  }
  if (elements.firstRunYes) {
    elements.firstRunYes.addEventListener('click', () => {
      state.autoSave = true;
      setSetting(AUTO_SAVE_KEY, true);
      closeFirstRunModal();
      if (elements.autoSaveIndicator) elements.autoSaveIndicator.textContent = 'Auto-Save: ON';
    });
  }
  if (elements.firstRunNo) {
    elements.firstRunNo.addEventListener('click', () => {
      state.autoSave = false;
      setSetting(AUTO_SAVE_KEY, false);
      closeFirstRunModal();
    });
  }
  if (elements.clearHistoryBtn) {
    elements.clearHistoryBtn.addEventListener('click', () => {
      if (confirm('Clear all history?')) {
        clearHistory();
        renderHistory();
        showToast('History cleared');
      }
    });
  }
  if (elements.closeHistoryBtn) {
    elements.closeHistoryBtn.addEventListener('click', closeHistoryPanel);
  }
  window.addEventListener('online', () => {
    state.isOnline = true;
    updateOnlineIndicator();
    showToast('Back online');
  });
  window.addEventListener('offline', () => {
    state.isOnline = false;
    updateOnlineIndicator();
    showToast('Offline - using cached data');
  });
}

function debounceAutoSave() {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    if (state.currentTopic && state.currentNote) saveCurrentTopic();
  }, 30000);
}

async function initViews() {
  await loadTrending();
  await renderLibraryPreview();
  renderHistory();
}

function showView(view) {
  const allViews = ['home', 'topic', 'reader', 'library'];
  allViews.forEach(v => {
    const el = document.getElementById(`${v}Screen`);
    if (el) el.style.display = 'none';
  });
  state.currentView = view;
  switch (view) {
    case 'home':
      if (elements.homeScreen) elements.homeScreen.style.display = 'flex';
      setActiveFooter('home');
      break;
    case 'topic':
      if (elements.topicScreen) elements.topicScreen.style.display = 'block';
      setActiveFooter('library');
      break;
    case 'reader':
      if (elements.readerScreen) elements.readerScreen.style.display = 'block';
      setActiveFooter('library');
      break;
    case 'library':
      if (elements.libraryScreen) {
        elements.libraryScreen.style.display = 'block';
        renderLibrary();
        renderLibraryTags();
      }
      setActiveFooter('library');
      break;
  }
  window.scrollTo(0, 0);
}

function setActiveFooter(button) {
  if (!elements.footer) return;
  const buttons = [elements.homeBtn, elements.libraryBtn, elements.historyBtn, elements.themeBtn];
  buttons.forEach(btn => { if (btn) btn.classList.remove('active'); });
  const activeBtn = { home: elements.homeBtn, library: elements.libraryBtn, history: elements.historyBtn, theme: elements.themeBtn }[button];
  if (activeBtn) activeBtn.classList.add('active');
}

async function performSearch() {
  if (!elements.searchInput) return;
  const query = elements.searchInput.value.trim();
  if (!query) { showToast('Enter something to search'); return; }
  showLoading('Searching Wikipedia...');
  try {
    addToHistory(query);
    renderHistory();
    localStorage.setItem('lastSearch', query);
    const wikiData = await searchWikipedia(query);
    const [images, related, instantAnswer, coverImage] = await Promise.all([
      getImages(wikiData.title || query),
      getRelatedTopics(wikiData.title || query),
      getInstantAnswer(query),
      getCoverImage(wikiData.title || query)
    ]);
    state.currentTopic = {
      title: wikiData.title || query,
      summary: wikiData.extract || 'No summary available.',
      url: wikiData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiData.title || query)}`,
      coverImage
    };
    state.currentImages = images;
    state.currentRelated = related;
    state.currentNote = '';
    state.lbIndex = 0;
    const isSaved = await isTopicSaved(state.currentTopic.title);
    renderTopicView(instantAnswer, isSaved);
    showView('topic');
    logEvent(EVENT_TYPES.SEM_SEARCH);
    if (state.autoSave) saveCurrentTopic();
  } catch (error) {
    console.error('Search failed:', error);
    showToast('Nothing found. Try a different search.');
  } finally {
    hideLoading();
  }
}

function renderTopicView(instantAnswer, isSaved) {
  if (elements.topicCover) {
    if (state.currentTopic.coverImage) {
      elements.topicCover.src = state.currentTopic.coverImage;
      elements.topicCover.style.display = 'block';
    } else {
      elements.topicCover.style.display = 'none';
    }
  }
  if (elements.topicTitle) elements.topicTitle.textContent = state.currentTopic.title;
  if (elements.topicSubtitle) elements.topicSubtitle.textContent = instantAnswer ? 'Quick Fact Available' : '';
  if (instantAnswer && elements.quickFactContent) {
    elements.quickFactContent.textContent = instantAnswer;
    if (elements.quickFact) elements.quickFact.style.display = 'block';
    if (elements.quickFactToggle) elements.quickFactToggle.textContent = 'Hide Quick Fact';
  } else {
    if (elements.quickFact) elements.quickFact.style.display = 'none';
  }
  if (elements.wikiSummary) elements.wikiSummary.innerHTML = `<p>${state.currentTopic.summary}</p>`;
  renderImagesStrip();
  renderRelatedChips();
  if (elements.userNote) elements.userNote.value = state.currentNote;
  if (elements.saveBtn) {
    elements.saveBtn.textContent = isSaved ? 'Saved ✓' : 'Save';
    elements.saveBtn.dataset.saved = isSaved.toString();
  }
  if (elements.readerTitle) elements.readerTitle.textContent = state.currentTopic.title;
}

function renderImagesStrip() {
  if (!elements.imagesStrip || !state.currentImages.length) {
    if (elements.imagesStripContainer) elements.imagesStripContainer.style.display = 'none';
    return;
  }
  elements.imagesStrip.innerHTML = '';
  const previewImages = state.currentImages.slice(0, 4);
  previewImages.forEach((img, i) => {
    const imgEl = document.createElement('img');
    imgEl.src = img.src;
    imgEl.alt = img.title || '';
    imgEl.loading = 'lazy';
    imgEl.style.cursor = 'pointer';
    imgEl.onerror = () => { imgEl.style.display = 'none'; };
    imgEl.onclick = () => openLightbox(i);
    elements.imagesStrip.appendChild(imgEl);
  });
  if (state.currentImages.length > 4) {
    const seeMore = document.createElement('button');
    seeMore.className = 'see-more-btn';
    seeMore.textContent = `+${state.currentImages.length - 4} more`;
    seeMore.onclick = () => openLightbox(4);
    elements.imagesStrip.appendChild(seeMore);
  }
  if (elements.imagesStripContainer) elements.imagesStripContainer.style.display = 'flex';
}

function renderRelatedChips() {
  if (!elements.relatedChips || !state.currentRelated.length) return;
  elements.relatedChips.innerHTML = '';
  state.currentRelated.forEach(related => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = related.title;
    chip.onclick = () => {
      if (elements.searchInput) {
        elements.searchInput.value = related.title;
        performSearch();
      }
    };
    elements.relatedChips.appendChild(chip);
  });
}

function toggleQuickFact() {
  if (!elements.quickFact) return;
  if (elements.quickFact.style.display === 'none') {
    elements.quickFact.style.display = 'block';
    if (elements.quickFactToggle) elements.quickFactToggle.textContent = 'Hide Quick Fact';
  } else {
    elements.quickFact.style.display = 'none';
    if (elements.quickFactToggle) elements.quickFactToggle.textContent = 'Show Quick Fact';
  }
}

async function openReader() {
  if (!state.currentTopic) return;
  showLoading('Loading article...');
  try {
    const articleHtml = await getFullArticle(state.currentTopic.title);
    if (elements.readerContent) elements.readerContent.innerHTML = articleHtml;
    showView('reader');
    logEvent(EVENT_TYPES.SEM_READER, { topic: state.currentTopic.title });
  } catch (error) {
    console.error('Failed to load article:', error);
    showToast('Unable to load article. Please check your internet connection.');
  } finally {
    hideLoading();
  }
}

async function saveCurrentTopic() {
  if (!state.currentTopic) return;
  const topic = { ...state.currentTopic, note: state.currentNote, isAutoSaved: state.autoSave, tags: [] };
  try {
    await saveTopic(topic);
    if (elements.saveBtn) {
      elements.saveBtn.textContent = 'Saved ✓';
      elements.saveBtn.dataset.saved = 'true';
    }
    showToast('Topic saved to library!');
    logEvent(EVENT_TYPES.SEM_SAVE, { topic: topic.title });
    await renderLibraryPreview();
  } catch (error) {
    console.error('Failed to save topic:', error);
    showToast('Failed to save topic.');
  }
}

async function shareCurrentTopic() {
  if (!state.currentTopic) return;
  await shareTopic(state.currentTopic);
}

async function loadTrending() {
  try {
    const topics = await getTrendingTopics();
    renderTrendingChips(topics);
  } catch (error) {
    console.error('Failed to load trending:', error);
    renderTrendingChips(['Artificial Intelligence', 'Climate Change', 'Quantum Physics', 'Solar System']);
  }
}

function renderTrendingChips(topics) {
  if (!elements.trendingChips) return;
  elements.trendingChips.innerHTML = '';
  topics.forEach(topic => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = topic;
    chip.onclick = () => {
      if (elements.searchInput) {
        elements.searchInput.value = topic;
        performSearch();
      }
    };
    elements.trendingChips.appendChild(chip);
  });
}

async function renderLibraryPreview() {
  if (!elements.libraryGrid) return;
  const topics = await getTopics('', null);
  elements.libraryGrid.innerHTML = '';
  if (topics.length === 0) {
    if (elements.librarySection) elements.librarySection.style.display = 'none';
    return;
  }
  const previewTopics = topics.slice(0, 6);
  previewTopics.forEach(topic => {
    const card = document.createElement('button');
    card.className = 'library-card';
    card.onclick = () => {
      state.currentTopic = topic;
      state.currentImages = [];
      state.currentRelated = [];
      state.currentNote = topic.note || '';
      renderTopicView(null, true);
      showView('topic');
    };
    const img = document.createElement('img');
    img.src = topic.coverImage || 'assets/fallback.svg';
    img.alt = topic.title;
    img.loading = 'lazy';
    img.onerror = () => { img.src = 'assets/fallback.svg'; };
    const title = document.createElement('div');
    title.className = 'library-card-title';
    title.textContent = topic.title;
    const date = document.createElement('div');
    date.className = 'library-card-date';
    date.textContent = new Date(topic.savedAt).toLocaleDateString();
    card.appendChild(img);
    card.appendChild(title);
    card.appendChild(date);
    elements.libraryGrid.appendChild(card);
  });
  if (elements.librarySection) elements.librarySection.style.display = 'block';
}

async function renderLibrary(query = '', tag = null) {
  if (!elements.libraryResults) return;
  const topics = await getTopics(query, tag);
  elements.libraryResults.innerHTML = '';
  if (topics.length === 0) {
    elements.libraryResults.innerHTML = '<div class="empty-state"><i class="fas fa-book"></i><p>No topics found.</p></div>';
    return;
  }
  topics.forEach(topic => {
    const card = document.createElement('div');
    card.className = 'library-item';
    const img = document.createElement('img');
    img.src = topic.coverImage || 'assets/fallback.svg';
    img.alt = topic.title;
    img.loading = 'lazy';
    img.onerror = () => { img.src = 'assets/fallback.svg'; };
    const info = document.createElement('div');
    info.className = 'library-item-info';
    const title = document.createElement('h3');
    title.textContent = topic.title;
    const date = document.createElement('div');
    date.className = 'library-item-date';
    date.textContent = new Date(topic.savedAt).toLocaleDateString();
    const notePreview = document.createElement('div');
    notePreview.className = 'library-item-note';
    notePreview.textContent = topic.note ? topic.note.substring(0, 100) + (topic.note.length > 100 ? '...' : '') : 'No note';
    const actions = document.createElement('div');
    actions.className = 'library-item-actions';
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn-icon';
    viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      state.currentTopic = topic;
      state.currentImages = [];
      state.currentRelated = [];
      state.currentNote = topic.note || '';
      renderTopicView(null, true);
      showView('topic');
    };
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn-icon';
    shareBtn.innerHTML = '<i class="fas fa-share-alt"></i>';
    shareBtn.onclick = (e) => { e.stopPropagation(); shareTopic(topic); };
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-icon-danger';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${topic.title}"?`)) {
        deleteTopic(topic.id).then(() => {
          renderLibrary(query, tag);
          renderLibraryPreview();
          showToast('Topic deleted');
        });
      }
    };
    actions.appendChild(viewBtn);
    actions.appendChild(shareBtn);
    actions.appendChild(deleteBtn);
    info.appendChild(title);
    info.appendChild(date);
    info.appendChild(notePreview);
    card.appendChild(img);
    card.appendChild(info);
    card.appendChild(actions);
    card.onclick = () => {
      state.currentTopic = topic;
      state.currentImages = [];
      state.currentRelated = [];
      state.currentNote = topic.note || '';
      renderTopicView(null, true);
      showView('topic');
    };
    elements.libraryResults.appendChild(card);
  });
}

async function renderLibraryTags() {
  if (!elements.libraryTags) return;
  const tags = []; // Placeholder - will implement later
  elements.libraryTags.innerHTML = '';
  if (tags.length === 0) return;
  const allTag = document.createElement('button');
  allTag.className = 'tag-chip active';
  allTag.textContent = 'All';
  allTag.onclick = () => {
    elements.libraryTags.querySelectorAll('.tag-chip').forEach(t => t.classList.remove('active'));
    allTag.classList.add('active');
    renderLibrary(elements.librarySearch?.value || '');
  };
  elements.libraryTags.appendChild(allTag);
  tags.forEach(tag => {
    const tagEl = document.createElement('button');
    tagEl.className = 'tag-chip';
    tagEl.textContent = `#${tag}`;
    tagEl.onclick = () => {
      elements.libraryTags.querySelectorAll('.tag-chip').forEach(t => t.classList.remove('active'));
      tagEl.classList.add('active');
      renderLibrary(elements.librarySearch?.value || '', tag);
    };
    elements.libraryTags.appendChild(tagEl);
  });
}

function toggleTheme() {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  state.theme = newTheme;
  setSetting(THEME_KEY, newTheme);
  applyTheme(newTheme);
}

function showFirstRunModal() {
  if (!elements.firstRunModal || !elements.firstRunOverlay) return;
  elements.firstRunModal.style.display = 'flex';
  elements.firstRunOverlay.style.display = 'block';
}

function closeFirstRunModal() {
  if (!elements.firstRunModal || !elements.firstRunOverlay) return;
  elements.firstRunModal.style.display = 'none';
  elements.firstRunOverlay.style.display = 'none';
}

function updateOnlineIndicator() {
  if (elements.onlineIndicator) {
    elements.onlineIndicator.textContent = state.isOnline ? '●' : '○';
    elements.onlineIndicator.title = state.isOnline ? 'Online' : 'Offline';
  }
  if (elements.autoSaveIndicator) {
    elements.autoSaveIndicator.textContent = state.autoSave ? 'Auto-Save: ON' : 'Auto-Save: OFF';
  }
}

function showLoading(text = 'Loading...') {
  if (elements.loading && elements.loadingText) {
    elements.loadingText.textContent = text;
    elements.loading.classList.add('active');
  }
}

function hideLoading() {
  if (elements.loading) elements.loading.classList.remove('active');
}

function showToast(message, duration = 3000) {
  document.querySelectorAll('.sem-toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'sem-toast';
  toast.style.cssText = `position:fixed;bottom:74px;left:50%;transform:translateX(-50%);background:var(--text, #202124);color:var(--bg, #ffffff);padding:10px 18px;border-radius:8px;font-size:13px;z-index:4000;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,0.25);pointer-events:none;`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

function openLightbox(index) {
  state.lbIndex = index;
  updateLightbox();
  if (elements.lightbox) {
    elements.lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeLightbox() {
  if (elements.lightbox) {
    elements.lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function shiftLb(dir) {
  state.lbIndex = (state.lbIndex + dir + state.currentImages.length) % state.currentImages.length;
  updateLightbox();
}

function updateLightbox() {
  if (!state.currentImages[state.lbIndex]) return;
  const img = state.currentImages[state.lbIndex];
  if (elements.lbImg) elements.lbImg.src = img.src;
  if (elements.lbCaption) elements.lbCaption.textContent = img.title || '';
  if (elements.lbCounter) elements.lbCounter.textContent = `${state.lbIndex + 1} / ${state.currentImages.length}`;
  const multi = state.currentImages.length > 1;
  if (elements.lbPrev) elements.lbPrev.style.display = multi ? 'flex' : 'none';
  if (elements.lbNext) elements.lbNext.style.display = multi ? 'flex' : 'none';
}

function toggleHistoryPanel() {
  if (elements.historyPanel?.classList.contains('open')) closeHistoryPanel();
  else openHistoryPanel();
}

function openHistoryPanel() {
  if (elements.historyPanel) elements.historyPanel.classList.add('open');
  if (elements.historyBtn) elements.historyBtn.classList.add('active');
  renderHistory();
}

function closeHistoryPanel() {
  if (elements.historyPanel) elements.historyPanel.classList.remove('open');
  if (elements.historyBtn) elements.historyBtn.classList.remove('active');
}

function renderHistory() {
  if (!elements.historyList) return;
  const history = getHistory();
  if (history.length === 0) {
    elements.historyList.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>No history yet</p></div>';
    return;
  }
  elements.historyList.innerHTML = '';
  history.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const textDiv = document.createElement('div');
    textDiv.className = 'history-text';
    const queryDiv = document.createElement('div');
    queryDiv.className = 'history-query';
    queryDiv.textContent = item.query;
    const timeDiv = document.createElement('div');
    timeDiv.className = 'history-time';
    timeDiv.textContent = timeAgo(item.timestamp);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'history-delete';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      const newHistory = history.filter((_, index) => index !== i);
      localStorage.setItem('sem-history', JSON.stringify(newHistory));
      renderHistory();
      showToast('Deleted');
    };
    textDiv.appendChild(queryDiv);
    textDiv.appendChild(timeDiv);
    div.appendChild(textDiv);
    div.appendChild(deleteBtn);
    div.onclick = () => {
      if (elements.searchInput) {
        elements.searchInput.value = item.query;
        closeHistoryPanel();
        performSearch();
      }
    };
    elements.historyList.appendChild(div);
  });
}

function initVoice() {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    if (elements.voiceBtn) elements.voiceBtn.style.display = 'none';
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.onstart = () => {
    isListening = true;
    if (elements.voiceBtn) elements.voiceBtn.classList.add('listening');
    showToast('Listening...');
  };
  recognition.onresult = (e) => {
    if (elements.searchInput) {
      elements.searchInput.value = e.results[0][0].transcript;
      performSearch();
    }
  };
  recognition.onerror = stopVoice;
  recognition.onend = stopVoice;
}

function toggleVoice() {
  if (!recognition) { showToast('Voice search not supported'); return; }
  if (isListening) stopVoice();
  else try { recognition.start(); } catch {}
}

function stopVoice() {
  isListening = false;
  if (elements.voiceBtn) elements.voiceBtn.classList.remove('listening');
  try { recognition?.stop(); } catch {}
}

function timeAgo(timestamp) {
  const d = Date.now() - timestamp;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  if (d < 604800000) return `${Math.floor(d / 86400000)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ============================================
// Initialize Application
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize analytics
  initAnalytics();
  
  // Cache DOM elements
  cacheElements();
  
  // Load settings
  await loadSettings();
  
  // Setup event listeners
  setupEventListeners();
  
  // Initialize views
  await initViews();
  
  // Log app open
  logEvent(EVENT_TYPES.SEM_OPEN);
  
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
