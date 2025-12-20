document.addEventListener('DOMContentLoaded', () => {
  initStorage().then(() => {
    initLoadingScreen();
    initTheme();
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

const STORAGE_DB_NAME = 'btube-app';
const STORAGE_DB_VERSION = 1;
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
    const keys = ['theme', 'btube-search-history', 'sidebar-collapsed', 'btube-subs-ux-variant', 'btube-subs-metrics'];
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

  const mockVideos = [
    { title: "Building a Website in 10 Minutes", channel: "Web Dev Simplified", views: "1.2M views", time: "2 days ago", duration: "10:05" },
    { title: "Material Design 3 Tutorial", channel: "Google Design", views: "500K views", time: "1 week ago", duration: "15:30" },
    { title: "Top 10 Programming Languages 2024", channel: "Traversy Media", views: "2.5M views", time: "3 days ago", duration: "12:45" },
    { title: "Relaxing Jazz Music", channel: "Coffee Shop Vibes", views: "10M views", time: "1 month ago", duration: "1:30:00" },
    { title: "Learn React JS - Full Course", channel: "FreeCodeCamp", views: "800K views", time: "5 days ago", duration: "4:20:10" },
    { title: "Funny Cat Compilation", channel: "MeowTube", views: "5M views", time: "2 weeks ago", duration: "8:15" },
    { title: "SpaceX Launch Highlights", channel: "SpaceX", views: "3M views", time: "1 day ago", duration: "25:00" },
    { title: "How to Cook the Perfect Steak", channel: "Gordon Ramsay", views: "15M views", time: "1 year ago", duration: "10:00" },
    { title: "Travel Vlog: Japan", channel: "Wanderlust", views: "200K views", time: "4 days ago", duration: "18:20" },
    { title: "Advanced CSS Animations", channel: "Kevin Powell", views: "300K views", time: "2 weeks ago", duration: "14:50" },
    { title: "History of the Internet", channel: "Veritasium", views: "4M views", time: "3 months ago", duration: "22:15" },
    { title: "Gaming Setup Tour 2025", channel: "TechSource", views: "1.5M views", time: "1 week ago", duration: "11:30" }
  ];

  withLoader(videoGrid, () => {
    videoGrid.innerHTML = mockVideos.map((video, index) => `
      <div class="video-card" onclick="window.location.hash='#/video/${index}'">
        <div class="thumbnail-container">
          <img src="://picsum.photos/300/200?random=${index}" alt="Thumbnail" class="thumbnail-img" loading="lazy">
          <span class="video-duration">${video.duration}</span>
        </div>
        <div class="video-info">
          <div class="channel-avatar" style="background-image: url('://picsum.photos/40/40?random=${index + 100}'); background-size: cover;"></div>
          <div class="video-details">
            <h3 class="video-title">${video.title}</h3>
            <div class="channel-name">${video.channel}</div>
            <div class="video-meta">${video.views} • ${video.time}</div>
          </div>
        </div>
      </div>
    `).join('');
  });
}

/* --- Search Suggestions --- */
const SEARCH_HISTORY_KEY = 'btube-search-history';

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

const SUBS_VARIANT_KEY = 'btube-subs-ux-variant';
const SUBS_METRIC_KEY = 'btube-subs-metrics';

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

function initProfileView() {
  const view = document.getElementById('view-profile');
  if (!view || view.dataset.initialized === 'true') return;
  view.dataset.initialized = 'true';

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

  const recentGrid = view.querySelector('#recent-grid');
  if (recentGrid) {
    recentGrid.innerHTML = `
      <div class="video-card">
        <div class="thumbnail-container">
           <img src="://picsum.photos/300/200?random=20" class="thumbnail-img" loading="lazy">
           <span class="video-duration">10:05</span>
        </div>
        <div class="video-info">
           <div class="video-details">
              <h3 class="video-title">Watched Video 1</h3>
              <div class="channel-name">Channel A</div>
           </div>
        </div>
      </div>
      <div class="video-card">
        <div class="thumbnail-container">
           <img src="://picsum.photos/300/200?random=21" class="thumbnail-img" loading="lazy">
           <span class="video-duration">5:30</span>
        </div>
        <div class="video-info">
           <div class="video-details">
              <h3 class="video-title">Watched Video 2</h3>
              <div class="channel-name">Channel B</div>
           </div>
        </div>
      </div>
    `;
  }
}

function initVideoView(id) {
  const view = document.getElementById('view-video');
  if (!view) return;

  if (!videoViewBound) {
    bindVideoView(view);
    videoViewBound = true;
  }

  const title = view.querySelector('#btube-video-title');
  if (title && id != null) {
    title.textContent = '10 分钟搭建一个网站 #' + id;
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

  const replyButtons = view.querySelectorAll('.btube-reply-btn');
  replyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.btube-comment-item');
      if (!item) return;
      const box = item.querySelector('.btube-reply-box');
      if (!box) return;
      box.classList.toggle('active');
    });
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

    view.dataset.bound = 'true';
  }

  if (activeType === 'videos') {
    fillSearchVideoResults(decodedKeyword);
  } else {
    fillSearchUserResults(decodedKeyword);
  }
}
