const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach(value => this.values.add(value)); }
  remove(...values) { values.forEach(value => this.values.delete(value)); }
  toggle(value, force) {
    const shouldAdd = force === undefined ? !this.values.has(value) : force;
    shouldAdd ? this.values.add(value) : this.values.delete(value);
    return shouldAdd;
  }
  contains(value) { return this.values.has(value); }
}

class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.classList = new ClassList();
    this.listeners = {};
    this.value = '';
    this.textContent = '';
    this._innerHTML = '';
    this.onclick = null;
  }
  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
    const matches = [...this._innerHTML.matchAll(/<([a-z0-9]+)[^>]*class="([^"]+)"[^>]*>(.*?)<\/\1>/gis)];
    for (const match of matches) {
      const child = new MockElement(match[1]);
      match[2].split(/\s+/).forEach(cls => child.classList.add(cls));
      child.innerHTML = match[3];
      this.children.push(child);
    }
  }
  get innerHTML() { return this._innerHTML; }
  appendChild(child) { this.children.push(child); return child; }
  querySelector(selector) {
    if (selector.startsWith('.')) {
      const wanted = selector.slice(1);
      const queue = [...this.children]; while (queue.length) { const child = queue.shift(); if (child.classList.contains(wanted)) return child; queue.push(...child.children); } const match = this._innerHTML.match(new RegExp('class=\"[^\"]*\\b' + wanted + '\\b[^\"]*\"[^>]*>([^<]*)', 'i')); if (match) { const child = new MockElement('span'); child.textContent = match[1]; this.children.push(child); return child; } return null;
    }
    return null;
  }
  querySelectorAll(selector) { const found = this.querySelector(selector); return found ? [found] : []; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  remove() { this.removed = true; }
  contains() { return false; }
}

function createLocalStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    clear: () => values.clear()
  };
}

function makeRequest(result) {
  const request = {};
  queueMicrotask(() => { request.result = result; request.onsuccess?.({ target: request }); });
  return request;
}

function createIndexedDB() {
  const stores = new Map();
  return {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          objectStoreNames: { contains: store => stores.has(store) },
          createObjectStore(store) {
            stores.set(store, new Map());
            return { createIndex() {} };
          },
          transaction(storeName, mode) {
            const data = stores.get(storeName);
            const tx = { mode, oncomplete: null, onerror: null };
            tx.objectStore = () => ({
              put(value) { data.set(value.id, structuredClone(value)); queueMicrotask(() => tx.oncomplete?.()); },
              delete(id) { data.delete(id); queueMicrotask(() => tx.oncomplete?.()); },
              getAll() { return makeRequest([...data.values()].map(value => structuredClone(value))); },
              get(id) { return makeRequest(data.has(id) ? structuredClone(data.get(id)) : undefined); }
            });
            return tx;
          }
        };
        request.onupgradeneeded?.({ target: request });
        request.onsuccess?.({ target: request });
      });
      return request;
    }
  };
}

function loadBundle() {
  const source = fs.readFileSync('js/app-bundle.js', 'utf8');
  const entryPoint = source.indexOf('// Main Entry Point');
  const isolated = source.slice(0, entryPoint) + `
    globalThis.__app = {
      getState: () => state,
      setState: value => { state = value; },
      setElements: value => { elements = value; },
      renderStats,
      renderAchievements,
      renderHistory,
      saveCurrentTopic,
      getTopics,
      saveTopic,
      isTopicSaved,
      getAchievements,
      getHistory
    };
  `;
  const document = {
    body: new MockElement('body'),
    addEventListener() {},
    createElement: tag => new MockElement(tag),
    querySelector: () => null,
    getElementById: () => null,
    querySelectorAll: () => []
  };
  const context = {
    console,
    document,
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }), scrollTo() {} },
    navigator: { onLine: true, userAgent: 'node-test', language: 'en-US' },
    localStorage: createLocalStorage(),
    indexedDB: createIndexedDB(),
    crypto: { randomUUID: () => 'test-id', subtle: { digest: async () => new Uint8Array(32).buffer } },
    TextEncoder,
    fetch: async () => ({ ok: true, text: async () => '<article>Full article</article>', json: async () => ({}) }),
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    Date,
    Math,
    JSON,
    URL,
    structuredClone
  };
  vm.createContext(context);
  vm.runInContext(isolated, context, { filename: 'app-bundle.js' });
  return { app: context.__app, context };
}

function baseElements() {
  return {
    statsSection: new MockElement(),
    achievementsList: new MockElement(),
    historyList: new MockElement(),
    saveBtn: new MockElement('button'),
    readerSaveBtn: new MockElement('button'),
    readerTitle: new MockElement(),
    libraryGrid: null,
    firstRunModal: null,
    librarySection: null
  };
}

test('Home dashboard renders confident metric cards', () => {
  const { app } = loadBundle();
  const elements = baseElements();
  app.setElements(elements);
  app.setState({ stats: { streak: 4, totalReads: 12, totalSaves: 7, totalShares: 3 } });
  app.renderStats();
  assert.match(elements.statsSection.innerHTML, /Day streak/);
  assert.match(elements.statsSection.innerHTML, /Articles read/);
  assert.match(elements.statsSection.innerHTML, /Saved topics/);
  assert.match(elements.statsSection.innerHTML, /Knowledge builder/);
  assert.match(elements.statsSection.innerHTML, /Level 4/);
});

test('Achievements dashboard shows XP, next milestone, analytics, and locked badges', () => {
  const { app, context } = loadBundle();
  const elements = baseElements();
  app.setElements(elements);
  context.localStorage.setItem('sem-achievements', JSON.stringify({ first_search: true }));
  app.setState({ stats: { streak: 6, totalReads: 4, totalSaves: 2, totalShares: 1 } });
  app.renderAchievements();
  assert.match(elements.achievementsList.innerHTML, /YOUR PROGRESS/);
  assert.match(elements.achievementsList.innerHTML, /First Save/);
  assert.match(elements.achievementsList.innerHTML, /Badges/);
  assert.match(elements.achievementsList.innerHTML, /1 of 10 badges earned/);
  assert.match(elements.achievementsList.innerHTML, /locked/);
});

test('History rendering filters searches and creates reopenable items', () => {
  const { app, context } = loadBundle();
  const elements = baseElements();
  app.setElements(elements);
  context.localStorage.setItem('sem-history', JSON.stringify([
    { query: 'Solar System', timestamp: Date.now() },
    { query: 'Ancient Rome', timestamp: Date.now() }
  ]));
  app.renderHistory('solar');
  assert.equal(elements.historyList.children.length, 1);
  assert.equal(typeof elements.historyList.children[0].onclick, 'function');
});

test('History empty state distinguishes no history from no matches', () => {
  const { app, context } = loadBundle();
  const elements = baseElements();
  app.setElements(elements);
  context.localStorage.setItem('sem-history', JSON.stringify([{ query: 'Physics', timestamp: Date.now() }]));
  app.renderHistory('biology');
  assert.match(elements.historyList.innerHTML, /No matching searches/);
  context.localStorage.setItem('sem-history', '[]');
  app.renderHistory();
  assert.match(elements.historyList.innerHTML, /Your search trail is empty/);
});

test('Saved topics persist full article content and can be retrieved', async () => {
  const { app } = loadBundle();
  const topic = { title: 'Ada Lovelace', summary: 'A computing pioneer', fullArticle: '<article>Ada</article>', tags: [] };
  const saved = await app.saveTopic(topic);
  const topics = await app.getTopics();
  assert.equal(topics.length, 1);
  assert.equal(saved.fullArticle, '<article>Ada</article>');
  assert.equal(topics[0].fullArticle, '<article>Ada</article>');
  assert.equal(await app.isTopicSaved('Ada Lovelace'), true);
});

test('Saving the same topic uses the existing record instead of creating duplicates', async () => {
  const { app } = loadBundle();
  const elements = baseElements();
  app.setElements(elements);
  app.setState({
    currentTopic: { title: 'Reusable Topic', summary: 'Summary', fullArticle: '<article>Full</article>', coverImage: '' },
    currentNote: 'Important',
    autoSave: false,
    stats: { streak: 1, totalReads: 0, totalSaves: 0, totalShares: 0 }
  });
  await app.saveCurrentTopic();
  await app.saveCurrentTopic();
  const topics = await app.getTopics();
  assert.equal(topics.length, 1);
  assert.equal(topics[0].note, 'Important');
  assert.match(elements.readerSaveBtn.innerHTML, /Saved offline/);
  assert.equal(elements.readerSaveBtn.classList.contains('saved'), true);
});

test('Reader save state uses an explicit offline confirmation', async () => {
  const { app } = loadBundle();
  const elements = baseElements();
  app.setElements(elements);
  app.setState({ currentTopic: { title: 'Reader Topic', summary: 'Summary', fullArticle: '<article>Reader</article>' }, currentNote: '', autoSave: false, stats: { streak: 1, totalReads: 0, totalSaves: 0, totalShares: 0 } });
  await app.saveCurrentTopic();
  assert.match(elements.saveBtn.innerHTML, /Saved/);
  assert.match(elements.readerSaveBtn.innerHTML, /Saved offline/);
});

