// DuckDuckGo Instant Answer Service for Search with SEM

import { DDG_ENDPOINTS, USER_AGENT } from './config.js';
import { setCache, getCache } from './store.js';

// Cache TTL in milliseconds (1 hour)
const CACHE_TTL = 60 * 60 * 1000;

/**
 * Get instant answer from DuckDuckGo
 * @param {string} query - Search query
 * @returns {Promise<string|null>} Instant answer text or null
 */
export async function getInstantAnswer(query) {
  const cacheKey = `ddg-ia-${query}`;
  
  // Try to get from cache first
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(DDG_ENDPOINTS.instantAnswer(query), {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Extract the answer from various possible fields
    let answer = null;
    
    // Try Abstract first (usually the most comprehensive)
    if (data.Abstract) {
      answer = data.Abstract;
    }
    // Try Answer (short direct answer)
    else if (data.Answer) {
      answer = data.Answer;
    }
    // Try Definition
    else if (data.Definition) {
      answer = data.Definition;
    }
    // Try RelatedTopics (first one's description)
    else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      answer = data.RelatedTopics[0].Text || data.RelatedTopics[0].FirstURL;
    }
    
    // Cache the result
    if (answer) {
      setCache(cacheKey, answer, CACHE_TTL);
    }
    
    return answer;
  } catch (error) {
    console.error('Failed to fetch DuckDuckGo instant answer:', error);
    return null;
  }
}

/**
 * Get quick facts from DuckDuckGo
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of quick fact strings
 */
export async function getQuickFacts(query) {
  const cacheKey = `ddg-facts-${query}`;
  
  // Try to get from cache first
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(DDG_ENDPOINTS.instantAnswer(query), {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    const facts = [];
    
    // Extract various types of information
    if (data.Abstract) {
      // Split abstract into sentences for facts
      const sentences = data.Abstract.split('. ').filter(s => s.length > 20);
      facts.push(...sentences.slice(0, 3));
    }
    
    if (data.Answer) {
      facts.push(data.Answer);
    }
    
    // Process RelatedTopics
    if (data.RelatedTopics) {
      data.RelatedTopics.forEach(topic => {
        if (topic.Text && topic.Text.length < 200) {
          facts.push(topic.Text);
        }
      });
    }
    
    // Process Results (if present)
    if (data.Results) {
      data.Results.forEach(result => {
        if (result.Text && result.Text.length < 200) {
          facts.push(result.Text);
        }
      });
    }
    
    // Limit to 5 facts and cache
    const limitedFacts = facts.slice(0, 5);
    if (limitedFacts.length > 0) {
      setCache(cacheKey, limitedFacts, CACHE_TTL);
    }
    
    return limitedFacts;
  } catch (error) {
    console.error('Failed to fetch DuckDuckGo quick facts:', error);
    return [];
  }
}

/**
 * Get entity information from DuckDuckGo
 * @param {string} query - Search query
 * @returns {Promise<Object>} Entity information
 */
export async function getEntityInfo(query) {
  try {
    const response = await fetch(DDG_ENDPOINTS.instantAnswer(query), {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) {
      return {};
    }
    
    const data = await response.json();
    
    // Extract entity information
    const entity = {};
    
    if (data.Entity) {
      entity.name = data.Entity;
    }
    
    if (data.Type) {
      entity.type = data.Type;
    }
    
    if (data.Definition) {
      entity.definition = data.Definition;
    }
    
    // Extract categories if available
    if (data.RelatedTopics) {
      entity.categories = data.RelatedTopics
        .filter(t => t.Name)
        .map(t => t.Name);
    }
    
    return entity;
  } catch (error) {
    console.error('Failed to fetch DuckDuckGo entity info:', error);
    return {};
  }
}

/**
 * Check if a query has a direct answer
 * @param {string} query - Search query
 * @returns {Promise<boolean>} True if direct answer exists
 */
export async function hasDirectAnswer(query) {
  try {
    const answer = await getInstantAnswer(query);
    return answer !== null;
  } catch {
    return false;
  }
}
