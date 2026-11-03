/* 离线缓存淘汰。音频尽量保留，视频只留最近几条，总容量有上限。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OfflinePolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var LIMITS = {
    videoCount: 3,
    totalBytes: 120 * 1024 * 1024
  };

  function bytesOf(entries) {
    return (entries || []).reduce(function (sum, entry) {
      return sum + (Number(entry && entry.bytes) || 0);
    }, 0);
  }

  function byOldest(list) {
    return list.slice().sort(function (a, b) {
      return (Number(a.lastUsed) || 0) - (Number(b.lastUsed) || 0);
    });
  }

  function plan(entries, incoming, limits) {
    var caps = limits || LIMITS;
    var next = [];
    (entries || []).forEach(function (entry) {
      if (!entry || !entry.id || entry.id === incoming.id) return;
      next.push(entry);
    });
    next.push(incoming);
    var evict = [];
    var videos = next.filter(function (entry) { return entry.kind === 'video'; })
      .sort(function (a, b) { return (Number(b.lastUsed) || 0) - (Number(a.lastUsed) || 0); });
    videos.slice(Math.max(0, caps.videoCount)).forEach(function (entry) { evict.push(entry); });
    var dropped = {};
    evict.forEach(function (entry) { dropped[entry.id] = true; });
    var kept = next.filter(function (entry) { return !dropped[entry.id]; });
    var guard = 0;
    while (bytesOf(kept) > caps.totalBytes && kept.length > 1 && guard < 1000) {
      guard += 1;
      var audios = byOldest(kept.filter(function (entry) {
        return entry.kind !== 'video' && entry.id !== incoming.id;
      }));
      var candidate = audios[0];
      if (!candidate) {
        candidate = byOldest(kept.filter(function (entry) {
          return entry.id !== incoming.id;
        }))[0];
      }
      if (!candidate) break;
      evict.push(candidate);
      dropped[candidate.id] = true;
      kept = kept.filter(function (entry) { return entry.id !== candidate.id; });
    }
    return { keep: kept, evict: evict };
  }

  return {
    LIMITS: LIMITS,
    bytesOf: bytesOf,
    plan: plan
  };
});
