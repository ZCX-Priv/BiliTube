var BiliTubeWebmaskState = {
  list: [],
  index: 0,
  timer: null,
  enabled: true,
  laneIndex: 0,
  lineHeight: 24,
  rows: 6,
  laneLastEntryTime: [],
  danmakuStartTime: []
};

function webmaskGetLayer() {
  return document.getElementById('BiliTube-danmaku-layer');
}

function webmaskSetEnabled(enabled) {
  BiliTubeWebmaskState.enabled = !!enabled;
  var layer = webmaskGetLayer();
  if (!layer) return;
  layer.style.display = enabled ? 'block' : 'none';
}

function webmaskStopLoop() {
  if (BiliTubeWebmaskState.timer) {
    clearInterval(BiliTubeWebmaskState.timer);
    BiliTubeWebmaskState.timer = null;
  }
}

function webmaskClearAll() {
  var layer = webmaskGetLayer();
  if (layer) {
    layer.innerHTML = '';
  }
  BiliTubeWebmaskState.laneLastEntryTime = [];
  BiliTubeWebmaskState.danmakuStartTime = [];
}

function webmaskInitRows() {
  var layer = webmaskGetLayer();
  var videoEl = document.getElementById('BiliTube-video');
  if (!layer) return;
  var height = layer.clientHeight || videoEl.clientHeight || 0;
  var lineHeight = BiliTubeWebmaskState.lineHeight;
  var newRows = height > 0 ? Math.max(6, Math.floor(height / lineHeight)) : 6;
  
  if (newRows !== BiliTubeWebmaskState.rows) {
    BiliTubeWebmaskState.rows = newRows;
    BiliTubeWebmaskState.laneLastEntryTime = [];
    for (var i = 0; i < newRows; i++) {
      BiliTubeWebmaskState.laneLastEntryTime[i] = 0;
    }
  }
}

function webmaskFindLane(danmakuWidth, layerWidth) {
  var rows = BiliTubeWebmaskState.rows;
  var now = performance.now();
  
  var minScore = Infinity;
  var bestLane = 0;
  
  for (var i = 0; i < rows; i++) {
    var lastEntry = BiliTubeWebmaskState.laneLastEntryTime[i] || 0;
    var timeSinceLast = now - lastEntry;
    
    var score = -timeSinceLast;
    
    if (score < minScore) {
      minScore = score;
      bestLane = i;
    }
  }
  
  return bestLane;
}

function webmaskGetWaitTime(lane, danmakuWidth, layerWidth) {
  var now = performance.now();
  var lastEntry = BiliTubeWebmaskState.laneLastEntryTime[lane] || 0;
  var timeSinceLast = now - lastEntry;
  
  var danmakuDuration = (danmakuWidth + layerWidth) / (layerWidth / 8);
  var minGap = danmakuDuration * 300;
  
  if (timeSinceLast >= minGap) {
    return 0;
  }
  
  return minGap - timeSinceLast;
}

function webmaskStartLoop() {
  if (BiliTubeWebmaskState.timer) {
    return;
  }
  var videoEl = document.getElementById('BiliTube-video');
  var layer = webmaskGetLayer();
  if (!videoEl || !layer) {
    return;
  }
  webmaskInitRows();
  
  var rows = BiliTubeWebmaskState.rows;
  for (var i = 0; i < rows; i++) {
    if (!BiliTubeWebmaskState.laneLastEntryTime[i]) {
      BiliTubeWebmaskState.laneLastEntryTime[i] = 0;
    }
  }

  BiliTubeWebmaskState.timer = setInterval(function () {
    if (!BiliTubeWebmaskState.enabled) return;
    if (!BiliTubeWebmaskState.list || !BiliTubeWebmaskState.list.length) return;
    if (BiliTubeWebmaskState.index >= BiliTubeWebmaskState.list.length) return;
    if (!videoEl.duration || isNaN(videoEl.currentTime)) return;

    var currentTime = videoEl.currentTime;
    var layerWidth = layer.clientWidth || videoEl.clientWidth || window.innerWidth;
    var lineHeight = BiliTubeWebmaskState.lineHeight;
    var now = performance.now();

    while (BiliTubeWebmaskState.index < BiliTubeWebmaskState.list.length) {
      var item = BiliTubeWebmaskState.list[BiliTubeWebmaskState.index];
      if (item.time > currentTime) {
        break;
      }

      var el = document.createElement('div');
      el.className = 'BiliTube-danmaku-item';
      el.textContent = item.text;
      el.style.left = layerWidth + 'px';
      layer.appendChild(el);

      var danmakuWidth = el.offsetWidth || 150;
      var duration = Math.max(4, Math.min((danmakuWidth + layerWidth) / (layerWidth / 8), 10));
      var endX = -(danmakuWidth + layerWidth);
      
      var lane = webmaskFindLane(danmakuWidth, layerWidth);
      var waitTime = webmaskGetWaitTime(lane, danmakuWidth, layerWidth);
      
      el.style.top = Math.round(lineHeight * lane) + 'px';
      BiliTubeWebmaskState.laneIndex = (lane + 1) % BiliTubeWebmaskState.rows;

      el.style.transition = 'none';
      el.style.transform = 'translateX(0px)';
      
      BiliTubeWebmaskState.laneLastEntryTime[lane] = now + waitTime;

      var animationDelay = waitTime > 0 ? waitTime : 16;
      
      setTimeout(function(danmakuEl, danmakuEndX, danmakuDuration) {
        return function() {
          danmakuEl.style.transition = 'transform ' + danmakuDuration + 's linear';
          danmakuEl.style.transform = 'translateX(' + danmakuEndX + 'px)';
        };
      }(el, endX, duration), animationDelay);

      var cleanup = function(danmakuEl) {
        if (danmakuEl.parentNode === layer) {
          layer.removeChild(danmakuEl);
        }
      };

      el.addEventListener('transitionend', function(e) {
        if (e.propertyName === 'transform') {
          cleanup(this);
        }
      });

      el.addEventListener('transitioncancel', function() {
        cleanup(this);
      });

      setTimeout(function(danmakuEl) {
        return function() {
          cleanup(danmakuEl);
        };
      }(el), animationDelay + duration * 1000 + 200);

      BiliTubeWebmaskState.index++;
    }
  }, 20);
}

function webmaskLoad(cid) {
  webmaskStopLoop();
  var layer = webmaskGetLayer();
  if (layer) {
    layer.innerHTML = '';
  }
  BiliTubeWebmaskState.list = [];
  BiliTubeWebmaskState.index = 0;
  BiliTubeWebmaskState.laneIndex = 0;
  BiliTubeWebmaskState.laneLastEntryTime = [];
  BiliTubeWebmaskState.danmakuStartTime = [];
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
      BiliTubeWebmaskState.list = list;
      BiliTubeWebmaskState.index = 0;
      webmaskStartLoop();
    })
    .catch(function () {});
}

function webmaskPause() {
  var layer = webmaskGetLayer();
  if (layer) {
    var items = layer.querySelectorAll('.BiliTube-danmaku-item');
    for (var i = 0; i < items.length; i++) {
      var computedStyle = window.getComputedStyle(items[i]);
      if (computedStyle.transition !== 'none') {
        items[i].style.transition = 'none';
      }
    }
  }
}

function webmaskResume() {
  var layer = webmaskGetLayer();
  if (layer) {
    var items = layer.querySelectorAll('.BiliTube-danmaku-item');
    for (var i = 0; i < items.length; i++) {
      var transform = items[i].style.transform;
      items[i].style.transition = '';
      items[i].style.transform = transform;
    }
  }
}

function webmaskSeekTo(time) {
  if (typeof BiliTubeWebmaskState !== 'undefined' && BiliTubeWebmaskState) {
    webmaskClearAll();
    if (BiliTubeWebmaskState.list && BiliTubeWebmaskState.list.length) {
      var newIndex = 0;
      for (var i = 0; i < BiliTubeWebmaskState.list.length; i++) {
        if (BiliTubeWebmaskState.list[i].time <= time) {
          newIndex = i + 1;
        } else {
          break;
        }
      }
      BiliTubeWebmaskState.index = Math.max(0, Math.min(newIndex, BiliTubeWebmaskState.list.length));
    }
  }
}
