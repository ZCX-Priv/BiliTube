const COIN_STORE = 'coins';
let coinRainCanvas = null;
let coinRainCtx = null;
let coinRainCoins = [];
let coinRainAnimationId = null;

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

function BiliTubeInitCoinRain() {
  if (coinRainCanvas) return;
  coinRainCanvas = document.createElement('canvas');
  coinRainCanvas.id = 'BiliTube-coin-rain-canvas';
  coinRainCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  document.body.appendChild(coinRainCanvas);
  coinRainCtx = coinRainCanvas.getContext('2d');
  window.addEventListener('resize', BiliTubeResizeCoinRain);
  BiliTubeResizeCoinRain();
}

function BiliTubeResizeCoinRain() {
  if (coinRainCanvas) {
    coinRainCanvas.width = window.innerWidth;
    coinRainCanvas.height = window.innerHeight;
  }
}

class BiliTubeCoin {
  constructor(startX, startY) {
    this.x = startX !== undefined ? startX : Math.random() * window.innerWidth;
    this.y = startY !== undefined ? startY : -Math.random() * window.innerHeight - 50;
    this.size = 12 + Math.random() * 12;
    this.speedY = 4 + Math.random() * 8;
    this.speedX = (Math.random() - 0.5) * 3;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.3;
    this.opacity = 0.7 + Math.random() * 0.3;
    this.scaleX = 1;
    this.scaleXSpeed = 0.08 + Math.random() * 0.12;
  }

  update() {
    this.y += this.speedY;
    this.x += this.speedX;
    this.rotation += this.rotationSpeed;
    this.scaleX = Math.cos(this.rotation);
    if (this.y > window.innerHeight + 100) {
      return false;
    }
    return true;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * 0.15);
    ctx.scale(Math.abs(this.scaleX), 1);
    
    const gradient = ctx.createRadialGradient(
      -this.size * 0.3, -this.size * 0.3, 0,
      0, 0, this.size
    );
    gradient.addColorStop(0, '#FFF7C0');
    gradient.addColorStop(0.4, '#FFD700');
    gradient.addColorStop(0.8, '#D4AF37');
    gradient.addColorStop(1, '#996515');
    
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 215, 0, ${this.opacity})`;
    ctx.fill();
    
    ctx.strokeStyle = `rgba(184, 134, 11, ${this.opacity})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(0, 0, this.size * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(184, 134, 11, ${this.opacity * 0.5})`;
    ctx.stroke();
    
    ctx.fillStyle = `rgba(184, 134, 11, ${this.opacity * 0.7})`;
    ctx.font = `bold ${this.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Ɓ', 0, 0);
    
    ctx.restore();
  }
}

function BiliTubeAnimateCoinRain() {
  if (!coinRainCtx || !coinRainCanvas) return;
  
  coinRainCtx.clearRect(0, 0, coinRainCanvas.width, coinRainCanvas.height);
  
  coinRainCoins = coinRainCoins.filter(coin => {
    const active = coin.update();
    if (active) coin.draw(coinRainCtx);
    return active;
  });
  
  if (coinRainCoins.length > 0) {
    coinRainAnimationId = requestAnimationFrame(BiliTubeAnimateCoinRain);
  } else {
    coinRainAnimationId = null;
  }
}

function BiliTubePlayCoinEffect(target) {
  BiliTubeInitCoinRain();
  
  const anchor = target && target.getBoundingClientRect ? target : null;
  let centerX = window.innerWidth / 2;
  let centerY = window.innerHeight / 2;
  
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
  }
  
  const count = 80;
  for (let i = 0; i < count; i++) {
    const startX = Math.random() * window.innerWidth;
    const startY = -Math.random() * window.innerHeight - 50;
    coinRainCoins.push(new BiliTubeCoin(startX, startY));
  }
  
  if (!coinRainAnimationId) {
    BiliTubeAnimateCoinRain();
  }
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

