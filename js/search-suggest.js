const SEARCH_HISTORY_KEY = 'BiliTube-search-history';
let searchSuggestRequestToken = 0;

function fetchJsonViaProxy(u) {
  if (!u) return Promise.resolve(null);
  if (typeof searchFetchJson === 'function') {
    return searchFetchJson(u);
  }
  const url = '/proxy?u=' + encodeURIComponent(u);
  return fetch(url).then(function (res) {
    if (!res.ok) {
      throw new Error('network');
    }
    return res.json();
  });
}

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
  const current = getSearchHistory().filter(function (item) {
    return item !== value;
  });
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
  updateSearchSuggestionsBox();
}

function renderSearchHistorySection() {
  const history = getSearchHistory();
  if (!history.length) return '';
  const title = t('search_history_title');
  const clearText = t('search_history_clear');
  const items = history.map(function (term) {
    const safeText = escapeHtml(term);
    const arg = term.replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
    return '<div class="search-history-tag" onclick="selectSuggestion(\'' + arg + '\')">' + safeText + '</div>';
  }).join('');
  return '<div class="suggestion-section-header">' +
    '<span>' + title + '</span>' +
    '<button type="button" class="clear-history-btn" onclick="clearSearchHistoryUI(event)">' + clearText + '</button>' +
    '</div>' +
    '<div class="search-history-list">' +
    items +
    '</div>';
}

function renderSuggestSection(keyword, suggestions) {
  if (!Array.isArray(suggestions) || !suggestions.length) return '';
  if (!keyword) return '';
  const items = suggestions.map(function (text) {
    const value = String(text || '');
    if (!value) return '';
    const safeText = escapeHtml(value);
    const arg = value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
    return '<div class="suggestion-item" onclick="selectSuggestion(\'' + arg + '\')">' + safeText + '</div>';
  }).filter(function (x) {
    return !!x;
  }).join('');
  if (!items) return '';
  return items;
}

function renderHotSearchSection(list) {
  if (!Array.isArray(list) || !list.length) return '';
  const items = list.map(function (item) {
    const safeText = escapeHtml(item.text);
    const arg = item.text.replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
    var badgeHtml = '';
    if (item.badge) {
      var badgeClass = item.type === 'red' ? 'search-badge-red' : 'search-badge-pink';
      badgeHtml = '<span class="search-hot-badge ' + badgeClass + '">' + escapeHtml(item.badge) + '</span>';
    }
    return '<div class="search-hot-item" onclick="selectSuggestion(\'' + arg + '\')">' +
      '<span class="search-hot-rank">' + item.rank + '</span>' +
      '<span class="search-hot-text">' + safeText + '</span>' +
      badgeHtml +
      '</div>';
  }).join('');
  return '<div class="suggestion-section-header">' +
    '<span>热门搜索</span>' +
    '</div>' +
    '<div class="search-hot-list">' +
    items +
    '</div>';
}

function buildSearchSuggestionsContent(keyword, suggestList, hotList) {
  const suggestSection = renderSuggestSection(keyword, suggestList);
  const historySection = renderSearchHistorySection();
  const hotSection = renderHotSearchSection(hotList);
  let inner = '';
  if (suggestSection) {
    inner += suggestSection;
  } else {
    if (historySection) {
      inner += historySection;
    }
    inner += hotSection;
  }
  if (!inner) return '';
  return '<div class="search-suggestions-panel">' +
    '<div class="search-suggestions-content">' +
    inner +
    '</div>' +
    '</div>';
}

function fetchHotSearchList() {
  const cached = BiliTubeDataCache.get('hot-search-list');
  if (cached) {
    return Promise.resolve(cached);
  }
  const url = 'https://s.search.bilibili.com/main/hotword';
  return fetchJsonViaProxy(url)
    .then(function (res) {
      if (!res || typeof res.code !== 'number' || res.code !== 0) {
        return [];
      }
      const list = Array.isArray(res.list) ? res.list : [];
      const mapped = list.map(function (item, idx) {
        if (!item) return null;
        const rank = item.pos || item.id || item.position || idx + 1;
        const text = item.show_name || item.keyword || '';
        let badge = '';
        let type = '';
        const wt = item.word_type;
        if (wt === 4) {
          badge = '新';
          type = 'red';
        } else if (wt === 5) {
          badge = '热';
          type = 'red';
        } else if (wt === 9) {
          badge = '梗';
          type = 'pink';
        } else if (wt === 11) {
          badge = '话题';
          type = 'pink';
        }
        return text ? { rank: rank, text: text, badge: badge, type: type } : null;
      }).filter(function (x) {
        return !!x;
      }).slice(0, 10);
      BiliTubeDataCache.set('hot-search-list', mapped);
      return mapped;
    })
    .catch(function () {
      return [];
    });
}

function fetchSearchSuggestList(keyword) {
  const value = (keyword || '').trim();
  if (!value) return Promise.resolve([]);
  const cacheKey = 'search-suggest:' + value;
  const cached = BiliTubeDataCache.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }
  const url = 'https://s.search.bilibili.com/main/suggest?term=' + encodeURIComponent(value);
  return fetchJsonViaProxy(url)
    .then(function (res) {
      if (!res || typeof res.code !== 'number' || res.code !== 0) {
        return [];
      }
      const result = res.result || {};
      const tag = Array.isArray(result.tag) ? result.tag : [];
      const list = tag.map(function (item) {
        if (!item) return '';
        return item.value || item.term || '';
      }).filter(function (x) {
        return !!x;
      });
      BiliTubeDataCache.set(cacheKey, list);
      return list;
    })
    .catch(function () {
      return [];
    });
}

function updateSearchSuggestionsBox() {
  const suggestionsBox = document.getElementById('search-suggestions');
  const searchInput = document.querySelector('.search-input');
  if (!suggestionsBox || !searchInput) return;
  const keyword = searchInput.value.trim();
  const token = ++searchSuggestRequestToken;
  Promise.all([
    fetchSearchSuggestList(keyword),
    fetchHotSearchList()
  ]).then(function (result) {
    if (token !== searchSuggestRequestToken) return;
    const suggestList = result[0] || [];
    const hotList = result[1] || [];
    const html = buildSearchSuggestionsContent(keyword, suggestList, hotList);
    if (html) {
      suggestionsBox.innerHTML = html;
      suggestionsBox.style.display = 'block';
    } else {
      suggestionsBox.style.display = 'none';
    }
  });
}

function initSearch() {
  const searchInput = document.querySelector('.search-input');
  const suggestionsBox = document.getElementById('search-suggestions');
  const searchBtn = document.querySelector('.search-btn');
  const mobileSearchToggle = document.getElementById('search-toggle-mobile');
  const appHeader = document.querySelector('.app-header');

  if (!searchInput || !suggestionsBox) return;

  searchInput.addEventListener('input', function () {
    updateSearchSuggestionsBox();
  });

  searchInput.addEventListener('focus', function () {
    updateSearchSuggestionsBox();
  });

  document.addEventListener('click', function (e) {
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

  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      triggerSearch();
    }
  });

  if (searchBtn) {
    searchBtn.addEventListener('click', function () {
      triggerSearch();
    });
  }

  if (mobileSearchToggle && appHeader) {
    mobileSearchToggle.addEventListener('click', function () {
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
  if (!searchInput || !suggestionsBox) return;
  searchInput.value = text;
  suggestionsBox.style.display = 'none';
  addSearchHistory(text);
  goToSearch('videos', text);
}
