var BiliTubeDanmakuState = {
  list: [],
  index: 0,
  timer: null,
  enabled: true,
  laneIndex: 0,
  lineHeight: 24,
  laneNextAvailable: []
};

var BiliTubeVideoChecker = {
  retryCount: 0,
  maxRetries: 3,
  retryDelay: [1000, 2000, 4000],
  currentRetry: 0,
  timer: null,
  stallTimer: null,
  stallThreshold: 8000,
  isRetrying: false,
  lastBvid: '',
  lastCid: '',
  lastAid: '',
  pendingRetry: null,

  reset: function() {
    this.retryCount = 0;
    this.currentRetry = 0;
    this.isRetrying = false;
    this.lastBvid = '';
    this.lastCid = '';
    this.lastAid = '';
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.stallTimer) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
    this.pendingRetry = null;
  },

  markRetry: function(bvid, aid, cid) {
    this.lastBvid = bvid || '';
    this.lastAid = aid || '';
    this.lastCid = cid || '';
    if (this.currentRetry >= this.maxRetries) {
      this.retryCount++;
      this.currentRetry = 0;
    }
  },

  canRetry: function() {
    return this.currentRetry < this.maxRetries;
  },

  getNextDelay: function() {
    var delay = this.retryDelay[this.currentRetry] || 2000;
    this.currentRetry++;
    return delay;
  },

  startStallTimer: function(videoEl, callback) {
    this.stopStallTimer();
    if (!videoEl) return;
    var self = this;
    this.stallTimer = setTimeout(function() {
      if (videoEl && videoEl.readyState < 3) {
        callback && callback();
      }
    }, this.stallThreshold);
  },

  stopStallTimer: function() {
    if (this.stallTimer) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
  },

  isCorruptionError: function(err) {
    if (!err) return false;
    if (err.name === 'MediaError') {
      var code = err.code || 0;
      return code === 1 || code === 2 || code === 3 || code === 4;
    }
    return false;
  },

  isNetworkError: function(err) {
    if (!err) return false;
    if (err.name === 'TypeError' && err.message && err.message.indexOf('Failed to fetch') !== -1) {
      return true;
    }
    if (err.name === 'MediaError' && err.code === 1) {
      return true;
    }
    return false;
  },

  clearVideoSource: function(videoEl) {
    if (!videoEl) return;
    videoEl.removeAttribute('src');
    if (window.BiliTubeHls) {
      try {
        window.BiliTubeHls.destroy();
      } catch (e) {
        console.error('Error destroying Hls instance:', e);
      }
      window.BiliTubeHls = null;
    }
    var source = videoEl.querySelector('source');
    if (source) {
      source.remove();
    }
    videoEl.load();
  }
};

var BiliTubeCommentState = {
  aid: 0,
  next: 1,
  loading: false,
  finished: false
};

var BiliTubeAutoPlayState = {
  enabled: false,
  timer: null,
  nextId: ''
};

var BiliTubeRecommendState = {
  list: [],
  index: 0,
  pageSize: 10,
  container: null,
  finished: false,
  loading: false
};

function playerCancelAutoPlayTimer() {
  if (BiliTubeAutoPlayState.timer) {
    clearTimeout(BiliTubeAutoPlayState.timer);
    BiliTubeAutoPlayState.timer = null;
  }
}

function playerUpdateAutoPlayToggle() {
  var toggles = document.querySelectorAll('.BiliTube-auto-play-toggle');
  toggles.forEach(function (btn) {
    btn.classList.toggle('BiliTube-auto-play-on', BiliTubeAutoPlayState.enabled);
    btn.setAttribute('aria-pressed', BiliTubeAutoPlayState.enabled ? 'true' : 'false');
  });
}

function playerSetAutoPlayEnabled(enabled) {
  BiliTubeAutoPlayState.enabled = !!enabled;
  if (!BiliTubeAutoPlayState.enabled) {
    playerCancelAutoPlayTimer();
  }
  playerUpdateAutoPlayToggle();
}

function playerHandleAutoPlayEnded() {
  if (!BiliTubeAutoPlayState.enabled) {
    return;
  }
  playerCancelAutoPlayTimer();
  var nextId = BiliTubeAutoPlayState.nextId || '';
  if (!nextId) {
    return;
  }
  BiliTubeAutoPlayState.timer = setTimeout(function () {
    if (!BiliTubeAutoPlayState.enabled) {
      return;
    }
    if (!BiliTubeAutoPlayState.nextId) {
      return;
    }
    window.location.hash =
      '#/video/' + encodeURIComponent(BiliTubeAutoPlayState.nextId);
  }, 3000);
}

function playerAppendNextRecommendationsPage() {
  if (!BiliTubeRecommendState || !BiliTubeRecommendState.container) {
    return;
  }
  if (BiliTubeRecommendState.loading || BiliTubeRecommendState.finished) {
    return;
  }
  var list = BiliTubeRecommendState.list || [];
  if (!list.length) {
    BiliTubeRecommendState.finished = true;
    return;
  }
  var start = BiliTubeRecommendState.index || 0;
  if (start >= list.length) {
    BiliTubeRecommendState.finished = true;
    return;
  }
  BiliTubeRecommendState.loading = true;
  var pageSize = BiliTubeRecommendState.pageSize || 10;
  var end = start + pageSize;
  if (end > list.length) {
    end = list.length;
  }
  var container = BiliTubeRecommendState.container;
  for (var i = start; i < end; i++) {
    var item = list[i] || {};
    var rec = document.createElement('div');
    rec.className = 'BiliTube-rec-item';
    var thumb = document.createElement('div');
    thumb.className = 'BiliTube-rec-thumb';
    var pic = item.pic || item.cover || '';
    if (typeof playerSetThumbBackground === 'function') {
      playerSetThumbBackground(thumb, pic);
    }
    var info = document.createElement('div');
    info.className = 'BiliTube-rec-info';
    var titleEl = document.createElement('div');
    titleEl.className = 'BiliTube-rec-title';
    titleEl.textContent = item.title || '';
    var meta = document.createElement('div');
    meta.className = 'BiliTube-rec-meta';
    var stat = item.stat || {};
    var views = stat.view || stat.play || 0;
    var viewText = views ? views.toLocaleString() + ' 次观看' : '';
    meta.textContent = viewText;
    info.appendChild(titleEl);
    if (viewText) {
      info.appendChild(meta);
    }
    rec.appendChild(thumb);
    rec.appendChild(info);
    var nextId = item.bvid || (item.aid ? String(item.aid) : '');
    if (nextId) {
      rec.addEventListener('click', function (id) {
        return function () {
          window.location.hash = '#/video/' + encodeURIComponent(id);
        };
      }(nextId));
    }
    container.appendChild(rec);
  }
  BiliTubeRecommendState.index = end;
  if (end >= list.length) {
    BiliTubeRecommendState.finished = true;
  }
  BiliTubeRecommendState.loading = false;
}

function playerMaybeLoadMoreRecommendations() {
  if (!BiliTubeRecommendState || !BiliTubeRecommendState.container) {
    return;
  }
  if (BiliTubeRecommendState.finished) {
    return;
  }
  playerAppendNextRecommendationsPage();
}

function playerProxyUrl(u) {
  return '/proxy?u=' + encodeURIComponent(u);
}

function playerFetchJson(u) {
  return fetch(playerProxyUrl(u)).then(function (res) {
    if (!res.ok) {
      throw new Error('network');
    }
    return res.json();
  });
}

function playerNormalizeUrl(u) {
  if (!u) return '';
  var s = String(u);
  if (s.indexOf('/proxy?') === 0 || s.indexOf('/stream?') === 0) {
    var qIndex = s.indexOf('?');
    if (qIndex !== -1 && qIndex + 1 < s.length) {
      var params = s.slice(qIndex + 1).split('&');
      for (var i = 0; i < params.length; i++) {
        var kv = params[i].split('=');
        if (kv[0] === 'u' && kv[1]) {
          try {
            return decodeURIComponent(kv[1]);
          } catch (e) {
            return kv[1];
          }
        }
      }
    }
  }
  if (s.indexOf('//') === 0) {
    return 'https:' + s;
  }
  if (!/^https?:\/\//i.test(s)) {
    return 'https://' + s;
  }
  return s;
}

function playerNormalizeTextLinks(text) {
  if (!text) return '';
  var s = String(text);
  if (s.indexOf('/proxy?') === -1 && s.indexOf('/stream?') === -1) {
    return s;
  }
  return s.replace(/(?:\/proxy|\/stream)\?u=([^ \u4e00-\u9fa5]+)/g, function (
    match,
    encoded
  ) {
    if (!encoded) return match;
    try {
      var decoded = decodeURIComponent(encoded);
      if (!decoded) return match;
      return decoded;
    } catch (e) {
      return match;
    }
  });
}

function playerAttachSource(videoEl, url) {
  if (!videoEl || !url) return;
  var isHls = /\.m3u8(\?|$)/i.test(url);
  if (isHls && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    if (window.BiliTubeHls) {
      try {
        window.BiliTubeHls.destroy();
      } catch (e) {}
      window.BiliTubeHls = null;
    }
    var source = videoEl.querySelector('source');
    if (!source) {
      source = document.createElement('source');
      while (videoEl.firstChild) {
        videoEl.removeChild(videoEl.firstChild);
      }
      videoEl.appendChild(source);
    }
    source.src = url;
    source.type = 'application/vnd.apple.mpegurl';
    videoEl.removeAttribute('data-src-hd');
    videoEl.removeAttribute('data-src-sd');
    videoEl.preload = 'auto';
    try {
      videoEl.load();
    } catch (e) {}
  } else {
    if (window.BiliTubeHls) {
      try {
        window.BiliTubeHls.destroy();
      } catch (e) {}
      window.BiliTubeHls = null;
    }
    var source = videoEl.querySelector('source');
    if (!source) {
      source = document.createElement('source');
      while (videoEl.firstChild) {
        videoEl.removeChild(videoEl.firstChild);
      }
      videoEl.appendChild(source);
    }
    source.src = url;
    source.removeAttribute('type');
    videoEl.setAttribute('data-src-hd', url);
    videoEl.setAttribute('data-src-sd', url);
    videoEl.preload = 'auto';
    videoEl.setAttribute('webkit-playsinline', 'true');
    videoEl.setAttribute('playsinline', 'true');
    try {
      videoEl.load();
    } catch (e) {}
  }
}

var BiliTubePlayerState = {
  playbackRates: [0.5, 1, 1.5, 2]
};

function playerGetControlBar() {
  var videoEl = document.getElementById('BiliTube-video');
  if (!videoEl) return null;
  var section = videoEl.closest('.BiliTube-video-section');
  if (!section) return null;
  return section.querySelector('.BiliTube-player-control-bar');
}

function playerUpdatePlayButtonState() {
  var bar = playerGetControlBar();
  if (!bar) return;
  var videoEl = document.getElementById('BiliTube-video');
  if (!videoEl) return;
  var btn = bar.querySelector('[data-action="toggle-play"]');
  if (!btn) return;
  var isPlaying = !videoEl.paused && !videoEl.ended;
  var svg = btn.querySelector('svg');
  if (!svg) return;
  if (isPlaying) {
    svg.innerHTML = '<path d="M8 5h3v14H8zM13 5h3v14h-3z"></path>';
  } else {
    svg.innerHTML = '<path d="M8 5v14l11-7z"></path>';
  }
}

function playerUpdateSettingsState() {
  var bar = playerGetControlBar();
  if (!bar) return;
  var videoEl = document.getElementById('BiliTube-video');
  if (videoEl) {
    var q = videoEl.getAttribute('data-quality') || 'hd';
    var qualitySelect = bar.querySelector('.BiliTube-player-quality-select');
    if (qualitySelect) {
      qualitySelect.value = q === 'sd' ? 'sd' : 'hd';
    }
    var speedSelect = bar.querySelector('.BiliTube-player-speed-select');
    if (speedSelect) {
      var rate = videoEl.playbackRate || 1;
      speedSelect.value = String(rate);
    }
  }
  var danmakuItem = bar.querySelector('[data-type="danmaku"]');
  if (danmakuItem) {
    var enabled = true;
    if (typeof BiliTubeDanmakuState !== 'undefined' && BiliTubeDanmakuState) {
      enabled = !!BiliTubeDanmakuState.enabled;
    }
    danmakuItem.classList.toggle('active', enabled);
  }
  var danmakuToggle = document.getElementById('BiliTube-danmaku-toggle');
  if (danmakuToggle && typeof BiliTubeDanmakuState !== 'undefined' && BiliTubeDanmakuState) {
    danmakuToggle.classList.toggle('active', !!BiliTubeDanmakuState.enabled);
  }
}

function playerSetupControlBar() {
  var videoEl = document.getElementById('BiliTube-video');
  if (!videoEl) return;
  var section = videoEl.closest('.BiliTube-video-section');
  if (!section) return;
  var existing = section.querySelector('.BiliTube-player-control-bar');
  if (existing) {
    playerUpdatePlayButtonState();
    playerUpdateSettingsState();
    return;
  }
  var bar = document.createElement('div');
  bar.className = 'BiliTube-player-control-bar';
  var left = document.createElement('div');
  left.className = 'BiliTube-player-controls-left';
  var right = document.createElement('div');
  right.className = 'BiliTube-player-controls-right';

  function createBtn(text, title, action, extraClass) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'BiliTube-player-btn-icon';
    if (extraClass) {
      btn.className += ' ' + extraClass;
    }
    if (title) {
      btn.title = title;
    }
    if (action) {
      btn.setAttribute('data-action', action);
    }
    if (text) {
      btn.textContent = text;
    }
    return btn;
  }

  var btnBack20 = createBtn('<<<', '快退 20 秒', 'seek-back-20');
  var btnBack10 = createBtn('<<', '快退 10 秒', 'seek-back-10');
  var btnBack5 = createBtn('<', '快退 5 秒', 'seek-back-5');

  var playBtn = createBtn('', '播放/暂停', 'toggle-play', 'BiliTube-player-btn-play');
  playBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>';

  var btnForward5 = createBtn('>', '快进 5 秒', 'seek-forward-5');
  var btnForward10 = createBtn('>>', '快进 10 秒', 'seek-forward-10');
  var btnForward20 = createBtn('>>>', '快进 20 秒', 'seek-forward-20');

  left.appendChild(btnBack20);
  left.appendChild(btnBack10);
  left.appendChild(btnBack5);
  left.appendChild(playBtn);
  left.appendChild(btnForward5);
  left.appendChild(btnForward10);
  left.appendChild(btnForward20);

  var settingsBtn = createBtn('', '设置', 'toggle-settings');
  settingsBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M7 20c-1.1 0-2-.9-2-2s.9-2 2-2h10c1.1 0 2 .9 2 2s-.9 2-2 2H7zm-3-7c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2s-.9 2-2 2H6c-1.1 0-2-.9-2-2zm2-7c-1.1 0-2 .9-2 2s.9 2 2 2h4c1.1 0 2-.9 2-2S11.1 6 10 6H6z"></path></svg>';

  var menu = document.createElement('div');
  menu.className = 'BiliTube-player-settings-menu';

  var qualityItem = document.createElement('div');
  qualityItem.className = 'BiliTube-player-menu-item';
  qualityItem.setAttribute('data-type', 'quality');
  var qualityLabel = document.createElement('span');
  qualityLabel.textContent = '画质';
  var qualitySelect = document.createElement('select');
  qualitySelect.className = 'BiliTube-player-select BiliTube-player-quality-select';
  var optionHd = document.createElement('option');
  optionHd.value = 'hd';
  optionHd.textContent = '高清';
  var optionSd = document.createElement('option');
  optionSd.value = 'sd';
  optionSd.textContent = '标清';
  qualitySelect.appendChild(optionHd);
  qualitySelect.appendChild(optionSd);
  qualityItem.appendChild(qualityLabel);
  qualityItem.appendChild(qualitySelect);

  var speedItem = document.createElement('div');
  speedItem.className = 'BiliTube-player-menu-item';
  speedItem.setAttribute('data-type', 'speed');
  var speedLabel = document.createElement('span');
  speedLabel.textContent = '倍速';
  var speedSelect = document.createElement('select');
  speedSelect.className = 'BiliTube-player-select BiliTube-player-speed-select';
  var rates = BiliTubePlayerState.playbackRates || [0.5, 1, 1.5, 2];
  rates.forEach(function (r) {
    var opt = document.createElement('option');
    opt.value = String(r);
    opt.textContent = (r % 1 === 0 ? String(r) : r.toFixed(1)) + 'x';
    speedSelect.appendChild(opt);
  });
  speedItem.appendChild(speedLabel);
  speedItem.appendChild(speedSelect);

  var danmakuItem = document.createElement('div');
  danmakuItem.className = 'BiliTube-player-menu-item';
  danmakuItem.setAttribute('data-type', 'danmaku');
  var danmakuLabel = document.createElement('span');
  danmakuLabel.textContent = '弹幕';
  var toggle = document.createElement('div');
  toggle.className = 'BiliTube-player-toggle-switch';
  danmakuItem.appendChild(danmakuLabel);
  danmakuItem.appendChild(toggle);

  menu.appendChild(qualityItem);
  menu.appendChild(speedItem);
  menu.appendChild(danmakuItem);

  right.appendChild(settingsBtn);
  right.appendChild(menu);

  bar.appendChild(left);
  bar.appendChild(right);
  section.appendChild(bar);

  bar.addEventListener('click', function (e) {
    var target = e.target;
    var btn = target.closest('button');
    if (!btn || !bar.contains(btn)) return;
    var action = btn.getAttribute('data-action') || '';
    if (!action) return;
    var v = document.getElementById('BiliTube-video');
    if (!v) return;
    if (action === 'toggle-play') {
      if (v.paused || v.ended) {
        var p = v.play();
        if (p && typeof p.catch === 'function') {
          p.catch(function () {});
        }
      } else {
        v.pause();
      }
      playerUpdatePlayButtonState();
    } else if (action === 'seek-back-5') {
      if (!isNaN(v.currentTime)) {
        v.currentTime = Math.max(0, v.currentTime - 5);
      }
    } else if (action === 'seek-back-10') {
      if (!isNaN(v.currentTime)) {
        v.currentTime = Math.max(0, v.currentTime - 10);
      }
    } else if (action === 'seek-back-20') {
      if (!isNaN(v.currentTime)) {
        v.currentTime = Math.max(0, v.currentTime - 20);
      }
    } else if (action === 'seek-forward-5') {
      if (!isNaN(v.currentTime) && !isNaN(v.duration)) {
        v.currentTime = Math.min(v.duration, v.currentTime + 5);
      }
    } else if (action === 'seek-forward-10') {
      if (!isNaN(v.currentTime) && !isNaN(v.duration)) {
        v.currentTime = Math.min(v.duration, v.currentTime + 10);
      }
    } else if (action === 'seek-forward-20') {
      if (!isNaN(v.currentTime) && !isNaN(v.duration)) {
        v.currentTime = Math.min(v.duration, v.currentTime + 20);
      }
    } else if (action === 'toggle-settings') {
      right.classList.toggle('BiliTube-settings-open');
    }
  });

  menu.addEventListener('click', function (e) {
    var item = e.target.closest('.BiliTube-player-menu-item');
    if (!item || !menu.contains(item)) return;
    var type = item.getAttribute('data-type') || '';
    var v = document.getElementById('BiliTube-video');
    if (!v) return;
    if (type === 'danmaku') {
      var enabled = true;
      if (typeof BiliTubeDanmakuState !== 'undefined' && BiliTubeDanmakuState) {
        enabled = !BiliTubeDanmakuState.enabled;
      } else {
        enabled = !item.classList.contains('active');
      }
      if (typeof playerSetDanmakuEnabled === 'function') {
        playerSetDanmakuEnabled(enabled);
      }
      playerUpdateSettingsState();
    }
  });

  videoEl.addEventListener('play', function () {
    playerUpdatePlayButtonState();
  });
  videoEl.addEventListener('pause', function () {
    playerUpdatePlayButtonState();
  });
  videoEl.addEventListener('ended', function () {
    playerUpdatePlayButtonState();
  });
  videoEl.addEventListener('ratechange', function () {
    playerUpdateSettingsState();
  });

  var qualityToggle = document.getElementById('BiliTube-quality-toggle');
  if (qualityToggle) {
    qualityToggle.addEventListener('click', function () {
      playerUpdateSettingsState();
    });
  }
  var danmakuToggle = document.getElementById('BiliTube-danmaku-toggle');
  if (danmakuToggle) {
    danmakuToggle.addEventListener('click', function () {
      if (typeof BiliTubeDanmakuState !== 'undefined' && BiliTubeDanmakuState) {
        BiliTubeDanmakuState.enabled = danmakuToggle.classList.contains('active');
      }
      playerUpdateSettingsState();
    });
  }

  var qualitySelectEl = bar.querySelector('.BiliTube-player-quality-select');
  if (qualitySelectEl) {
    qualitySelectEl.addEventListener('change', function () {
      var video = document.getElementById('BiliTube-video');
      if (!video) return;
      var targetQuality = qualitySelectEl.value === 'sd' ? 'sd' : 'hd';
      var hdSrc = video.getAttribute('data-src-hd') || '';
      var sdSrc = video.getAttribute('data-src-sd') || hdSrc;
      var source = video.querySelector('source');
      if (!source || !hdSrc) return;
      var nextSrc = targetQuality === 'hd' ? hdSrc : sdSrc;
      if (!nextSrc) return;
      var wasPlaying = !video.paused && !video.ended;
      video.pause();
      source.src = nextSrc;
      video.setAttribute('data-quality', targetQuality);
      try {
        video.load();
      } catch (e) {}
      if (wasPlaying) {
        var playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function () {});
        }
      }
      var qt = document.getElementById('BiliTube-quality-toggle');
      if (qt) {
        var label = qt.querySelector('.BiliTube-control-label');
        if (label) {
          label.textContent = targetQuality === 'hd' ? '高清' : '标清';
        }
      }
      playerUpdateSettingsState();
    });
  }

  var speedSelectEl = bar.querySelector('.BiliTube-player-speed-select');
  if (speedSelectEl) {
    speedSelectEl.addEventListener('change', function () {
      var video = document.getElementById('BiliTube-video');
      if (!video) return;
      var value = parseFloat(speedSelectEl.value);
      if (!value || value <= 0) {
        value = 1;
      }
      video.playbackRate = value;
      playerUpdateSettingsState();
    });
  }

  playerUpdatePlayButtonState();
  playerUpdateSettingsState();
}

var BiliTubeVideoProgress = {
  saveDelay: 5000,
  lastSaveTime: 0,
  saveTimer: null,
  currentVideoId: '',

  save: function(videoId, currentTime, duration) {
    if (!videoId || typeof currentTime !== 'number' || currentTime < 0.5) return;
    var key = 'BiliTube-video-progress-' + videoId;
    var progressData = {
      currentTime: currentTime,
      duration: duration || 0,
      ts: Date.now()
    };
    if (typeof storageSetItem === 'function') {
      storageSetItem(key, progressData);
    }
  },

  get: function(videoId) {
    if (!videoId) return null;
    var key = 'BiliTube-video-progress-' + videoId;
    if (typeof storageGetItem === 'function') {
      var data = storageGetItem(key);
      if (!data) return null;
      var obj = data;
      if (typeof data === 'string') {
        try {
          obj = JSON.parse(data);
        } catch (e) {
          obj = null;
        }
      }
      if (obj && typeof obj === 'object') {
        var age = Date.now() - (obj.ts || 0);
        if (age < 7 * 24 * 60 * 60 * 1000) {
          return obj;
        }
      }
    }
    return null;
  },

  clear: function(videoId) {
    if (!videoId) return;
    var key = 'BiliTube-video-progress-' + videoId;
    if (typeof storageRemoveItem === 'function') {
      storageRemoveItem(key);
    }
  },

  bind: function(videoEl, videoId) {
    var self = this;
    if (!videoEl || !videoId) return;
    this.currentVideoId = videoId;
    this.lastSaveTime = 0;
    if (videoEl._BiliTubeProgressHandlers) {
      var handlers = videoEl._BiliTubeProgressHandlers;
      if (handlers.timeupdate) {
        videoEl.removeEventListener('timeupdate', handlers.timeupdate);
      }
      if (handlers.seeking) {
        videoEl.removeEventListener('seeking', handlers.seeking);
      }
      if (handlers.pause) {
        videoEl.removeEventListener('pause', handlers.pause);
      }
      if (handlers.ended) {
        videoEl.removeEventListener('ended', handlers.ended);
      }
    }
    var progress = this.get(videoId);
    if (progress && progress.currentTime > 0.5) {
      var applyProgress = function() {
        videoEl.currentTime = progress.currentTime;
      };
      if (videoEl.readyState >= 1) {
        applyProgress();
      } else {
        var onLoadedMetadata = function() {
          applyProgress();
          videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
        };
        videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
      }
    }
    var saveProgress = function() {
      var ct = videoEl.currentTime;
      var dur = videoEl.duration;
      if (ct && dur) {
        self.save(videoId, ct, dur);
      }
    };
    var onTimeUpdate = function() {
      var now = Date.now();
      if (now - self.lastSaveTime > self.saveDelay) {
        saveProgress();
        self.lastSaveTime = now;
      }
    };
    var onSeeking = saveProgress;
    var onPause = saveProgress;
    var onEnded = function() {
      self.clear(videoId);
    };
    videoEl.addEventListener('timeupdate', onTimeUpdate);
    videoEl.addEventListener('seeking', onSeeking);
    videoEl.addEventListener('pause', onPause);
    videoEl.addEventListener('ended', onEnded);
    videoEl._BiliTubeProgressHandlers = {
      timeupdate: onTimeUpdate,
      seeking: onSeeking,
      pause: onPause,
      ended: onEnded
    };
  },

  unbind: function() {
    this.currentVideoId = '';
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
};

var BiliTubeSeekPreload = {
  timer: null,
  lastTime: 0,
  bufferMap: {},
  currentUrl: '',
  bind: function(videoEl) {
    var self = this;
    if (!videoEl) return;
    videoEl.addEventListener('seeking', function() {
      var ct = videoEl.currentTime;
      var diff = Math.abs(ct - self.lastTime);
      if (diff > 5 && self.currentUrl) {
        self.preloadAround(videoEl, ct);
      }
      self.lastTime = ct;
    });
    videoEl.addEventListener('seeked', function() {
      if (self.timer) {
        clearTimeout(self.timer);
        self.timer = null;
      }
    });
    videoEl.addEventListener('waiting', function() {
      var ct = videoEl.currentTime;
      self.preloadAround(videoEl, ct);
    });
    videoEl.addEventListener('play', function() {
      var ct = videoEl.currentTime;
      self.preloadAround(videoEl, ct);
    });
  },
  preloadAround: function(videoEl, time) {
    var self = this;
    if (!videoEl.src || !videoEl.src.indexOf) return;
    if (videoEl.src.indexOf('/stream?u=') === -1) return;
    var start = Math.max(0, time - 10);
    var end = Math.min(videoEl.duration || 0, time + 30);
    if (end <= start) return;
    var url = videoEl.src + '&range=' + Math.floor(start) + '-' + Math.floor(end);
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(function() {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.setRequestHeader('Range', 'bytes=' + Math.floor(start) + '-' + Math.floor(end));
      xhr.responseType = 'arraybuffer';
      xhr.send();
    }, 500);
  }
};

function playerDetectQn() {
  var ua = navigator.userAgent || '';
  var match = ua.match(/Chrome\/(\d+)/);
  var version = match && match[1] ? parseInt(match[1], 10) : 0;
  if (version && version <= 80) {
    return 32;
  }
  return 64;
}

function playerLoadPlayUrl(videoEl, bvid, aid, cid) {
  if (!videoEl || !cid) return Promise.reject(new Error('no_cid'));
  BiliTubeVideoChecker.markRetry(bvid, aid, cid);
  var qs = '';
  if (bvid) {
    qs = 'bvid=' + encodeURIComponent(bvid);
  } else if (aid) {
    qs = 'aid=' + encodeURIComponent(String(aid));
  } else {
    qs = 'cid=' + encodeURIComponent(String(cid));
  }
  var api =
    'https://api.bilibili.com/x/player/playurl?type=mp4&platform=html5&qn=' +
    String(playerDetectQn()) +
    '&high_quality=1&' +
    qs +
    '&cid=' +
    encodeURIComponent(String(cid));
  return playerFetchJson(api)
    .then(function (res) {
      if (!res || typeof res.code !== 'number' || res.code !== 0 || !res.data) {
        throw new Error('playurl_api');
      }
      var data = res.data;
      var durl = data.durl;
      if (!durl || !durl.length || !durl[0] || !durl[0].url) {
        throw new Error('no_durl');
      }
      var rawUrl = playerNormalizeUrl(durl[0].url);
      if (!rawUrl) {
        throw new Error('no_durl');
      }
      var streamUrl = '/stream?u=' + encodeURIComponent(rawUrl);
      playerAttachSource(videoEl, streamUrl);
      var banner = document.getElementById('BiliTube-video-error');
      if (banner) {
        banner.textContent = '';
        banner.style.display = 'none';
      }
      BiliTubeVideoChecker.currentRetry = 0;
      return streamUrl;
    })
    .catch(function (err) {
      var banner = document.getElementById('BiliTube-video-error');
      if (banner) {
        var msg = '视频播放地址加载失败，请稍后重试。';
        if (err && err.message === 'playurl_api') {
          msg = '视频播放接口返回异常，请稍后重试。';
        }
        if (BiliTubeVideoChecker.canRetry()) {
          banner.innerHTML = msg + ' <button type="button" class="BiliTube-retry-btn" onclick="playerRetryLoad()">重新加载</button>';
        } else {
          banner.innerHTML = msg + '<br><button type="button" class="BiliTube-retry-btn" onclick="playerRetryLoad()">重新加载</button>';
        }
        banner.style.display = 'block';
      }
      throw err;
    });
}

function playerHandleStall(videoEl) {
  if (!videoEl) return;
  var banner = document.getElementById('BiliTube-video-error');
  var videoContainer = videoEl.closest('.BiliTube-video-container');
  if (videoContainer && videoContainer.classList.contains('BiliTube-video-retrying')) {
    return;
  }
  if (!BiliTubeVideoChecker.canRetry()) {
    if (banner) {
      banner.innerHTML = '视频加载缓慢，请检查网络连接。<button type="button" class="BiliTube-retry-btn" onclick="playerRetryLoad()">重新加载</button>';
      banner.style.display = 'block';
    }
    return;
  }
  if (banner) {
    banner.innerHTML = '视频加载中，请稍候...';
    banner.style.display = 'block';
  }
  if (videoContainer) {
    videoContainer.classList.add('BiliTube-video-retrying');
  }
  var delay = BiliTubeVideoChecker.getNextDelay();
  if (BiliTubeVideoChecker.timer) {
    clearTimeout(BiliTubeVideoChecker.timer);
  }
  BiliTubeVideoChecker.timer = setTimeout(function() {
    if (videoContainer) {
      videoContainer.classList.remove('BiliTube-video-retrying');
    }
    BiliTubeVideoChecker.clearVideoSource(videoEl);
    if (BiliTubeVideoChecker.lastBvid || BiliTubeVideoChecker.lastAid) {
      playerLoadPlayUrl(videoEl, BiliTubeVideoChecker.lastBvid, BiliTubeVideoChecker.lastAid, BiliTubeVideoChecker.lastCid).catch(function() {});
    }
    if (banner) {
      banner.style.display = 'none';
    }
  }, delay);
}

function playerRetryLoad() {
  var videoEl = document.getElementById('BiliTube-video');
  var banner = document.getElementById('BiliTube-video-error');
  if (!videoEl) return;
  BiliTubeVideoChecker.reset();
  BiliTubeVideoChecker.markRetry(BiliTubeVideoChecker.lastBvid, BiliTubeVideoChecker.lastAid, BiliTubeVideoChecker.lastCid);
  BiliTubeVideoChecker.clearVideoSource(videoEl);
  if (banner) {
    banner.innerHTML = '正在重新加载...';
    banner.style.display = 'block';
  }
  if (BiliTubeVideoChecker.lastBvid || BiliTubeVideoChecker.lastAid) {
    playerLoadPlayUrl(videoEl, BiliTubeVideoChecker.lastBvid, BiliTubeVideoChecker.lastAid, BiliTubeVideoChecker.lastCid).then(function() {
      if (banner) {
        banner.style.display = 'none';
      }
    }).catch(function() {
      if (banner) {
        banner.innerHTML = '视频加载失败，请稍后重试。<button type="button" class="BiliTube-retry-btn" onclick="playerRetryLoad()">重新加载</button>';
        banner.style.display = 'block';
      }
    });
  }
}

function BiliTubeResetCommentState(aid) {
  BiliTubeCommentState.aid = aid;
  BiliTubeCommentState.next = 1;
  BiliTubeCommentState.loading = false;
  BiliTubeCommentState.finished = false;
}

function BiliTubeLoadVideoById(id) {
  var raw = (id || '').trim();
  if (!raw) return;
  var isBvid = /^BV/i.test(raw);
  var key = isBvid ? 'bvid' : 'aid';
  var videoEl = document.getElementById('BiliTube-video');
  if (videoEl) {
    try {
      videoEl.pause();
    } catch (e) {}
    videoEl.removeAttribute('src');
    videoEl.load();
    videoEl.currentTime = 0;
    videoEl.removeAttribute('poster');
    videoEl.removeAttribute('data-quality');
  }
  playerSetupControlBar();
  playerCancelAutoPlayTimer();
  var titleElReset = document.getElementById('BiliTube-video-title');
  if (titleElReset) {
    titleElReset.textContent = '';
  }
  var descElReset = document.getElementById('BiliTube-video-desc');
  if (descElReset) {
    descElReset.textContent = '';
    descElReset.style.display = 'none';
  }
  var metaElReset = document.getElementById('BiliTube-video-meta');
  if (metaElReset) {
    metaElReset.textContent = '';
    metaElReset.style.display = 'none';
  }
  var commentsReset = document.getElementById('BiliTube-comments-content');
  if (commentsReset) {
    commentsReset.innerHTML = '';
  }
  var recReset = document.getElementById('BiliTube-recommendations');
  if (recReset) {
    recReset.innerHTML = '';
  }
  var episodesReset = document.getElementById('BiliTube-episodes');
  if (episodesReset) {
    episodesReset.innerHTML = '';
    episodesReset.style.display = 'none';
  }
  var api =
    'https://api.bilibili.com/x/web-interface/view?' +
    key +
    '=' +
    encodeURIComponent(raw);
  var errorBanner = document.getElementById('BiliTube-video-error');
  if (errorBanner) {
    errorBanner.textContent = '';
    errorBanner.style.display = 'none';
  }
  playerFetchJson(api)
    .then(function (res) {
      if (!res || typeof res.code !== 'number' || res.code !== 0 || !res.data) {
        throw new Error('view_api');
      }
      var data = res.data;
      var cid = data.cid;
      var pages = data.pages || [];
      var rawTitle = data.title || '';
      var rawDesc = data.desc || '';
      var title = playerNormalizeTextLinks(rawTitle);
      var desc = playerNormalizeTextLinks(rawDesc);
      var owner = data.owner || {};
      var poster = data.pic || '';
      var authorName = owner.name || '';
      var avatar = owner.face || '';
      var bio = data.dynamic || '';
      var titleEl = document.getElementById('BiliTube-video-title');
      if (titleEl) {
        titleEl.textContent = title;
      }
      var descEl = document.getElementById('BiliTube-video-desc');
      if (descEl) {
        var descText = (desc || '').trim();
        var shouldHide =
          !descText ||
          descText === '-' ||
          descText === '—' ||
          descText === '－';
        if (shouldHide) {
          descEl.style.display = 'none';
        } else {
          descEl.textContent = descText;
          descEl.style.display = 'block';
        }
      }
      var nameEl = document.getElementById('BiliTube-author-name');
      if (nameEl) {
        nameEl.textContent = authorName || '';
      }
      var bioEl = document.getElementById('BiliTube-author-bio');
      if (bioEl) {
        bioEl.textContent = bio || '';
      }
      var avatarEl = document.getElementById('BiliTube-author-avatar');
      if (avatarEl && typeof playerSetAvatarBackground === 'function') {
        playerSetAvatarBackground(avatarEl, avatar);
      }
      var videoEl = document.getElementById('BiliTube-video');
      if (videoEl) {
        var displayPoster = poster;
        if (displayPoster && typeof homeParseCoverUrl === 'function') {
          displayPoster = homeParseCoverUrl(displayPoster);
        }
        if (displayPoster) {
          videoEl.setAttribute('poster', displayPoster);
        }
      }
      if (!cid && pages && pages.length) {
        cid = pages[0].cid;
      }
      if (!cid || !videoEl) {
        throw new Error('no_cid');
      }
      var bvid = data.bvid || (isBvid ? raw : '');
      var aid = data.aid || (!isBvid ? Number(raw) || 0 : 0);
      var stat = data.stat || {};
      var viewsNum = stat.view || stat.play || 0;
      var durationSeconds = data.duration || 0;
      var pub = data.pubdate || data.ctime || 0;
      var dateText = '';
      if (pub && typeof homeFormatPubDate === 'function') {
        dateText = homeFormatPubDate(pub);
      }
      var metaEl = document.getElementById('BiliTube-video-meta');
      if (metaEl) {
        var viewsText = '';
        if (viewsNum) {
          viewsText = viewsNum.toLocaleString() + ' 次观看';
        }
        var metaParts = [];
        if (viewsText) metaParts.push(viewsText);
        if (dateText) metaParts.push(dateText);
        if (metaParts.length) {
          metaEl.textContent = metaParts.join(' · ');
          metaEl.style.display = 'block';
        } else {
          metaEl.textContent = '';
          metaEl.style.display = 'none';
        }
      }
      var historyId = bvid || (aid ? String(aid) : '');
      if (historyId) {
        var entry = {
          id: historyId,
          title: title,
          cover: poster,
          channel: authorName,
          avatar: avatar,
          time: dateText,
          views: viewsNum,
          duration: durationSeconds,
          ts: Date.now()
        };
        if (typeof BiliTubeRecordWatchHistory === 'function') {
          BiliTubeRecordWatchHistory(entry);
        }
        if (typeof BiliTubeSetupFavoriteButton === 'function') {
          BiliTubeSetupFavoriteButton(entry);
        }
        if (typeof BiliTubeSetupLoveButton === 'function') {
          BiliTubeSetupLoveButton(historyId);
        }
        if (typeof BiliTubeSetupCoinButton === 'function') {
          BiliTubeSetupCoinButton(historyId);
        }
        if (typeof BiliTubeSetupShareButton === 'function') {
          BiliTubeSetupShareButton(historyId);
        }
        var shareBtn = document.querySelector('.BiliTube-action-btn[data-action="share"]');
        if (shareBtn) {
          shareBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (typeof BiliTubeShowShareModal === 'function') {
              BiliTubeShowShareModal(historyId);
            }
          });
        }
      }
      playerRenderEpisodes(pages, cid, bvid, aid, videoEl);
      BiliTubeSeekPreload.bind(videoEl);
      BiliTubeVideoProgress.bind(videoEl, bvid || (aid ? String(aid) : '') || raw);
      Promise.all([
        playerLoadPlayUrl(videoEl, bvid, aid, cid).then(function(url) {
          if (url) {
            BiliTubeSeekPreload.currentUrl = url;
          }
        }).catch(function() {}),
        playerLoadDanmaku(cid),
        playerLoadComments(aid),
        playerLoadRecommendations(bvid || '', aid)
      ]).then(function() {}).catch(function() {});
    })
    .catch(function (err) {
      var banner = document.getElementById('BiliTube-video-error');
      if (banner) {
        var msg = '视频信息加载失败，请稍后重试。';
        if (err && err.message === 'view_api') {
          msg = '视频信息接口返回异常，请稍后重试。';
        }
        banner.textContent = msg;
        banner.style.display = 'block';
      }
    });
}

function playerRenderEpisodes(pages, currentCid, bvid, aid, videoEl) {
  var container = document.getElementById('BiliTube-episodes');
  if (!container) return;
  container.innerHTML = '';
  if (!pages || !pages.length || pages.length === 1) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  var title = document.createElement('div');
  title.className = 'BiliTube-section-title';
  title.textContent = '选集';
  var list = document.createElement('div');
  list.className = 'BiliTube-episode-list';
  pages.forEach(function (item, index) {
    var cid = item.cid;
    var label = item.part || '';
    var pageNum = item.page || index + 1;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'BiliTube-episode-chip';
    if (String(cid) === String(currentCid)) {
      btn.className += ' BiliTube-episode-chip-active';
    }
    btn.textContent = 'P' + pageNum + ' ' + label;
    btn.setAttribute('data-cid', String(cid));
    btn.setAttribute('data-page', String(pageNum));
    btn.addEventListener('click', function () {
      var targetCid = Number(btn.getAttribute('data-cid'));
      var siblings = list.querySelectorAll('.BiliTube-episode-chip');
      siblings.forEach(function (el) {
        el.classList.remove('BiliTube-episode-chip-active');
      });
      btn.classList.add('BiliTube-episode-chip-active');
      playerLoadPlayUrl(videoEl, bvid, aid, targetCid).catch(function () {});
      playerLoadDanmaku(targetCid);
    });
    list.appendChild(btn);
  });
  container.appendChild(title);
  container.appendChild(list);
}

function playerSetDanmakuEnabled(enabled) {
  BiliTubeDanmakuState.enabled = !!enabled;
  var layer = document.getElementById('BiliTube-danmaku-layer');
  if (!layer) return;
  layer.style.display = enabled ? 'block' : 'none';
}

function playerEnsureDanmakuLoop() {
  if (BiliTubeDanmakuState.timer) {
    return;
  }
  var videoEl = document.getElementById('BiliTube-video');
  var layer = document.getElementById('BiliTube-danmaku-layer');
  if (!videoEl || !layer) {
    return;
  }
  BiliTubeDanmakuState.timer = setInterval(function () {
    if (!BiliTubeDanmakuState.enabled) return;
    if (!BiliTubeDanmakuState.list || !BiliTubeDanmakuState.list.length) return;
    if (BiliTubeDanmakuState.index >= BiliTubeDanmakuState.list.length) return;
    if (!videoEl.duration || isNaN(videoEl.currentTime)) return;
    var currentTime = videoEl.currentTime;
    var height = layer.clientHeight || videoEl.clientHeight || 0;
    var lineHeight = BiliTubeDanmakuState.lineHeight;
    var rows = height > 0 ? Math.max(6, Math.floor((height - 40) / lineHeight)) : 6;
    if (!BiliTubeDanmakuState.laneNextAvailable || BiliTubeDanmakuState.laneNextAvailable.length !== rows) {
      BiliTubeDanmakuState.laneNextAvailable = [];
      for (var r = 0; r < rows; r++) {
        BiliTubeDanmakuState.laneNextAvailable[r] = 0;
      }
    }
    while (BiliTubeDanmakuState.index < BiliTubeDanmakuState.list.length) {
      var item = BiliTubeDanmakuState.list[BiliTubeDanmakuState.index];
      if (item.time > currentTime) {
        break;
      }
      var bestLane = 0;
      var earliest = BiliTubeDanmakuState.laneNextAvailable[0];
      for (var i = 1; i < rows; i++) {
        if (BiliTubeDanmakuState.laneNextAvailable[i] < earliest) {
          earliest = BiliTubeDanmakuState.laneNextAvailable[i];
          bestLane = i;
        }
      }
      if (earliest > currentTime) {
        bestLane = BiliTubeDanmakuState.laneIndex % rows;
      }
      BiliTubeDanmakuState.laneIndex = bestLane;
      var top = Math.round(10 + lineHeight * BiliTubeDanmakuState.laneIndex);
      var el = document.createElement('div');
      el.className = 'BiliTube-danmaku-item';
      el.textContent = item.text;
      el.style.top = top + 'px';
      layer.appendChild(el);
      setTimeout(function () {
        if (el.parentNode === layer) {
          layer.removeChild(el);
        }
      }, 8000);
      BiliTubeDanmakuState.laneNextAvailable[bestLane] = currentTime + 8;
      BiliTubeDanmakuState.index += 1;
    }
  }, 100);
}

function playerLoadDanmaku(cid) {
  var layer = document.getElementById('BiliTube-danmaku-layer');
  if (layer) {
    layer.innerHTML = '';
  }
  BiliTubeDanmakuState.list = [];
  BiliTubeDanmakuState.index = 0;
  BiliTubeDanmakuState.laneIndex = 0;
  BiliTubeDanmakuState.laneNextAvailable = [];
  if (!cid) {
    return;
  }
  var url = 'https://comment.bilibili.com/' + String(cid) + '.xml';
  fetch(playerProxyUrl(url))
    .then(function (res) {
      if (!res.ok) {
        throw new Error('network');
      }
      return res.text();
    })
    .then(function (text) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(text, 'text/xml');
      var ds = doc.getElementsByTagName('d');
      var list = [];
      for (var i = 0; i < ds.length; i++) {
        var node = ds[i];
        var p = node.getAttribute('p') || '';
        var parts = p.split(',');
        var time = parseFloat(parts[0] || '0');
        if (!isFinite(time)) {
          continue;
        }
        var msg = node.textContent || '';
        if (!msg) continue;
        list.push({ time: time, text: msg });
      }
      list.sort(function (a, b) {
        return a.time - b.time;
      });
      BiliTubeDanmakuState.list = list;
      BiliTubeDanmakuState.index = 0;
      playerEnsureDanmakuLoop();
    })
    .catch(function () {});
}

function playerSetAvatarBackground(el, url) {
  if (!el) {
    return;
  }
  el.textContent = '';
  if (url) {
    var finalUrl = url;
    if (typeof homeParseCoverUrl === 'function') {
      finalUrl = homeParseCoverUrl(finalUrl);
    }
    el.style.backgroundImage = "url('" + finalUrl + "')";
  } else {
    var placeholder =
      typeof AVATAR_PLACEHOLDER === 'string' ? AVATAR_PLACEHOLDER : '';
    if (placeholder) {
      el.style.backgroundImage = "url('" + placeholder + "')";
    } else {
      el.style.backgroundImage = '';
    }
  }
}

function playerSetThumbBackground(el, url) {
  if (!el) {
    return;
  }
  var placeholder =
    typeof THUMBNAIL_PLACEHOLDER === 'string'
      ? THUMBNAIL_PLACEHOLDER
      : '';
  if (placeholder) {
    el.style.backgroundImage = "url('" + placeholder + "')";
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
  } else {
    el.style.backgroundImage = '';
  }
  if (!url) {
    return;
  }
  var finalUrl = url;
  if (typeof homeParseCoverUrl === 'function') {
    finalUrl = homeParseCoverUrl(finalUrl);
  }
  var img = new Image();
  img.onload = function () {
    el.style.backgroundImage = "url('" + finalUrl + "')";
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
  };
  img.onerror = function () {};
  img.src = finalUrl;
}

function playerAppendSubReply(box, sub) {
  if (!box || !sub) {
    return;
  }
  var subItem = document.createElement('div');
  subItem.className = 'BiliTube-comment-item BiliTube-comment-reply';
  var subAvatar = document.createElement('div');
  subAvatar.className = 'BiliTube-avatar BiliTube-avatar-xsmall';
  var subName = (sub.member && sub.member.uname) || '';
  var subFace =
    (sub.member && (sub.member.avatar || sub.member.face)) || '';
  if (typeof playerSetAvatarBackground === 'function') {
    playerSetAvatarBackground(subAvatar, subFace);
  }
  var subContent = document.createElement('div');
  subContent.className = 'BiliTube-comment-content';
  var subUser = document.createElement('div');
  subUser.className = 'BiliTube-comment-user';
  subUser.textContent = subName || '用户';
  var subText = document.createElement('div');
  subText.className = 'BiliTube-comment-text';
  var rawSubMessage =
    (sub.content && sub.content.message) || '';
  subText.textContent = playerNormalizeTextLinks(rawSubMessage);
  subContent.appendChild(subUser);
  subContent.appendChild(subText);
  subItem.appendChild(subAvatar);
  subItem.appendChild(subContent);
  box.appendChild(subItem);
}

function playerLoadComments(aid) {
  var container = document.getElementById('BiliTube-comments-content');
  if (!container || !aid) {
    return;
  }
  if (BiliTubeCommentState.aid !== aid) {
    BiliTubeResetCommentState(aid);
  } else {
    BiliTubeCommentState.next = 1;
    BiliTubeCommentState.finished = false;
  }
  container.innerHTML = '';
  playerLoadMoreComments(true);
}

function playerLoadMoreComments(isFirstPage) {
  var container = document.getElementById('BiliTube-comments-content');
  if (!container) {
    return;
  }
  var aid = BiliTubeCommentState.aid;
  if (!aid || BiliTubeCommentState.loading || BiliTubeCommentState.finished) {
    return;
  }
  BiliTubeCommentState.loading = true;
  var page = BiliTubeCommentState.next || 1;
  var apiMain =
    'https://api.bilibili.com/x/v2/reply/main?oid=' +
    encodeURIComponent(String(aid)) +
    '&type=1&mode=3&next=' +
    encodeURIComponent(String(page));
  var apiLegacy =
    'https://api.bilibili.com/x/v2/reply?jsonp=jsonp&pn=' +
    encodeURIComponent(String(page)) +
    '&ps=50&type=1&sort=2&oid=' +
    encodeURIComponent(String(aid));
  var handleResult = function (res, usingMain) {
    if (!res || typeof res.code !== 'number' || res.code !== 0 || !res.data) {
      throw new Error('reply_api');
    }
    var replies = res.data.replies || [];
    if (!replies.length) {
      if (isFirstPage && !container.children.length) {
        var empty = document.createElement('div');
        empty.className = 'BiliTube-comment-text';
        empty.textContent = '暂无评论';
        container.appendChild(empty);
      }
      BiliTubeCommentState.finished = true;
      BiliTubeCommentState.loading = false;
      return;
    }
    replies.forEach(function (reply) {
      var item = document.createElement('div');
      item.className = 'BiliTube-comment-item';
      var avatar = document.createElement('div');
      avatar.className = 'BiliTube-avatar BiliTube-avatar-small';
      var uname = (reply.member && reply.member.uname) || '';
      var face =
        (reply.member && (reply.member.avatar || reply.member.face)) || '';
      if (typeof playerSetAvatarBackground === 'function') {
        playerSetAvatarBackground(avatar, face);
      }
      var content = document.createElement('div');
      content.className = 'BiliTube-comment-content';
      var userEl = document.createElement('div');
      userEl.className = 'BiliTube-comment-user';
      userEl.textContent = uname || '用户';
      var textEl = document.createElement('div');
      textEl.className = 'BiliTube-comment-text';
      var rawMessage =
        (reply.content && reply.content.message) || '';
      textEl.textContent = playerNormalizeTextLinks(rawMessage);
      var meta = document.createElement('div');
      meta.className = 'BiliTube-rec-meta';
      var likes = reply.like || 0;
      var ts = reply.ctime ? new Date(reply.ctime * 1000) : null;
      var timeText = ts ? ts.toLocaleDateString() : '';
      meta.textContent =
        (likes ? likes + ' 赞' : '') +
        (likes && timeText ? ' · ' : '') +
        (timeText || '');
      content.appendChild(userEl);
      content.appendChild(textEl);
      if (meta.textContent) {
        content.appendChild(meta);
      }
      var hasReplies =
        (reply.replies && reply.replies.length) || reply.rcount;
      var box = document.createElement('div');
      box.className = 'BiliTube-reply-box';
      if (reply.replies && reply.replies.length) {
        reply.replies.slice(0, 2).forEach(function (sub) {
          playerAppendSubReply(box, sub);
        });
      }
      if (reply.rcount && reply.rcount > (reply.replies ? reply.replies.length : 0)) {
        var more = document.createElement('div');
        more.className = 'BiliTube-reply-more';
        more.textContent = '查看全部 ' + reply.rcount + ' 条回复';
        more.setAttribute('data-expanded', 'false');
        more._BiliTubeLabel = more.textContent;
        more.addEventListener('click', function () {
          playerShowMoreReplies(aid, reply.rpid, box, more);
        });
        box.appendChild(more);
      }
      if (hasReplies) {
        box.classList.add('active');
      }
      content.appendChild(box);
      item.appendChild(avatar);
      item.appendChild(content);
      container.appendChild(item);
    });
    if (usingMain && res.data && res.data.cursor) {
      var cursor = res.data.cursor || {};
      if (typeof cursor.next === 'number' && cursor.next > 0) {
        BiliTubeCommentState.next = cursor.next;
      } else {
        BiliTubeCommentState.finished = true;
      }
      if (cursor.is_end) {
        BiliTubeCommentState.finished = true;
      }
    } else {
      var nextPage = BiliTubeCommentState.next || 1;
      BiliTubeCommentState.next = nextPage + 1;
      if (replies.length < 50) {
        BiliTubeCommentState.finished = true;
      }
    }
    BiliTubeCommentState.loading = false;
  };
  var handleError = function () {
    BiliTubeCommentState.loading = false;
    BiliTubeCommentState.finished = true;
    if (isFirstPage && !container.children.length) {
      var error = document.createElement('div');
      error.className = 'BiliTube-comment-text';
      error.textContent = '评论加载失败，请稍后重试。';
      container.appendChild(error);
    }
  };
  playerFetchJson(apiMain)
    .then(function (res) {
      if (!res || typeof res.code !== 'number' || res.code !== 0 || !res.data) {
        return playerFetchJson(apiLegacy).then(function (legacyRes) {
          return { res: legacyRes, usingMain: false };
        });
      }
      return { res: res, usingMain: true };
    })
    .then(function (wrapped) {
      if (!wrapped || !wrapped.res) {
        throw new Error('reply_api');
      }
      handleResult(wrapped.res, wrapped.usingMain);
    })
    .catch(handleError);
}

function playerLoadRecommendations(bvid, aid) {
  var container = document.getElementById('BiliTube-recommendations');
  if (!container || (!bvid && !aid)) {
    return;
  }
  BiliTubeRecommendState.list = [];
  BiliTubeRecommendState.index = 0;
  BiliTubeRecommendState.pageSize = 10;
  BiliTubeRecommendState.container = container;
  BiliTubeRecommendState.finished = false;
  BiliTubeRecommendState.loading = false;
  container.innerHTML = '';
  var header = document.createElement('div');
  header.className = 'BiliTube-rec-header';
  var title = document.createElement('div');
  title.className = 'BiliTube-section-title';
  title.textContent = '相关推荐';
  header.appendChild(title);
  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'BiliTube-auto-play-toggle';
  toggle.setAttribute('aria-label', '自动连播开关');
  toggle.setAttribute(
    'aria-pressed',
    BiliTubeAutoPlayState.enabled ? 'true' : 'false'
  );
  var label = document.createElement('span');
  label.className = 'BiliTube-auto-play-text';
  label.textContent = '自动连播';
  var switchEl = document.createElement('span');
  switchEl.className = 'BiliTube-auto-play-switch';
  var knob = document.createElement('span');
  knob.className = 'BiliTube-auto-play-switch-knob';
  switchEl.appendChild(knob);
  toggle.appendChild(label);
  toggle.appendChild(switchEl);
  toggle.addEventListener('click', function () {
    playerSetAutoPlayEnabled(!BiliTubeAutoPlayState.enabled);
  });
  header.appendChild(toggle);
  container.appendChild(header);
  playerUpdateAutoPlayToggle();
  var apiBase = 'https://api.bilibili.com/x/web-interface/archive/related?';
  var qs = bvid
    ? 'bvid=' + encodeURIComponent(bvid)
    : 'aid=' + encodeURIComponent(String(aid));
  var api = apiBase + qs;
  playerFetchJson(api)
    .then(function (res) {
      if (!res || typeof res.code !== 'number' || res.code !== 0 || !res.data) {
        throw new Error('related_api');
      }
      var list = res.data || [];
      BiliTubeAutoPlayState.nextId = '';
      if (!list || !list.length) {
        return;
      }
      var first = list[0] || {};
      var firstId = first.bvid || (first.aid ? String(first.aid) : '');
      if (firstId) {
        BiliTubeAutoPlayState.nextId = firstId;
      }
      BiliTubeRecommendState.list = list;
      BiliTubeRecommendState.index = 0;
      BiliTubeRecommendState.finished = false;
      BiliTubeRecommendState.container = container;
      playerAppendNextRecommendationsPage();
    })
    .catch(function () {
      BiliTubeAutoPlayState.nextId = '';
      BiliTubeRecommendState.list = [];
      BiliTubeRecommendState.finished = true;
    });
}

function playerShowMoreReplies(aid, rpid, box, controlEl) {
  if (!aid || !rpid || !box) {
    return;
  }
  if (controlEl && controlEl.getAttribute('data-expanded') === 'true') {
    var prevReplies = controlEl._BiliTubeAllReplies || [];
    box.innerHTML = '';
    if (prevReplies && prevReplies.length) {
      prevReplies.slice(0, 2).forEach(function (sub) {
        playerAppendSubReply(box, sub);
      });
    }
    var label = controlEl._BiliTubeLabel || controlEl.textContent || '';
    if (label) {
      controlEl.textContent = label;
    }
    controlEl.setAttribute('data-expanded', 'false');
    return;
  }
  var api =
    'https://api.bilibili.com/x/v2/reply/reply?jsonp=jsonp&pn=1&ps=20&type=1&sort=2&oid=' +
    encodeURIComponent(String(aid)) +
    '&root=' +
    encodeURIComponent(String(rpid));
  playerFetchJson(api)
    .then(function (res) {
      if (!res || typeof res.code !== 'number' || res.code !== 0 || !res.data) {
        throw new Error('reply_reply_api');
      }
      var replies = res.data.replies || [];
      box.innerHTML = '';
      replies.forEach(function (sub) {
        playerAppendSubReply(box, sub);
      });
      if (controlEl) {
        controlEl._BiliTubeAllReplies = replies;
        controlEl.textContent = '收起评论';
        controlEl.setAttribute('data-expanded', 'true');
      }
    })
    .catch(function () {});
}
