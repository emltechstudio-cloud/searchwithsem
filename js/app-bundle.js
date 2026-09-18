// ============================================
// Search with SEM - Complete Modern Bundle
// Version 3.0.0 - Modern UI, Gamification, Offline-First
// ============================================

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
const APP_VERSION = "3.0.0";
const USER_AGENT = `SearchWithSEM/${APP_VERSION}`;

// Gamification Keys
const STREAK_KEY = "sem-streak";
const LAST_ACTIVE_DATE_KEY = "sem-last-active";
const ACHIEVEMENTS_KEY = "sem-achievements";
const TOTAL_READS_KEY = "sem-total-reads";
const TOTAL_SAVES_KEY = "sem-total-saves";
const TOTAL_SHARES_KEY = "sem-total-shares";

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
  fullArticle: (title) => `${WIKI_API}/page/html/${encodeURIComponent(title)}`
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
// Gamification System
// ============================================
const ACHIEVEMENTS = {
  FIRST_SEARCH: { id: 'first_search', name: 'First Search', description: 'Perform your first search', icon: '🔍', points: 10 },
  FIRST_SAVE: { id: 'first_save', name: 'First Save', description: 'Save your first topic', icon: '💾', points: 20 },
  FIRST_SHARE: { id: 'first_share', name: 'First Share', description: 'Share your first topic', icon: '📤', points: 15 },
  READER_EXPLORER: { id: 'reader_explorer', name: 'Reader Explorer', description: 'Read 5 full articles', icon: '📚', points: 50, target: 5 },
  LIBRARY_BUILDER: { id: 'library_builder', name: 'Library Builder', description: 'Save 10 topics', icon: '📚', points: 75, target: 10 },
  SHARE_ENTHUSIAST: { id: 'share_enthusiast', name: 'Share Enthusiast', description: 'Share 5 topics', icon: '🌟', points: 40, target: 5 },
  WEEKLY_STREAK: { id: 'weekly_streak', name: 'Weekly Streak', description: 'Use the app for 7 consecutive days', icon: '🔥', points: 100, target: 7 },
  MONTHLY_STREAK: { id: 'monthly_streak', name: 'Monthly Streak', description: 'Use the app for 30 consecutive days', icon: '🔥🔥', points: 300, target: 30 },
  NIGHT_OWL: { id: 'night_owl', name: 'Night Owl', description: 'Use the app at night (9pm-12am)', icon: '🦉', points: 25 },
  EARLY_BIRD: { id: 'early_bird', name: 'Early Bird', description: 'Use the app in the morning (5am-9am)', icon: '🐦', points: 25 }
};

function getAchievements() {
  try {
    const achievements = localStorage.getItem(ACHIEVEMENTS_KEY);
    return achievements ? JSON.parse(achievements) : {};
  } catch {
    return {};
  }
}

function saveAchievements(achievements) {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
  } catch (error) {
    console.error('Failed to save achievements:', error);
  }
}

function getStreak() {
  try {
    return parseInt(localStorage.getItem(STREAK_KEY) || '0');
  } catch {
    return 0;
  }
}

function saveStreak(streak) {
  try {
    localStorage.setItem(STREAK_KEY, streak.toString());
  } catch (error) {
    console.error('Failed to save streak:', error);
  }
}

function getLastActiveDate() {
  try {
    return localStorage.getItem(LAST_ACTIVE_DATE_KEY) || '';
  } catch {
    return '';
  }
}

function saveLastActiveDate(date) {
  try {
    localStorage.setItem(LAST_ACTIVE_DATE_KEY, date);
  } catch (error) {
    console.error('Failed to save last active date:', error);
  }
}

function getTotalReads() {
  try {
    return parseInt(localStorage.getItem(TOTAL_READS_KEY) || '0');
  } catch {
    return 0;
  }
}

function incrementTotalReads() {
  try {
    const reads = getTotalReads() + 1;
    localStorage.setItem(TOTAL_READS_KEY, reads.toString());
    return reads;
  } catch {
    return getTotalReads();
  }
}

function getTotalSaves() {
  try {
    return parseInt(localStorage.getItem(TOTAL_SAVES_KEY) || '0');
  } catch {
    return 0;
  }
}

function incrementTotalSaves() {
  try {
    const saves = getTotalSaves() + 1;
    localStorage.setItem(TOTAL_SAVES_KEY, saves.toString());
    return saves;
  } catch {
    return getTotalSaves();
  }
}

function getTotalShares() {
  try {
    return parseInt(localStorage.getItem(TOTAL_SHARES_KEY) || '0');
  } catch {
    return 0;
  }
}

function incrementTotalShares() {
  try {
    const shares = getTotalShares() + 1;
    localStorage.setItem(TOTAL_SHARES_KEY, shares.toString());
    return shares;
  } catch {
    return getTotalShares();
  }
}

function updateStreak() {
  const today = new Date().toISOString().split('T')[0];
  const lastActive = getLastActiveDate();

  if (!lastActive) {
    // First time
    saveStreak(1);
    saveLastActiveDate(today);
    return 1;
  }

  const lastDate = new Date(lastActive);
  const todayDate = new Date(today);
  const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    // Consecutive day
    const newStreak = getStreak() + 1;
    saveStreak(newStreak);
    saveLastActiveDate(today);
    return newStreak;
  } else if (diffDays === 0) {
    // Same day
    return getStreak();
  } else {
    // Reset streak
    saveStreak(1);
    saveLastActiveDate(today);
    return 1;
  }
}

function checkAchievements(action, data = {}) {
  const achievements = getAchievements();
  const newAchievements = [];

  switch (action) {
    case 'search':
      if (!achievements.first_search) {
        achievements.first_search = true;
        newAchievements.push(ACHIEVEMENTS.FIRST_SEARCH);
      }
      break;
    case 'save':
      if (!achievements.first_save) {
        achievements.first_save = true;
        newAchievements.push(ACHIEVEMENTS.FIRST_SAVE);
      }
      {
        const totalSaves = getTotalSaves() + 1;
        if (totalSaves >= 10 && !achievements.library_builder) {
          achievements.library_builder = true;
          newAchievements.push(ACHIEVEMENTS.LIBRARY_BUILDER);
        }
      }
      break;
    case 'share':
      if (!achievements.first_share) {
        achievements.first_share = true;
        newAchievements.push(ACHIEVEMENTS.FIRST_SHARE);
      }
      {
        const totalShares = getTotalShares() + 1;
        if (totalShares >= 5 && !achievements.share_enthusiast) {
          achievements.share_enthusiast = true;
          newAchievements.push(ACHIEVEMENTS.SHARE_ENTHUSIAST);
        }
      }
      break;
    case 'reader':
      {
        const totalReads = getTotalReads() + 1;
        if (totalReads >= 5 && !achievements.reader_explorer) {
          achievements.reader_explorer = true;
          newAchievements.push(ACHIEVEMENTS.READER_EXPLORER);
        }
      }
      break;
    case 'daily':
      {
        const streak = getStreak();
        if (streak >= 7 && !achievements.weekly_streak) {
          achievements.weekly_streak = true;
          newAchievements.push(ACHIEVEMENTS.WEEKLY_STREAK);
        }
        if (streak >= 30 && !achievements.monthly_streak) {
          achievements.monthly_streak = true;
          newAchievements.push(ACHIEVEMENTS.MONTHLY_STREAK);
        }
      }
      break;
  }

  // Check time-based achievements
  const hour = new Date().getHours();
  if (hour >= 21 && hour <= 23 && !achievements.night_owl) {
    achievements.night_owl = true;
    newAchievements.push(ACHIEVEMENTS.NIGHT_OWL);
  } else if (hour >= 5 && hour <= 9 && !achievements.early_bird) {
    achievements.early_bird = true;
    newAchievements.push(ACHIEVEMENTS.EARLY_BIRD);
  }

  if (newAchievements.length > 0) {
    saveAchievements(achievements);
    return newAchievements;
  }

  saveAchievements(achievements);
  return [];
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
      const request = indexedDB.open(DB_NAME, 3);
      request.onerror = reject;
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(TOPICS_STORE)) {
          const store = db.createObjectStore(TOPICS_STORE, { keyPath: 'id' });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('savedAt', 'savedAt', { unique: false });
          store.createIndex('tags', 'tags', { multiEntry: true });
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
    fullArticle: topic.fullArticle || '',
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
          t.summary.toLowerCase().includes(queryLower) ||
          (t.tags && t.tags.some(tag => tag.toLowerCase().includes(queryLower)))
        );
      }
      if (tag) {
        topics = topics.filter(t => t.tags && t.tags.includes(tag));
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

async function getTopicById(id) {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(TOPICS_STORE, 'readonly');
    const request = tx.objectStore(TOPICS_STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
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
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed.expires && Date.now() > parsed.expires) {
      localStorage.removeItem(`sem-cache-${key}`);
      return null;
    }
    return parsed.value;
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
    const response = await fetch(WIKI_ENDPOINTS.fullArticle(title), {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (!response.ok) {
      // Fallback to mobile version
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
    let html = await response.text();

    // Clean up the HTML for better display
    html = html.replace(/<style[^>]*>.*?<\/style>/gsi, '');
    html = html.replace(/<script[^>]*>.*?<\/script>/gsi, '');
    html = html.replace(/<link[^>]*>/gi, '');
    html = html.replace(/<meta[^>]*>/gi, '');

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
  return ['Artificial Intelligence', 'Climate Change', 'Quantum Physics', 'Solar System', 'DNA', 'Ancient Rome', 'Machine Learning', 'Blockchain', 'Renewable Energy', 'Human Brain'];
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
      incrementTotalShares();
      checkAchievements('share');
      showToast('Shared successfully!');
      return;
    }
    await navigator.clipboard.writeText(shareData.text + '\n' + shareData.url);
    showToast('Link copied to clipboard! Share it anywhere.');
    logEvent(EVENT_TYPES.SEM_SHARE, { topic: topic.title, method: 'clipboard' });
    incrementTotalShares();
    checkAchievements('share');
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
  theme: 'light',
  stats: {
    streak: 0,
    totalReads: 0,
    totalSaves: 0,
    totalShares: 0,
    achievements: []
  }
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
    homeTagline: document.querySelector('.home-tagline'),
    librarySection: document.querySelector('.library-section'),
    libraryGrid: document.getElementById('libraryGrid'),
    statsSection: document.querySelector('.stats-section'),
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
    readerSaveBtn: document.getElementById('readerSaveBtn'),
    readerShareBtn: document.getElementById('readerShareBtn'),
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
    achievementsBtn: document.getElementById('achievementsBtn'),
    achievementsPanel: document.getElementById('achievementsPanel'),
    achievementsList: document.getElementById('achievementsList'),
    closeAchievementsBtn: document.getElementById('closeAchievementsBtn'),
    historyPanel: document.getElementById('historyPanel'),
    historyList: document.getElementById('historyList'),
    historySearch: document.getElementById('historySearch'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    closeHistoryBtn: document.getElementById('closeHistoryBtn'),
    firstRunModal: document.getElementById('firstRunModal'),
    firstRunYes: document.getElementById('firstRunYes'),
    firstRunNo: document.getElementById('firstRunNo')
  };
}

async function loadSettings() {
  state.autoSave = (await getSetting(AUTO_SAVE_KEY, false)) === true;
  state.theme = await getSetting(THEME_KEY, 'light');
  state.stats.streak = getStreak();
  state.stats.totalReads = getTotalReads();
  state.stats.totalSaves = getTotalSaves();
  state.stats.totalShares = getTotalShares();
  state.stats.achievements = Object.keys(getAchievements());

  applyTheme(state.theme);
  updateAutoSaveIndicator();

  const firstRun = await getSetting('firstRun', true);
  if (firstRun) {
    showFirstRunModal();
    await setSetting('firstRun', false);
  }

  // Update streak on app open
  const newStreak = updateStreak();
  if (newStreak !== state.stats.streak) {
    state.stats.streak = newStreak;
    checkAchievements('daily');
  }

  // Log app open event
  logEvent(EVENT_TYPES.SEM_OPEN);
}

function updateAutoSaveIndicator() {
  if (elements.autoSaveIndicator) {
    elements.autoSaveIndicator.classList.toggle('on', state.autoSave);
    elements.autoSaveIndicator.querySelector('.toggle-text').textContent = state.autoSave ? 'ON' : 'OFF';
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
  // Auto-save toggle
  if (elements.autoSaveIndicator) {
    elements.autoSaveIndicator.addEventListener('click', toggleAutoSave);
  }

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
    elements.historyBtn.addEventListener('click', toggleHistoryPanel);
  }
  if (elements.achievementsBtn) {
    elements.achievementsBtn.addEventListener('click', toggleAchievementsPanel);
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
  if (elements.readerSaveBtn) elements.readerSaveBtn.addEventListener('click', saveCurrentTopic);
  if (elements.readerShareBtn) elements.readerShareBtn.addEventListener('click', shareCurrentTopic);
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

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (elements.lightbox?.classList.contains('active')) {
      if (e.key === 'ArrowLeft') shiftLb(-1);
      else if (e.key === 'ArrowRight') shiftLb(1);
      else if (e.key === 'Escape') closeLightbox();
    } else if (e.key === 'Escape') {
      closeHistoryPanel();
      closeAchievementsPanel();
    }
  });

  // Lightbox touch gestures
  let touchX = 0;
  if (elements.lightbox) {
    elements.lightbox.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    elements.lightbox.addEventListener('touchend', (e) => {
      const diff = touchX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 48) shiftLb(diff > 0 ? 1 : -1);
    });
  }

  // Close panels when clicking outside
  document.addEventListener('click', (e) => {
    if (elements.historyPanel && !elements.historyPanel.contains(e.target) &&
        e.target !== elements.historyBtn && !elements.historyBtn?.contains(e.target)) {
      closeHistoryPanel();
    }
    if (elements.achievementsPanel && !elements.achievementsPanel.contains(e.target) &&
        e.target !== elements.achievementsBtn && !elements.achievementsBtn?.contains(e.target)) {
      closeAchievementsPanel();
    }
    // Close first run modal when clicking outside
    if (elements.firstRunModal && elements.firstRunModal.style.display === 'block' &&
        !elements.firstRunModal.contains(e.target)) {
      closeFirstRunModal();
    }
  });

  if (elements.librarySearch) {
    elements.librarySearch.addEventListener('input', (e) => renderLibrary(e.target.value));
  }
  if (elements.historySearch) {
    elements.historySearch.addEventListener('input', (e) => renderHistory(e.target.value));
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
      updateAutoSaveIndicator();
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
  if (elements.closeAchievementsBtn) {
    elements.closeAchievementsBtn.addEventListener('click', closeAchievementsPanel);
  }

  // Online/offline events
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

  // Scroll effect for header
  window.addEventListener('scroll', () => {
    if (elements.header) {
      elements.header.classList.toggle('scrolled', window.scrollY > 10);
    }
  });
}

function toggleAutoSave() {
  state.autoSave = !state.autoSave;
  setSetting(AUTO_SAVE_KEY, state.autoSave);
  updateAutoSaveIndicator();
  showToast(`Auto-save ${state.autoSave ? 'enabled' : 'disabled'}`);
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
  renderStats();
}

function renderStats() {
  if (!elements.statsSection) return;
  const savedCount = state.stats.totalSaves;
  const readCount = state.stats.totalReads;
  const level = Math.max(1, Math.floor((savedCount + readCount) / 5) + 1);
  elements.statsSection.innerHTML = `
    <div class="stat-card stat-card-featured"><div class="stat-icon"><i class="fas fa-fire"></i></div><div><div class="stat-value">${state.stats.streak}</div><div class="stat-label">Day streak</div></div><span class="stat-trend">Keep going</span></div>
    <div class="stat-card"><div class="stat-icon"><i class="fas fa-book-open"></i></div><div><div class="stat-value">${readCount}</div><div class="stat-label">Articles read</div></div></div>
    <div class="stat-card"><div class="stat-icon"><i class="far fa-bookmark"></i></div><div><div class="stat-value">${savedCount}</div><div class="stat-label">Saved topics</div></div></div>
    <div class="stat-card"><div class="stat-icon"><i class="fas fa-star"></i></div><div><div class="stat-value">Level ${level}</div><div class="stat-label">Knowledge builder</div></div></div>
  `;
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
      if (elements.homeScreen) {
        elements.homeScreen.style.display = 'flex';
        renderStats();
      }
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
  const buttons = [elements.homeBtn, elements.libraryBtn, elements.historyBtn, elements.themeBtn, elements.achievementsBtn];
  buttons.forEach(btn => { if (btn) btn.classList.remove('active'); });
  const activeBtn = { home: elements.homeBtn, library: elements.libraryBtn, history: elements.historyBtn, theme: elements.themeBtn, achievements: elements.achievementsBtn }[button];
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

    // Fetch full article for saving
    let fullArticle = '';
    if (state.autoSave) {
      fullArticle = await getFullArticle(wikiData.title || query);
    }

    state.currentTopic = {
      title: wikiData.title || query,
      summary: wikiData.extract || 'No summary available.',
      fullArticle,
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
    checkAchievements('search');

    if (state.autoSave) {
      saveCurrentTopic();
    }
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

  // Only show quick fact if it exists, don't duplicate with summary
  if (instantAnswer && elements.quickFactContent) {
    elements.quickFactContent.textContent = instantAnswer;
    if (elements.quickFact) elements.quickFact.style.display = 'block';
    if (elements.quickFactToggle) elements.quickFactToggle.textContent = 'Hide Quick Fact';
    if (elements.wikiSummary) elements.wikiSummary.style.display = 'none';
  } else {
    if (elements.quickFact) elements.quickFact.style.display = 'none';
    if (elements.wikiSummary) {
      elements.wikiSummary.style.display = 'block';
      elements.wikiSummary.innerHTML = `<p>${state.currentTopic.summary}</p>`;
    }
  }

  if (elements.topicSubtitle) {
    elements.topicSubtitle.textContent = instantAnswer ? 'Quick Fact Available' : state.currentTopic.summary.substring(0, 100) + '...';
  }

  renderImagesStrip();
  renderRelatedChips();

  if (elements.userNote) elements.userNote.value = state.currentNote;

  if (elements.saveBtn) {
    elements.saveBtn.textContent = isSaved ? 'Saved ✓' : 'Save';
    elements.saveBtn.dataset.saved = isSaved.toString();
  }

  if (elements.readerTitle) elements.readerTitle.textContent = state.currentTopic.title;
  if (elements.readerSaveBtn) {
    elements.readerSaveBtn.classList.toggle('saved', isSaved);
    elements.readerSaveBtn.innerHTML = isSaved ? '<i class="fas fa-check"></i><span>Saved offline</span>' : '<i class="far fa-bookmark"></i><span>Save</span>';
  }
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
    imgEl.style.objectFit = 'contain';
    imgEl.style.background = 'var(--bg-secondary)';
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
    if (elements.wikiSummary) elements.wikiSummary.style.display = 'none';
  } else {
    elements.quickFact.style.display = 'none';
    if (elements.quickFactToggle) elements.quickFactToggle.textContent = 'Show Quick Fact';
    if (elements.wikiSummary) elements.wikiSummary.style.display = 'block';
  }
}

async function openReader() {
  if (!state.currentTopic) return;
  showLoading('Loading article...');

  try {
    // Use cached full article if available
    let articleHtml = state.currentTopic.fullArticle;
    if (!articleHtml) {
      articleHtml = await getFullArticle(state.currentTopic.title);
    }

    if (elements.readerContent) {
      elements.readerContent.innerHTML = articleHtml;
    }

    showView('reader');
    logEvent(EVENT_TYPES.SEM_READER, { topic: state.currentTopic.title });
    incrementTotalReads();
    checkAchievements('reader');
    renderStats();
  } catch (error) {
    console.error('Failed to load article:', error);
    showToast('Unable to load article. Please check your internet connection.');
  } finally {
    hideLoading();
  }
}

async function saveCurrentTopic() {
  if (!state.currentTopic) return;

  // If full article is not cached, fetch it
  let fullArticle = state.currentTopic.fullArticle;
  if (!fullArticle) {
    fullArticle = await getFullArticle(state.currentTopic.title);
  }

  const existingTopics = await getTopics();
  const existing = existingTopics.find(item => item.title === state.currentTopic.title);
  const topic = {
    ...state.currentTopic,
    id: existing?.id,
    fullArticle,
    note: state.currentNote,
    isAutoSaved: state.autoSave,
    tags: existing?.tags || []
  };

  try {
    await saveTopic(topic);
    if (elements.saveBtn) {
      elements.saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved';
      elements.saveBtn.dataset.saved = 'true';
    }
    if (elements.readerSaveBtn) {
      elements.readerSaveBtn.innerHTML = '<i class="fas fa-check"></i><span>Saved offline</span>';
      elements.readerSaveBtn.classList.add('saved');
    }
    showToast('Topic saved to library!');
    logEvent(EVENT_TYPES.SEM_SAVE, { topic: topic.title });
    incrementTotalSaves();
    checkAchievements('save');
    renderStats();
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
    renderTrendingChips(fallbackTrending());
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
    img.src = topic.coverImage || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="14">No Image</text></svg>';
    img.alt = topic.title;
    img.loading = 'lazy';
    img.style.objectFit = 'cover';
    img.style.background = 'var(--bg-secondary)';
    img.onerror = () => {
      img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="14">No Image</text></svg>';
    };

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
    img.src = topic.coverImage || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect fill="%23f0f0f0" width="80" height="80"/><text x="40" y="45" text-anchor="middle" fill="%23999" font-size="10">No Image</text></svg>';
    img.alt = topic.title;
    img.loading = 'lazy';
    img.style.objectFit = 'cover';
    img.style.background = 'var(--bg-secondary)';
    img.onerror = () => {
      img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect fill="%23f0f0f0" width="80" height="80"/><text x="40" y="45" text-anchor="middle" fill="%23999" font-size="10">No Image</text></svg>';
    };

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
    shareBtn.onclick = (e) => {
      e.stopPropagation();
      shareTopic(topic);
    };

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

  const topics = await getTopics();
  const allTags = new Set();
  topics.forEach(topic => {
    if (topic.tags) {
      topic.tags.forEach(tag => allTags.add(tag));
    }
  });

  const tags = Array.from(allTags).sort();

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
  if (!elements.firstRunModal) return;
  elements.firstRunModal.style.display = 'block';
}

function closeFirstRunModal() {
  if (!elements.firstRunModal) return;
  elements.firstRunModal.style.display = 'none';
}

function updateOnlineIndicator() {
  if (elements.onlineIndicator) {
    elements.onlineIndicator.classList.toggle('offline', !state.isOnline);
    elements.onlineIndicator.textContent = state.isOnline ? '●' : '○';
    elements.onlineIndicator.title = state.isOnline ? 'Online' : 'Offline';
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

function toggleAchievementsPanel() {
  if (elements.achievementsPanel?.classList.contains('open')) closeAchievementsPanel();
  else openAchievementsPanel();
}

function openAchievementsPanel() {
  if (elements.achievementsPanel) elements.achievementsPanel.classList.add('open');
  if (elements.achievementsBtn) elements.achievementsBtn.classList.add('active');
  renderAchievements();
}

function closeAchievementsPanel() {
  if (elements.achievementsPanel) elements.achievementsPanel.classList.remove('open');
  if (elements.achievementsBtn) elements.achievementsBtn.classList.remove('active');
}

function renderAchievements() {
  if (!elements.achievementsList) return;
  const achievements = getAchievements();
  const list = Object.values(ACHIEVEMENTS);
  const earned = list.filter(item => achievements[item.id]).length;
  const points = list.filter(item => achievements[item.id]).reduce((sum, item) => sum + item.points, 0);
  const next = list.find(item => !achievements[item.id]);
  const progressTarget = next?.target || 1;
  const progressValue = next?.id === 'library_builder' ? state.stats.totalSaves : next?.id === 'reader_explorer' ? state.stats.totalReads : next?.id === 'share_enthusiast' ? state.stats.totalShares : 0;
  const progress = Math.min(100, Math.round((progressValue / progressTarget) * 100));
  elements.achievementsList.innerHTML = `
    <div class="achievement-hero"><div><span class="eyebrow">YOUR PROGRESS</span><h4>Keep building your knowledge.</h4><p>${earned} of ${list.length} badges earned · ${points} XP collected</p></div><div class="level-orb"><strong>Lv ${Math.max(1, Math.floor(points / 100) + 1)}</strong><span>Explorer</span></div></div>
    <div class="achievement-metrics"><div><strong>${state.stats.streak}</strong><span>Day streak</span></div><div><strong>${state.stats.totalReads}</strong><span>Articles read</span></div><div><strong>${state.stats.totalSaves}</strong><span>Saved</span></div><div><strong>${state.stats.totalShares}</strong><span>Shared</span></div></div>
    ${next ? `<div class="next-achievement"><div class="next-icon">${next.icon}</div><div class="next-copy"><span class="eyebrow">UP NEXT</span><strong>${next.name}</strong><small>${next.description}</small><div class="progress-track"><span style="width:${progress}%"></span></div><em>${progressValue} / ${progressTarget}</em></div></div>` : ''}
    <div class="badge-heading"><span>Badges</span><small>${earned} unlocked</small></div>
    <div class="badge-grid">${list.map(item => `<div class="badge-card ${achievements[item.id] ? 'unlocked' : 'locked'}"><div class="badge-symbol">${item.icon}</div><strong>${item.name}</strong><span>${achievements[item.id] ? 'Unlocked' : `+${item.points} XP`}</span></div>`).join('')}</div>
  `;
}

function renderHistory(query = '') {
  if (!elements.historyList) return;
  const normalized = query.trim().toLowerCase();
  const history = getHistory().filter(item => !normalized || item.query.toLowerCase().includes(normalized));
  if (history.length === 0) {
    elements.historyList.innerHTML = `<div class="empty-state"><i class="fas fa-compass"></i><p>${normalized ? 'No matching searches' : 'Your search trail is empty'}</p><span>${normalized ? 'Try another term.' : 'Searches will appear here as you explore.'}</span></div>`;
    return;
  }
  elements.historyList.innerHTML = '';
  history.forEach(item => {
    const div = document.createElement('button');
    div.className = 'history-item';
    div.innerHTML = `<span class="history-icon"><i class="fas fa-search"></i></span><span class="history-text"><span class="history-query"></span><span class="history-time"></span></span><span class="history-open"><i class="fas fa-arrow-up-right-from-square"></i></span>`;
    div.querySelector('.history-query').textContent = item.query;
    div.querySelector('.history-time').textContent = new Date(item.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    div.onclick = () => { elements.searchInput.value = item.query; closeHistoryPanel(); performSearch(); };
    elements.historyList.appendChild(div);
  });
}

// Voice Search
function toggleVoice() {
  if (isListening) {
    stopVoice();
    return;
  }

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('Voice search not supported in your browser');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isListening = true;
    if (elements.voiceBtn) {
      elements.voiceBtn.style.background = 'var(--error)';
      elements.voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    }
    showToast('Listening...');
  };

  recognition.onend = () => {
    isListening = false;
    if (elements.voiceBtn) {
      elements.voiceBtn.style.background = '';
      elements.voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    }
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (elements.searchInput) {
      elements.searchInput.value = transcript;
      performSearch();
    }
  };

  recognition.onerror = (event) => {
    isListening = false;
    if (elements.voiceBtn) {
      elements.voiceBtn.style.background = '';
      elements.voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    }
    if (event.error !== 'no-speech') {
      showToast(`Voice error: ${event.error}`);
    }
  };

  recognition.start();
}

function stopVoice() {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
  isListening = false;
}

// ============================================
// Main Entry Point
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  await loadSettings();
  setupEventListeners();
  initAnalytics();
  await initViews();
  // Always land on the Home dashboard, including first visit and refresh.
  showView('home');
  updateOnlineIndicator();
});
