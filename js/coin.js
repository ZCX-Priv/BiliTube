const COIN_STORE = 'coins';

function BiliTubeSetCoin(videoId, amount) {
  const id = (videoId || '').trim();
  const num = Number(amount);
  if (!id || !num || !isFinite(num) || num <= 0) return;
  openStorageDb().then((db) => {
    if (!db) return;
    if (!db.objectStoreNames.contains(COIN_STORE)) return;
    const tx = db.transaction(COIN_STORE, 'readwrite');
    const store = tx.objectStore(COIN_STORE);
    const now = Date.now();
    const data = {
      id,
      amount: num,
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

function BiliTubeIsCoined(videoId) {
  const id = (videoId || '').trim();
  if (!id) return Promise.resolve(false);
  return openStorageDb().then((db) => {
    if (!db) return false;
    if (!db.objectStoreNames.contains(COIN_STORE)) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(COIN_STORE, 'readonly');
      const store = tx.objectStore(COIN_STORE);
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

function BiliTubeSetupCoinButton(videoId) {
  const id = (videoId || '').trim();
  if (!id) return;
  const view = document.getElementById('view-video');
  if (!view) return;
  const btn = view.querySelector('.BiliTube-action-btn[data-action="coin"]');
  if (!btn) return;
  btn.setAttribute('data-video-id', id);
  BiliTubeIsCoined(id)
    .then((coined) => {
      btn.classList.toggle('BiliTube-action-active', coined);
    })
    .catch(function () {});
}

function BiliTubePlayCoinEffect(target) {
  const anchor = target && target.getBoundingClientRect ? target : null;
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }
  const container = document.createElement('div');
  container.className = 'BiliTube-coin-burst';
  container.style.left = x + 'px';
  container.style.top = y + 'px';
  const count = 14;
  for (let i = 0; i < count; i++) {
    const item = document.createElement('div');
    item.className = 'BiliTube-coin-burst-item';
    container.appendChild(item);
  }
  document.body.appendChild(container);
  const items = container.children;
  requestAnimationFrame(() => {
    for (let i = 0; i < items.length; i++) {
      const angle = (Math.PI * 2 * i) / items.length;
      const distance = 60 + Math.random() * 40;
      const dx = Math.cos(angle) * distance;
      const dy = -Math.abs(Math.sin(angle) * distance) - 10;
      const item = items[i];
      item.style.opacity = '1';
      item.style.transform =
        'translate(' + dx + 'px,' + dy + 'px) scale(1.2)';
    }
  });
  setTimeout(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }, 900);
}

function BiliTubeShowCoinModal(videoId, btn) {
  const modal = document.getElementById('BiliTube-modal');
  const titleEl = document.getElementById('BiliTube-modal-title');
  const bodyEl = document.getElementById('BiliTube-modal-body');
  const confirmBtn = modal
    ? modal.querySelector('[data-action="modal-confirm"]')
    : null;
  const cancelBtn = modal
    ? modal.querySelector('[data-action="modal-cancel"]')
    : null;
  if (!modal || !titleEl || !bodyEl || !confirmBtn || !cancelBtn) {
    const amount = window.prompt('请输入投币金额', '');
    if (amount == null || amount === '') return;
    const parsed = Number(amount);
    if (!parsed || !isFinite(parsed) || parsed <= 0) return;
    if (typeof BiliTubeSetCoin === 'function' && videoId) {
      BiliTubeSetCoin(videoId, parsed);
    }
    if (btn) {
      btn.classList.add('BiliTube-action-active');
    }
    if (typeof BiliTubePlayCoinEffect === 'function') {
      BiliTubePlayCoinEffect(btn || null);
    }
    if (typeof BiliTubeConfirm === 'function') {
      BiliTubeConfirm('投币成功！');
    }
    return;
  }
  titleEl.textContent = '投币';
  bodyEl.innerHTML =
    '<div class="coin-modal-content">' +
    '<label style="display:block;margin-bottom:8px;">请输入投币金额</label>' +
    '<input type="number" id="BiliTube-coin-amount" min="0" step="1" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--divider-color);margin-bottom:12px;box-sizing:border-box;" />' +
    '<div style="margin-bottom:12px;">卡内余额：∞</div>' +
    '</div>';
  const originalConfirmText = confirmBtn.textContent || '';
  confirmBtn.textContent = '投币！';
  modal.hidden = false;
  const amountInput = document.getElementById('BiliTube-coin-amount');
  if (amountInput) {
    amountInput.focus();
  }
  const handleSubmit = () => {
    if (!amountInput) return;
    const value = amountInput.value.trim();
    if (!value) {
      amountInput.focus();
      return;
    }
    const parsed = Number(value);
    if (parsed && isFinite(parsed) && parsed > 0) {
      if (typeof BiliTubeSetCoin === 'function' && videoId) {
        BiliTubeSetCoin(videoId, parsed);
      }
      if (btn) {
        btn.classList.add('BiliTube-action-active');
      }
      modal.hidden = true;
      confirmBtn.textContent = originalConfirmText;
      confirmBtn.removeEventListener('click', handleSubmit);
      cancelBtn.removeEventListener('click', handleCancel);
      modal.removeEventListener('click', handleBackdropClick);
      if (typeof BiliTubePlayCoinEffect === 'function') {
        BiliTubePlayCoinEffect(confirmBtn);
      }
      if (typeof BiliTubeConfirm === 'function') {
        BiliTubeConfirm('投币成功！');
      }
    }
  };
  const handleCancel = () => {
    confirmBtn.textContent = originalConfirmText;
    confirmBtn.removeEventListener('click', handleSubmit);
    cancelBtn.removeEventListener('click', handleCancel);
    modal.removeEventListener('click', handleBackdropClick);
  };
  const handleBackdropClick = (e) => {
    if (e.target === modal) {
      handleCancel();
    }
  };
  confirmBtn.addEventListener('click', handleSubmit);
  cancelBtn.addEventListener('click', handleCancel);
  modal.addEventListener('click', handleBackdropClick);
}

