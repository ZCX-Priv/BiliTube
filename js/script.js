document.addEventListener('DOMContentLoaded', () => {
  if (!supportsFlexGap()) {
    document.documentElement.classList.add('no-flex-gap');
  }
  initStorage().then(() => {
    initLoadingScreen();
    initTheme();
    biliTubeInitModal();
    initSidebar();
    initSearch();
    initTags();
    initRouter();
  });
});

function isMobileDevice() {
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

function supportsFlexGap() {
  if (typeof document === 'undefined') return true;
  const flex = document.createElement('div');
  flex.style.display = 'flex';
  flex.style.flexDirection = 'column';
  flex.style.rowGap = '1px';
  flex.appendChild(document.createElement('div'));
  flex.appendChild(document.createElement('div'));
  document.body.appendChild(flex);
  const isSupported = flex.scrollHeight === 1;
  if (flex.parentNode) {
    flex.parentNode.removeChild(flex);
  }
  return isSupported;
}

const I18N = {
  zh: {
    loading_initializing: '初始化中',
    loading_resources: '加载资源中',
    loading_rendering: '渲染界面中',
    loading_complete: '完成',
    search_empty_videos: '没有找到相关视频',
    search_empty_users: '没有找到相关用户',
    search_history_title: '搜索历史',
    search_history_clear: '清空',
    search_label_prefix: '搜索: '
  }
};

let currentLang = 'zh';

function t(key) {
  const dict = I18N[currentLang] || I18N.zh;
  if (!dict) return key;
  return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
}

const STORAGE_DB_NAME = 'bilitube-app';
const STORAGE_DB_VERSION = 3;
const STORAGE_STORE_NAME = 'kv';

const storageState = {
  db: null,
  cache: {},
  readyPromise: null
};

function openStorageDb() {
  if (!window.indexedDB) {
    return Promise.resolve(null);
  }
  if (storageState.db) {
    return Promise.resolve(storageState.db);
  }
  if (storageState.readyPromise) {
    return storageState.readyPromise;
  }
  storageState.readyPromise = new Promise((resolve) => {
    const request = window.indexedDB.open(STORAGE_DB_NAME, STORAGE_DB_VERSION);
    request.onupgradeneeded = function () {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORAGE_STORE_NAME)) {
        db.createObjectStore(STORAGE_STORE_NAME);
      }
      if (db.objectStoreNames.contains('watch_history')) {
        db.deleteObjectStore('watch_history');
      }
      const store = db.createObjectStore('watch_history', { keyPath: 'key', autoIncrement: true });
      if (!store.indexNames.contains('ts')) {
        store.createIndex('ts', 'ts', { unique: false });
      }
    };
    request.onsuccess = function () {
      storageState.db = request.result;
      resolve(storageState.db);
    };
    request.onerror = function () {
      resolve(null);
    };
  });
  return storageState.readyPromise;
}

function initStorage() {
  if (storageState.readyPromise) {
    return storageState.readyPromise;
  }
  storageState.readyPromise = openStorageDb().then((db) => {
    if (!db) {
      return;
    }
    const keys = ['theme', 'bilitube-search-history', 'sidebar-collapsed', 'bilitube-subs-ux-variant', 'bilitube-subs-metrics'];
    return Promise.all(keys.map((key) => {
      return new Promise((resolve) => {
        const tx = db.transaction(STORAGE_STORE_NAME, 'readonly');
        const store = tx.objectStore(STORAGE_STORE_NAME);
        const request = store.get(key);
        request.onsuccess = function () {
          if (request.result !== undefined) {
            storageState.cache[key] = request.result;
          }
          resolve();
        };
        request.onerror = function () {
          resolve();
        };
      });
    }));
  });
  return storageState.readyPromise;
}

function storageGetItem(key) {
  return Object.prototype.hasOwnProperty.call(storageState.cache, key)
    ? storageState.cache[key]
    : null;
}

function storageSetItem(key, value) {
  storageState.cache[key] = value;
  openStorageDb().then((db) => {
    if (!db) return;
    const tx = db.transaction(STORAGE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORAGE_STORE_NAME);
    store.put(value, key);
  });
}

function storageRemoveItem(key) {
  delete storageState.cache[key];
  openStorageDb().then((db) => {
    if (!db) return;
    const tx = db.transaction(STORAGE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORAGE_STORE_NAME);
    store.delete(key);
  });
}

const WATCH_HISTORY_STORE = 'watch_history';

function biliTubeRecordWatchHistory(entry) {
  if (!entry || !entry.id) return;
  openStorageDb().then((db) => {
    if (!db) return;
    if (!db.objectStoreNames.contains(WATCH_HISTORY_STORE)) return;
    const tx = db.transaction(WATCH_HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(WATCH_HISTORY_STORE);
    const now = Date.now();
    const data = {
      id: entry.id,
      title: entry.title || '',
      cover: entry.cover || '',
      channel: entry.channel || '',
      views: typeof entry.views === 'number' ? entry.views : 0,
      duration: typeof entry.duration === 'number' ? entry.duration : 0,
      ts: typeof entry.ts === 'number' ? entry.ts : now
    };
    store.add(data);
  });
}

function biliTubeQueryWatchHistory(limit) {
  const max = typeof limit === 'number' && limit > 0 ? limit : Infinity;
  return openStorageDb().then((db) => {
    if (!db) return [];
    if (!db.objectStoreNames.contains(WATCH_HISTORY_STORE)) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(WATCH_HISTORY_STORE, 'readonly');
      const store = tx.objectStore(WATCH_HISTORY_STORE);
      let source = store;
      if (store.indexNames && store.indexNames.contains && store.indexNames.contains('ts')) {
        source = store.index('ts');
      }
      const direction = 'prev';
      const request = source.openCursor(null, direction);
      const items = [];
      request.onsuccess = function () {
        const cursor = request.result;
        if (!cursor) {
          return;
        }
        const value = cursor.value || {};
        const key =
          cursor.primaryKey != null
            ? cursor.primaryKey
            : value.key != null
            ? value.key
            : null;
        if (key != null && !value.key) {
          value.key = key;
        }
        items.push(value);
        if (items.length >= max) {
          return;
        }
        cursor.continue();
      };
      tx.oncomplete = function () {
        resolve(items);
      };
      tx.onerror = function () {
        resolve(items);
      };
    });
  });
}

function biliTubeDeleteWatchHistoryByKey(key) {
  if (key == null) return;
  const numKey = Number(key);
  openStorageDb().then((db) => {
    if (!db) return;
    if (!db.objectStoreNames.contains(WATCH_HISTORY_STORE)) return;
    const tx = db.transaction(WATCH_HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(WATCH_HISTORY_STORE);
    store.delete(numKey);
  });
}

function biliTubeClearWatchHistory() {
  openStorageDb().then((db) => {
    if (!db) return;
    if (!db.objectStoreNames.contains(WATCH_HISTORY_STORE)) return;
    const tx = db.transaction(WATCH_HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(WATCH_HISTORY_STORE);
    store.clear();
  });
}

const biliTubeModalState = {
  resolve: null
};

function biliTubeInitModal() {
  const modal = document.getElementById('btube-modal');
  if (!modal) return;
  const cancelBtn = modal.querySelector('[data-action="modal-cancel"]');
  const confirmBtn = modal.querySelector('[data-action="modal-confirm"]');
  const close = (ok) => {
    modal.hidden = true;
    if (biliTubeModalState.resolve) {
      biliTubeModalState.resolve(ok);
      biliTubeModalState.resolve = null;
    }
  };
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      close(false);
    });
  }
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      close(true);
    });
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      close(false);
    }
  });
}

function biliTubeConfirm(message) {
  const modal = document.getElementById('btube-modal');
  if (!modal) {
    const ok = window.confirm(message);
    return Promise.resolve(ok);
  }
  const titleEl = document.getElementById('btube-modal-title');
  const bodyEl = document.getElementById('btube-modal-body');
  if (titleEl) {
    titleEl.textContent = '确认操作';
  }
  if (bodyEl) {
    bodyEl.textContent = message;
  }
  modal.hidden = false;
  return new Promise((resolve) => {
    biliTubeModalState.resolve = resolve;
  });
}

/* --- Loading Screen --- */
function initLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  const loadingStatus = document.getElementById('loading-status');
  if (!loadingScreen || !loadingStatus) return;

  const steps = [
    { text: t('loading_initializing'), delay: 0 },
    { text: t('loading_resources'), delay: 800 },
    { text: t('loading_rendering'), delay: 1600 },
    { text: t('loading_complete'), delay: 2400 }
  ];

  steps.forEach(step => {
    setTimeout(() => {
      loadingStatus.textContent = step.text;
    }, step.delay);
  });

  setTimeout(() => {
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }, 3000);
}

function withLoader(container, loadFn, delay = 300) {
  if (!container || typeof loadFn !== 'function') {
    if (typeof loadFn === 'function') {
      loadFn();
    }
    return;
  }

  container.classList.add('with-loader');

  let overlay = container.querySelector('.loader-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'loader-overlay';
    const spinner = document.createElement('div');
    spinner.className = 'loader-spinner';
    overlay.appendChild(spinner);
    container.appendChild(overlay);
  }

  overlay.classList.add('visible');

  setTimeout(() => {
    loadFn();
    setTimeout(() => {
      overlay.classList.remove('visible');
    }, 300);
  }, delay);
}

/* --- Theme Toggle --- */
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  
  const savedTheme = storageGetItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && prefersDarkScheme.matches)) {
    document.body.setAttribute('data-theme', 'dark');
    updateThemeIcon(true);
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.body.removeAttribute('data-theme');
      storageSetItem('theme', 'light');
      updateThemeIcon(false);
    } else {
      document.body.setAttribute('data-theme', 'dark');
      storageSetItem('theme', 'dark');
      updateThemeIcon(true);
    }
  });
}

function updateThemeIcon(isDark) {
  const themeIcon = document.getElementById('theme-icon');
  if (isDark) {
    // Sun Icon
    themeIcon.innerHTML = '<path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/>';
  } else {
    // Moon Icon
    themeIcon.innerHTML = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';
  }
}

/* --- Video Grid --- */
function initVideoGrid() {
  const videoGrid = document.getElementById('video-grid');
  if (!videoGrid) return;
  videoGrid.innerHTML = '';
}

/* --- Search Suggestions --- */
const SEARCH_HISTORY_KEY = 'bilitube-search-history';

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getSearchHistory() {
  try {
    const raw = storageGetItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveSearchHistory(list) {
  if (!Array.isArray(list)) {
    storageSetItem(SEARCH_HISTORY_KEY, JSON.stringify([]));
    return;
  }
  const trimmed = list.slice(0, 10);
  storageSetItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed));
}

function addSearchHistory(keyword) {
  const value = (keyword || '').trim();
  if (!value) return;
  const current = getSearchHistory().filter(item => item !== value);
  current.unshift(value);
  saveSearchHistory(current);
}

function clearSearchHistory() {
  storageRemoveItem(SEARCH_HISTORY_KEY);
}

function clearSearchHistoryUI(e) {
  if (e && typeof e.stopPropagation === 'function') {
    e.stopPropagation();
  }
  clearSearchHistory();
  const box = document.getElementById('search-suggestions');
  if (box) {
    box.style.display = 'none';
  }
}

function renderSearchHistoryList() {
  const history = getSearchHistory();
  if (!history.length) return '';
  const title = t('search_history_title');
  const clearText = t('search_history_clear');
  const header = '<div class="suggestion-section-header">' +
    '<span>' + title + '</span>' +
    '<button type="button" class="clear-history-btn" onclick="clearSearchHistoryUI(event)">' + clearText + '</button>' +
    '</div>';
  const items = history.map(term => {
    const safeText = escapeHtml(term);
    const arg = term.replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
    return '<div class="suggestion-item" onclick="selectSuggestion(\'' + arg + '\')">' + safeText + '</div>';
  }).join('');
  return header + items;
}

function initSearch() {
  const searchInput = document.querySelector('.search-input');
  const suggestionsBox = document.getElementById('search-suggestions');
  const searchBtn = document.querySelector('.search-btn');
  const mobileSearchToggle = document.getElementById('search-toggle-mobile');
  const appHeader = document.querySelector('.app-header');

  if (!searchInput || !suggestionsBox) return;

  const suggestions = [
    'HTML5 教程', 'CSS Grid 与 Flexbox 对比', 'JavaScript 入门',
    'React 与 Vue', 'Angular 速成课', 'Python 自动化',
    '机器学习', '网页设计趋势', 'Material 设计', 'BiliTube 高能推荐'
  ];

  searchInput.addEventListener('input', (e) => {
    const value = e.target.value.toLowerCase();
    if (value.length > 0) {
      const filtered = suggestions.filter(s => s.toLowerCase().includes(value));
      const suggestionHtml = filtered.map(s => {
        const safeText = escapeHtml(s);
        const arg = s.replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
        return '<div class="suggestion-item" onclick="selectSuggestion(\'' + arg + '\')">' + safeText + '</div>';
      }).join('');
      const historyHtml = renderSearchHistoryList();
      const content = suggestionHtml + historyHtml;
      if (content) {
        suggestionsBox.innerHTML = content;
        suggestionsBox.style.display = 'block';
      } else {
        suggestionsBox.style.display = 'none';
      }
    } else {
      const historyHtml = renderSearchHistoryList();
      if (historyHtml) {
        suggestionsBox.innerHTML = historyHtml;
        suggestionsBox.style.display = 'block';
      } else {
        suggestionsBox.style.display = 'none';
      }
    }
  });

  searchInput.addEventListener('focus', () => {
    if (!searchInput.value.trim()) {
      const historyHtml = renderSearchHistoryList();
      if (historyHtml) {
        suggestionsBox.innerHTML = historyHtml;
        suggestionsBox.style.display = 'block';
      }
    }
  });

  document.addEventListener('click', (e) => {
    const clickInsideSearch = searchInput.contains(e.target) || suggestionsBox.contains(e.target);
    if (!clickInsideSearch) {
      suggestionsBox.style.display = 'none';
      if (appHeader && appHeader.classList.contains('mobile-search-active')) {
        if (!mobileSearchToggle || !mobileSearchToggle.contains(e.target)) {
          appHeader.classList.remove('mobile-search-active');
        }
      }
    }
  });

  function triggerSearch() {
    const keyword = searchInput.value.trim();
    if (!keyword) return;
    addSearchHistory(keyword);
    goToSearch('videos', keyword);
  }

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      triggerSearch();
    }
  });

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      triggerSearch();
    });
  }

  if (mobileSearchToggle && appHeader) {
    mobileSearchToggle.addEventListener('click', () => {
      const active = appHeader.classList.toggle('mobile-search-active');
      if (active) {
        searchInput.focus();
      }
    });
  }
}

function selectSuggestion(text) {
  const searchInput = document.querySelector('.search-input');
  const suggestionsBox = document.getElementById('search-suggestions');
  searchInput.value = text;
  suggestionsBox.style.display = 'none';
  addSearchHistory(text);
  goToSearch('videos', text);
}

/* --- Sidebar --- */
function initSidebar() {
  const menuBtn = document.querySelector('.menu-btn');
  if (!menuBtn) return;

  const saved = storageGetItem('sidebar-collapsed');
  if (saved === 'true') {
    document.body.classList.add('sidebar-collapsed');
  }

  menuBtn.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    storageSetItem('sidebar-collapsed', collapsed ? 'true' : 'false');
  });
}

/* --- Tags --- */
function initTags() {
  const tags = document.querySelectorAll('.tag-chip');
  tags.forEach(tag => {
    tag.addEventListener('click', () => {
      tags.forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
    });
  });
}

/* --- SPA Router --- */
const routes = {
  '/home': 'view-home',
  '/subscriptions': 'view-subscriptions',
  '/profile': 'view-profile',
  '/video': 'view-video',
  '/search': 'view-search'
};

let videoViewBound = false;
let lastNonVideoHash = '#/home';

const SUBS_VARIANT_KEY = 'bilitube-subs-ux-variant';
const SUBS_METRIC_KEY = 'bilitube-subs-metrics';

function getSubsVariant() {
  let v = storageGetItem(SUBS_VARIANT_KEY);
  if (v !== 'A' && v !== 'B') {
    v = Math.random() < 0.5 ? 'A' : 'B';
    storageSetItem(SUBS_VARIANT_KEY, v);
  }
  return v;
}

function readSubsMetrics() {
  try {
    const raw = storageGetItem(SUBS_METRIC_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeSubsMetrics(data) {
  storageSetItem(SUBS_METRIC_KEY, JSON.stringify(data || {}));
}

function trackSubsEvent(type, variant) {
  const v = variant || getSubsVariant();
  const key = v + ':' + type;
  const data = readSubsMetrics();
  data[key] = (data[key] || 0) + 1;
  writeSubsMetrics(data);
}

function initRouter() {
  window.addEventListener('hashchange', handleRouteChange);
  if (!window.location.hash) {
    window.location.hash = '#/home';
  } else {
    handleRouteChange();
  }
}

function handleRouteChange() {
  const hash = window.location.hash || '#/home';
  const segments = hash.replace(/^#/, '').split('/');
  const path = '/' + (segments[1] || 'home');
  const param1 = segments[2] || null;
  const param2 = segments[3] || null;

  const viewId = routes[path] || 'view-home';

  if (viewId !== 'view-video') {
    lastNonVideoHash = hash;
  }

  const views = document.querySelectorAll('.view');
  views.forEach(view => {
    const active = view.id === viewId;
    view.hidden = !active;
    view.classList.toggle('active', active);
  });

  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  sidebarLinks.forEach(link => {
    const href = link.getAttribute('href') || '';
    if (!href.startsWith('#')) return;
    const linkPath = href.replace(/^#/, '');
    let active = false;
    if (path === '/home' && linkPath === '/home') active = true;
    if (path === '/subscriptions' && linkPath === '/subscriptions') active = true;
    if (path === '/profile' && linkPath === '/profile') active = true;
    link.classList.toggle('active', active);
  });

  if (viewId === 'view-home') {
    if (typeof initHomeView === 'function') {
      initHomeView();
    } else {
      initVideoGrid();
    }
  } else if (viewId === 'view-subscriptions') {
    initSubscriptionsView();
  } else if (viewId === 'view-profile') {
    initProfileView();
  } else if (viewId === 'view-video') {
    initVideoView(param1);
  } else if (viewId === 'view-search') {
    initSearchView(param1, param2);
  }
}

function biliTubeLoadProfileHeader(view) {
  if (!view) return;
  const avatarEl = view.querySelector('.profile-avatar');
  const nameEl = view.querySelector('.profile-info h1');
  const bioEl = view.querySelector('.profile-info p');
  const url =
    '/proxy?u=' +
    encodeURIComponent('https://api.bilibili.com/x/web-interface/nav');
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error('network');
      return res.json();
    })
    .then((json) => {
      if (!json || typeof json.code !== 'number' || json.code !== 0 || !json.data) {
        throw new Error('nav_api');
      }
      const data = json.data || {};
      const uname = data.uname || data.username || '';
      const face = data.face || '';
      const sign = data.sign || '';
      if (avatarEl) {
        let avatar = face;
        if (avatar && typeof homeParseCoverUrl === 'function') {
          avatar = homeParseCoverUrl(avatar);
        }
        if (avatar) {
          avatarEl.style.backgroundImage = "url('" + avatar + "')";
        } else {
          avatarEl.style.backgroundImage = '';
        }
      }
      if (nameEl) {
        nameEl.textContent = uname || '未登录用户';
      }
      if (bioEl) {
        if (sign) {
          bioEl.textContent = sign;
        } else {
          bioEl.textContent = '无法获取账号信息，请确认已登录并配置 Cookie';
        }
      }
    })
    .catch(() => {
      if (nameEl) {
        nameEl.textContent = '未登录用户';
      }
      if (bioEl) {
        bioEl.textContent = '无法获取账号信息，请确认已登录并配置 Cookie';
      }
    });
}

function biliTubeRenderProfileHistory(view) {
  const recentGrid =
    (view && view.querySelector('#recent-grid')) ||
    document.getElementById('recent-grid');
  if (!recentGrid) return;
  biliTubeQueryWatchHistory().then((items) => {
    if (!items || !items.length) {
      recentGrid.innerHTML =
        '<div class="empty-result">暂无观看历史</div>';
      return;
    }
    const groups = {};
    items.forEach((item) => {
      if (!item) return;
      const ts = item.ts || Date.now();
      const d = new Date(ts);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = y + '-' + m + '-' + day;
      const dateLabel = d.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
      });
      if (!groups[key]) {
        groups[key] = { label: dateLabel, items: [] };
      }
      groups[key].items.push(item);
    });
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === b) return 0;
      return a > b ? -1 : 1;
    });
    const html = sortedKeys
      .map((dateKey) => {
        const group = groups[dateKey];
        const dayItems = group.items
          .map((item, index) => {
            let cover = item.cover || '';
            if (cover && typeof homeParseCoverUrl === 'function') {
              cover = homeParseCoverUrl(cover);
            }
            const durationSeconds =
              typeof item.duration === 'number' ? item.duration : 0;
            let durationText = '';
            if (durationSeconds && typeof homeFormatDuration === 'function') {
              durationText = homeFormatDuration(durationSeconds);
            }
            let viewsText = '';
            if (typeof item.views === 'number' && item.views > 0) {
              viewsText =
                item.views.toLocaleString() + ' 次观看';
            } else if (typeof item.views === 'string') {
              viewsText = item.views;
            }
            let timeText = '';
            if (item.ts) {
              try {
                const d = new Date(item.ts);
                timeText = d.toLocaleTimeString('zh-CN', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit'
                });
              } catch (e) {}
            }
            const rawId = item.id || '';
            const safeId = encodeURIComponent(rawId || String(index));
            const channelName = item.channel || '';
            const metaParts = [];
            if (channelName) metaParts.push(channelName);
            if (durationText) metaParts.push(durationText);
            if (viewsText) metaParts.push(viewsText);
            const meta = metaParts.join(' · ');
            const keyAttr =
              item.key != null ? String(item.key) : '';
            return (
              '<div class="timeline-item" data-id="' +
              rawId +
              '" data-key="' +
              keyAttr +
              '">' +
              '<div class="timeline-side">' +
              '<div class="timeline-dot"></div>' +
              '<div class="timeline-line"></div>' +
              '</div>' +
              '<div class="timeline-content">' +
              '<div class="timeline-header-row">' +
              '<div class="timeline-time">' +
              timeText +
              '</div>' +
              '<button type="button" class="timeline-remove" data-action="history-remove">删除</button>' +
              '</div>' +
              '<div class="timeline-main">' +
              (cover
                ? '<div class="timeline-thumb"><img src="' +
                  cover +
                  '" alt="Thumbnail" loading="lazy"></div>'
                : '') +
              '<div class="timeline-text">' +
              '<div class="timeline-title">' +
              (item.title || '') +
              '</div>' +
              (meta
                ? '<div class="timeline-meta">' +
                  meta +
                  '</div>'
                : '') +
              '</div>' +
              '</div>' +
              '</div>' +
              '</div>'
            );
          })
          .join('');
        return (
          '<div class="timeline-day">' +
          '<div class="timeline-date">' +
          group.label +
          '</div>' +
          '<div class="timeline-items">' +
          dayItems +
          '</div>' +
          '</div>'
        );
      })
      .join('');
    recentGrid.innerHTML = html;
    const lines = recentGrid.querySelectorAll('.timeline-items');
    lines.forEach((groupEl) => {
      const itemsEls = groupEl.querySelectorAll('.timeline-item');
      if (itemsEls.length) {
        const last = itemsEls[itemsEls.length - 1];
        const lineEl = last.querySelector('.timeline-line');
        if (lineEl) {
          lineEl.style.display = 'none';
        }
      }
    });
  });
}

function initProfileView() {
  const view = document.getElementById('view-profile');
  if (!view) return;

  if (!view.dataset.tabsBound) {
    const tabs = view.querySelectorAll('.tab-btn');
    const contents = view.querySelectorAll('.tab-content');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        tabs.forEach(b => b.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const panel = view.querySelector('#' + target);
        if (panel) panel.classList.add('active');
      });
    });
    view.dataset.tabsBound = 'true';
  }
  if (!view.dataset.profileLoaded) {
    biliTubeLoadProfileHeader(view);
    view.dataset.profileLoaded = 'true';
  }
  if (!view.dataset.historyBound) {
    const recentGrid =
      view.querySelector('#recent-grid') ||
      document.getElementById('recent-grid');
    if (recentGrid) {
      recentGrid.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('[data-action="history-remove"]');
        if (removeBtn) {
          e.stopPropagation();
          const itemEl = removeBtn.closest('.timeline-item');
          if (itemEl) {
            const titleEl = itemEl.querySelector('.timeline-title');
            const titleText = titleEl ? titleEl.textContent || '' : '';
            const msg = titleText
              ? '确定删除这条观看记录吗？\n《' + titleText + '》'
              : '确定删除这条观看记录吗？';
            biliTubeConfirm(msg).then((ok) => {
              if (!ok) return;
              const key = itemEl.getAttribute('data-key');
              if (key != null && key !== '') {
                biliTubeDeleteWatchHistoryByKey(key);
              }
              biliTubeRenderProfileHistory(view);
            });
          }
          return;
        }
        const itemEl = e.target.closest('.timeline-item');
        if (itemEl) {
          const id = itemEl.getAttribute('data-id') || '';
          if (id) {
            window.location.hash =
              '#/video/' + encodeURIComponent(id);
          }
        }
      });
    }
    const clearBtn =
      view.querySelector('[data-action="history-clear"]') ||
      document.querySelector('[data-action="history-clear"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        biliTubeConfirm('确定清空所有观看历史吗？').then((ok) => {
          if (!ok) return;
          biliTubeClearWatchHistory();
          biliTubeRenderProfileHistory(view);
        });
      });
    }
    view.dataset.historyBound = 'true';
  }
  biliTubeRenderProfileHistory(view);
}

function initVideoView(id) {
  const view = document.getElementById('view-video');
  if (!view) return;

  if (!videoViewBound) {
    bindVideoView(view);
    videoViewBound = true;
  }

  const rawId = id != null ? decodeURIComponent(id) : '';
  if (typeof biliTubeLoadVideoById === 'function' && rawId) {
    biliTubeLoadVideoById(rawId);
  }
}

function bindVideoView(view) {
  if (!view) return;

  const backBtn = view.querySelector('[data-action="video-back"]');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const target = lastNonVideoHash || '#/home';
      window.location.hash = target;
    });
  }

  const tabs = view.querySelectorAll('.btube-tab');
  const details = view.querySelector('#btube-details-content');
  const comments = view.querySelector('#btube-comments-content');
  const panelBody = view.querySelector('.btube-panel-body');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab === 'comments' ? 'comments' : 'details';
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      if (details && comments) {
        const showDetails = target === 'details';
        details.style.display = showDetails ? 'block' : 'none';
        comments.style.display = showDetails ? 'none' : 'block';
      }
    });
  });

  if (details && comments) {
    details.style.display = 'block';
    comments.style.display = 'none';
  }

   if (panelBody && comments && tabs.length) {
    panelBody.addEventListener('scroll', () => {
      var activeTab = null;
      tabs.forEach(t => {
        if (t.classList.contains('active')) {
          activeTab = t;
        }
      });
      if (!activeTab || activeTab.dataset.tab !== 'comments') {
        return;
      }
      const distance =
        panelBody.scrollHeight - panelBody.scrollTop - panelBody.clientHeight;
      if (distance <= 80 && typeof playerLoadMoreComments === 'function') {
        playerLoadMoreComments(false);
      }
    });
  }

  view.addEventListener('click', (e) => {
    const btn = e.target.closest('.btube-reply-btn');
    if (!btn || !view.contains(btn)) return;
    const item = btn.closest('.btube-comment-item');
    if (!item) return;
    const box = item.querySelector('.btube-reply-box');
    if (!box) return;
    box.classList.toggle('active');
  });

  const video = view.querySelector('#btube-video');
  const qualityToggle = view.querySelector('#btube-quality-toggle');
  const danmakuToggle = view.querySelector('#btube-danmaku-toggle');
  const errorBanner = view.querySelector('#btube-video-error');
  const panelToggle = view.querySelector('.btube-panel-toggle');
  const rightPanel = view.querySelector('.btube-right-panel');

  if (video) {
    video.addEventListener('error', () => {
      if (errorBanner) {
        errorBanner.textContent = isMobileDevice()
          ? '移动端视频加载失败，请检查网络或浏览器设置。'
          : '视频加载失败，请稍后重试。';
        errorBanner.style.display = 'block';
      }
    });
  }

  if (qualityToggle && video) {
    qualityToggle.addEventListener('click', () => {
      const hdSrc = video.getAttribute('data-src-hd') || '';
      const sdSrc = video.getAttribute('data-src-sd') || hdSrc;
      const source = video.querySelector('source');
      if (!source || !hdSrc) return;

      const currentQuality = video.getAttribute('data-quality') || 'hd';
      const nextQuality = currentQuality === 'hd' ? 'sd' : 'hd';
      const nextSrc = nextQuality === 'hd' ? hdSrc : sdSrc;

      if (!nextSrc) return;

      const wasPlaying = !video.paused && !video.ended;
      video.pause();
      source.src = nextSrc;
      video.setAttribute('data-quality', nextQuality);
      try {
        video.load();
      } catch (e) {
      }

      if (wasPlaying) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      }

      const label = qualityToggle.querySelector('.btube-control-label');
      if (label) {
        label.textContent = nextQuality === 'hd' ? '高清' : '标清';
      }
    });
  }

  if (danmakuToggle) {
    danmakuToggle.addEventListener('click', () => {
      danmakuToggle.classList.toggle('active');
      if (typeof playerSetDanmakuEnabled === 'function') {
        playerSetDanmakuEnabled(danmakuToggle.classList.contains('active'));
      }
    });
  }

  if (panelToggle && rightPanel) {
    panelToggle.addEventListener('click', () => {
      rightPanel.classList.toggle('btube-right-panel-collapsed');
    });
  }
}

function goToSearch(type, keyword) {
  const t = type === 'users' ? 'users' : 'videos';
  const value = keyword.trim();
  if (!value) return;
  const encoded = encodeURIComponent(value);
  window.location.hash = '#/search/' + t + '/' + encoded;
}

function initSearchView(type, keyword) {
  const view = document.getElementById('view-search');
  if (!view) return;

  const activeType = type === 'users' ? 'users' : 'videos';
  const decodedKeyword = keyword ? decodeURIComponent(keyword) : '';

  const label = document.getElementById('search-keyword-label');
  if (label) {
    label.textContent = decodedKeyword ? t('search_label_prefix') + decodedKeyword : '搜索结果';
  }

  const tabs = view.querySelectorAll('.search-tab');
  const videosContainer = document.getElementById('search-results-videos');
  const usersContainer = document.getElementById('search-results-users');

  tabs.forEach(tab => {
    const t = tab.dataset.type;
    const isActive = t === activeType;
    tab.classList.toggle('active', isActive);
  });

  if (videosContainer) {
    videosContainer.classList.toggle('active', activeType === 'videos');
  }
  if (usersContainer) {
    usersContainer.classList.toggle('active', activeType === 'users');
  }

  if (!view.dataset.bound) {
    const backBtn = document.getElementById('search-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.hash = '#/home';
      });
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const t = tab.dataset.type;
        const currentKeyword = decodedKeyword || '';
        goToSearch(t, currentKeyword || (label ? label.textContent.replace(/^搜索:\s*/, '') : ''));
      });
    });

    const loadMoreVideosBtn = document.getElementById('search-video-more');
    if (loadMoreVideosBtn && !loadMoreVideosBtn.dataset.bound) {
      loadMoreVideosBtn.dataset.bound = 'true';
      loadMoreVideosBtn.addEventListener('click', () => {
        if (typeof searchLoadMoreVideos === 'function') {
          searchLoadMoreVideos();
        }
      });
    }

    const loadMoreUsersBtn = document.getElementById('search-user-more');
    if (loadMoreUsersBtn && !loadMoreUsersBtn.dataset.bound) {
      loadMoreUsersBtn.dataset.bound = 'true';
      loadMoreUsersBtn.addEventListener('click', () => {
        if (typeof searchLoadMoreUsers === 'function') {
          searchLoadMoreUsers();
        }
      });
    }

    if (!window.__biliTubeSearchScrollBound) {
      window.__biliTubeSearchScrollBound = true;
      window.addEventListener('scroll', () => {
        const searchView = document.getElementById('view-search');
        if (!searchView || searchView.hidden) return;
        const activeTab = searchView.querySelector('.search-tab.active');
        const activeTypeNow = activeTab ? activeTab.dataset.type : 'videos';
        let container = null;
        if (activeTypeNow === 'users') {
          container = document.getElementById('search-user-list');
        } else {
          container = document.getElementById('search-video-grid');
        }
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const threshold = 300;
        if (rect.bottom - window.innerHeight <= threshold) {
          if (activeTypeNow === 'users') {
            if (typeof searchLoadMoreUsers === 'function') {
              searchLoadMoreUsers();
            }
          } else {
            if (typeof searchLoadMoreVideos === 'function') {
              searchLoadMoreVideos();
            }
          }
        }
      });
    }

    view.dataset.bound = 'true';
  }

  if (activeType === 'videos') {
    fillSearchVideoResults(decodedKeyword);
  } else {
    fillSearchUserResults(decodedKeyword);
  }
}
