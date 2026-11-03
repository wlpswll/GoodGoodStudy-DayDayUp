/* 断点进度与播放模式。网页和小程序读写同一份快照与播放模式规则。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EnglishProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var PROGRESS_KEY = 'english-player-progress-v1';
  var DEFAULT_RATE = 1;
  var RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

  var PLAY_MODES = ['sequence', 'loop-all', 'loop-one', 'shuffle'];
  var DEFAULT_PLAY_MODE = 'sequence';
  var PLAY_MODE_LABELS = {
    'sequence': '顺序播放',
    'loop-all': '列表循环',
    'loop-one': '单曲循环',
    'shuffle': '随机播放'
  };

  function normalizePlayMode(mode) {
    var m = String(mode || '');
    return PLAY_MODES.indexOf(m) >= 0 ? m : DEFAULT_PLAY_MODE;
  }

  function nextPlayMode(mode) {
    var cur = normalizePlayMode(mode);
    var idx = PLAY_MODES.indexOf(cur);
    return PLAY_MODES[(idx + 1) % PLAY_MODES.length];
  }

  function formatPlayMode(mode) {
    var cur = normalizePlayMode(mode);
    return PLAY_MODE_LABELS[cur] || PLAY_MODE_LABELS[DEFAULT_PLAY_MODE];
  }

  /* 根据播放模式计算下一项索引：
   * - reason: 'ended'（自然播完） | 'next'（手动点下一首） | 'prev'（手动点上一首）
   * - 返回 { index: number, replay: boolean }，index 为 -1 表示播完停止
   */
  function pickNextIndex(currentIndex, total, mode, reason, randFn) {
    var n = Number(total) || 0;
    if (n <= 0) return { index: -1, replay: false };
    var cur = Math.max(0, Math.min(n - 1, Number(currentIndex) || 0));
    var m = normalizePlayMode(mode);
    var why = reason || 'ended';

    if (why === 'ended' && m === 'loop-one') {
      return { index: cur, replay: true };
    }

    if (m === 'shuffle') {
      if (n === 1) {
        return { index: 0, replay: why === 'ended' };
      }
      var rng = typeof randFn === 'function' ? randFn : Math.random;
      var offset = 1 + Math.floor(rng() * (n - 1));
      return { index: (cur + offset) % n, replay: false };
    }

    var delta = why === 'prev' ? -1 : 1;
    var next = cur + delta;
    if (next >= 0 && next < n) {
      return { index: next, replay: false };
    }

    if (m === 'loop-all' || m === 'loop-one') {
      var wrapped = next < 0 ? (n - 1) : 0;
      return { index: wrapped, replay: n === 1 };
    }

    return { index: -1, replay: false };
  }

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

  function createSnapshot(media, currentTime, playbackRate, updatedAt, playMode) {
    var time = Number(currentTime);
    if (!isFinite(time) || time < 0) time = 0;
    var snap = {
      version: 1,
      mediaId: media && media.id ? String(media.id) : '',
      kind: media && media.kind === 'video' ? 'video' : 'audio',
      currentTime: time,
      playbackRate: normalizeRate(playbackRate),
      updatedAt: updatedAt == null ? Date.now() : Number(updatedAt) || 0
    };
    if (playMode != null) snap.playMode = normalizePlayMode(playMode);
    return snap;
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
      playMode: normalizePlayMode(raw.playMode),
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
    var mode = snapshot.playMode != null ? normalizePlayMode(snapshot.playMode) : (previous ? previous.playMode : DEFAULT_PLAY_MODE);
    storage.set(PROGRESS_KEY, {
      version: 1,
      mediaId: mediaId,
      kind: kind,
      currentTime: time,
      playbackRate: normalizeRate(snapshot.playbackRate),
      playMode: mode,
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
      playMode: normalizePlayMode(progress.playMode),
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
    PLAY_MODES: PLAY_MODES,
    DEFAULT_PLAY_MODE: DEFAULT_PLAY_MODE,
    PLAY_MODE_LABELS: PLAY_MODE_LABELS,
    normalizePlayMode: normalizePlayMode,
    nextPlayMode: nextPlayMode,
    formatPlayMode: formatPlayMode,
    pickNextIndex: pickNextIndex,
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
