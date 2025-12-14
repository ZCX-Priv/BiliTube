document.addEventListener('DOMContentLoaded', () => {
  initLoadingScreen();
  initTheme();
  initSidebar();
  initSearch();
  initTags();
  initRouter();
});

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
  
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && prefersDarkScheme.matches)) {
    document.body.setAttribute('data-theme', 'dark');
    updateThemeIcon(true);
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      updateThemeIcon(false);
    } else {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
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
          <img src="https://picsum.photos/300/200?random=${index}" alt="Thumbnail" class="thumbnail-img" loading="lazy">
          <span class="video-duration">${video.duration}</span>
        </div>
        <div class="video-info">
          <div class="channel-avatar" style="background-image: url('https://picsum.photos/40/40?random=${index + 100}'); background-size: cover;"></div>
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
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveSearchHistory(list) {
  if (!Array.isArray(list)) {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify([]));
    return;
  }
  const trimmed = list.slice(0, 10);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed));
}

function addSearchHistory(keyword) {
  const value = (keyword || '').trim();
  if (!value) return;
  const current = getSearchHistory().filter(item => item !== value);
  current.unshift(value);
  saveSearchHistory(current);
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
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
    if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.style.display = 'none';
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

  const saved = localStorage.getItem('sidebar-collapsed');
  if (saved === 'true') {
    document.body.classList.add('sidebar-collapsed');
  }

  menuBtn.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebar-collapsed', collapsed ? 'true' : 'false');
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

const SUBS_VARIANT_KEY = 'btube-subs-ux-variant';
const SUBS_METRIC_KEY = 'btube-subs-metrics';

function getSubsVariant() {
  let v = localStorage.getItem(SUBS_VARIANT_KEY);
  if (v !== 'A' && v !== 'B') {
    v = Math.random() < 0.5 ? 'A' : 'B';
    localStorage.setItem(SUBS_VARIANT_KEY, v);
  }
  return v;
}

function readSubsMetrics() {
  try {
    const raw = localStorage.getItem(SUBS_METRIC_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeSubsMetrics(data) {
  localStorage.setItem(SUBS_METRIC_KEY, JSON.stringify(data || {}));
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
    initVideoGrid();
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

function initSubscriptionsView() {
  const view = document.getElementById('view-subscriptions');
  if (!view || view.dataset.initialized === 'true') return;
  view.dataset.initialized = 'true';

  const variant = getSubsVariant();
  view.dataset.variant = variant;
  view.classList.add('subs-variant-' + variant.toLowerCase());
  trackSubsEvent('visit', variant);

  const list = view.querySelector('.subs-list');
  const content = view.querySelector('.subs-content');
  if (!list || !content) return;

  const items = Array.prototype.slice.call(list.querySelectorAll('.sub-item'));

  const feedData = {
    tech: [
      {
        title: '科技日报 · 最新手机评测',
        time: '2 小时前',
        text: '快来看看我们最新的手机评测！这次的相机升级非常惊艳。',
        image: 'https://picsum.photos/600/300?random=10'
      }
    ],
    game: [
      {
        title: '游戏高手 · 今晚直播预告',
        time: '5 小时前',
        text: '直播将在 10 分钟后开始！一起来看高能对局。',
        image: ''
      }
    ],
    music: [
      {
        title: '音乐人生 · 新歌上线',
        time: '1 天前',
        text: '全新翻唱已上线，一起沉浸在音乐里。',
        image: 'https://picsum.photos/600/300?random=11'
      }
    ],
    cook: [
      {
        title: '家常菜课堂 · 今晚吃什么',
        time: '3 小时前',
        text: '三道十分钟快手菜，简单好吃，每天都不重样。',
        image: 'https://picsum.photos/600/300?random=12'
      }
    ]
  };

  feedData.all = []
    .concat(feedData.tech, feedData.game, feedData.music, feedData.cook);

  function keyFromItem(item) {
    const nameEl = item.querySelector('.sub-name');
    if (!nameEl) return 'tech';
    const text = nameEl.textContent || '';
    if (text.indexOf('全部订阅') !== -1) return 'all';
    if (text.indexOf('Tech Daily') !== -1 || text.indexOf('科技日报') !== -1) return 'tech';
    if (text.indexOf('Gaming Pro') !== -1 || text.indexOf('游戏高手') !== -1) return 'game';
    if (text.indexOf('音乐人生') !== -1 || text.indexOf('Music') !== -1) return 'music';
    if (text.indexOf('家常菜课堂') !== -1 || text.indexOf('Cooking') !== -1) return 'cook';
    return 'tech';
  }

  function renderFeed(key) {
    const listForKey = feedData[key] || [];
    const container = content;
    withLoader(container, () => {
      if (!listForKey.length) {
        container.innerHTML = '<div class="empty-result">暂无该订阅的最新动态</div>';
        return;
      }
      container.innerHTML = listForKey.map(item => {
        const hasImage = !!item.image;
        const imgHtml = hasImage
          ? '<div class="feed-media"><img src="' + item.image + '" alt="Feed Image" class="feed-img" loading="lazy"></div>'
          : '';
        return (
          '<div class="feed-card">' +
            '<div class="feed-header">' +
              '<div class="sub-avatar"></div>' +
              '<div class="feed-meta">' +
                '<div class="sub-name">' + item.title + '</div>' +
                '<div class="feed-time">' + item.time + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="feed-body">' +
              '<div class="feed-text">' + item.text + '</div>' +
              imgHtml +
            '</div>' +
          '</div>'
        );
      }).join('');
    });
  }

  items.forEach(item => {
    item.addEventListener('click', () => {
      items.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const key = keyFromItem(item);
      trackSubsEvent('channel_click_' + key, variant);
      renderFeed(key);
    });
  });

  list.addEventListener('click', e => {
    const card = e.target.closest('.sub-item');
    if (card) {
      trackSubsEvent('list_click', variant);
    }
  });

  content.addEventListener('click', e => {
    const card = e.target.closest('.feed-card');
    if (card) {
      trackSubsEvent('feed_click', variant);
    }
  });

  const initial = items[0];
  if (initial) {
    initial.classList.add('active');
    renderFeed(keyFromItem(initial));
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
           <img src="https://picsum.photos/300/200?random=20" class="thumbnail-img" loading="lazy">
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
           <img src="https://picsum.photos/300/200?random=21" class="thumbnail-img" loading="lazy">
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
  const title = view.querySelector('.video-primary-info h1');
  if (title && id != null) {
    title.textContent = 'Building a Website in 10 Minutes #' + id;
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

function fillSearchVideoResults(keyword) {
  const grid = document.getElementById('search-video-grid');
  if (!grid) return;
  const data = [
    { title: "Building a Website in 10 Minutes", channel: "Web Dev Simplified", views: "1.2M views", time: "2 days ago", duration: "10:05" },
    { title: "Material Design 3 Tutorial", channel: "Google Design", views: "500K views", time: "1 week ago", duration: "15:30" },
    { title: "Top 10 Programming Languages 2024", channel: "Traversy Media", views: "2.5M views", time: "3 days ago", duration: "12:45" },
    { title: "Relaxing Jazz Music", channel: "Coffee Shop Vibes", views: "10M views", time: "1 month ago", duration: "1:30:00" },
    { title: "Advanced CSS Animations", channel: "Kevin Powell", views: "300K views", time: "2 weeks ago", duration: "14:50" }
  ];

  const value = keyword.toLowerCase();
  const list = value ? data.filter(v => v.title.toLowerCase().includes(value)) : data;

  if (!list.length) {
    grid.innerHTML = '<div class="empty-result">' + t('search_empty_videos') + '</div>';
    return;
  }

  const container = grid.parentElement || grid;
  withLoader(container, () => {
    grid.innerHTML = list.map((video, index) => (
      '<div class="video-card" onclick="window.location.hash=\'#/video/' + index + '\'">' +
        '<div class="thumbnail-container">' +
          '<img src="https://picsum.photos/300/200?random=' + (200 + index) + '" alt="Thumbnail" class="thumbnail-img" loading="lazy">' +
          '<span class="video-duration">' + video.duration + '</span>' +
        '</div>' +
        '<div class="video-info">' +
          '<div class="channel-avatar" style="background-image: url(\'https://picsum.photos/40/40?random=' + (300 + index) + '\'); background-size: cover;"></div>' +
          '<div class="video-details">' +
            '<h3 class="video-title">' + video.title + '</h3>' +
            '<div class="channel-name">' + video.channel + '</div>' +
            '<div class="video-meta">' + video.views + ' • ' + video.time + '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    )).join('');
  });
}

function fillSearchUserResults(keyword) {
  const container = document.getElementById('search-user-list');
  if (!container) return;
  const users = [
    { name: "Web Dev Simplified", desc: "前端开发教程", followers: "1.5M" },
    { name: "Gaming Pro", desc: "高能游戏解说", followers: "800K" },
    { name: "Music Life", desc: "音乐现场与翻唱", followers: "600K" },
    { name: "Cooking 101", desc: "家常菜与甜品教程", followers: "300K" }
  ];

  const value = keyword.toLowerCase();
  const list = value ? users.filter(u => u.name.toLowerCase().includes(value)) : users;

  if (!list.length) {
    container.innerHTML = '<div class="empty-result">' + t('search_empty_users') + '</div>';
    return;
  }

  withLoader(container, () => {
    container.innerHTML = list.map((user, index) => (
      '<div class="user-card">' +
        '<div class="user-avatar" style="background-image: url(\'https://picsum.photos/64/64?random=' + (400 + index) + '\'); background-size: cover;"></div>' +
        '<div class="user-info">' +
          '<div class="user-name">' + user.name + '</div>' +
          '<div class="user-meta">' + user.desc + ' · ' + user.followers + ' 关注</div>' +
        '</div>' +
      '</div>'
    )).join('');
  });
}
