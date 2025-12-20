function subsProxyUrl(u) {
  return '/proxy?u=' + encodeURIComponent(u);
}

function subsFetchJson(u) {
  return fetch(subsProxyUrl(u)).then(function (res) {
    if (!res.ok) throw new Error('network');
    return res.json();
  });
}

function subsFormatTime(ts) {
  if (!ts) return '';
  try {
    var d = new Date(ts * 1000);
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch (e) {
    return '';
  }
}

function subsBuildFeedItemFromDynamic(item) {
  if (!item || !item.modules || !item.modules.module_dynamic) return null;
  var author = item.modules.module_author || {};
  var dynamic = item.modules.module_dynamic;
  var archive = dynamic.major && dynamic.major.archive;
  var title = '';
  var text = '';
  var cover = '';
  if (archive) {
    title = archive.title || '';
    cover = archive.cover || '';
    text =
      (archive.desc || '') ||
      (dynamic.desc && dynamic.desc.text) ||
      '';
  } else if (dynamic.major && dynamic.major.opus) {
    title = (dynamic.major.opus.title && dynamic.major.opus.title.text) || '';
    text = (dynamic.major.opus.summary && dynamic.major.opus.summary.text) || '';
    if (dynamic.major.opus.pics && dynamic.major.opus.pics.length) {
      cover = dynamic.major.opus.pics[0].url || '';
    }
  }
  var ts = author.pub_ts || dynamic.pub_time || 0;
  return {
    avatar: author.face || '',
    name: author.name || '',
    time: subsFormatTime(ts),
    title: title || author.name || '',
    text: text || '',
    cover: cover || ''
  };
}

function subsRenderFeedCards(container, items) {
  if (!container) return;
  if (!items || !items.length) {
    container.innerHTML = '<div class="empty-result">暂无订阅动态</div>';
    return;
  }
  var html = items
    .map(function (it) {
      var imgHtml = '';
      var cover = it.cover || '';
      if (cover) {
        if (typeof homeParseCoverUrl === 'function') {
          cover = homeParseCoverUrl(cover);
        }
        imgHtml =
          '<div class="feed-media">' +
          '<img src="' +
          cover +
          '" alt="Feed Image" class="feed-img" loading="lazy">' +
          '</div>';
      }
      return (
        '<div class="feed-card">' +
        '<div class="feed-header">' +
        '<div class="sub-avatar"' +
        (it.avatar
          ? ' style="background-image: url(\'' +
            (typeof homeParseCoverUrl === 'function'
              ? homeParseCoverUrl(it.avatar)
              : it.avatar) +
            '\'); background-size: cover;"'
          : '') +
        '></div>' +
        '<div class="feed-meta">' +
        '<div class="sub-name">' +
        (it.name || '') +
        '</div>' +
        '<div class="feed-time">' +
        (it.time || '') +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="feed-body">' +
        '<div class="feed-text">' +
        (it.title || '') +
        (it.text ? '：' + it.text : '') +
        '</div>' +
        imgHtml +
        '</div>' +
        '</div>'
      );
    })
    .join('');
  container.innerHTML = html;
}

function initSubscriptionsView() {
  var view = document.getElementById('view-subscriptions');
  if (!view || view.dataset.initialized === 'true') return;
  view.dataset.initialized = 'true';
  var variant = typeof getSubsVariant === 'function' ? getSubsVariant() : 'A';
  view.dataset.variant = variant;
  view.classList.add('subs-variant-' + (variant || 'a').toLowerCase());
  if (typeof trackSubsEvent === 'function') {
    trackSubsEvent('visit', variant);
  }
  var list = view.querySelector('.subs-list');
  var content = view.querySelector('.subs-content');
  if (!list || !content) return;
  var run = function () {
    withLoader(content, function () {
      loadSubscriptionsIntoView(list, content, variant);
    }, 200);
  };
  if (typeof withLoader === 'function') {
    withLoader(view, run, 150);
  } else {
    run();
  }
}

function loadSubscriptionsIntoView(list, content, variant) {
  list.innerHTML = '';
  content.innerHTML = '';
  subsFetchJson('https://api.bilibili.com/x/web-interface/nav')
    .then(function (nav) {
      var mid =
        nav &&
        nav.data &&
        (nav.data.mid || nav.data.uid || nav.data.userid);
      if (!mid) {
        content.innerHTML =
          '<div class="empty-result">无法获取账号信息，请确认已登录并配置 Cookie</div>';
        return;
      }
      return loadFollowings(mid);
    })
    .then(function (followings) {
      if (!followings) return;
      renderSubsList(list, followings, variant);
      renderAllDynamics(content, variant);
    })
    .catch(function () {
      content.innerHTML =
        '<div class="empty-result">加载订阅列表失败，请稍后重试</div>';
    });
}

function loadFollowings(mid) {
  var all = [];
  var maxPages = 3;
  var perPage = 50;
  var chain = Promise.resolve();
  for (var i = 1; i <= maxPages; i++) {
    (function (page) {
      chain = chain.then(function () {
        var url =
          'https://api.bilibili.com/x/relation/followings?vmid=' +
          mid +
          '&pn=' +
          page +
          '&ps=' +
          perPage +
          '&order=desc&order_type=attention';
        return subsFetchJson(url)
          .then(function (res) {
            if (!res || res.code !== 0) {
              return;
            }
            var list = (res.data && res.data.list) || [];
            if (!list.length) {
              return;
            }
            list.forEach(function (item) {
              all.push({
                uid: item.mid,
                name: item.uname,
                face: item.face,
                sign: item.sign
              });
            });
          })
          .catch(function () {});
      });
    })(i);
  }
  return chain.then(function () {
    return all;
  });
}

function renderSubsList(list, followings, variant) {
  var html =
    '<div class="sub-item sub-item-all active" data-uid="all">' +
    '<div class="sub-avatar"></div>' +
    '<div class="sub-name">全部订阅</div>' +
    '</div>';
  followings.forEach(function (u) {
    var avatar = u.face || '';
    if (typeof homeParseCoverUrl === 'function') {
      avatar = homeParseCoverUrl(avatar);
    }
    html +=
      '<div class="sub-item" data-uid="' +
      u.uid +
      '">' +
      '<div class="sub-avatar"' +
      (avatar
        ? ' style="background-image: url(\'' +
          avatar +
          '\'); background-size: cover;"'
        : '') +
      '></div>' +
      '<div class="sub-name">' +
      (u.name || '') +
      '</div>' +
      '</div>';
  });
  list.innerHTML = html;
  var items = Array.prototype.slice.call(list.querySelectorAll('.sub-item'));
  items.forEach(function (item) {
    item.addEventListener('click', function () {
      items.forEach(function (i) {
        i.classList.remove('active');
      });
      item.classList.add('active');
      var uid = item.getAttribute('data-uid') || 'all';
      if (typeof trackSubsEvent === 'function') {
        trackSubsEvent(
          'channel_click_' + (uid === 'all' ? 'all' : 'user'),
          variant
        );
      }
      if (uid === 'all') {
        renderAllDynamics(
          list.parentNode.querySelector('.subs-content') || null,
          variant
        );
      } else {
        renderUserDynamics(
          list.parentNode.querySelector('.subs-content') || null,
          uid,
          variant
        );
      }
    });
  });
}

function renderAllDynamics(content, variant) {
  if (!content) return;
  if (typeof trackSubsEvent === 'function') {
    trackSubsEvent('feed_all', variant);
  }
  if (typeof withLoader === 'function') {
    withLoader(content, function () {
      loadAllDynamics(content);
    }, 200);
  } else {
    loadAllDynamics(content);
  }
}

function renderUserDynamics(content, uid, variant) {
  if (!content) return;
  if (typeof trackSubsEvent === 'function') {
    trackSubsEvent('feed_user', variant);
  }
  if (typeof withLoader === 'function') {
    withLoader(content, function () {
      loadUserDynamics(content, uid);
    }, 200);
  } else {
    loadUserDynamics(content, uid);
  }
}

function loadAllDynamics(content) {
  var url =
    'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?timezone_offset=-480&type=video&platform=web&page=1';
  subsFetchJson(url)
    .then(function (res) {
      var items =
        (res &&
          res.data &&
          Array.isArray(res.data.items) &&
          res.data.items) ||
        [];
      var mapped = items
        .map(subsBuildFeedItemFromDynamic)
        .filter(function (x) {
          return !!x;
        });
      subsRenderFeedCards(content, mapped);
    })
    .catch(function () {
      content.innerHTML =
        '<div class="empty-result">加载全部订阅动态失败</div>';
    });
}

function loadUserDynamics(content, uid) {
  var url =
    'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?offset=&host_mid=' +
    uid +
    '&timezone_offset=-480&platform=web&type=video';
  subsFetchJson(url)
    .then(function (res) {
      var items =
        (res &&
          res.data &&
          Array.isArray(res.data.items) &&
          res.data.items) ||
        [];
      var mapped = items
        .map(subsBuildFeedItemFromDynamic)
        .filter(function (x) {
          return !!x;
        });
      subsRenderFeedCards(content, mapped);
    })
    .catch(function () {
      content.innerHTML =
        '<div class="empty-result">加载该订阅动态失败</div>';
    });
}

