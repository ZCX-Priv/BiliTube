const HOME_STATE = {
  currentTab: 'rcmd',
  page: 1,
  loading: false,
  finished: false
};

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
    '<div class="video-card" onclick="window.location.hash=\'#/video/' +
    safeId +
    '\'">' +
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

function loadHomeVideos(tab, page, replace) {
  const grid = document.getElementById('video-grid');
  if (!grid || HOME_STATE.loading) return;
  HOME_STATE.loading = true;
  HOME_STATE.page = page;
  const container = grid.parentElement || grid;
  let url;
  if (tab === 'popular') {
    url =
      '/proxy?u=' +
      encodeURIComponent(
        'https://api.bilibili.com/x/web-interface/popular?ps=20&pn=' + page
      );
  } else {
    const base =
      'https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd';
    const params =
      'fresh_type=4&ps=20&fresh_idx=' +
      page +
      '&fresh_idx_1h=' +
      page +
      '&fetch_row=20';
    url = '/proxy?u=' + encodeURIComponent(base + '?' + params);
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
        } else {
          insertVideosOptimized(grid, htmlArray);
        }
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

  if (typeof withLoader === 'function') {
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
      if (text === '热门') {
        tab = 'popular';
      }
      HOME_STATE.currentTab = tab;
      HOME_STATE.page = 1;
      HOME_STATE.finished = false;
      loadHomeVideos(tab, 1, true);
    });
  });
}

function initHomeView() {
  const grid = document.getElementById('video-grid');
  if (!grid) return;
  bindHomeTagInteractions();
  bindHomeScroll();
  if (grid.dataset.homeInitialized === 'true') return;
  grid.dataset.homeInitialized = 'true';
  HOME_STATE.currentTab = 'rcmd';
  HOME_STATE.page = 1;
  HOME_STATE.finished = false;
  loadHomeVideos('rcmd', 1, true);
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
