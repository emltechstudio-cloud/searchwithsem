// UI Module for Search with SEM
// DOM rendering and view management

import { saveTopic, getTopics, deleteTopic, getAllTags, isTopicSaved, addToHistory, getHistory, clearHistory, getSetting, setSetting } from './store.js';
import { getInstantAnswer } from './ddg.js';
import { searchWikipedia, getImages, getRelatedTopics, getCoverImage, getTrendingTopics, getFullArticle } from './wiki.js';
import { shareTopic, shareToPlatform } from './share.js';
import { logEvent, EVENT_TYPES } from './analytics.js';
import { AUTO_SAVE_KEY, THEME_KEY, DEFAULT_SETTINGS } from './config.js';

// DOM Elements
const elements = {
  // Loading
  loading: null,
  loadingText: null,
  
  // Header
  header: null,
  headerLogo: null,
  searchWrap: null,
  searchInput: null,
  voiceBtn: null,
  searchBtn: null,
  autoSaveIndicator: null,
  onlineIndicator: null,
  
  // Main
  main: null,
  
  // Home
  homeScreen: null,
  homeLogo: null,
  homeSub: null,
  librarySection: null,
  libraryGrid: null,
  trendingSection: null,
  trendingChips: null,
  
  // Topic
  topicScreen: null,
  topicCover: null,
  topicTitle: null,
  topicSubtitle: null,
  quickFact: null,
  quickFactContent: null,
  quickFactToggle: null,
  wikiSummary: null,
  imagesStrip: null,
  imagesStripContainer: null,
  readFullBtn: null,
  relatedChips: null,
  userNote: null,
  saveBtn: null,
  shareBtn: null,
  
  // Reader
  readerScreen: null,
  readerContent: null,
  readerClose: null,
  
  // Library
  libraryScreen: null,
  librarySearch: null,
  libraryTags: null,
  libraryResults: null,
  
  // Lightbox
  lightbox: null,
  lbImg: null,
  lbCaption: null,
  lbCounter: null,
  lbClose: null,
  lbPrev: null,
  lbNext: null,
  
  // Footer
  footer: null,
  homeBtn: null,
  libraryBtn: null,
  historyBtn: null,
  themeBtn: null,
  
  // History Panel
  historyPanel: null,
  historyList: null,
  clearHistoryBtn: null,
  closeHistoryBtn: null,
  
  // First Run Modal
  firstRunModal: null,
  firstRunOverlay: null,
  firstRunYes: null,
  firstRunNo: null
};

// State
const state = {
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

// Initialize UI
export async function initUI() {
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
  
  // Setup network listeners
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

// Cache DOM elements
function cacheElements() {
  elements.loading = document.getElementById('loading');
  elements.loadingText = document.getElementById('loadingText');
  
  elements.header = document.querySelector('header');
  elements.headerLogo = document.getElementById('headerLogo');
  elements.searchWrap = document.querySelector('.search-wrap');
  elements.searchInput = document.getElementById('searchInput');
  elements.voiceBtn = document.getElementById('voiceBtn');
  elements.searchBtn = document.getElementById('searchBtn');
  
  elements.main = document.querySelector('main');
  
  elements.homeScreen = document.getElementById('homeScreen');
  elements.homeLogo = document.getElementById('homeLogo');
  elements.homeSub = document.querySelector('.home-sub');
  elements.librarySection = document.querySelector('.library-section');
  elements.libraryGrid = document.getElementById('libraryGrid');
  elements.trendingSection = document.querySelector('.trending-section');
  elements.trendingChips = document.getElementById('trendingChips');
  
  elements.topicScreen = document.getElementById('topicScreen');
  elements.topicCover = document.getElementById('topicCover');
  elements.topicTitle = document.getElementById('topicTitle');
  elements.topicSubtitle = document.getElementById('topicSubtitle');
  elements.quickFact = document.getElementById('quickFact');
  elements.quickFactContent = document.getElementById('quickFactContent');
  elements.quickFactToggle = document.getElementById('quickFactToggle');
  elements.wikiSummary = document.getElementById('wikiSummary');
  elements.imagesStrip = document.getElementById('imagesStrip');
  elements.imagesStripContainer = document.querySelector('.images-strip-container');
  elements.readFullBtn = document.getElementById('readFullBtn');
  elements.relatedChips = document.getElementById('relatedChips');
  elements.userNote = document.getElementById('userNote');
  elements.saveBtn = document.getElementById('saveBtn');
  elements.shareBtn = document.getElementById('shareBtn');
  
  elements.readerScreen = document.getElementById('readerScreen');
  elements.readerContent = document.getElementById('readerContent');
  elements.readerClose = document.getElementById('readerClose');
  
  elements.libraryScreen = document.getElementById('libraryScreen');
  elements.librarySearch = document.getElementById('librarySearch');
  elements.libraryTags = document.getElementById('libraryTags');
  elements.libraryResults = document.getElementById('libraryResults');
  
  elements.lightbox = document.getElementById('lightbox');
  elements.lbImg = document.getElementById('lbImg');
  elements.lbCaption = document.getElementById('lbCaption');
  elements.lbCounter = document.getElementById('lbCounter');
  elements.lbClose = document.getElementById('lbClose');
  elements.lbPrev = document.getElementById('lbPrev');
  elements.lbNext = document.getElementById('lbNext');
  
  elements.footer = document.querySelector('footer');
  elements.homeBtn = document.getElementById('homeBtn');
  elements.libraryBtn = document.getElementById('libraryBtn');
  elements.historyBtn = document.getElementById('historyBtn');
  elements.themeBtn = document.getElementById('themeBtn');
  
  elements.historyPanel = document.getElementById('historyPanel');
  elements.historyList = document.getElementById('historyList');
  elements.clearHistoryBtn = document.getElementById('clearHistoryBtn');
  elements.closeHistoryBtn = document.getElementById('closeHistoryBtn');
  
  elements.firstRunModal = document.getElementById('firstRunModal');
  elements.firstRunOverlay = document.getElementById('firstRunOverlay');
  elements.firstRunYes = document.getElementById('firstRunYes');
  elements.firstRunNo = document.getElementById('firstRunNo');
}

// Load settings
async function loadSettings() {
  state.autoSave = (await getSetting(AUTO_SAVE_KEY, DEFAULT_SETTINGS.autoSave)) === true;
  state.theme = await getSetting(THEME_KEY, DEFAULT_SETTINGS.theme);
  
  // Apply theme
  applyTheme(state.theme);
  
  // Show first run modal if needed
  const firstRun = await getSetting('firstRun', true);
  if (firstRun) {
    showFirstRunModal();
    await setSetting('firstRun', false);
  }
}

// Apply theme
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Search
  elements.searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });
  
  elements.searchBtn?.addEventListener('click', performSearch);
  elements.voiceBtn?.addEventListener('click', toggleVoice);
  
  // Navigation
  elements.homeBtn?.addEventListener('click', () => showView('home'));
  elements.libraryBtn?.addEventListener('click', () => showView('library'));
  elements.historyBtn?.addEventListener('click', () => toggleHistoryPanel());
  elements.themeBtn?.addEventListener('click', toggleTheme);
  elements.headerLogo?.addEventListener('click', () => showView('home'));
  elements.homeLogo?.addEventListener('click', () => showView('home'));
  
  // Topic actions
  elements.readFullBtn?.addEventListener('click', openReader);
  elements.saveBtn?.addEventListener('click', saveCurrentTopic);
  elements.shareBtn?.addEventListener('click', shareCurrentTopic);
  
  // Quick fact toggle
  elements.quickFactToggle?.addEventListener('click', toggleQuickFact);
  
  // User note
  elements.userNote?.addEventListener('input', (e) => {
    state.currentNote = e.target.value;
    // Auto-save note every 30 seconds
    if (state.currentTopic) {
      debounceAutoSave();
    }
  });
  
  // Lightbox
  elements.lbClose?.addEventListener('click', closeLightbox);
  elements.lbPrev?.addEventListener('click', () => shiftLb(-1));
  elements.lbNext?.addEventListener('click', () => shiftLb(1));
  elements.lightbox?.addEventListener('click', (e) => {
    if (e.target === elements.lightbox) closeLightbox();
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (elements.lightbox?.classList.contains('active')) {
      if (e.key === 'ArrowLeft') shiftLb(-1);
      else if (e.key === 'ArrowRight') shiftLb(1);
      else if (e.key === 'Escape') closeLightbox();
    } else if (e.key === 'Escape') {
      closeHistoryPanel();
    }
  });
  
  // Swipe on lightbox
  let touchX = 0;
  elements.lightbox?.addEventListener('touchstart', (e) => {
    touchX = e.touches[0].clientX;
  }, { passive: true });
  
  elements.lightbox?.addEventListener('touchend', (e) => {
    const diff = touchX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 48) shiftLb(diff > 0 ? 1 : -1);
  });
  
  // Close history on outside tap
  document.addEventListener('click', (e) => {
    if (elements.historyPanel && !elements.historyPanel.contains(e.target) && 
        e.target !== elements.historyBtn && !elements.historyBtn?.contains(e.target)) {
      closeHistoryPanel();
    }
  });
  
  // Library search
  elements.librarySearch?.addEventListener('input', (e) => {
    renderLibrary(e.target.value);
  });
  
  // First run modal
  elements.firstRunYes?.addEventListener('click', () => {
    state.autoSave = true;
    setSetting(AUTO_SAVE_KEY, true);
    closeFirstRunModal();
  });
  
  elements.firstRunNo?.addEventListener('click', () => {
    state.autoSave = false;
    setSetting(AUTO_SAVE_KEY, false);
    closeFirstRunModal();
  });
  
  // History
  elements.clearHistoryBtn?.addEventListener('click', () => {
    if (confirm('Clear all history?')) {
      clearHistory();
      renderHistory();
      showToast('History cleared');
    }
  });
  
  elements.closeHistoryBtn?.addEventListener('click', closeHistoryPanel);
}

// Debounced auto-save
let autoSaveTimeout = null;
function debounceAutoSave() {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    if (state.currentTopic && state.currentNote) {
      saveCurrentTopic();
    }
  }, 30000); // 30 seconds
}

// Initialize views
async function initViews() {
  // Load trending topics
  await loadTrending();
  
  // Render library preview on home
  await renderLibraryPreview();
  
  // Render history
  renderHistory();
}

// Show view
function showView(view) {
  // Hide all views
  const allViews = ['home', 'topic', 'reader', 'library'];
  allViews.forEach(v => {
    const el = document.getElementById(`${v}Screen`);
    if (el) el.style.display = 'none';
  });
  
  // Show requested view
  state.currentView = view;
  
  switch (view) {
    case 'home':
      elements.homeScreen?.style.display = 'flex';
      setActiveFooter('home');
      break;
    case 'topic':
      elements.topicScreen?.style.display = 'block';
      setActiveFooter('library');
      break;
    case 'reader':
      elements.readerScreen?.style.display = 'block';
      setActiveFooter('library');
      break;
    case 'library':
      elements.libraryScreen?.style.display = 'block';
      renderLibrary();
      setActiveFooter('library');
      break;
  }
  
  window.scrollTo(0, 0);
}

// Set active footer button
function setActiveFooter(button) {
  [elements.homeBtn, elements.libraryBtn, elements.historyBtn, elements.themeBtn].forEach(btn => {
    btn?.classList.remove('active');
  });
  
  const activeBtn = {
    home: elements.homeBtn,
    library: elements.libraryBtn,
    history: elements.historyBtn,
    theme: elements.themeBtn
  }[button];
  
  activeBtn?.classList.add('active');
}

// Perform search
async function performSearch() {
  const query = elements.searchInput?.value.trim();
  if (!query) {
    showToast('Enter something to search');
    return;
  }
  
  showLoading('Searching Wikipedia...');
  
  try {
    // Add to history
    addToHistory(query);
    renderHistory();
    
    // Save last search
    localStorage.setItem('lastSearch', query);
    
    // Search Wikipedia
    const wikiData = await searchWikipedia(query);
    
    // Get images and related topics
    const [images, related, instantAnswer, coverImage] = await Promise.all([
      getImages(wikiData.title || query),
      getRelatedTopics(wikiData.title || query),
      getInstantAnswer(query),
      getCoverImage(wikiData.title || query)
    ]);
    
    // Store current state
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
    
    // Check if topic is saved
    const isSaved = await isTopicSaved(state.currentTopic.title);
    
    // Render topic view
    renderTopicView(instantAnswer, isSaved);
    
    // Show topic view
    showView('topic');
    
    // Log search event
    logEvent(EVENT_TYPES.SEM_SEARCH);
    
    // Auto-save if enabled
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

// Render topic view
function renderTopicView(instantAnswer, isSaved) {
  // Cover image
  if (state.currentTopic.coverImage) {
    elements.topicCover?.setAttribute('src', state.currentTopic.coverImage);
    elements.topicCover?.style.display = 'block';
  } else {
    elements.topicCover?.style.display = 'none';
  }
  
  // Title and subtitle
  elements.topicTitle?.textContent = state.currentTopic.title;
  elements.topicSubtitle?.textContent = instantAnswer ? 'Quick Fact Available' : '';
  
  // Quick fact
  if (instantAnswer) {
    elements.quickFactContent?.textContent = instantAnswer;
    elements.quickFact?.style.display = 'block';
    elements.quickFactToggle?.textContent = 'Hide Quick Fact';
  } else {
    elements.quickFact?.style.display = 'none';
  }
  
  // Wikipedia summary
  elements.wikiSummary?.innerHTML = `<p>${state.currentTopic.summary}</p>`;
  
  // Images strip
  renderImagesStrip();
  
  // Related chips
  renderRelatedChips();
  
  // User note
  elements.userNote?.value = state.currentNote;
  
  // Save button
  elements.saveBtn?.textContent = isSaved ? 'Saved ✓' : 'Save';
  elements.saveBtn?.dataset.saved = isSaved.toString();
  
  // Reader button
  elements.readFullBtn?.onclick = openReader;
}

// Render images strip
function renderImagesStrip() {
  if (!elements.imagesStrip || !state.currentImages.length) {
    elements.imagesStripContainer?.style.display = 'none';
    return;
  }
  
  elements.imagesStrip.innerHTML = '';
  
  // Show first 4 images
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
  
  // Show "see more" if there are more images
  if (state.currentImages.length > 4) {
    const seeMore = document.createElement('button');
    seeMore.className = 'see-more-btn';
    seeMore.textContent = `+${state.currentImages.length - 4} more`;
    seeMore.onclick = () => openLightbox(4);
    elements.imagesStrip.appendChild(seeMore);
  }
  
  elements.imagesStripContainer?.style.display = 'flex';
}

// Render related chips
function renderRelatedChips() {
  if (!elements.relatedChips || !state.currentRelated.length) {
    return;
  }
  
  elements.relatedChips.innerHTML = '';
  
  state.currentRelated.forEach(related => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = related.title;
    chip.onclick = () => {
      elements.searchInput.value = related.title;
      performSearch();
    };
    elements.relatedChips.appendChild(chip);
  });
}

// Toggle quick fact
function toggleQuickFact() {
  if (elements.quickFact?.style.display === 'none') {
    elements.quickFact.style.display = 'block';
    elements.quickFactToggle.textContent = 'Hide Quick Fact';
  } else {
    elements.quickFact.style.display = 'none';
    elements.quickFactToggle.textContent = 'Show Quick Fact';
  }
}

// Open reader
async function openReader() {
  if (!state.currentTopic) return;
  
  showLoading('Loading article...');
  
  try {
    const articleHtml = await getFullArticle(state.currentTopic.title);
    elements.readerContent.innerHTML = articleHtml;
    showView('reader');
    
    // Log reader event
    logEvent(EVENT_TYPES.SEM_READER, { topic: state.currentTopic.title });
  } catch (error) {
    console.error('Failed to load article:', error);
    showToast('Unable to load article. Please check your internet connection.');
  } finally {
    hideLoading();
  }
}

// Close reader
function closeReader() {
  showView('topic');
}

// Save current topic
async function saveCurrentTopic() {
  if (!state.currentTopic) return;
  
  const topic = {
    ...state.currentTopic,
    note: state.currentNote,
    isAutoSaved: state.autoSave,
    tags: []
  };
  
  try {
    await saveTopic(topic);
    elements.saveBtn.textContent = 'Saved ✓';
    elements.saveBtn.dataset.saved = 'true';
    showToast('Topic saved to library!');
    
    // Log save event
    logEvent(EVENT_TYPES.SEM_SAVE, { topic: topic.title });
    
    // Refresh library preview
    await renderLibraryPreview();
  } catch (error) {
    console.error('Failed to save topic:', error);
    showToast('Failed to save topic.');
  }
}

// Share current topic
async function shareCurrentTopic() {
  if (!state.currentTopic) return;
  
  await shareTopic(state.currentTopic);
}

// Load trending topics
async function loadTrending() {
  try {
    const topics = await getTrendingTopics();
    renderTrendingChips(topics);
  } catch (error) {
    console.error('Failed to load trending:', error);
    renderTrendingChips(['Artificial Intelligence', 'Climate Change', 'Quantum Physics', 'Solar System']);
  }
}

// Render trending chips
function renderTrendingChips(topics) {
  if (!elements.trendingChips) return;
  
  elements.trendingChips.innerHTML = '';
  
  topics.forEach(topic => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = topic;
    chip.onclick = () => {
      elements.searchInput.value = topic;
      performSearch();
    };
    elements.trendingChips.appendChild(chip);
  });
}

// Render library preview on home
async function renderLibraryPreview() {
  if (!elements.libraryGrid) return;
  
  const topics = await getTopics('', null, 6); // Get first 6
  
  elements.libraryGrid.innerHTML = '';
  
  if (topics.length === 0) {
    elements.librarySection?.style.display = 'none';
    return;
  }
  
  topics.forEach(topic => {
    const card = document.createElement('button');
    card.className = 'library-card';
    card.onclick = () => {
      // Load the topic
      state.currentTopic = topic;
      state.currentImages = [];
      state.currentRelated = [];
      state.currentNote = topic.note || '';
      
      // Render topic view
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
  
  elements.librarySection?.style.display = 'block';
}

// Render library
async function renderLibrary(query = '', tag = null) {
  if (!elements.libraryResults) return;
  
  const topics = await getTopics(query, tag);
  
  elements.libraryResults.innerHTML = '';
  
  if (topics.length === 0) {
    elements.libraryResults.innerHTML = '<div class="empty-state"><i class="fas fa-book"></i><p>No topics found. Try a different search or tag.</p></div>';
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
    
    const tags = document.createElement('div');
    tags.className = 'library-item-tags';
    if (topic.tags && topic.tags.length > 0) {
      topic.tags.forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        tagEl.textContent = `#${tag}`;
        tags.appendChild(tagEl);
      });
    }
    
    const actions = document.createElement('div');
    actions.className = 'library-item-actions';
    
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn-icon';
    viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
    viewBtn.title = 'View';
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      // Load the topic
      state.currentTopic = topic;
      state.currentImages = [];
      state.currentRelated = [];
      state.currentNote = topic.note || '';
      
      // Render topic view
      renderTopicView(null, true);
      showView('topic');
    };
    
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn-icon';
    shareBtn.innerHTML = '<i class="fas fa-share-alt"></i>';
    shareBtn.title = 'Share';
    shareBtn.onclick = (e) => {
      e.stopPropagation();
      shareTopic(topic);
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-icon-danger';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = 'Delete';
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
    info.appendChild(tags);
    
    card.appendChild(img);
    card.appendChild(info);
    card.appendChild(actions);
    
    // Add click handler for the whole card
    card.onclick = () => {
      // Load the topic
      state.currentTopic = topic;
      state.currentImages = [];
      state.currentRelated = [];
      state.currentNote = topic.note || '';
      
      // Render topic view
      renderTopicView(null, true);
      showView('topic');
    };
    
    elements.libraryResults.appendChild(card);
  });
}

// Render library tags
async function renderLibraryTags() {
  if (!elements.libraryTags) return;
  
  const tags = await getAllTags();
  
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

// Toggle theme
function toggleTheme() {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  state.theme = newTheme;
  setSetting(THEME_KEY, newTheme);
  applyTheme(newTheme);
  
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

// Show first run modal
function showFirstRunModal() {
  if (!elements.firstRunModal || !elements.firstRunOverlay) return;
  
  elements.firstRunModal.style.display = 'block';
  elements.firstRunOverlay.style.display = 'block';
}

// Close first run modal
function closeFirstRunModal() {
  if (!elements.firstRunModal || !elements.firstRunOverlay) return;
  
  elements.firstRunModal.style.display = 'none';
  elements.firstRunOverlay.style.display = 'none';
}

// Update online indicator
function updateOnlineIndicator() {
  if (elements.onlineIndicator) {
    elements.onlineIndicator.textContent = state.isOnline ? '●' : '○';
    elements.onlineIndicator.title = state.isOnline ? 'Online' : 'Offline';
  }
  
  if (elements.autoSaveIndicator) {
    elements.autoSaveIndicator.textContent = state.autoSave ? 'Auto-Save: ON' : 'Auto-Save: OFF';
  }
}

// Show loading
function showLoading(text = 'Loading...') {
  if (elements.loading && elements.loadingText) {
    elements.loadingText.textContent = text;
    elements.loading.classList.add('active');
  }
}

// Hide loading
function hideLoading() {
  if (elements.loading) {
    elements.loading.classList.remove('active');
  }
}

// Show toast
function showToast(message, duration = 3000) {
  // Remove existing toasts
  document.querySelectorAll('.sem-toast').forEach(t => t.remove());
  
  const toast = document.createElement('div');
  toast.className = 'sem-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 74px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--text, #202124);
    color: var(--bg, #ffffff);
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 13px;
    z-index: 4000;
    white-space: nowrap;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    pointer-events: none;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

// Lightbox functions
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

// History panel functions
function toggleHistoryPanel() {
  if (elements.historyPanel?.classList.contains('open')) {
    closeHistoryPanel();
  } else {
    openHistoryPanel();
  }
}

function openHistoryPanel() {
  elements.historyPanel?.classList.add('open');
  elements.historyBtn?.classList.add('active');
  renderHistory();
}

function closeHistoryPanel() {
  elements.historyPanel?.classList.remove('open');
  elements.historyBtn?.classList.remove('active');
}

// Render history
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
    deleteBtn.title = 'Delete';
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
      elements.searchInput.value = item.query;
      closeHistoryPanel();
      performSearch();
    };
    
    elements.historyList.appendChild(div);
  });
}

// Voice search
let recognition = null;
let isListening = false;

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
  if (!recognition) {
    showToast('Voice search not supported');
    return;
  }
  
  if (isListening) {
    stopVoice();
  } else {
    try {
      recognition.start();
    } catch {
      // Already started or error
    }
  }
}

function stopVoice() {
  isListening = false;
  if (elements.voiceBtn) elements.voiceBtn.classList.remove('listening');
  try {
    recognition?.stop();
  } catch {
    // Ignore errors
  }
}

// Time ago utility
function timeAgo(timestamp) {
  const d = Date.now() - timestamp;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  if (d < 604800000) return `${Math.floor(d / 86400000)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Initialize voice on module load
initVoice();

// Export public functions
export {
  showView,
  performSearch,
  renderLibrary,
  renderLibraryTags,
  shareToPlatform,
  updateOnlineIndicator,
  showToast,
  showLoading,
  hideLoading
};
