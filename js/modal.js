const BiliTubeModalState = {
  resolve: null
};

function BiliTubeInitModal() {
  const modal = document.getElementById('BiliTube-modal');
  if (!modal) return;
  const cancelBtn = modal.querySelector('[data-action="modal-cancel"]');
  const confirmBtn = modal.querySelector('[data-action="modal-confirm"]');
  const closeBtn = modal.querySelector('[data-action="modal-close"]');
  const close = (ok) => {
    modal.hidden = true;
    if (BiliTubeModalState.resolve) {
      BiliTubeModalState.resolve(ok);
      BiliTubeModalState.resolve = null;
    }
  };
  BiliTubeModalState.close = close;
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      close(false);
    });
  }
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      close(true);
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      close(false);
    });
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      close(false);
    }
  });
}

function BiliTubeConfirm(message) {
  const modal = document.getElementById('BiliTube-modal');
  if (!modal) {
    const ok = window.confirm(message);
    return Promise.resolve(ok);
  }
  const titleEl = document.getElementById('BiliTube-modal-title');
  const bodyEl = document.getElementById('BiliTube-modal-body');
  if (titleEl) {
    titleEl.textContent = '确认操作';
  }
  if (bodyEl) {
    bodyEl.textContent = message;
  }
  modal.hidden = false;
  return new Promise((resolve) => {
    BiliTubeModalState.resolve = resolve;
  });
}
