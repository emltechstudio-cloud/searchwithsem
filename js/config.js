// Configuration for Search with SEM
// Environment setup, API base URLs, and feature toggles

export const API_BASE = "https://emltechstudio-eml-core-api.hf.space";
export const WIKI_API = "https://en.wikipedia.org/api/rest_v1";
export const DDG_API = "https://api.duckduckgo.com";

// Feature toggles
export const AUTO_SAVE_KEY = "sem-auto-save";
export const THEME_KEY = "sem-theme";
export const VISITOR_ID_KEY = "sem-visitor-id";
export const EVENT_QUEUE_KEY = "sem-event-queue";

// Default settings
export const DEFAULT_SETTINGS = {
  autoSave: false,
  theme: "light",
  firstRun: true
};

// Wikipedia API endpoints
export const WIKI_ENDPOINTS = {
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

// DuckDuckGo API endpoints
export const DDG_ENDPOINTS = {
  instantAnswer: (query) => `${DDG_API}/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`
};

// Analytics endpoints
export const ANALYTICS_ENDPOINTS = {
  logEvent: `${API_BASE}/sem/event`,
  health: `${API_BASE}/sem/health`
};

// App version
export const APP_VERSION = "2.0.0";

// User agent for API requests
export const USER_AGENT = `SearchWithSEM/${APP_VERSION}`;
