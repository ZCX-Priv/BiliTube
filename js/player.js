var biliTubeDanmakuState = {
  list: [],
  index: 0,
  timer: null,
  enabled: true,
  laneIndex: 0,
  lineHeight: 24,
  laneNextAvailable: []
};

var biliTubeCommentState = {
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

function playerAttachSource(videoEl, url) {
  if (!videoEl || !url) return;
  var isHls = /\.m3u8(\?|$)/i.test(url);
  if (isHls && window.Hls && typeof window.Hls.isSupported === 'function' && window.Hls.isSupported()) {
    if (window.biliTubeHls) {
      try {
        window.biliTubeHls.destroy();
      } catch (e) {}
      window.biliTubeHls = null;
    }
    var hls = new window.Hls();
    window.biliTubeHls = hls;
    hls.loadSource(url);
    hls.attachMedia(videoEl);
  } else {
    if (window.biliTubeHls) {
      try {
        window.biliTubeHls.destroy();
      } catch (e) {}
      window.biliTubeHls = null;
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
    try {
      videoEl.load();
    } catch (e) {}
  }
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
    'https://api.bilibili.com/x/player/playurl?type=mp4&platform=html5&qn=64&high_quality=1&' +
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
      var rawUrl = durl[0].url;
      var streamUrl = '/stream?u=' + encodeURIComponent(rawUrl);
      playerAttachSource(videoEl, streamUrl);
      var banner = document.getElementById('btube-video-error');
      if (banner) {
        banner.textContent = '';
        banner.style.display = 'none';
      }
      return streamUrl;
    })
    .catch(function (err) {
      var banner = document.getElementById('btube-video-error');
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

function biliTubeResetCommentState(aid) {
  biliTubeCommentState.aid = aid;
  biliTubeCommentState.next = 1;
  biliTubeCommentState.loading = false;
  biliTubeCommentState.finished = false;
}

function biliTubeLoadVideoById(id) {
  var raw = (id || '').trim();
  if (!raw) return;
  var isBvid = /^BV/i.test(raw);
  var key = isBvid ? 'bvid' : 'aid';
  var api =
    'https://api.bilibili.com/x/web-interface/view?' +
    key +
    '=' +
    encodeURIComponent(raw);
  var errorBanner = document.getElementById('btube-video-error');
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
      var titleEl = document.getElementById('btube-video-title');
      if (titleEl) {
        titleEl.textContent = title;
      }
      var descEl = document.getElementById('btube-video-desc');
      if (descEl) {
        descEl.textContent = desc;
      }
      var nameEl = document.getElementById('btube-author-name');
      if (nameEl) {
        nameEl.textContent = authorName || '';
      }
      var bioEl = document.getElementById('btube-author-bio');
      if (bioEl) {
        bioEl.textContent = bio || '';
      }
      var avatarEl = document.getElementById('btube-author-avatar');
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
      var videoEl = document.getElementById('btube-video');
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
      if (typeof biliTubeRecordWatchHistory === 'function') {
        var historyId = bvid || (aid ? String(aid) : '');
        if (historyId) {
          biliTubeRecordWatchHistory({
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
      playerLoadDanmaku(cid);
      playerLoadComments(aid);
      playerLoadRecommendations(bvid || '', aid);
      return playerLoadPlayUrl(videoEl, bvid, aid, cid);
    })
    .catch(function (err) {
      var banner = document.getElementById('btube-video-error');
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
  var container = document.getElementById('btube-episodes');
  if (!container) return;
  container.innerHTML = '';
  if (!pages || !pages.length || pages.length === 1) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  var title = document.createElement('div');
  title.className = 'btube-section-title';
  title.textContent = '选集';
  var list = document.createElement('div');
  list.className = 'btube-episode-list';
  pages.forEach(function (item, index) {
    var cid = item.cid;
    var label = item.part || '';
    var pageNum = item.page || index + 1;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btube-episode-chip';
    if (String(cid) === String(currentCid)) {
      btn.className += ' btube-episode-chip-active';
    }
    btn.textContent = 'P' + pageNum + ' ' + label;
    btn.setAttribute('data-cid', String(cid));
    btn.setAttribute('data-page', String(pageNum));
    btn.addEventListener('click', function () {
      var targetCid = Number(btn.getAttribute('data-cid'));
      var siblings = list.querySelectorAll('.btube-episode-chip');
      siblings.forEach(function (el) {
        el.classList.remove('btube-episode-chip-active');
      });
      btn.classList.add('btube-episode-chip-active');
      playerLoadPlayUrl(videoEl, bvid, aid, targetCid).catch(function () {});
      playerLoadDanmaku(targetCid);
    });
    list.appendChild(btn);
  });
  container.appendChild(title);
  container.appendChild(list);
}

function playerSetDanmakuEnabled(enabled) {
  biliTubeDanmakuState.enabled = !!enabled;
  var layer = document.getElementById('btube-danmaku-layer');
  if (!layer) return;
  layer.style.display = enabled ? 'block' : 'none';
}

function playerEnsureDanmakuLoop() {
  if (biliTubeDanmakuState.timer) {
    return;
  }
  var videoEl = document.getElementById('btube-video');
  var layer = document.getElementById('btube-danmaku-layer');
  if (!videoEl || !layer) {
    return;
  }
  biliTubeDanmakuState.timer = setInterval(function () {
    if (!biliTubeDanmakuState.enabled) return;
    if (!biliTubeDanmakuState.list || !biliTubeDanmakuState.list.length) return;
    if (biliTubeDanmakuState.index >= biliTubeDanmakuState.list.length) return;
    if (!videoEl.duration || isNaN(videoEl.currentTime)) return;
    var currentTime = videoEl.currentTime;
    var height = layer.clientHeight || videoEl.clientHeight || 0;
    var lineHeight = biliTubeDanmakuState.lineHeight;
    var rows = height > 0 ? Math.max(6, Math.floor((height - 40) / lineHeight)) : 6;
    if (!biliTubeDanmakuState.laneNextAvailable || biliTubeDanmakuState.laneNextAvailable.length !== rows) {
      biliTubeDanmakuState.laneNextAvailable = [];
      for (var r = 0; r < rows; r++) {
        biliTubeDanmakuState.laneNextAvailable[r] = 0;
      }
    }
    while (biliTubeDanmakuState.index < biliTubeDanmakuState.list.length) {
      var item = biliTubeDanmakuState.list[biliTubeDanmakuState.index];
      if (item.time > currentTime) {
        break;
      }
      var bestLane = 0;
      var earliest = biliTubeDanmakuState.laneNextAvailable[0];
      for (var i = 1; i < rows; i++) {
        if (biliTubeDanmakuState.laneNextAvailable[i] < earliest) {
          earliest = biliTubeDanmakuState.laneNextAvailable[i];
          bestLane = i;
        }
      }
      if (earliest > currentTime) {
        bestLane = biliTubeDanmakuState.laneIndex % rows;
      }
      biliTubeDanmakuState.laneIndex = bestLane;
      var top = Math.round(10 + lineHeight * biliTubeDanmakuState.laneIndex);
      var el = document.createElement('div');
      el.className = 'btube-danmaku-item';
      el.textContent = item.text;
      el.style.top = top + 'px';
      layer.appendChild(el);
      setTimeout(function () {
        if (el.parentNode === layer) {
          layer.removeChild(el);
        }
      }, 8000);
      biliTubeDanmakuState.laneNextAvailable[bestLane] = currentTime + 8;
      biliTubeDanmakuState.index += 1;
    }
  }, 100);
}

function playerLoadDanmaku(cid) {
  var layer = document.getElementById('btube-danmaku-layer');
  if (layer) {
    layer.innerHTML = '';
  }
  biliTubeDanmakuState.list = [];
  biliTubeDanmakuState.index = 0;
  biliTubeDanmakuState.laneIndex = 0;
  biliTubeDanmakuState.laneNextAvailable = [];
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
      biliTubeDanmakuState.list = list;
      biliTubeDanmakuState.index = 0;
      playerEnsureDanmakuLoop();
    })
    .catch(function () {});
}

function playerAppendSubReply(box, sub) {
  if (!box || !sub) {
    return;
  }
  var subItem = document.createElement('div');
  subItem.className = 'btube-comment-item btube-comment-reply';
  var subAvatar = document.createElement('div');
  subAvatar.className = 'btube-avatar btube-avatar-xsmall';
  var subName = (sub.member && sub.member.uname) || '';
  var subFace =
    (sub.member && (sub.member.avatar || sub.member.face)) || '';
  if (subFace) {
    subAvatar.style.backgroundImage = "url('" + subFace + "')";
  } else {
    subAvatar.textContent = subName ? subName.charAt(0) : 'U';
  }
  var subContent = document.createElement('div');
  subContent.className = 'btube-comment-content';
  var subUser = document.createElement('div');
  subUser.className = 'btube-comment-user';
  subUser.textContent = subName || '用户';
  var subText = document.createElement('div');
  subText.className = 'btube-comment-text';
  subText.textContent =
    (sub.content && sub.content.message) || '';
  subContent.appendChild(subUser);
  subContent.appendChild(subText);
  subItem.appendChild(subAvatar);
  subItem.appendChild(subContent);
  box.appendChild(subItem);
}

function playerLoadComments(aid) {
  var container = document.getElementById('btube-comments-content');
  if (!container || !aid) {
    return;
  }
  if (biliTubeCommentState.aid !== aid) {
    biliTubeResetCommentState(aid);
  } else {
    biliTubeCommentState.next = 1;
    biliTubeCommentState.finished = false;
  }
  container.innerHTML = '';
  playerLoadMoreComments(true);
}

function playerLoadMoreComments(isFirstPage) {
  var container = document.getElementById('btube-comments-content');
  if (!container) {
    return;
  }
  var aid = biliTubeCommentState.aid;
  if (!aid || biliTubeCommentState.loading || biliTubeCommentState.finished) {
    return;
  }
  biliTubeCommentState.loading = true;
  var page = biliTubeCommentState.next || 1;
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
        empty.className = 'btube-comment-text';
        empty.textContent = '暂无评论';
        container.appendChild(empty);
      }
      biliTubeCommentState.finished = true;
      biliTubeCommentState.loading = false;
      return;
    }
    replies.forEach(function (reply) {
      var item = document.createElement('div');
      item.className = 'btube-comment-item';
      var avatar = document.createElement('div');
      avatar.className = 'btube-avatar btube-avatar-small';
      var uname = (reply.member && reply.member.uname) || '';
      var face =
        (reply.member && (reply.member.avatar || reply.member.face)) || '';
      if (face) {
        avatar.style.backgroundImage = "url('" + face + "')";
      } else {
        avatar.textContent = uname ? uname.charAt(0) : 'U';
      }
      var content = document.createElement('div');
      content.className = 'btube-comment-content';
      var userEl = document.createElement('div');
      userEl.className = 'btube-comment-user';
      userEl.textContent = uname || '用户';
      var textEl = document.createElement('div');
      textEl.className = 'btube-comment-text';
      textEl.textContent =
        (reply.content && reply.content.message) || '';
      var meta = document.createElement('div');
      meta.className = 'btube-rec-meta';
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
      box.className = 'btube-reply-box';
      if (reply.replies && reply.replies.length) {
        reply.replies.slice(0, 2).forEach(function (sub) {
          playerAppendSubReply(box, sub);
        });
      }
      if (reply.rcount && reply.rcount > (reply.replies ? reply.replies.length : 0)) {
        var more = document.createElement('div');
        more.className = 'btube-reply-more';
        more.textContent = '查看全部 ' + reply.rcount + ' 条回复';
        more.setAttribute('data-expanded', 'false');
        more._biliTubeLabel = more.textContent;
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
        biliTubeCommentState.next = cursor.next;
      } else {
        biliTubeCommentState.finished = true;
      }
      if (cursor.is_end) {
        biliTubeCommentState.finished = true;
      }
    } else {
      var nextPage = biliTubeCommentState.next || 1;
      biliTubeCommentState.next = nextPage + 1;
      if (replies.length < 50) {
        biliTubeCommentState.finished = true;
      }
    }
    biliTubeCommentState.loading = false;
  };
  var handleError = function () {
    biliTubeCommentState.loading = false;
    biliTubeCommentState.finished = true;
    if (isFirstPage && !container.children.length) {
      var error = document.createElement('div');
      error.className = 'btube-comment-text';
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
  var container = document.getElementById('btube-recommendations');
  if (!container || (!bvid && !aid)) {
    return;
  }
  container.innerHTML = '';
  var title = document.createElement('div');
  title.className = 'btube-section-title';
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
        rec.className = 'btube-rec-item';
        var thumb = document.createElement('div');
        thumb.className = 'btube-rec-thumb';
        var pic = item.pic || item.cover || '';
        if (pic) {
          thumb.style.backgroundImage = "url('" + pic + "')";
          thumb.style.backgroundSize = 'cover';
          thumb.style.backgroundPosition = 'center';
        }
        var info = document.createElement('div');
        info.className = 'btube-rec-info';
        var titleEl = document.createElement('div');
        titleEl.className = 'btube-rec-title';
        titleEl.textContent = item.title || '';
        var meta = document.createElement('div');
        meta.className = 'btube-rec-meta';
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
    var prevReplies = controlEl._biliTubeAllReplies || [];
    box.innerHTML = '';
    if (prevReplies && prevReplies.length) {
      prevReplies.slice(0, 2).forEach(function (sub) {
        playerAppendSubReply(box, sub);
      });
    }
    var label = controlEl._biliTubeLabel || controlEl.textContent || '';
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
        controlEl._biliTubeAllReplies = replies;
        controlEl.textContent = '收起评论';
        controlEl.setAttribute('data-expanded', 'true');
      }
    })
    .catch(function () {});
}
