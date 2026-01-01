const FAVORITE_STORE = 'favorites';

function BiliTubeRecordFavorite(entry) {
  if (!entry || !entry.id) return;
  openStorageDb().then((db) => {
    if (!db) return;
    if (!db.objectStoreNames.contains(FAVORITE_STORE)) return;
    const tx = db.transaction(FAVORITE_STORE, 'readwrite');
    const store = tx.objectStore(FAVORITE_STORE);
    const now = Date.now();
    const data = {
      id: entry.id,
      title: entry.title || '',
      cover: entry.cover || '',
      channel: entry.channel || '',
      avatar: entry.avatar || '',
      time: entry.time || '',
      views:
        typeof entry.views === 'number'
          ? entry.views
          : typeof entry.views === 'string'
          ? Number(entry.views) || 0
          : 0,
      duration:
        typeof entry.duration === 'number'
          ? entry.duration
          : typeof entry.duration === 'string'
          ? Number(entry.duration) || 0
          : 0,
      ts: typeof entry.ts === 'number' ? entry.ts : now
    };
    const request = store.openCursor();
    request.onsuccess = function () {
      const cursor = request.result;
      if (!cursor) {
        store.add(data);
        return;
      }
      const value = cursor.value || {};
      if (value.id === data.id) {
        const next = Object.assign({}, value, data);
        cursor.update(next);
        cursor.continue();
        return;
      }
      cursor.continue();
    };
  });
}

function BiliTubeRemoveFavoriteById(id) {
  const targetId = (id || '').trim();
  if (!targetId) return;
  openStorageDb().then((db) => {
    if (!db) return;
    if (!db.objectStoreNames.contains(FAVORITE_STORE)) return;
    const tx = db.transaction(FAVORITE_STORE, 'readwrite');
    const store = tx.objectStore(FAVORITE_STORE);
    const request = store.openCursor();
    request.onsuccess = function () {
      const cursor = request.result;
      if (!cursor) {
        return;
      }
      const value = cursor.value || {};
      if (value.id === targetId) {
        cursor.delete();
      }
      cursor.continue();
    };
  });
}

function BiliTubeQueryFavorites(limit) {
  const max = typeof limit === 'number' && limit > 0 ? limit : Infinity;
  return openStorageDb().then((db) => {
    if (!db) return [];
    if (!db.objectStoreNames.contains(FAVORITE_STORE)) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(FAVORITE_STORE, 'readonly');
      const store = tx.objectStore(FAVORITE_STORE);
      let source = store;
      if (
        store.indexNames &&
        store.indexNames.contains &&
        store.indexNames.contains('ts')
      ) {
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

function BiliTubeIsFavorite(id) {
  const targetId = (id || '').trim();
  if (!targetId) return Promise.resolve(false);
  return openStorageDb().then((db) => {
    if (!db) return false;
    if (!db.objectStoreNames.contains(FAVORITE_STORE)) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(FAVORITE_STORE, 'readonly');
      const store = tx.objectStore(FAVORITE_STORE);
      const request = store.openCursor();
      let found = false;
      request.onsuccess = function () {
        const cursor = request.result;
        if (!cursor) {
          return;
        }
        const value = cursor.value || {};
        if (value.id === targetId) {
          found = true;
        }
        cursor.continue();
      };
      tx.oncomplete = function () {
        resolve(found);
      };
      tx.onerror = function () {
        resolve(found);
      };
    });
  });
}

function BiliTubeSetupFavoriteButton(entry) {
  if (!entry || !entry.id) return;
  const view = document.getElementById('view-video');
  if (!view) return;
  const btn = view.querySelector(
    '.BiliTube-action-btn[data-action="favorite"]'
  );
  if (!btn) return;
  btn.setAttribute('data-video-id', entry.id);
  btn.setAttribute('data-video-title', entry.title || '');
  btn.setAttribute('data-video-cover', entry.cover || '');
  btn.setAttribute('data-video-channel', entry.channel || '');
  if (entry.avatar) {
    btn.setAttribute('data-video-avatar', entry.avatar);
  } else {
    btn.removeAttribute('data-video-avatar');
  }
  if (entry.time) {
    btn.setAttribute('data-video-time', entry.time);
  } else {
    btn.removeAttribute('data-video-time');
  }
  if (typeof entry.views === 'number') {
    btn.setAttribute('data-video-views', String(entry.views));
  } else if (typeof entry.views === 'string') {
    btn.setAttribute('data-video-views', entry.views);
  } else {
    btn.removeAttribute('data-video-views');
  }
  if (typeof entry.duration === 'number') {
    btn.setAttribute('data-video-duration', String(entry.duration));
  } else if (typeof entry.duration === 'string') {
    btn.setAttribute('data-video-duration', entry.duration);
  } else {
    btn.removeAttribute('data-video-duration');
  }
  BiliTubeIsFavorite(entry.id)
    .then((isFav) => {
      if (isFav) {
        btn.classList.add('BiliTube-action-active');
      } else {
        btn.classList.remove('BiliTube-action-active');
      }
    })
    .catch(function () {});
}

function BiliTubeToggleFavorite(entry, shouldFavorite) {
  if (!entry || !entry.id) return;
  const target =
    typeof shouldFavorite === 'boolean' ? shouldFavorite : !entry.removed;
  if (target) {
    BiliTubeRecordFavorite(entry);
  } else {
    BiliTubeRemoveFavoriteById(entry.id);
  }
  const profileView = document.getElementById('view-profile');
  if (
    profileView &&
    !profileView.hidden &&
    typeof BiliTubeRenderProfileFavorites === 'function'
  ) {
    BiliTubeRenderProfileFavorites(profileView);
  }
}

function BiliTubeRenderProfileFavorites(view) {
  const container =
    (view && view.querySelector('#favorites')) ||
    document.getElementById('favorites');
  if (!container) return;
  BiliTubeQueryFavorites().then((items) => {
    if (!items || !items.length) {
      container.innerHTML = '<div class="empty-result">暂无收藏视频</div>';
      return;
    }
    const videos = items.map((item) => {
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
        viewsText = item.views.toLocaleString() + ' 次观看';
      } else if (typeof item.views === 'string') {
        viewsText = item.views;
      }
      return {
        id: item.id || '',
        cover,
        duration: durationText,
        title: item.title || '',
        channel: item.channel || '',
        views: viewsText,
        time: item.time || '',
        avatar: item.avatar || ''
      };
    });
    const htmlList = videos.map((video, idx) => {
      if (typeof createHomeCardHtml === 'function') {
        return createHomeCardHtml(video, idx);
      }
      const safeId = encodeURIComponent(video.id || idx);
      const cover = video.cover || '';
      const channelName = video.channel || 'UP 主';
      const viewsText = video.views || '';
      const timeText = video.time || '';
      const meta = [viewsText, timeText].filter(Boolean).join(' · ');
      const duration = video.duration || '';
      return (
        '<div class="video-card" onclick="BiliTubeOpenVideo(\'#/video/' +
        safeId +
        '\')">' +
        '<div class="thumbnail-container">' +
        '<img src="' +
        THUMBNAIL_PLACEHOLDER +
        '" alt="Thumbnail" class="thumbnail-img" loading="lazy"' +
        (cover ? ' data-src="' + cover + '"' : '') +
        '>' +
        (duration ? '<span class="video-duration">' + duration + '</span>' : '') +
        '</div>' +
        '<div class="video-info">' +
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
    });
    const gridHtml =
      '<div class="video-grid" id="favorites-grid">' +
      htmlList.join('') +
      '</div>';
    container.innerHTML = gridHtml;
    if (typeof initImagePlaceholders === 'function') {
      initImagePlaceholders();
    }
  });
}

function BiliTubeBindProfileFavorites(view) {
  if (!view) return;
  if (view.dataset.favoritesBound) return;
  view.dataset.favoritesBound = 'true';
}
