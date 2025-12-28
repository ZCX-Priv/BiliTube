var BiliTubeDanmakuState = {
  list: [],
  index: 0,
  timer: null,
  enabled: true,
  laneIndex: 0,
  lineHeight: 24,
  laneNextAvailable: []
};

var BiliTubeCommentState = {
  aid: 0,
  next: 1,
  loading: false,
  finished: false
};

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

function playerAttachSource(videoEl, url) {
  if (!videoEl || !url) return;
  var isHls = /\.m3u8(\?|$)/i.test(url);
  if (isHls && window.Hls && typeof window.Hls.isSupported === 'function' && window.Hls.isSupported()) {
    if (window.BiliTubeHls) {
      try {
        window.BiliTubeHls.destroy();
      } catch (e) {}
      window.BiliTubeHls = null;
    }
    var hlsConfig = {
      enableWorker: true,
      lowLatencyMode: true,
      xhrSetup: function(xhr, url) {
        xhr.timeout = 15000;
      },
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      maxBufferSize: 60 * 1024 * 1024,
      maxBufferHole: 0.5
    };
    var hls = new window.Hls(hlsConfig);
    window.BiliTubeHls = hls;
    hls.loadSource(url);
    hls.attachMedia(videoEl);
    hls.on(window.Hls.Events.MANIFEST_PARSED, function() {
      videoEl.currentTime = 0;
    });
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
      return streamUrl;
    })
    .catch(function (err) {
      var banner = document.getElementById('BiliTube-video-error');
      if (banner) {
        var msg = '视频播放地址加载失败，请稍后重试。';
        if (err && err.message === 'playurl_api') {
          msg = '视频播放接口返回异常，请稍后重试。';
        }
        banner.textContent = msg;
        banner.style.display = 'block';
      }
      throw err;
    });
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
      var title = data.title || '';
      var desc = data.desc || '';
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
        descEl.textContent = desc;
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
      if (avatarEl) {
        var displayAvatar = avatar;
        if (displayAvatar && typeof homeParseCoverUrl === 'function') {
          displayAvatar = homeParseCoverUrl(displayAvatar);
        }
        avatarEl.textContent = '';
        if (displayAvatar) {
          avatarEl.style.backgroundImage = "url('" + displayAvatar + "')";
        } else {
          avatarEl.style.backgroundImage = '';
          var initial = authorName ? authorName.charAt(0) : 'A';
          avatarEl.textContent = initial;
        }
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
      if (typeof BiliTubeRecordWatchHistory === 'function') {
        var historyId = bvid || (aid ? String(aid) : '');
        if (historyId) {
          BiliTubeRecordWatchHistory({
            id: historyId,
            title: title,
            cover: poster,
            channel: authorName,
            views: viewsNum,
            duration: durationSeconds,
            ts: Date.now()
          });
        }
      }
      playerRenderEpisodes(pages, cid, bvid, aid, videoEl);
      BiliTubeSeekPreload.bind(videoEl);
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
  if (subFace) {
    var subFaceUrl = subFace;
    if (typeof homeParseCoverUrl === 'function') {
      subFaceUrl = homeParseCoverUrl(subFaceUrl);
    }
    subAvatar.style.backgroundImage = "url('" + subFaceUrl + "')";
  } else {
    subAvatar.textContent = subName ? subName.charAt(0) : 'U';
  }
  var subContent = document.createElement('div');
  subContent.className = 'BiliTube-comment-content';
  var subUser = document.createElement('div');
  subUser.className = 'BiliTube-comment-user';
  subUser.textContent = subName || '用户';
  var subText = document.createElement('div');
  subText.className = 'BiliTube-comment-text';
  subText.textContent =
    (sub.content && sub.content.message) || '';
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
      if (face) {
        var faceUrl = face;
        if (typeof homeParseCoverUrl === 'function') {
          faceUrl = homeParseCoverUrl(faceUrl);
        }
        avatar.style.backgroundImage = "url('" + faceUrl + "')";
      } else {
        avatar.textContent = uname ? uname.charAt(0) : 'U';
      }
      var content = document.createElement('div');
      content.className = 'BiliTube-comment-content';
      var userEl = document.createElement('div');
      userEl.className = 'BiliTube-comment-user';
      userEl.textContent = uname || '用户';
      var textEl = document.createElement('div');
      textEl.className = 'BiliTube-comment-text';
      textEl.textContent =
        (reply.content && reply.content.message) || '';
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
  container.innerHTML = '';
  var title = document.createElement('div');
  title.className = 'BiliTube-section-title';
  title.textContent = '相关推荐';
  container.appendChild(title);
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
      list.slice(0, 10).forEach(function (item) {
        var rec = document.createElement('div');
        rec.className = 'BiliTube-rec-item';
        var thumb = document.createElement('div');
        thumb.className = 'BiliTube-rec-thumb';
        var pic = item.pic || item.cover || '';
        if (pic) {
          var coverUrl = pic;
          if (typeof homeParseCoverUrl === 'function') {
            coverUrl = homeParseCoverUrl(coverUrl);
          }
          thumb.style.backgroundImage = "url('" + coverUrl + "')";
          thumb.style.backgroundSize = 'cover';
          thumb.style.backgroundPosition = 'center';
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
        var viewText = views
          ? views.toLocaleString() + ' 次观看'
          : '';
        meta.textContent = viewText;
        info.appendChild(titleEl);
        if (viewText) {
          info.appendChild(meta);
        }
        rec.appendChild(thumb);
        rec.appendChild(info);
        var nextId = item.bvid || (item.aid ? String(item.aid) : '');
        if (nextId) {
          rec.addEventListener('click', function () {
            window.location.hash = '#/video/' + encodeURIComponent(nextId);
          });
        }
        container.appendChild(rec);
      });
    })
    .catch(function () {});
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
