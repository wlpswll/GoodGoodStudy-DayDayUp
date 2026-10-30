/* 媒体清单分组。浏览器、Node 测试和小程序共用，不依赖页面。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EnglishCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var AUDIO_EXTS = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'flac', 'opus', 'weba'];
  var VIDEO_EXTS = ['mp4', 'm4v', 'webm', 'ogv', 'mov', 'mkv'];

  function extOf(name) {
    var base = String(name || '').split('/').pop();
    var match = base.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : '';
  }

  function kindFromName(name) {
    var ext = extOf(name);
    if (VIDEO_EXTS.indexOf(ext) >= 0) return 'video';
    if (AUDIO_EXTS.indexOf(ext) >= 0) return 'audio';
    return null;
  }

  function naturalCompare(a, b) {
    var re = /(\d+)|(\D+)/g;
    var left = String(a == null ? '' : a).match(re) || [];
    var right = String(b == null ? '' : b).match(re) || [];
    var count = Math.max(left.length, right.length);
    for (var i = 0; i < count; i++) {
      var x = left[i] || '';
      var y = right[i] || '';
      var xNum = /^\d+$/.test(x);
      var yNum = /^\d+$/.test(y);
      if (xNum && yNum) {
        var diff = parseInt(x, 10) - parseInt(y, 10);
        if (diff) return diff;
      } else {
        var text = x.localeCompare(y, 'zh');
        if (text) return text;
      }
    }
    return 0;
  }

  function groupCatalog(items) {
    var kinds = [
      { kind: 'video', label: '视频' },
      { kind: 'audio', label: '音频' }
    ];
    return kinds.map(function (meta) {
      var list = (items || []).filter(function (item) {
        return item && item.kind === meta.kind;
      }).slice().sort(function (a, b) {
        var folder = naturalCompare(a.folder, b.folder);
        if (folder) return folder;
        return naturalCompare(a.title, b.title);
      });
      var folders = [];
      var seen = {};
      list.forEach(function (item) {
        var name = item.folder || '未分类';
        if (!seen[name]) {
          seen[name] = { name: name, items: [] };
          folders.push(seen[name]);
        }
        seen[name].items.push(item);
      });
      return { kind: meta.kind, label: meta.label, count: list.length, folders: folders };
    }).filter(function (group) { return group.count > 0; });
  }

  function flattenKind(groups, kind) {
    var list = [];
    (groups || []).forEach(function (group) {
      if (group.kind !== kind) return;
      group.folders.forEach(function (folder) {
        folder.items.forEach(function (item) { list.push(item); });
      });
    });
    return list;
  }

  function matchesQuery(item, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    var kindLabel = item.kind === 'video' ? '视频' : '音频';
    var blob = [item.title, item.folder, item.ext, kindLabel].join(' ').toLowerCase();
    return blob.indexOf(q) >= 0;
  }

  function resolveSrc(item, baseUrl) {
    var src = String(item && item.src || '');
    var encoded = src.split('/').filter(function (part) { return part.length; }).map(function (part) {
      return encodeURIComponent(part);
    }).join('/');
    if (!baseUrl) return encoded;
    return String(baseUrl).replace(/\/$/, '') + '/' + encoded;
  }

  return {
    AUDIO_EXTS: AUDIO_EXTS,
    VIDEO_EXTS: VIDEO_EXTS,
    extOf: extOf,
    kindFromName: kindFromName,
    naturalCompare: naturalCompare,
    groupCatalog: groupCatalog,
    flattenKind: flattenKind,
    matchesQuery: matchesQuery,
    resolveSrc: resolveSrc
  };
});
