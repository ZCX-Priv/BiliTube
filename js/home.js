const HOME_STATE = {
  currentTab: 'rcmd',
  page: 1,
  loading: false,
  finished: false,
  cachedTab: '',
  cachedHtml: '',
  scrollPosition: 0
};

function homeSaveScrollPosition() {
  HOME_STATE.scrollPosition = window.scrollY || document.documentElement.scrollTop || 0;
}

function homeRestoreScrollPosition() {
  if (HOME_STATE.scrollPosition > 0) {
    setTimeout(function() {
      window.scrollTo(0, HOME_STATE.scrollPosition);
    }, 100);
  }
}

function homeFormatDuration(totalSeconds) {
  const s = parseInt(totalSeconds, 10) || 0;
  let h = Math.floor(s / 3600);
  let m = Math.floor((s % 3600) / 60);
  let sec = s % 60;
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  if (h <= 0) {
    return pad(m) + ':' + pad(sec);
  }
  return pad(h) + ':' + pad(m) + ':' + pad(sec);
}

function homeParseCoverUrl(pic) {
  if (!pic) return '';
  if (pic.startsWith('/proxy?') || pic.startsWith('/stream?')) return pic;
  if (pic.startsWith('//')) {
    pic = 'https:' + pic;
  } else if (!pic.startsWith('http://') && !pic.startsWith('https://')) {
    pic = 'https://' + pic;
  }
  return '/proxy?u=' + encodeURIComponent(pic);
}

function mapHomeRcmdItem(item) {
  const cover = homeParseCoverUrl(item.pic || '');
  const duration = homeFormatDuration(item.duration || 0);
  const title = item.title || '';
  const name =
    (item.owner && (item.owner.name || item.owner.uname)) ||
    (item.args && item.args.up_name) ||
    '';
  const avatar =
    (item.owner && (item.owner.face || item.owner.pic)) ||
    (item.args && item.args.up_face) ||
    '';
  const stat = item.stat || item.rcmd_reason || {};
  let views = '';
  if (stat.view != null) {
    views = stat.view + ' 次观看';
  } else if (stat.play != null) {
    views = stat.play + ' 次观看';
  }
  const id = item.bvid || item.id || item.aid || '';
  return {
    id,
    cover,
    duration,
    title,
    channel: name,
    views,
    time: '',
    avatar
  };
}

function mapHomePopularItem(item) {
  const cover = homeParseCoverUrl(item.pic || '');
  const duration = homeFormatDuration(item.duration || 0);
  const title = item.title || '';
  const name = (item.owner && item.owner.name) || '';
  const avatar = (item.owner && (item.owner.face || item.owner.pic)) || '';
  const stat = item.stat || {};
  let views = '';
  if (stat.view != null) {
    views = stat.view + ' 次观看';
  } else if (stat.play != null) {
    views = stat.play + ' 次观看';
  }
  const id = item.bvid || item.aid || '';
  return {
    id,
    cover,
    duration,
    title,
    channel: name,
    views,
    time: '',
    avatar
  };
}

function createHomeCardHtml(video, indexOffset) {
  const safeId = encodeURIComponent(video.id || indexOffset || '');
  const cover = video.cover || '';
  const channelName = video.channel || 'UP 主';
  const viewsText = video.views || '';
  const timeText = video.time || '';
  const meta = [viewsText, timeText].filter(Boolean).join(' · ');
  const duration = video.duration || '';
  const idx = Number.isFinite(indexOffset) ? indexOffset : 0;
  let avatar = video.avatar || '';
  if (avatar && typeof homeParseCoverUrl === 'function') {
    avatar = homeParseCoverUrl(avatar);
  }
  return (
    '<div class="video-card" onclick="BiliTubeOpenVideo(\'#/video/' +
    safeId +
    '\')">' +
    '<div class="thumbnail-container">' +
    '<img src="' + THUMBNAIL_PLACEHOLDER + '" alt="Thumbnail" class="thumbnail-img" loading="lazy"' +
    (cover ? ' data-src="' + cover + '"' : '') + '>' +
    (duration ? '<span class="video-duration">' + duration + '</span>' : '') +
    '</div>' +
    '<div class="video-info">' +
    '<img class="channel-avatar" src="' + AVATAR_PLACEHOLDER + '" alt="" loading="lazy"' +
    (avatar ? ' data-src="' + avatar + '"' : '') + '>' +
    '<div class="video-details">' +
    '<h3 class="video-title">' +
    video.title +
    '</h3>' +
    '<div class="channel-name">' +
    channelName +
    '</div>' +
    (meta ? '<div class="video-meta">' + meta + '</div>' : '') +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

function insertVideosOptimized(grid, htmlArray) {
  if (!htmlArray.length || !grid) return;
  if (htmlArray.length < 5) {
    htmlArray.forEach(function(html) {
      grid.insertAdjacentHTML('beforeend', html);
    });
    return;
  }
  var fragment = document.createDocumentFragment();
  var temp = document.createElement('div');
  temp.innerHTML = htmlArray.join('');
  while (temp.firstChild) {
    fragment.appendChild(temp.firstChild);
  }
  grid.appendChild(fragment);
}

function homeShuffle(list) {
  if (!Array.isArray(list) || list.length < 2) return;
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
}

function loadHomeVideos(tab, page, replace) {
  const grid = document.getElementById('video-grid');
  if (!grid || HOME_STATE.loading) return;
  HOME_STATE.loading = true;
  HOME_STATE.page = page;
  const container = grid.parentElement || grid;

  if (page === 1 && HOME_STATE.cachedTab === tab && HOME_STATE.cachedHtml) {
    grid.innerHTML = HOME_STATE.cachedHtml;
    HOME_STATE.loading = false;
    homeRestoreScrollPosition();
    return;
  }

  let url;
  if (tab === 'popular') {
    url =
      '/proxy?u=' +
      encodeURIComponent(
        'https://api.bilibili.com/x/web-interface/popular?ps=20&pn=' + page
      );
  } else if (tab === 'rcmd') {
    const base =
      'https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd';
    const params =
      'fresh_type=4&ps=20&fresh_idx=' +
      page +
      '&fresh_idx_1h=' +
      page +
      '&fetch_row=20';
    url = '/proxy?u=' + encodeURIComponent(base + '?' + params);
  } else if (tab === 'all') {
    const baseRcmd =
      'https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd';
    const paramsRcmd =
      'fresh_type=4&ps=20&fresh_idx=' +
      page +
      '&fresh_idx_1h=' +
      page +
      '&fetch_row=20';
    const urlRcmd =
      '/proxy?u=' + encodeURIComponent(baseRcmd + '?' + paramsRcmd);
    const urlPopular =
      '/proxy?u=' +
      encodeURIComponent(
        'https://api.bilibili.com/x/web-interface/popular?ps=20&pn=' + page
      );
    const doFetchAll = () => {
      Promise.all([
        fetch(urlRcmd)
          .then(function(res) {
            if (!res.ok) return null;
            return res.json();
          })
          .catch(function() {
            return null;
          }),
        fetch(urlPopular)
          .then(function(res) {
            if (!res.ok) return null;
            return res.json();
          })
          .catch(function() {
            return null;
          })
      ])
        .then(function(results) {
          const jsonRcmd = results[0];
          const jsonPopular = results[1];
          let itemsRcmd = [];
          let itemsPopular = [];
          if (
            jsonRcmd &&
            jsonRcmd.data &&
            Array.isArray(jsonRcmd.data.item) &&
            jsonRcmd.data.item.length
          ) {
            itemsRcmd = jsonRcmd.data.item;
          }
          if (
            jsonPopular &&
            jsonPopular.data &&
            Array.isArray(jsonPopular.data.list) &&
            jsonPopular.data.list.length
          ) {
            itemsPopular = jsonPopular.data.list;
          }
          let videos = [];
          if (itemsRcmd.length) {
            videos = videos.concat(
              itemsRcmd.map(function(it) {
                return mapHomeRcmdItem(it);
              })
            );
          }
          if (itemsPopular.length) {
            videos = videos.concat(
              itemsPopular.map(function(it) {
                return mapHomePopularItem(it);
              })
            );
          }
          if (!videos.length) {
            if (replace) {
              grid.innerHTML =
                '<div class="empty-result">暂无推荐内容</div>';
            }
            HOME_STATE.finished = true;
            return;
          }
          homeShuffle(videos);
          const baseIndex = (page - 1) * videos.length;
          const htmlArray = videos.map(function(v, idx) {
            return createHomeCardHtml(v, baseIndex + idx);
          });
          if (replace) {
            grid.innerHTML = htmlArray.join('');
            HOME_STATE.cachedTab = tab;
            HOME_STATE.cachedHtml = grid.innerHTML;
          } else {
            insertVideosOptimized(grid, htmlArray);
          }
          homeRestoreScrollPosition();
        })
        .catch(function() {
          if (replace) {
            grid.innerHTML =
              '<div class="empty-result">首页推荐加载失败，请稍后重试</div>';
          }
        })
        .finally(function() {
          HOME_STATE.loading = false;
        });
    };

    const containerAll = grid.parentElement || grid;
    if (typeof withLoader === 'function' && replace) {
      withLoader(containerAll, doFetchAll, 200);
    } else {
      doFetchAll();
    }
    return;
  }

  const doFetch = () => {
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('network');
        return res.json();
      })
      .then((json) => {
        let items = [];
        if (tab === 'popular') {
          items =
            json &&
            json.data &&
            Array.isArray(json.data.list) &&
            json.data.list.length
              ? json.data.list
              : [];
        } else {
          items =
            json &&
            json.data &&
            Array.isArray(json.data.item) &&
            json.data.item.length
              ? json.data.item
              : [];
        }

        if (!items.length) {
          if (replace) {
            grid.innerHTML =
              '<div class="empty-result">暂无推荐内容</div>';
          }
          HOME_STATE.finished = true;
          return;
        }

        const mapped =
          tab === 'popular'
            ? items.map((it) => mapHomePopularItem(it))
            : items.map((it) => mapHomeRcmdItem(it));

        const baseIndex = (page - 1) * items.length;
        const htmlArray = mapped.map((v, idx) => createHomeCardHtml(v, baseIndex + idx));

        if (replace) {
          grid.innerHTML = htmlArray.join('');
          HOME_STATE.cachedTab = tab;
          HOME_STATE.cachedHtml = grid.innerHTML;
        } else {
          insertVideosOptimized(grid, htmlArray);
        }
        homeRestoreScrollPosition();
      })
      .catch(() => {
        if (replace) {
          grid.innerHTML =
            '<div class="empty-result">首页推荐加载失败，请稍后重试</div>';
        }
      })
      .finally(() => {
        HOME_STATE.loading = false;
      });
  };

  if (typeof withLoader === 'function' && replace) {
    withLoader(container, doFetch, 200);
  } else {
    doFetch();
  }
}

function bindHomeTagInteractions() {
  const view = document.getElementById('view-home');
  if (!view) return;
  const tags = view.querySelectorAll('.tag-chip');
  tags.forEach((tag) => {
    if (tag.dataset.homeBound === 'true') return;
    tag.dataset.homeBound = 'true';
    tag.addEventListener('click', () => {
      const text = (tag.textContent || '').trim();
      let tab = 'rcmd';
      if (text === '全部') {
        tab = 'all';
      } else if (text === '热门') {
        tab = 'popular';
      }
      HOME_STATE.currentTab = tab;
      HOME_STATE.page = 1;
      HOME_STATE.finished = false;
      loadHomeVideos(tab, 1, true);
    });
  });
}

const HOME_PULL_STATE = {
  enabled: false,
  pulling: false,
  startY: 0,
  active: false,
  threshold: 0
};

function bindHomePullToRefresh() {
  const view = document.getElementById('view-home');
  if (!view || HOME_PULL_STATE.enabled) return;
  HOME_PULL_STATE.enabled = true;

  function getScrollTop() {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function handleTouchStart(e) {
    if (!view || view.hidden) return;
    if (getScrollTop() > 0) return;
    if (!e.touches || !e.touches.length) return;
    HOME_PULL_STATE.pulling = true;
    HOME_PULL_STATE.startY = e.touches[0].clientY;
    HOME_PULL_STATE.active = false;
  }

  function handleTouchMove(e) {
    if (!HOME_PULL_STATE.pulling) return;
    if (!e.touches || !e.touches.length) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - HOME_PULL_STATE.startY;
    if (delta <= 0) {
      HOME_PULL_STATE.active = false;
      return;
    }
    if (getScrollTop() > 0) {
      HOME_PULL_STATE.active = false;
      return;
    }
    HOME_PULL_STATE.active = delta >= HOME_PULL_STATE.threshold;
  }

  function handleTouchEnd() {
    if (!HOME_PULL_STATE.pulling) return;
    const shouldRefresh = HOME_PULL_STATE.active;
    HOME_PULL_STATE.pulling = false;
    HOME_PULL_STATE.active = false;
    if (!shouldRefresh) return;
    if (HOME_STATE.loading) return;
    HOME_STATE.finished = false;
    HOME_STATE.cachedTab = '';
    HOME_STATE.cachedHtml = '';
    const tab = HOME_STATE.currentTab || 'all';
    loadHomeVideos(tab, 1, true);
  }

  function handleWheel(e) {
    if (!view || view.hidden) return;
    if (HOME_STATE.loading) return;
    const scrollTop = getScrollTop();
    if (scrollTop > 0) return;
    if (typeof e.deltaY !== 'number') return;
    if (e.deltaY < 0) {
      HOME_STATE.finished = false;
      HOME_STATE.cachedTab = '';
      HOME_STATE.cachedHtml = '';
      const tab = HOME_STATE.currentTab || 'all';
      loadHomeVideos(tab, 1, true);
    }
  }

  view.addEventListener('touchstart', handleTouchStart, { passive: true });
  view.addEventListener('touchmove', handleTouchMove, { passive: true });
  view.addEventListener('touchend', handleTouchEnd);
  view.addEventListener('touchcancel', handleTouchEnd);
  view.addEventListener('wheel', handleWheel, { passive: true });
}

function initHomeView() {
  const grid = document.getElementById('video-grid');
  if (!grid) return;
  bindHomeTagInteractions();
  bindHomeScroll();
  bindHomePullToRefresh();
  if (grid.dataset.homeInitialized === 'true') return;
  grid.dataset.homeInitialized = 'true';
  HOME_STATE.currentTab = 'all';
  HOME_STATE.page = 1;
  HOME_STATE.finished = false;
  loadHomeVideos('all', 1, true);
}

function handleHomeScroll() {
  const view = document.getElementById('view-home');
  const grid = document.getElementById('video-grid');
  if (!view || view.hidden) return;
  if (!grid || HOME_STATE.loading || HOME_STATE.finished) return;
  const rect = grid.getBoundingClientRect();
  const threshold = 300;
  if (rect.bottom - window.innerHeight <= threshold) {
    const nextPage = (HOME_STATE.page || 1) + 1;
    loadHomeVideos(HOME_STATE.currentTab, nextPage, false);
  }
}

function bindHomeScroll() {
  if (window.__BiliTubeHomeScrollBound) return;
  window.__BiliTubeHomeScrollBound = true;
  window.addEventListener('scroll', handleHomeScroll);
}
