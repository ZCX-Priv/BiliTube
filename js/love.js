const LOVE_STORE = 'likes';

function BiliTubeSetLove(videoId, liked) {
  const id = (videoId || '').trim();
  if (!id) return;
  openStorageDb().then((db) => {
    if (!db) return;
    if (!db.objectStoreNames.contains(LOVE_STORE)) return;
    const tx = db.transaction(LOVE_STORE, 'readwrite');
    const store = tx.objectStore(LOVE_STORE);
    if (!liked) {
      const delReq = store.openCursor();
      delReq.onsuccess = function () {
        const cursor = delReq.result;
        if (!cursor) {
          return;
        }
        const value = cursor.value || {};
        if (value.id === id) {
          cursor.delete();
        }
        cursor.continue();
      };
      return;
    }
    const now = Date.now();
    const data = {
      id,
      ts: now
    };
    const request = store.openCursor();
    request.onsuccess = function () {
      const cursor = request.result;
      if (!cursor) {
        store.add(data);
        return;
      }
      const value = cursor.value || {};
      if (value.id === id) {
        const next = Object.assign({}, value, data);
        cursor.update(next);
        cursor.continue();
        return;
      }
      cursor.continue();
    };
  });
}

function BiliTubeIsLoved(videoId) {
  const id = (videoId || '').trim();
  if (!id) return Promise.resolve(false);
  return openStorageDb().then((db) => {
    if (!db) return false;
    if (!db.objectStoreNames.contains(LOVE_STORE)) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(LOVE_STORE, 'readonly');
      const store = tx.objectStore(LOVE_STORE);
      const request = store.openCursor();
      let found = false;
      request.onsuccess = function () {
        const cursor = request.result;
        if (!cursor) {
          return;
        }
        const value = cursor.value || {};
        if (value.id === id) {
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

function BiliTubeSetupLoveButton(videoId) {
  const id = (videoId || '').trim();
  if (!id) return;
  const view = document.getElementById('view-video');
  if (!view) return;
  const btn = view.querySelector('.BiliTube-action-btn[data-action="like"]');
  if (!btn) return;
  btn.setAttribute('data-video-id', id);
  BiliTubeIsLoved(id)
    .then((liked) => {
      btn.classList.toggle('BiliTube-action-active', liked);
    })
    .catch(function () {});
}

