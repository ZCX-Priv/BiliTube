let BiliTubeShareState = {
  bvid: '',
  aid: 0,
  isConverted: false
};

function BiliTubeSetupShareButton(videoId) {
  const id = (videoId || '').trim();
  if (!id) return;
  const view = document.getElementById('view-video');
  if (!view) return;
  const btn = view.querySelector('.BiliTube-action-btn[data-action="share"]');
  if (!btn) return;
  btn.setAttribute('data-video-id', id);
}

function BiliTubeGetShareUrl(converted) {
  const { bvid, aid } = BiliTubeShareState;
  if (converted && bvid) {
    return 'https://www.bilibili.com/video/' + bvid;
  }
  if (bvid) {
    return window.location.origin + window.location.pathname + '#/video/' + bvid;
  }
  if (aid) {
    return window.location.origin + window.location.pathname + '#/video/' + aid;
  }
  return window.location.href;
}

function BiliTubeCopyShareUrl() {
  const url = BiliTubeGetShareUrl(BiliTubeShareState.isConverted);
  navigator.clipboard.writeText(url).then(function() {
    if (typeof BiliTubeConfirm === 'function') {
      BiliTubeConfirm('链接已复制到剪贴板');
    }
  }).catch(function() {
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    if (typeof BiliTubeConfirm === 'function') {
      BiliTubeConfirm('链接已复制到剪贴板');
    }
  });
}

function BiliTubeToggleShareUrl() {
  BiliTubeShareState.isConverted = !BiliTubeShareState.isConverted;
  const urlInput = document.getElementById('BiliTube-share-url');
  if (urlInput) {
    urlInput.value = BiliTubeGetShareUrl(BiliTubeShareState.isConverted);
  }
}

function BiliTubeShowShareModal(videoId) {
  const modal = document.getElementById('BiliTube-modal');
  const titleEl = document.getElementById('BiliTube-modal-title');
  const bodyEl = document.getElementById('BiliTube-modal-body');
  
  BiliTubeShareState.isConverted = false;
  
  let bvid = '';
  let aid = 0;
  
  if (videoId) {
    const id = videoId.trim();
    if (id.startsWith('BV')) {
      bvid = id;
    } else if (/^\d+$/.test(id)) {
      aid = parseInt(id, 10);
    }
  }
  
  if (!bvid && window.BiliTubeVideoData) {
    bvid = window.BiliTubeVideoData.bvid || '';
    aid = window.BiliTubeVideoData.aid || 0;
  }
  
  BiliTubeShareState.bvid = bvid;
  BiliTubeShareState.aid = aid;
  
  const shareUrl = BiliTubeGetShareUrl(false);
  
  bodyEl.innerHTML =
    '<div class="share-modal-content">' +
    '<label style="display:block;margin-bottom:8px;">分享链接</label>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
    '<input type="text" id="BiliTube-share-url" readonly style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--divider-color);background:var(--input-bg);color:var(--text-primary);font-size:13px;box-sizing:border-box;" value="' + shareUrl + '" />' +
    '<button type="button" id="BiliTube-share-toggle" style="padding:8px 10px;border-radius:8px;border:none;background:var(--primary-color);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="切换链接">' +
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/></svg>' +
    '</button>' +
    '<button type="button" id="BiliTube-share-copy" style="padding:8px 10px;border-radius:8px;border:none;background:linear-gradient(135deg, #FFDF00 0%, #D4AF37 100%);color:#333;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="复制链接">' +
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>' +
    '</button>' +
    '</div>' +
    '</div>';
  
  titleEl.textContent = '分享';
  
  document.getElementById('BiliTube-share-copy').addEventListener('click', BiliTubeCopyShareUrl);
  document.getElementById('BiliTube-share-toggle').addEventListener('click', BiliTubeToggleShareUrl);
  
  modal.hidden = false;
}