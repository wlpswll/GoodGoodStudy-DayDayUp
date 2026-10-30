/* 断点进度。网页和小程序读写同一份快照。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EnglishProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var PROGRESS_KEY = 'english-player-progress-v1';
  var DEFAULT_RATE = 1;
  var RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

  function normalizeRate(rate) {
    var value = Number(rate);
    if (!isFinite(value)) return DEFAULT_RATE;
    for (var i = 0; i < RATES.length; i++) {
      if (Math.abs(RATES[i] - value) < 0.001) return RATES[i];
    }
    return DEFAULT_RATE;
  }

  function formatRate(rate) {
    var value = normalizeRate(rate);
    return String(value) + '×';
  }

  function formatClock(seconds) {
    var safe = Number(seconds);
    if (!isFinite(safe) || safe < 0) safe = 0;
    var whole = Math.floor(safe);
    var minute = Math.floor(whole / 60);
    var second = whole % 60;
    return minute + ':' + (second < 10 ? '0' : '') + second;
  }

  function createSnapshot(media, currentTime, playbackRate, updatedAt) {
    var time = Number(currentTime);
    if (!isFinite(time) || time < 0) time = 0;
    return {
      version: 1,
      mediaId: media && media.id ? String(media.id) : '',
      kind: media && media.kind === 'video' ? 'video' : 'audio',
      currentTime: time,
      playbackRate: normalizeRate(playbackRate),
      updatedAt: updatedAt == null ? Date.now() : Number(updatedAt) || 0
    };
  }

  function positionEntry(entry, fallbackKind) {
    if (!entry) return null;
    var time = Number(entry.currentTime);
    if (!isFinite(time) || time < 0) time = 0;
    return {
      currentTime: time,
      kind: entry.kind === 'video' || fallbackKind === 'video' ? 'video' : 'audio',
      updatedAt: Number(entry.updatedAt) || 0
    };
  }

  function readPositions(raw) {
    var positions = {};
    var source = raw && raw.positions;
    if (source && typeof source === 'object') {
      Object.keys(source).forEach(function (id) {
        var entry = positionEntry(source[id]);
        if (entry) positions[String(id)] = entry;
      });
    }
    if (raw && raw.mediaId && !positions[String(raw.mediaId)]) {
      positions[String(raw.mediaId)] = positionEntry(raw, raw.kind);
    }
    return positions;
  }

  function readProgress(storage) {
    if (!storage || typeof storage.get !== 'function') return null;
    var raw;
    try { raw = storage.get(PROGRESS_KEY); } catch (err) { return null; }
    if (!raw || raw.version !== 1 || !raw.mediaId) return null;
    return {
      version: 1,
      mediaId: String(raw.mediaId),
      kind: raw.kind === 'video' ? 'video' : 'audio',
      currentTime: Math.max(0, Number(raw.currentTime) || 0),
      playbackRate: normalizeRate(raw.playbackRate),
      updatedAt: Number(raw.updatedAt) || 0,
      positions: readPositions(raw)
    };
  }

  function writeProgress(storage, snapshot) {
    if (!storage || typeof storage.set !== 'function') return false;
    if (!snapshot || !snapshot.mediaId) return false;
    var previous = readProgress(storage);
    var positions = {};
    var prior = previous && previous.positions;
    if (prior) {
      Object.keys(prior).forEach(function (id) { positions[id] = prior[id]; });
    }
    var mediaId = String(snapshot.mediaId);
    var kind = snapshot.kind === 'video' ? 'video' : 'audio';
    var time = Number(snapshot.currentTime);
    if (!isFinite(time) || time < 0) time = 0;
    positions[mediaId] = {
      currentTime: time,
      kind: kind,
      updatedAt: Number(snapshot.updatedAt) || 0
    };
    storage.set(PROGRESS_KEY, {
      version: 1,
      mediaId: mediaId,
      kind: kind,
      currentTime: time,
      playbackRate: normalizeRate(snapshot.playbackRate),
      updatedAt: Number(snapshot.updatedAt) || 0,
      positions: positions
    });
    return true;
  }

  function timeFor(progress, mediaId) {
    if (!progress || !mediaId || !progress.positions) return 0;
    var entry = progress.positions[String(mediaId)];
    return entry ? entry.currentTime : 0;
  }

  function resolveResume(progress, items) {
    if (!progress) return null;
    var found = null;
    (items || []).some(function (item) {
      if (item && item.id === progress.mediaId) {
        found = item;
        return true;
      }
      return false;
    });
    return {
      media: found,
      currentTime: found ? progress.currentTime : 0,
      playbackRate: normalizeRate(progress.playbackRate),
      missing: !found
    };
  }

  /* 已经播完的媒体下次从 0 开始，避免停在结尾按播放没有反应。 */
  function clampResumeTime(currentTime, duration) {
    var time = Number(currentTime);
    if (!isFinite(time) || time < 0) time = 0;
    if (!isFinite(duration) || duration <= 0) return time;
    if (time >= duration - 0.75) return 0;
    return Math.min(time, Math.max(0, duration - 0.25));
  }

  return {
    PROGRESS_KEY: PROGRESS_KEY,
    DEFAULT_RATE: DEFAULT_RATE,
    RATES: RATES,
    normalizeRate: normalizeRate,
    formatRate: formatRate,
    formatClock: formatClock,
    createSnapshot: createSnapshot,
    readProgress: readProgress,
    writeProgress: writeProgress,
    timeFor: timeFor,
    resolveResume: resolveResume,
    clampResumeTime: clampResumeTime
  };
});
