function searchProxyUrl(u) {
  return '/proxy?u=' + encodeURIComponent(u);
}

function searchFetchJson(u) {
  return fetch(searchProxyUrl(u)).then(function (res) {
    if (!res.ok) {
      throw new Error('network');
    }
    return res.json();
  });
}

function searchFormatDuration(input) {
  if (!input) return '';
  if (typeof input === 'string' && input.indexOf(':') !== -1) {
    return input;
  }
  var s = typeof input === 'number' ? input : parseInt(input, 10);
  if (!s || s <= 0) return '';
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  var pad = function (n) {
    return n < 10 ? '0' + n : '' + n;
  };
  if (h <= 0) {
    return pad(m) + ':' + pad(sec);
  }
  return pad(h) + ':' + pad(sec);
}

function mapSearchVideoItem(item) {
  if (!item) return null;
  var cover = item.pic || '';
  var title = item.title || '';
  var author = item.author || '';
  var duration = item.duration || 0;
  var views = item.play || item.play_num || '';
  var bvid = item.bvid || '';
  var mapped = {
    id: bvid,
    cover: cover,
    duration: searchFormatDuration(duration),
    title: title,
    channel: author,
    views: views ? views + ' 次观看' : '',
    time: ''
  };
  return mapped;
}

function fillSearchVideoResults(keyword) {
  var grid = document.getElementById('search-video-grid');
  if (!grid) return;
  var value = (keyword || '').trim();
  if (!value) {
    grid.innerHTML =
      '<div class="empty-result">' + t('search_empty_videos') + '</div>';
    return;
  }
  var container = grid.parentElement || grid;
  var run = function () {
    grid.innerHTML = '';
    var url =
      'https://api.bilibili.com/x/web-interface/wbi/search/type?search_type=video&keyword=' +
      encodeURIComponent(value) +
      '&page=1';
    searchFetchJson(url)
      .then(function (res) {
        if (!res || typeof res.code !== 'number' || res.code !== 0) {
          grid.innerHTML =
            '<div class="empty-result">' +
            t('search_empty_videos') +
            '</div>';
          return;
        }
        var list =
          res &&
          res.data &&
          Array.isArray(res.data.result) &&
          res.data.result.length
            ? res.data.result
            : [];
        if (!list.length) {
          grid.innerHTML =
            '<div class="empty-result">' +
            t('search_empty_videos') +
            '</div>';
          return;
        }
        var mapped = list
          .map(mapSearchVideoItem)
          .filter(function (x) {
            return !!x;
          });
        var baseIndex = 0;
        var html = mapped
          .map(function (v, idx) {
            if (typeof homeParseCoverUrl === 'function') {
              v.cover = homeParseCoverUrl(v.cover);
            }
            if (typeof createHomeCardHtml === 'function') {
              return createHomeCardHtml(v, baseIndex + idx);
            }
            var safeId = encodeURIComponent(v.id || baseIndex + idx);
            var cover =
              v.cover ||
              'https://via.placeholder.com/300x200?text=BiliTube+Search';
            var channelName = v.channel || '';
            var viewsText = v.views || '';
            var meta = viewsText;
            var duration = v.duration || '';
            return (
              '<div class="video-card" onclick="window.location.hash=\'#/video/' +
              safeId +
              '\'">' +
              '<div class="thumbnail-container">' +
              '<img src="' +
              cover +
              '" alt="Thumbnail" class="thumbnail-img" loading="lazy">' +
              (duration
                ? '<span class="video-duration">' + duration + '</span>'
                : '') +
              '</div>' +
              '<div class="video-info">' +
              '<div class="video-details">' +
              '<h3 class="video-title">' +
              v.title +
              '</h3>' +
              '<div class="channel-name">' +
              channelName +
              '</div>' +
              (meta ? '<div class="video-meta">' + meta + '</div>' : '') +
              '</div>' +
              '</div>' +
              '</div>'
            );
          })
          .join('');
        grid.innerHTML = html;
      })
      .catch(function () {
        grid.innerHTML =
          '<div class="empty-result">' +
          t('search_empty_videos') +
          '</div>';
      });
  };
  if (typeof withLoader === 'function') {
    withLoader(container, run, 200);
  } else {
    run();
  }
}

function mapSearchUserItem(item) {
  if (!item) return null;
  return {
    name: item.uname || '',
    desc: item.usign || '',
    followers: item.fans || item.fans_num || ''
  };
}

function fillSearchUserResults(keyword) {
  var container = document.getElementById('search-user-list');
  if (!container) return;
  var value = (keyword || '').trim();
  if (!value) {
    container.innerHTML =
      '<div class="empty-result">' + t('search_empty_users') + '</div>';
    return;
  }
  var run = function () {
    container.innerHTML = '';
    var url =
      'https://api.bilibili.com/x/web-interface/wbi/search/type?search_type=bili_user&keyword=' +
      encodeURIComponent(value) +
      '&page=1';
    searchFetchJson(url)
      .then(function (res) {
        if (!res || typeof res.code !== 'number' || res.code !== 0) {
          container.innerHTML =
            '<div class="empty-result">' +
            t('search_empty_users') +
            '</div>';
          return;
        }
        var list =
          res &&
          res.data &&
          Array.isArray(res.data.result) &&
          res.data.result.length
            ? res.data.result
            : [];
        if (!list.length) {
          container.innerHTML =
            '<div class="empty-result">' +
            t('search_empty_users') +
            '</div>';
          return;
        }
        var mapped = list
          .map(mapSearchUserItem)
          .filter(function (x) {
            return !!x;
          });
        var html = mapped
          .map(function (user, index) {
            var avatar =
              'https://picsum.photos/64/64?random=' + (400 + index);
            if (typeof homeParseCoverUrl === 'function') {
              avatar = homeParseCoverUrl(avatar);
            }
            var followers = user.followers
              ? user.followers + ' 关注'
              : '';
            var meta =
              (user.desc || '') + (followers ? ' · ' + followers : '');
            return (
              '<div class="user-card">' +
              '<div class="user-avatar" style="background-image: url(\'' +
              avatar +
              '\'); background-size: cover;"></div>' +
              '<div class="user-info">' +
              '<div class="user-name">' +
              user.name +
              '</div>' +
              '<div class="user-meta">' +
              meta +
              '</div>' +
              '</div>' +
              '</div>'
            );
          })
          .join('');
        container.innerHTML = html;
      })
      .catch(function () {
        container.innerHTML =
          '<div class="empty-result">' +
          t('search_empty_users') +
          '</div>';
      });
  };
  if (typeof withLoader === 'function') {
    withLoader(container, run, 200);
  } else {
    run();
  }
}
