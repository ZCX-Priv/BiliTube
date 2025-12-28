var SEARCH_VIDEO_STATE = {
  keyword: '',
  page: 1,
  finished: false,
  loading: false,
  cachedKeyword: '',
  cachedHtml: '',
  cachedUsersHtml: ''
};

var SEARCH_USER_STATE = {
  keyword: '',
  page: 1,
  finished: false,
  loading: false,
  cachedKeyword: '',
  cachedHtml: ''
};

function searchProxyUrl(u) {
  return '/proxy?u=' + encodeURIComponent(u);
}

function searchFetchJson(u) {
  return fetch(searchProxyUrl(u)).then(function (res) {
    if (!res.ok) {
      throw new Error('network');
    }
    return res.json();
  });
}

function searchFormatDuration(input) {
  if (!input) return '';
  if (typeof input === 'string' && input.indexOf(':') !== -1) {
    return input;
  }
  var s = typeof input === 'number' ? input : parseInt(input, 10);
  if (!s || s <= 0) return '';
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  var pad = function (n) {
    return n < 10 ? '0' + n : '' + n;
  };
  if (h <= 0) {
    return pad(m) + ':' + pad(sec);
  }
  return pad(h) + ':' + pad(sec);
}

function mapSearchVideoItem(item) {
  if (!item) return null;
  var cover = item.pic || '';
  var title = item.title || '';
  var author = item.author || '';
  var duration = item.duration || 0;
  var views = item.play || item.play_num || '';
  var bvid = item.bvid || '';
  var avatar = item.upic || '';
  var mapped = {
    id: bvid,
    cover: cover,
    duration: searchFormatDuration(duration),
    title: title,
    channel: author,
    views: views ? views + ' 次观看' : '',
    time: '',
    avatar: avatar
  };
  return mapped;
}

function fillSearchVideoResults(keyword) {
  var grid = document.getElementById('search-video-grid');
  if (!grid) return;
  var value = (keyword || '').trim();
  if (!value) {
    SEARCH_VIDEO_STATE.keyword = '';
    SEARCH_VIDEO_STATE.page = 1;
    SEARCH_VIDEO_STATE.finished = true;
    SEARCH_VIDEO_STATE.loading = false;
    SEARCH_VIDEO_STATE.cachedKeyword = '';
    SEARCH_VIDEO_STATE.cachedHtml = '';
    grid.innerHTML =
      '<div class="empty-result">' + t('search_empty_videos') + '</div>';
    var moreBtnEmpty = document.getElementById('search-video-more');
    if (moreBtnEmpty) {
      moreBtnEmpty.style.display = 'none';
      moreBtnEmpty.disabled = true;
    }
    return;
  }
  if (SEARCH_VIDEO_STATE.cachedKeyword === value && SEARCH_VIDEO_STATE.cachedHtml) {
    grid.innerHTML = SEARCH_VIDEO_STATE.cachedHtml;
    SEARCH_VIDEO_STATE.keyword = value;
    SEARCH_VIDEO_STATE.page = SEARCH_VIDEO_STATE.finished ? SEARCH_VIDEO_STATE.page : SEARCH_VIDEO_STATE.page;
    var moreBtn = document.getElementById('search-video-more');
    if (moreBtn) {
      moreBtn.style.display = SEARCH_VIDEO_STATE.finished ? 'none' : 'block';
      moreBtn.disabled = SEARCH_VIDEO_STATE.finished;
    }
    return;
  }
  SEARCH_VIDEO_STATE.keyword = value;
  SEARCH_VIDEO_STATE.page = 1;
  SEARCH_VIDEO_STATE.finished = false;
  SEARCH_VIDEO_STATE.loading = false;
  SEARCH_VIDEO_STATE.cachedKeyword = value;
  var container = grid.parentElement || grid;
  var run = function () {
    grid.innerHTML = '';
    var moreBtnFirst = document.getElementById('search-video-more');
    if (moreBtnFirst) {
      moreBtnFirst.style.display = 'none';
      moreBtnFirst.disabled = false;
    }
    searchLoadMoreVideos();
  };
  if (typeof withLoader === 'function') {
    withLoader(container, run, 200);
  } else {
    run();
  }
}

function searchLoadMoreVideos() {
  var grid = document.getElementById('search-video-grid');
  if (!grid) return;
  if (!SEARCH_VIDEO_STATE.keyword) return;
  if (SEARCH_VIDEO_STATE.loading || SEARCH_VIDEO_STATE.finished) return;
  var page = SEARCH_VIDEO_STATE.page || 1;
  var url =
    'https://api.bilibili.com/x/web-interface/wbi/search/type?search_type=video&keyword=' +
    encodeURIComponent(SEARCH_VIDEO_STATE.keyword) +
    '&page=' +
    encodeURIComponent(String(page));
  SEARCH_VIDEO_STATE.loading = true;
  searchFetchJson(url)
    .then(function (res) {
      if (!res || typeof res.code !== 'number' || res.code !== 0) {
        if (!grid.children.length) {
          grid.innerHTML =
            '<div class="empty-result">' +
            t('search_empty_videos') +
            '</div>';
        }
        SEARCH_VIDEO_STATE.finished = true;
        return;
      }
      var data = res.data || {};
      var list =
        data &&
        Array.isArray(data.result) &&
        data.result.length
          ? data.result
          : [];
      if (!list.length) {
        if (!grid.children.length) {
          grid.innerHTML =
            '<div class="empty-result">' +
            t('search_empty_videos') +
            '</div>';
        }
        SEARCH_VIDEO_STATE.finished = true;
        return;
      }
      var mapped = list
        .map(mapSearchVideoItem)
        .filter(function (x) {
          return !!x;
        });
      var baseIndex = grid.querySelectorAll('.video-card').length;
      var html = mapped
        .map(function (v, idx) {
          if (typeof homeParseCoverUrl === 'function') {
            v.cover = homeParseCoverUrl(v.cover);
            if (v.avatar) {
              v.avatar = homeParseCoverUrl(v.avatar);
            }
          }
          if (typeof createHomeCardHtml === 'function') {
            return createHomeCardHtml(v, baseIndex + idx);
          }
          var safeId = encodeURIComponent(v.id || baseIndex + idx);
          var cover = v.cover || '';
          var channelName = v.channel || '';
          var viewsText = v.views || '';
          var meta = viewsText;
          var duration = v.duration || '';
          return (
            '<div class="video-card" onclick="window.location.hash=\'#/video/' +
            safeId +
            '\'">' +
            '<div class="thumbnail-container">' +
            '<img src="' + THUMBNAIL_PLACEHOLDER + '" alt="Thumbnail" class="thumbnail-img" loading="lazy"' +
            (cover ? ' data-src="' + cover + '" onload="this.src=this.getAttribute(\'data-src\')"' : '') + '>' +
            (duration
              ? '<span class="video-duration">' + duration + '</span>'
              : '') +
            '</div>' +
            '<div class="video-info">' +
            '<div class="video-details">' +
            '<h3 class="video-title">' +
            v.title +
            '</h3>' +
            '<div class="channel-name">' +
            channelName +
            '</div>' +
            (meta ? '<div class="video-meta">' + meta + '</div>' : '') +
            '</div>' +
            '</div>' +
            '</div>'
          );
        })
        .join('');
      grid.insertAdjacentHTML('beforeend', html);
      SEARCH_VIDEO_STATE.cachedHtml = grid.innerHTML;
      var numPages = data.numPages || data.num_pages || 0;
      if (numPages && page >= numPages) {
        SEARCH_VIDEO_STATE.finished = true;
      } else if (numPages) {
        SEARCH_VIDEO_STATE.page = page + 1;
      } else {
        if (list.length < (data.pagesize || 20)) {
          SEARCH_VIDEO_STATE.finished = true;
        } else {
          SEARCH_VIDEO_STATE.page = page + 1;
        }
      }
      var moreBtn = document.getElementById('search-video-more');
      if (moreBtn) {
        moreBtn.style.display = SEARCH_VIDEO_STATE.finished ? 'none' : 'block';
        moreBtn.disabled = SEARCH_VIDEO_STATE.finished;
      }
    })
    .catch(function () {
      if (!grid.children.length) {
        grid.innerHTML =
          '<div class="empty-result">' +
          t('search_empty_videos') +
          '</div>';
      }
      SEARCH_VIDEO_STATE.finished = true;
    })
    .finally(function () {
      SEARCH_VIDEO_STATE.loading = false;
    });
}

function mapSearchUserItem(item) {
  if (!item) return null;
  return {
    name: item.uname || '',
    desc: item.usign || '',
    followers: item.fans || item.fans_num || '',
    avatar: item.upic || item.face || item.avatar || ''
  };
}

function fillSearchUserResults(keyword) {
  var container = document.getElementById('search-user-list');
  if (!container) return;
  var value = (keyword || '').trim();
  if (!value) {
    SEARCH_USER_STATE.keyword = '';
    SEARCH_USER_STATE.page = 1;
    SEARCH_USER_STATE.finished = true;
    SEARCH_USER_STATE.loading = false;
    SEARCH_USER_STATE.cachedKeyword = '';
    SEARCH_USER_STATE.cachedHtml = '';
    container.innerHTML =
      '<div class="empty-result">' + t('search_empty_users') + '</div>';
    var moreBtnEmpty = document.getElementById('search-user-more');
    if (moreBtnEmpty) {
      moreBtnEmpty.style.display = 'none';
      moreBtnEmpty.disabled = true;
    }
    return;
  }
  if (SEARCH_USER_STATE.cachedKeyword === value && SEARCH_USER_STATE.cachedHtml) {
    container.innerHTML = SEARCH_USER_STATE.cachedHtml;
    SEARCH_USER_STATE.keyword = value;
    var moreBtn = document.getElementById('search-user-more');
    if (moreBtn) {
      moreBtn.style.display = SEARCH_USER_STATE.finished ? 'none' : 'block';
      moreBtn.disabled = SEARCH_USER_STATE.finished;
    }
    return;
  }
  SEARCH_USER_STATE.keyword = value;
  SEARCH_USER_STATE.page = 1;
  SEARCH_USER_STATE.finished = false;
  SEARCH_USER_STATE.loading = false;
  SEARCH_USER_STATE.cachedKeyword = value;
  var run = function () {
    container.innerHTML = '';
    var moreBtnFirst = document.getElementById('search-user-more');
    if (moreBtnFirst) {
      moreBtnFirst.style.display = 'none';
      moreBtnFirst.disabled = false;
    }
    searchLoadMoreUsers();
  };
  if (typeof withLoader === 'function') {
    withLoader(container, run, 200);
  } else {
    run();
  }
}

function searchLoadMoreUsers() {
  var container = document.getElementById('search-user-list');
  if (!container) return;
  if (!SEARCH_USER_STATE.keyword) return;
  if (SEARCH_USER_STATE.loading || SEARCH_USER_STATE.finished) return;
  var page = SEARCH_USER_STATE.page || 1;
  var url =
    'https://api.bilibili.com/x/web-interface/wbi/search/type?search_type=bili_user&keyword=' +
    encodeURIComponent(SEARCH_USER_STATE.keyword) +
    '&page=' +
    encodeURIComponent(String(page));
  SEARCH_USER_STATE.loading = true;
  searchFetchJson(url)
    .then(function (res) {
      if (!res || typeof res.code !== 'number' || res.code !== 0) {
        if (!container.children.length) {
          container.innerHTML =
            '<div class="empty-result">' +
            t('search_empty_users') +
            '</div>';
        }
        SEARCH_USER_STATE.finished = true;
        return;
      }
      var data = res.data || {};
      var list =
        data &&
        Array.isArray(data.result) &&
        data.result.length
          ? data.result
          : [];
      if (!list.length) {
        if (!container.children.length) {
          container.innerHTML =
            '<div class="empty-result">' +
            t('search_empty_users') +
            '</div>';
        }
        SEARCH_USER_STATE.finished = true;
        return;
      }
      var mapped = list
        .map(mapSearchUserItem)
        .filter(function (x) {
          return !!x;
        });
      var existing = container.querySelectorAll('.user-card').length;
      var html = mapped
        .map(function (user, index) {
          var avatar = user.avatar || '';
          if (avatar && typeof homeParseCoverUrl === 'function') {
            avatar = homeParseCoverUrl(avatar);
          }
          var followers = user.followers
            ? user.followers + ' 关注'
            : '';
          var meta =
            (user.desc || '') + (followers ? ' · ' + followers : '');
          return (
            '<div class="user-card">' +
            '<img class="user-avatar" src="' + AVATAR_PLACEHOLDER + '" alt="" loading="lazy"' +
            (avatar ? ' data-src="' + avatar + '"' : '') + '>' +
            '<div class="user-info">' +
            '<div class="user-name">' +
            user.name +
            '</div>' +
            '<div class="user-meta">' +
            meta +
            '</div>' +
            '</div>' +
            '</div>'
          );
        })
        .join('');
      container.insertAdjacentHTML('beforeend', html);
      SEARCH_USER_STATE.cachedHtml = container.innerHTML;
      var numPages = data.numPages || data.num_pages || 0;
      if (numPages && page >= numPages) {
        SEARCH_USER_STATE.finished = true;
      } else if (numPages) {
        SEARCH_USER_STATE.page = page + 1;
      } else {
        if (list.length < (data.pagesize || 20)) {
          SEARCH_USER_STATE.finished = true;
        } else {
          SEARCH_USER_STATE.page = page + 1;
        }
      }
      var moreBtn = document.getElementById('search-user-more');
      if (moreBtn) {
        moreBtn.style.display = SEARCH_USER_STATE.finished ? 'none' : 'block';
        moreBtn.disabled = SEARCH_USER_STATE.finished;
      }
    })
    .catch(function () {
      if (!container.children.length) {
        container.innerHTML =
          '<div class="empty-result">' +
          t('search_empty_users') +
          '</div>';
      }
      SEARCH_USER_STATE.finished = true;
    })
    .finally(function () {
      SEARCH_USER_STATE.loading = false;
    });
}
