const WATCH_HISTORY_STORE = 'watch_history';

function BiliTubeRecordWatchHistory(entry) {
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
    let hasAny = false;
    const request = store.openCursor();
    request.onsuccess = function () {
      const cursor = request.result;
      if (!cursor) {
        store.add(data);
        return;
      }
      const value = cursor.value || {};
      if (value.id === data.id) {
        hasAny = true;
        cursor.delete();
        cursor.continue();
        return;
      }
      cursor.continue();
    };
  });
}

function BiliTubeQueryWatchHistory(limit) {
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

function BiliTubeDeleteWatchHistoryByKey(key) {
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

function BiliTubeClearWatchHistory() {
  openStorageDb().then((db) => {
    if (!db) return;
    if (!db.objectStoreNames.contains(WATCH_HISTORY_STORE)) return;
    const tx = db.transaction(WATCH_HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(WATCH_HISTORY_STORE);
    store.clear();
  });
}

function BiliTubeRenderProfileHistory(view) {
  const recentGrid =
    (view && view.querySelector('#recent-grid')) ||
    document.getElementById('recent-grid');
  if (!recentGrid) return;
  BiliTubeQueryWatchHistory().then((items) => {
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

function BiliTubeBindProfileHistory(view) {
  if (!view) return;
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
            BiliTubeConfirm(msg).then((ok) => {
              if (!ok) return;
              const key = itemEl.getAttribute('data-key');
              if (key != null && key !== '') {
                BiliTubeDeleteWatchHistoryByKey(key);
              }
              BiliTubeRenderProfileHistory(view);
            });
          }
          return;
        }
        const itemEl = e.target.closest('.timeline-item');
        if (itemEl) {
          const id = itemEl.getAttribute('data-id') || '';
          if (id) {
            BiliTubeOpenVideo(
              '#/video/' + encodeURIComponent(id)
            );
          }
        }
      });
    }
    const clearBtn =
      view.querySelector('[data-action="history-clear"]') ||
      document.querySelector('[data-action="history-clear"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        BiliTubeConfirm('确定清空所有观看历史吗？').then((ok) => {
          if (!ok) return;
          BiliTubeClearWatchHistory();
          BiliTubeRenderProfileHistory(view);
        });
      });
    }
    view.dataset.historyBound = 'true';
  }
}
