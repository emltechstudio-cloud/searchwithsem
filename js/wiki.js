// Wikipedia API Service for Search with SEM

import { WIKI_ENDPOINTS, USER_AGENT } from './config.js';
import { setCache, getCache, clearExpiredCache } from './store.js';

// Cache TTL in milliseconds (1 hour)
const CACHE_TTL = 60 * 60 * 1000;

/**
 * Search Wikipedia for a topic
 * @param {string} query - Search query
 * @returns {Promise<Object>} Wikipedia summary data
 */
export async function searchWikipedia(query) {
  const cacheKey = `wiki-summary-${query}`;
  
  // Try to get from cache first
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(WIKI_ENDPOINTS.summary(query), {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for "not found" response
    if (data.type && data.type.includes('not_found')) {
      throw new Error('Topic not found');
    }
    
    // Cache the result
    setCache(cacheKey, data, CACHE_TTL);
    
    return data;
  } catch (error) {
    console.error('Failed to fetch Wikipedia summary:', error);
    throw error;
  }
}

/**
 * Get images for a Wikipedia topic
 * @param {string} title - Topic title
 * @returns {Promise<Array>} Array of image objects with src and title
 */
export async function getImages(title) {
  const cacheKey = `wiki-images-${title}`;
  
  // Try to get from cache first
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    // Primary: article media list
    const response = await fetch(WIKI_ENDPOINTS.mediaList(title), {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (response.ok) {
      const data = await response.json();
      const images = processMediaList(data);
      
      if (images.length > 0) {
        setCache(cacheKey, images, CACHE_TTL);
        return images;
      }
    }
    
    // Fallback: search-based images
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

/**
 * Process media list response
 * @param {Object} data - Media list API response
 * @returns {Array} Array of image objects
 */
function processMediaList(data) {
  return (data.items || [])
    .filter(item => {
      if (item.type !== 'image') return false;
      const title = (item.title || '').toLowerCase();
      return !title.includes('icon') && 
             !title.includes('commons-logo') && 
             !title.includes('wikimedia') && 
             (item.srcset || []).length > 0;
    })
    .map(item => {
      const srcset = item.srcset || [];
      // Pick highest resolution (last tends to be largest)
      const best = srcset[srcset.length - 1]?.src || srcset[0]?.src;
      if (!best) return null;
      
      return {
        src: best.startsWith('//') ? 'https:' + best : best,
        title: item.caption?.text || 
               (item.title || '').replace('File:', '').replace(/_/g, ' ').split('.')[0],
        thumbnail: best
      };
    })
    .filter(Boolean);
}

/**
 * Process search images response
 * @param {Object} data - Search API response
 * @returns {Array} Array of image objects
 */
function processSearchImages(data) {
  return Object.values(data.query?.pages || {})
    .filter(page => page.thumbnail)
    .map(page => ({
      src: page.thumbnail.source,
      title: page.title,
      thumbnail: page.thumbnail.source
    }));
}

/**
 * Get related topics
 * @param {string} title - Topic title
 * @returns {Promise<Array>} Array of related topic objects
 */
export async function getRelatedTopics(title) {
  const cacheKey = `wiki-related-${title}`;
  
  // Try to get from cache first
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(WIKI_ENDPOINTS.related(title), {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) {
      return [];
    }
    
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

/**
 * Get full article content (for Reader view)
 * @param {string} title - Topic title
 * @returns {Promise<string>} Full article HTML content
 */
export async function getFullArticle(title) {
  const cacheKey = `wiki-full-${title}`;
  
  // Try to get from cache first
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    // Use the REST API for full content
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) {
      // Fallback to the mobile version
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
    // Return a simple message
    return `<p>Unable to load the full article. Please check your internet connection.</p>`;
  }
}

/**
 * Get trending topics
 * @returns {Promise<Array>} Array of trending topic titles
 */
export async function getTrendingTopics() {
  const cacheKey = 'wiki-trending';
  
  // Try to get from cache first (shorter TTL for trending)
  const cached = getCache(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 15 * 60 * 1000)) {
    return cached.value;
  }
  
  try {
    const response = await fetch(WIKI_ENDPOINTS.trending(), {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) {
      return fallbackTrending();
    }
    
    const data = await response.json();
    const topics = (data.mostread?.articles || [])
      .filter(a => !a.title.includes(':'))
      .slice(0, 10)
      .map(a => a.titles?.normalized || a.title.replace(/_/g, ' '));
    
    if (topics.length > 0) {
      setCache(cacheKey, topics, 15 * 60 * 1000); // 15 minute cache
      return topics;
    }
    
    return fallbackTrending();
  } catch (error) {
    console.error('Failed to fetch trending topics:', error);
    return fallbackTrending();
  }
}

/**
 * Fallback trending topics
 * @returns {Array} Default trending topics
 */
function fallbackTrending() {
  return [
    'Artificial Intelligence',
    'Climate Change',
    'Quantum Physics',
    'Solar System',
    'DNA',
    'Ancient Rome',
    'Black Holes',
    'Machine Learning',
    'Renewable Energy',
    'World History'
  ];
}

/**
 * Get cover image for a topic
 * @param {string} title - Topic title
 * @returns {Promise<string>} Cover image URL
 */
export async function getCoverImage(title) {
  try {
    const images = await getImages(title);
    if (images.length > 0) {
      // Return the first image as cover
      return images[0].src;
    }
    
    // Fallback: try to get page thumbnail
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { 'User-Agent': USER_AGENT } }
    );
    
    const data = await response.json();
    if (data.thumbnail) {
      return data.thumbnail.source;
    }
    
    // Default placeholder
    return '';
  } catch (error) {
    console.error('Failed to get cover image:', error);
    return '';
  }
}

/**
 * Clear all Wikipedia caches
 * @returns {void}
 */
export function clearWikiCache() {
  clearExpiredCache();
}
