document.addEventListener('DOMContentLoaded', () => {
  if (!supportsFlexGap()) {
    document.documentElement.classList.add('no-flex-gap');
  }
  initStorage().then(() => {
    if (typeof initLoadingScreen === 'function') {
      initLoadingScreen();
    }
    initTheme();
    if (typeof BiliTubeInitModal === 'function') {
      BiliTubeInitModal();
    }
    initSidebar();
    initSearch();
    initTags();
    initRouter();
    initImagePlaceholders();
    initMainEmptyWatcher();
  });
});

const THUMBNAIL_PLACEHOLDER = 'img/thumbnail-placeholder.png';
const AVATAR_PLACEHOLDER = 'img/avatar-placeholder.png';
const BILITUBE_DEFAULT_AVATAR = 'img/BiliTube.png';

function initImagePlaceholders() {
  document.body.addEventListener('error', function(e) {
    var target = e.target;
    if (target.tagName === 'IMG') {
      var src = target.getAttribute('src') || '';
      if (src.indexOf('/proxy?u=') !== -1) {
        if (target.classList.contains('thumbnail-img') || 
            target.closest('.thumbnail-container')) {
          target.src = THUMBNAIL_PLACEHOLDER;
        } else if (target.classList.contains('channel-avatar') ||
                   target.closest('.channel-avatar')) {
          target.src = AVATAR_PLACEHOLDER;
        }
      }
    }
  }, true);
  
  function replaceWithRealImage(img) {
    var dataSrc = img.getAttribute('data-src');
    if (!dataSrc) return;
    img.removeAttribute('data-src');
    var realImg = new Image();
    realImg.onload = function() {
      img.src = dataSrc;
    };
    realImg.onerror = function() {};
    realImg.src = dataSrc;
  }
  
  document.body.addEventListener('load', function(e) {
    var target = e.target;
    if (target.tagName === 'IMG') {
      var dataSrc = target.getAttribute('data-src');
      if (dataSrc && target.src !== dataSrc) {
        var currentSrc = target.getAttribute('src') || '';
        if (currentSrc.indexOf('placeholder') !== -1) {
          replaceWithRealImage(target);
        }
      }
    }
  }, true);
}

function getPlaceholderImage(isAvatar) {
  return isAvatar ? AVATAR_PLACEHOLDER : THUMBNAIL_PLACEHOLDER;
}

function updateMainEmptyPlaceholder() {
  var main = document.querySelector('main.main-content');
  if (!main) return;
  var placeholder = document.getElementById('main-empty-placeholder');
  if (!placeholder) {
    placeholder = document.createElement('div');
    placeholder.id = 'main-empty-placeholder';
    placeholder.className = 'main-empty-placeholder';
    placeholder.textContent = '暂无内容';
    main.appendChild(placeholder);
  }
  var activeView = main.querySelector('.view.active:not([hidden])');
  var hasContent = false;
  if (activeView) {
    if (activeView.id === 'view-home') {
      var homeGrid = activeView.querySelector('#video-grid');
      if (homeGrid && homeGrid.querySelector('.video-card')) {
        hasContent = true;
      }
    } else if (activeView.id === 'view-subscriptions') {
      var subsContent = activeView.querySelector('.subs-content');
      if (subsContent && subsContent.querySelector('.feed-card')) {
        hasContent = true;
      }
    } else if (activeView.id === 'view-profile') {
      var profileHeader = activeView.querySelector('.profile-header');
      if (profileHeader) {
        hasContent = true;
      }
    } else if (activeView.id === 'view-video') {
      var videoContainer = activeView.querySelector('.video-page-container');
      if (videoContainer && videoContainer.children.length) {
        hasContent = true;
      }
    } else if (activeView.id === 'view-search') {
      var videoGrid = document.getElementById('search-video-grid');
      var userList = document.getElementById('search-user-list');
      var hasVideoCard = videoGrid && videoGrid.querySelector('.video-card');
      var hasUserCard = userList && userList.querySelector('.user-card');
      if (hasVideoCard || hasUserCard) {
        hasContent = true;
      }
    } else {
      var meaningful = activeView.querySelector('.video-card, .feed-card, .user-card');
      if (meaningful) {
        hasContent = true;
      }
    }
  }
  var showPlaceholder = !hasContent;
  placeholder.classList.toggle('visible', showPlaceholder);
  if (activeView) {
    if (showPlaceholder) {
      activeView.style.visibility = 'hidden';
    } else {
      activeView.style.visibility = '';
    }
  }
}

function initMainEmptyWatcher() {
  var main = document.querySelector('main.main-content');
  if (!main || window.__BiliTubeMainEmptyBound) return;
  window.__BiliTubeMainEmptyBound = true;
  if (typeof MutationObserver === 'undefined') {
    updateMainEmptyPlaceholder();
    return;
  }
  var observer = new MutationObserver(function() {
    updateMainEmptyPlaceholder();
  });
  observer.observe(main, { childList: true, subtree: true });
  updateMainEmptyPlaceholder();
}

const BiliTubeDataCache = {
  maxSize: 50,
  data: {},
  _lock: {},
  
  get: function(key) {
    if (this.data[key]) {
      var entry = this.data[key];
      if (Date.now() - entry.ts < 300000) {
        return entry.data;
      }
      delete this.data[key];
    }
    return null;
  },
  
  set: function(key, data) {
    var keys = Object.keys(this.data);
    if (keys.length >= this.maxSize) {
      var oldestKey = keys.sort(function(a, b) {
        return this.data[a].ts - this.data[b].ts;
      }.bind(this))[0];
      delete this.data[oldestKey];
    }
    this.data[key] = { data: data, ts: Date.now() };
  },
  
  clear: function() {
    this.data = {};
  }
};

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

const STORAGE_DB_NAME = 'BiliTube-app';
const STORAGE_DB_VERSION = 6;
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
      if (db.objectStoreNames.contains('favorites')) {
        db.deleteObjectStore('favorites');
      }
      const favoritesStore = db.createObjectStore('favorites', { keyPath: 'key', autoIncrement: true });
      if (!favoritesStore.indexNames.contains('ts')) {
        favoritesStore.createIndex('ts', 'ts', { unique: false });
      }
      if (db.objectStoreNames.contains('likes')) {
        db.deleteObjectStore('likes');
      }
      const likesStore = db.createObjectStore('likes', { keyPath: 'key', autoIncrement: true });
      if (!likesStore.indexNames.contains('ts')) {
        likesStore.createIndex('ts', 'ts', { unique: false });
      }
      if (db.objectStoreNames.contains('coins')) {
        db.deleteObjectStore('coins');
      }
      const coinsStore = db.createObjectStore('coins', { keyPath: 'key', autoIncrement: true });
      if (!coinsStore.indexNames.contains('ts')) {
        coinsStore.createIndex('ts', 'ts', { unique: false });
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
    const keys = ['theme', 'BiliTube-search-history', 'sidebar-collapsed', 'BiliTube-subs-ux-variant', 'BiliTube-subs-metrics'];
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

/* --- 主题切换 --- */
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  
  const savedTheme = storageGetItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && prefersDarkScheme.matches)) {
    document.body.setAttribute('data-theme', 'dark');
    updateThemeIcon(true);
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
      storageSetItem('theme', 'dark');
      updateThemeIcon(true);
    } else {
      document.body.removeAttribute('data-theme');
      storageSetItem('theme', 'light');
      updateThemeIcon(false);
    }
  }

  if (!themeToggle) return;

  let themeAnimating = false;

  themeToggle.addEventListener('click', () => {
    if (themeAnimating) return;

    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const nextTheme = isDark ? 'light' : 'dark';

    const rect = themeToggle.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let overlay = document.getElementById('theme-transition-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'theme-transition-overlay';
      overlay.className = 'theme-transition-overlay';
      document.body.appendChild(overlay);
    }

    let content = overlay.querySelector('.theme-transition-content');
    if (!content) {
      content = document.createElement('div');
      content.className = 'theme-transition-content';
      overlay.appendChild(content);
    }

    const sunSvg = '<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/></svg>';
    const moonSvg = '<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>';
    const iconSvg = nextTheme === 'dark' ? moonSvg : sunSvg;
    const modeLabel = nextTheme === 'dark' ? '深色模式' : '浅色模式';

    content.innerHTML =
      '<div class="theme-transition-icon">' +
      iconSvg +
      '</div>' +
      '<div class="theme-transition-text">已切换到' +
      modeLabel +
      '</div>';

    if (nextTheme === 'dark') {
      overlay.style.backgroundColor = '#121212';
      overlay.style.color = '#FFFFFF';
    } else {
      overlay.style.backgroundColor = '#F9F9F9';
      overlay.style.color = '#212121';
    }

    overlay.style.setProperty('--theme-origin-x', cx + 'px');
    overlay.style.setProperty('--theme-origin-y', cy + 'px');

    themeAnimating = true;

    overlay.getBoundingClientRect();
    overlay.classList.add('active');

    const handleTransitionEnd = function () {
      overlay.removeEventListener('transitionend', handleTransitionEnd);
      applyTheme(nextTheme);
      setTimeout(function () {
        overlay.classList.remove('active');
        themeAnimating = false;
      }, 1000);
    };

    overlay.addEventListener('transitionend', handleTransitionEnd);
  });
}

function updateThemeIcon(isDark) {
  const themeIcon = document.getElementById('theme-icon');
  if (isDark) {
    // 太阳图标
    // 
    themeIcon.innerHTML = '<path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/>';
  } else {
    // 月亮图标
    themeIcon.innerHTML = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';
  }
}

function initVideoGrid() {
  const videoGrid = document.getElementById('video-grid');
  if (!videoGrid) return;
  videoGrid.innerHTML = '';
}

/* --- 侧边栏 --- */
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

/* --- 标签 --- */
function initTags() {
  const tags = document.querySelectorAll('.tag-chip');
  tags.forEach(tag => {
    tag.addEventListener('click', () => {
      tags.forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
    });
  });
}

/* --- 单页应用路由 --- */
const routes = {
  '/home': 'view-home',
  '/subscriptions': 'view-subscriptions',
  '/profile': 'view-profile',
  '/video': 'view-video',
  '/search': 'view-search'
};

let videoViewBound = false;
let lastNonVideoHash = '#/home';
let lastNonVideoScrollY = 0;

const SUBS_VARIANT_KEY = 'BiliTube-subs-ux-variant';
const SUBS_METRIC_KEY = 'BiliTube-subs-metrics';

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
  let wasOnHome = false;
  let previousViewId = null;
  views.forEach(view => {
    const wasActive = !view.hidden;
    if (wasActive) {
      previousViewId = view.id;
    }
    const active = view.id === viewId;
    if (view.id === 'view-home' && wasActive) {
      wasOnHome = true;
    }
    view.hidden = !active;
    view.classList.toggle('active', active);
  });

  if (wasOnHome && viewId !== 'view-home' && typeof homeSaveScrollPosition === 'function') {
    homeSaveScrollPosition();
  }

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

  if (previousViewId === 'view-video' && viewId !== 'view-video') {
    if (typeof BiliTubeVideoProgress !== 'undefined') {
      var videoEl = document.getElementById('BiliTube-video');
      var vid = BiliTubeVideoProgress.currentVideoId;
      if (videoEl && vid) {
        var ct = videoEl.currentTime;
        var dur = videoEl.duration;
        if (typeof ct === 'number' && ct >= 0) {
          BiliTubeVideoProgress.save(vid, ct, dur);
        }
      }
    }
    const targetScroll =
      lastNonVideoScrollY ||
      window.scrollY ||
      document.documentElement.scrollTop ||
      0;
    if (targetScroll > 0) {
      setTimeout(() => {
        window.scrollTo(0, targetScroll);
      }, 0);
    }
  }
  updateMainEmptyPlaceholder();
}

function BiliTubeOpenVideo(hash) {
  if (!hash) return;
  lastNonVideoScrollY =
    window.scrollY || document.documentElement.scrollTop || 0;
  window.location.hash = hash;
}

function BiliTubeLoadProfileHeader(view) {
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
        const defaultAvatar =
          typeof BILITUBE_DEFAULT_AVATAR === 'string'
            ? BILITUBE_DEFAULT_AVATAR
            : AVATAR_PLACEHOLDER;
        if (avatar) {
          avatarEl.style.backgroundImage = "url('" + avatar + "')";
        } else if (defaultAvatar) {
          avatarEl.style.backgroundImage = "url('" + defaultAvatar + "')";
        } else {
          avatarEl.style.backgroundImage = '';
        }
      }
      if (nameEl) {
        nameEl.textContent = uname || 'BiliTube';
      }
      if (bioEl) {
        if (sign && sign.trim()) {
          bioEl.textContent = sign;
        } else {
          bioEl.textContent = '这个人很懒，什么都没有留下';
        }
      }
    })
    .catch(() => {
      if (avatarEl) {
        const defaultAvatar =
          typeof BILITUBE_DEFAULT_AVATAR === 'string'
            ? BILITUBE_DEFAULT_AVATAR
            : AVATAR_PLACEHOLDER;
        if (defaultAvatar) {
          avatarEl.style.backgroundImage = "url('" + defaultAvatar + "')";
        } else {
          avatarEl.style.backgroundImage = '';
        }
      }
      if (nameEl) {
        nameEl.textContent = 'BiliTube';
      }
      if (bioEl) {
        bioEl.textContent = '这个人很懒，什么都没有留下';
      }
    });
}

function initProfileView() {
  const view = document.getElementById('view-profile');
  if (!view) return;

  const avatarEl = view.querySelector('.profile-avatar');
  if (avatarEl && !avatarEl.style.backgroundImage) {
    avatarEl.style.backgroundImage = "url('img/BiliTube.png')";
  }

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
    BiliTubeLoadProfileHeader(view);
    view.dataset.profileLoaded = 'true';
  }
  if (typeof BiliTubeBindProfileHistory === 'function') {
    BiliTubeBindProfileHistory(view);
  }
  if (typeof BiliTubeRenderProfileHistory === 'function') {
    BiliTubeRenderProfileHistory(view);
  }
  if (typeof BiliTubeBindProfileFavorites === 'function') {
    BiliTubeBindProfileFavorites(view);
  }
  if (typeof BiliTubeRenderProfileFavorites === 'function') {
    BiliTubeRenderProfileFavorites(view);
  }
}

function initVideoView(id) {
  const view = document.getElementById('view-video');
  if (!view) return;

  if (!videoViewBound) {
    bindVideoView(view);
    videoViewBound = true;
  }

  const rawId = id != null ? decodeURIComponent(id) : '';
  if (typeof BiliTubeLoadVideoById === 'function' && rawId) {
    BiliTubeLoadVideoById(rawId);
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

  const tabs = view.querySelectorAll('.BiliTube-tab');
  const details = view.querySelector('#BiliTube-details-content');
  const comments = view.querySelector('#BiliTube-comments-content');
  const panelBody = view.querySelector('.BiliTube-panel-body');

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
      if (!activeTab) {
        return;
      }
      const distance =
        panelBody.scrollHeight - panelBody.scrollTop - panelBody.clientHeight;
      if (activeTab.dataset.tab === 'comments') {
        if (distance <= 80 && typeof playerLoadMoreComments === 'function') {
          playerLoadMoreComments(false);
        }
      } else if (activeTab.dataset.tab === 'details') {
        if (distance <= 80 && typeof playerMaybeLoadMoreRecommendations === 'function') {
          playerMaybeLoadMoreRecommendations();
        }
      }
    });
  }

  view.addEventListener('click', (e) => {
    const btn = e.target.closest('.BiliTube-reply-btn');
    if (!btn || !view.contains(btn)) return;
    const item = btn.closest('.BiliTube-comment-item');
    if (!item) return;
    const box = item.querySelector('.BiliTube-reply-box');
    if (!box) return;
    box.classList.toggle('active');
  });

  const video = view.querySelector('#BiliTube-video');
  const errorBanner = view.querySelector('#BiliTube-video-error');
  const panelToggle = view.querySelector('.BiliTube-panel-toggle');
  const rightPanel = view.querySelector('.BiliTube-right-panel');
  const actionButtons = view.querySelectorAll('.BiliTube-action-btn');

  if (video) {
    video.addEventListener('error', function(e) {
      var error = video.error;
      if (!error) return;
      var code = error.code;
      if (code === 2 || code === 3 || code === 4) {
        if (typeof playerHandleStall === 'function') {
          playerHandleStall(video);
        } else {
          if (errorBanner) {
            errorBanner.textContent = isMobileDevice()
              ? '移动端视频加载失败，请检查网络或浏览器设置。'
              : '视频加载失败，请稍后重试。';
            errorBanner.style.display = 'block';
          }
        }
      }
    });
    video.addEventListener('canplay', function() {
      if (typeof BiliTubeVideoChecker !== 'undefined' && BiliTubeVideoChecker.stopStallTimer) {
        BiliTubeVideoChecker.stopStallTimer();
      }
    });
    video.addEventListener('ended', function() {
      if (typeof playerHandleAutoPlayEnded === 'function') {
        playerHandleAutoPlayEnded();
      }
    });
  }

  if (actionButtons && actionButtons.length) {
    actionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action || '';
        if (action === 'favorite') {
          let videoId = btn.getAttribute('data-video-id') || '';
          if (!videoId) {
            const hash = window.location.hash || '';
            const match = hash.match(/#\/video\/([^/?#]+)/);
            if (match && match[1]) {
              videoId = decodeURIComponent(match[1]);
            }
          }
          if (!videoId && typeof BiliTubeVideoProgress !== 'undefined') {
            const vid = BiliTubeVideoProgress.currentVideoId;
            if (vid) {
              videoId = vid;
            }
          }
          if (!videoId) {
            const fallbackActive = btn.classList.contains('BiliTube-action-active');
            btn.classList.toggle('BiliTube-action-active', !fallbackActive);
            return;
          }
          const entry = {
            id: videoId,
            title: btn.getAttribute('data-video-title') || '',
            cover: btn.getAttribute('data-video-cover') || '',
            channel: btn.getAttribute('data-video-channel') || '',
            avatar: btn.getAttribute('data-video-avatar') || '',
            time: btn.getAttribute('data-video-time') || '',
            views: 0,
            duration: 0,
            ts: Date.now()
          };
          const rawViews = btn.getAttribute('data-video-views');
          if (rawViews != null && rawViews !== '') {
            const numViews = Number(rawViews);
            if (!isNaN(numViews) && numViews > 0) {
              entry.views = numViews;
            }
          }
          const rawDuration = btn.getAttribute('data-video-duration');
          if (rawDuration != null && rawDuration !== '') {
            const numDur = Number(rawDuration);
            if (!isNaN(numDur) && numDur > 0) {
              entry.duration = numDur;
            }
          }
          const shouldFavorite = !btn.classList.contains('BiliTube-action-active');
          btn.classList.toggle('BiliTube-action-active', shouldFavorite);
          if (typeof BiliTubeToggleFavorite === 'function') {
            BiliTubeToggleFavorite(entry, shouldFavorite);
          } else if (typeof BiliTubeRecordFavorite === 'function' && shouldFavorite) {
            BiliTubeRecordFavorite(entry);
          } else if (!shouldFavorite && typeof BiliTubeRemoveFavoriteById === 'function') {
            BiliTubeRemoveFavoriteById(videoId);
          }
        } else if (action === 'like') {
          let videoId = btn.getAttribute('data-video-id') || '';
          if (!videoId) {
            const hash = window.location.hash || '';
            const match = hash.match(/#\/video\/([^/?#]+)/);
            if (match && match[1]) {
              videoId = decodeURIComponent(match[1]);
            }
          }
          if (!videoId && typeof BiliTubeVideoProgress !== 'undefined') {
            const vid = BiliTubeVideoProgress.currentVideoId;
            if (vid) {
              videoId = vid;
            }
          }
          if (!videoId) {
            const fallbackActive = btn.classList.contains('BiliTube-action-active');
            btn.classList.toggle('BiliTube-action-active', !fallbackActive);
            return;
          }
          const shouldLike = !btn.classList.contains('BiliTube-action-active');
          btn.classList.toggle('BiliTube-action-active', shouldLike);
          if (typeof BiliTubeSetLove === 'function') {
            BiliTubeSetLove(videoId, shouldLike);
          }
        } else if (action === 'coin') {
          if (typeof BiliTubeShowCoinModal === 'function') {
            let videoId = btn.getAttribute('data-video-id') || '';
            if (!videoId) {
              const hash = window.location.hash || '';
              const match = hash.match(/#\/video\/([^/?#]+)/);
              if (match && match[1]) {
                videoId = decodeURIComponent(match[1]);
              }
            }
            if (!videoId && typeof BiliTubeVideoProgress !== 'undefined') {
              const vid = BiliTubeVideoProgress.currentVideoId;
              if (vid) {
                videoId = vid;
              }
            }
            BiliTubeShowCoinModal(videoId || '', btn);
          }
        } else {
          const alreadyActive = btn.classList.contains('BiliTube-action-active');
          if (!alreadyActive) {
            btn.classList.add('BiliTube-action-active');
          } else {
            btn.classList.remove('BiliTube-action-active');
          }
        }
      });
    });
  }

  if (panelToggle && rightPanel) {
    panelToggle.addEventListener('click', () => {
      rightPanel.classList.toggle('BiliTube-right-panel-collapsed');
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

    if (!window.__BiliTubeSearchScrollBound) {
      window.__BiliTubeSearchScrollBound = true;
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
