// Store Module for Search with SEM
// Offline-first persistence using IndexedDB and localStorage

// Import idb for IndexedDB operations
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7/+esm';

const DB_NAME = 'SearchWithSEM';
const TOPICS_STORE = 'topics';
const NOTES_STORE = 'notes';
const SETTINGS_STORE = 'settings';

// Initialize database
let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, {
      upgrade(db, oldVersion) {
        // Create topics store if it doesn't exist
        if (!db.objectStoreNames.contains(TOPICS_STORE)) {
          const topicsStore = db.createObjectStore(TOPICS_STORE, { keyPath: 'id' });
          topicsStore.createIndex('title', 'title', { unique: false });
          topicsStore.createIndex('savedAt', 'savedAt', { unique: false });
          topicsStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }
        
        // Create notes store
        if (!db.objectStoreNames.contains(NOTES_STORE)) {
          const notesStore = db.createObjectStore(NOTES_STORE, { keyPath: 'topicId' });
          notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        
        // Create settings store
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      }
    });
  }
  return dbPromise;
}

// ============================================
// Topics Store Operations
// ============================================

/**
 * Save a topic to the library
 * @param {Object} topic - Topic data
 * @param {string} topic.title - Topic title
 * @param {string} [topic.id] - Optional ID
 * @param {string} [topic.summary] - Wikipedia summary
 * @param {string} [topic.coverImage] - Cover image URL
 * @param {string} [topic.url] - Wikipedia URL
 * @param {Array<string>} [topic.tags] - Tags array
 * @param {string} [topic.note] - User note
 * @returns {Promise<Object>} Saved topic with ID
 */
export async function saveTopic(topic) {
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
  
  await db.put(TOPICS_STORE, topicToSave);
  return topicToSave;
}

/**
 * Get all saved topics
 * @returns {Promise<Array>} Array of topics
 */
export async function getTopics(query = '', tag = null) {
  const db = await getDB();
  let topics = await db.getAll(TOPICS_STORE);
  
  // Sort by savedAt descending (newest first)
  topics.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  
  // Filter by query
  if (query) {
    const queryLower = query.toLowerCase();
    topics = topics.filter(t => 
      t.title.toLowerCase().includes(queryLower) ||
      t.note.toLowerCase().includes(queryLower) ||
      t.summary.toLowerCase().includes(queryLower)
    );
  }
  
  // Filter by tag
  if (tag) {
    topics = topics.filter(t => t.tags.includes(tag));
  }
  
  return topics;
}

/**
 * Get a topic by ID
 * @param {string} id - Topic ID
 * @returns {Promise<Object|null>} Topic or null
 */
export async function getTopicById(id) {
  const db = await getDB();
  return db.get(TOPICS_STORE, id);
}

/**
 * Delete a topic
 * @param {string} id - Topic ID
 * @returns {Promise<void>}
 */
export async function deleteTopic(id) {
  const db = await getDB();
  await db.delete(TOPICS_STORE, id);
}

/**
 * Check if a topic is saved
 * @param {string} title - Topic title
 * @returns {Promise<boolean>}
 */
export async function isTopicSaved(title) {
  const topics = await getTopics();
  return topics.some(t => t.title === title);
}

/**
 * Update a topic's note
 * @param {string} id - Topic ID
 * @param {string} note - New note
 * @returns {Promise<void>}
 */
export async function updateTopicNote(id, note) {
  const db = await getDB();
  const topic = await db.get(TOPICS_STORE, id);
  if (topic) {
    await db.put(TOPICS_STORE, { ...topic, note, lastRead: new Date().toISOString() });
  }
}

/**
 * Update a topic's tags
 * @param {string} id - Topic ID
 * @param {Array<string>} tags - New tags array
 * @returns {Promise<void>}
 */
export async function updateTopicTags(id, tags) {
  const db = await getDB();
  const topic = await db.get(TOPICS_STORE, id);
  if (topic) {
    await db.put(TOPICS_STORE, { ...topic, tags });
  }
}

/**
 * Get all unique tags
 * @returns {Promise<Array<string>>} Array of unique tags
 */
export async function getAllTags() {
  const topics = await getTopics();
  const tagsSet = new Set();
  topics.forEach(t => t.tags.forEach(tag => tagsSet.add(tag)));
  return Array.from(tagsSet).sort();
}

// ============================================
// Settings Store Operations
// ============================================

/**
 * Get a setting value
 * @param {string} key - Setting key
 * @param {*} defaultValue - Default value if not set
 * @returns {Promise<*>} Setting value
 */
export async function getSetting(key, defaultValue = null) {
  const db = await getDB();
  try {
    const setting = await db.get(SETTINGS_STORE, key);
    return setting ? setting.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
  const db = await getDB();
  await db.put(SETTINGS_STORE, { key, value });
}

// ============================================
// LocalStorage Cache (for non-persistent data)
// ============================================

/**
 * Get cache from localStorage
 * @param {string} key - Cache key
 * @returns {*} Cached value or null
 */
export function getCache(key) {
  try {
    const data = localStorage.getItem(`sem-cache-${key}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Set cache in localStorage
 * @param {string} key - Cache key
 * @param {*} value - Value to cache
 * @param {number} [ttl] - Time to live in milliseconds
 * @returns {void}
 */
export function setCache(key, value, ttl) {
  try {
    const data = { value, timestamp: Date.now() };
    if (ttl) {
      data.expires = Date.now() + ttl;
    }
    localStorage.setItem(`sem-cache-${key}`, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to set cache:', error);
  }
}

/**
 * Clear expired cache entries
 * @returns {void}
 */
export function clearExpiredCache() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('sem-cache-')) {
        const data = JSON.parse(localStorage.getItem(key));
        if (data?.expires && data.expires < Date.now()) {
          localStorage.removeItem(key);
          i--; // Adjust index after removal
        }
      }
    }
  } catch (error) {
    console.error('Failed to clear expired cache:', error);
  }
}

// ============================================
// History Operations (localStorage based)
// ============================================

const HISTORY_KEY = 'sem-history';

/**
 * Add a search to history
 * @param {string} query - Search query
 * @returns {void}
 */
export function addToHistory(query) {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    // Remove duplicate
    const index = history.findIndex(h => h.query === query);
    if (index > -1) {
      history.splice(index, 1);
    }
    // Add to beginning
    history.unshift({ query, timestamp: Date.now() });
    // Keep last 50
    if (history.length > 50) {
      history.length = 50;
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to add to history:', error);
  }
}

/**
 * Get search history
 * @returns {Array} History array
 */
export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Clear history
 * @returns {void}
 */
export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
}

// ============================================
// Export all functions
// ============================================

export {
  getDB,
  getAllTags
};
