/* 一年级必背古诗 70 首 · 微信小程序页 */
var gushiCatalog = require('../../shared/gushi-catalog.js');
var poemsData = require('../../shared/poems-data.js');
var platform = require('../../shared/platform.js');
var config = require('../../shared/config.js');
var offlineStore = require('../../shared/offline-store.js');

var RATE_KEY = 'gushi_rate';
var PLAY_MODE_KEY = 'gushi_play_mode';
var LAST_POEM_KEY = 'gushi_last_index';

var PLAY_MODE_ICONS = {
  'sequence': '⇥',
  'loop-all': '🔁',
  'loop-one': '🔂',
  'shuffle': '🔀'
};

Page({
  data: {
    gushiBaseUrl: config.GUSHI_BASE_URL,
    view: 'cover',
    total: 0,
    index: 0,
    poem: null,
    activeLine: -1,
    playing: false,
    currentTime: 0,
    duration: 0,
    curClock: '0:00',
    durClock: '0:00',
    rate: gushiCatalog.DEFAULT_RATE,
    rateLabel: gushiCatalog.DEFAULT_RATE + '×',
    playMode: gushiCatalog.DEFAULT_PLAY_MODE,
    playModeLabel: gushiCatalog.formatPlayMode(gushiCatalog.DEFAULT_PLAY_MODE),
    playModeIcon: PLAY_MODE_ICONS[gushiCatalog.DEFAULT_PLAY_MODE],
    prevDisabled: true,
    nextDisabled: false,
    catalogOpen: false,
    query: '',
    groups: [],
    offlineNote: ''
  },

  onLoad: function (options) {
    var storage = platform.createStorage({ wx: typeof wx !== 'undefined' ? wx : null });
    this.storage = storage;
    this.offline = offlineStore.createMiniOffline({ wx: typeof wx !== 'undefined' ? wx : null });
    this.rawPoems = (poemsData && poemsData.poems) || [];
    var savedRate = storage.get(RATE_KEY);
    var rate = gushiCatalog.normalizeRate(savedRate != null ? savedRate : gushiCatalog.DEFAULT_RATE);
    var savedMode = storage.get(PLAY_MODE_KEY);
    var playMode = gushiCatalog.normalizePlayMode(savedMode || gushiCatalog.DEFAULT_PLAY_MODE);

    this.setData({
      total: this.rawPoems.length,
      rate: rate,
      rateLabel: (rate === 1 ? '1' : rate) + '×',
      playMode: playMode,
      playModeLabel: gushiCatalog.formatPlayMode(playMode),
      playModeIcon: PLAY_MODE_ICONS[playMode] || '⇥',
      groups: gushiCatalog.groupByDynasty(this.rawPoems, '')
    });

    if (options && options.no) {
      var targetNo = parseInt(options.no, 10);
      var foundIdx = -1;
      this.rawPoems.forEach(function (p, i) {
        if (p.no === targetNo) foundIdx = i;
      });
      if (foundIdx >= 0) this.openPoem(foundIdx, false);
    }
  },

  ensureAudio: function () {
    if (this.audio) return this.audio;
    if (typeof wx === 'undefined' || typeof wx.createInnerAudioContext !== 'function') return null;
    var self = this;
    var audio = wx.createInnerAudioContext();
    if (typeof audio.onPlay === 'function') {
      audio.onPlay(function () {
        self.setData({ playing: true });
        self.retainCurrent();
      });
    }
    if (typeof audio.onPause === 'function') {
      audio.onPause(function () { self.setData({ playing: false }); });
    }
    if (typeof audio.onStop === 'function') {
      audio.onStop(function () { self.setData({ playing: false }); });
    }
    if (typeof audio.onEnded === 'function') {
      audio.onEnded(function () {
        self.setData({ playing: false, activeLine: -1 });
        self.stepPoem(1, true);
      });
    }
    if (typeof audio.onTimeUpdate === 'function') {
      audio.onTimeUpdate(function () {
        if (self.scrubbing) return;
        var cur = Number(audio.currentTime) || 0;
        var dur = Number(audio.duration) || (self.data.poem && self.data.poem.audioDuration) || 0;
        var lineTimes = (self.data.poem && self.data.poem.lineTimes) || [];
        self.setData({
          currentTime: cur,
          duration: dur,
          curClock: gushiCatalog.formatClock(cur),
          durClock: gushiCatalog.formatClock(dur),
          activeLine: gushiCatalog.activeLineIndex(lineTimes, cur, false)
        });
      });
    }
    this.audio = audio;
    return audio;
  },

  destroyAudio: function () {
    if (!this.audio) return;
    try { this.audio.stop(); } catch (e) {}
    try { this.audio.destroy(); } catch (e) {}
    this.audio = null;
  },

  openPoem: function (index, autoplay) {
    if (!this.rawPoems || !this.rawPoems.length) return;
    var clamped = Math.max(0, Math.min(this.rawPoems.length - 1, index));
    var raw = this.rawPoems[clamped];
    var enriched = gushiCatalog.enrichPoem(raw, this.data.gushiBaseUrl);
    var dur = enriched.audioDuration || 0;

    var loopOrRandom = this.data.playMode !== 'sequence' && this.rawPoems.length > 1;
    this.setData({
      view: 'poem',
      index: clamped,
      poem: enriched,
      activeLine: -1,
      playing: false,
      currentTime: 0,
      duration: dur,
      curClock: '0:00',
      durClock: gushiCatalog.formatClock(dur),
      prevDisabled: !loopOrRandom && clamped <= 0,
      nextDisabled: !loopOrRandom && clamped >= this.rawPoems.length - 1,
      catalogOpen: false,
      offlineNote: ''
    });
    if (this.storage) this.storage.set(LAST_POEM_KEY, clamped);

    var audio = this.ensureAudio();
    var localSrc = '';
    if (this.offline && enriched.id) {
      try { localSrc = this.offline.lookup(enriched.id) || ''; } catch (e) { localSrc = ''; }
    }
    this._remoteAudio = enriched.audioUrl;
    this._poemId = enriched.id;
    if (localSrc) this.setData({ offlineNote: '正在使用本机缓存' });
    if (audio) {
      try { audio.stop(); } catch (e) {}
      audio.src = localSrc || enriched.audioUrl;
      try { audio.playbackRate = this.data.rate; } catch (e) {}
      if (autoplay) {
        try { audio.play(); } catch (e) {}
        this.setData({ playing: true });
      }
    }
  },

  retainCurrent: function () {
    if (!this.offline || !this._poemId || !this._remoteAudio) return;
    var self = this;
    this.offline.retain(this._poemId, this._remoteAudio, { app: 'gushi', kind: 'audio' }).then(function (path) {
      if (path) self.setData({ offlineNote: '已保存到本机，断网后仍可播放' });
    });
  },

  onStart: function () {
    var savedIdx = this.storage ? this.storage.get(LAST_POEM_KEY) : 0;
    var idx = Number.isInteger(savedIdx) && savedIdx >= 0 && savedIdx < this.rawPoems.length ? savedIdx : 0;
    this.openPoem(idx, true);
  },

  goCover: function () {
    if (this.audio) {
      try { this.audio.stop(); } catch (e) {}
    }
    this.setData({ view: 'cover', playing: false, catalogOpen: false });
  },

  goHome: function () {
    if (typeof wx === 'undefined') return;
    var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    if (pages && pages.length > 1 && typeof wx.navigateBack === 'function') {
      wx.navigateBack({ delta: 1 });
    } else if (typeof wx.reLaunch === 'function') {
      wx.reLaunch({ url: '/pages/home/home' });
    }
  },

  stepPoem: function (delta, fromEnded) {
    if (!this.rawPoems || !this.rawPoems.length) return;
    var reason = fromEnded ? 'ended' : (delta < 0 ? 'prev' : 'next');
    var decision = gushiCatalog.pickNextIndex(this.data.index, this.rawPoems.length, this.data.playMode, reason);
    if (decision.index < 0) return;
    if (decision.replay) {
      var audio = this.ensureAudio();
      if (audio) {
        try { audio.seek(0); } catch (e) {}
        try { audio.play(); } catch (e) {}
      }
      this.setData({ currentTime: 0, curClock: '0:00', activeLine: -1, playing: true });
      return;
    }
    this.openPoem(decision.index, fromEnded ? true : this.data.playing);
  },

  onPrev: function () {
    this.stepPoem(-1, false);
  },

  onNext: function () {
    this.stepPoem(1, false);
  },

  onCyclePlayMode: function () {
    var nextMode = gushiCatalog.nextPlayMode(this.data.playMode);
    if (this.storage) this.storage.set(PLAY_MODE_KEY, nextMode);
    var loopOrRandom = nextMode !== 'sequence' && this.rawPoems.length > 1;
    this.setData({
      playMode: nextMode,
      playModeLabel: gushiCatalog.formatPlayMode(nextMode),
      playModeIcon: PLAY_MODE_ICONS[nextMode] || '⇥',
      prevDisabled: !loopOrRandom && this.data.index <= 0,
      nextDisabled: !loopOrRandom && this.data.index >= this.rawPoems.length - 1
    });
    if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
      wx.showToast({ title: gushiCatalog.formatPlayMode(nextMode), icon: 'none', duration: 900 });
    }
  },

  onTogglePlay: function () {
    var audio = this.ensureAudio();
    if (!audio) return;
    if (this.data.playing) {
      audio.pause();
      this.setData({ playing: false });
    } else {
      try { audio.playbackRate = this.data.rate; } catch (e) {}
      audio.play();
      this.setData({ playing: true });
    }
  },

  onLineTap: function (event) {
    var idx = Number(event.currentTarget.dataset.index);
    var times = (this.data.poem && this.data.poem.lineTimes) || [];
    if (times[idx] == null) return;
    var target = Number(times[idx]) || 0;
    var audio = this.ensureAudio();
    if (audio && typeof audio.seek === 'function') {
      audio.seek(target);
      if (!this.data.playing) {
        audio.play();
        this.setData({ playing: true });
      }
    }
    this.setData({
      currentTime: target,
      curClock: gushiCatalog.formatClock(target),
      activeLine: idx
    });
  },

  onSeekChanging: function (event) {
    this.scrubbing = true;
    var val = Number(event.detail && event.detail.value) || 0;
    this.setData({
      currentTime: val,
      curClock: gushiCatalog.formatClock(val)
    });
  },

  onSeekChange: function (event) {
    this.scrubbing = false;
    var val = Number(event.detail && event.detail.value) || 0;
    var lineTimes = (this.data.poem && this.data.poem.lineTimes) || [];
    if (this.audio && typeof this.audio.seek === 'function') {
      this.audio.seek(val);
    }
    this.setData({
      currentTime: val,
      curClock: gushiCatalog.formatClock(val),
      activeLine: gushiCatalog.activeLineIndex(lineTimes, val, false)
    });
  },

  onCycleRate: function () {
    var next = gushiCatalog.nextRate(this.data.rate);
    if (this.audio) {
      try { this.audio.playbackRate = next; } catch (e) {}
    }
    if (this.storage) this.storage.set(RATE_KEY, next);
    this.setData({
      rate: next,
      rateLabel: (next === 1 ? '1' : next) + '×'
    });
  },

  openCatalog: function () {
    this.setData({
      catalogOpen: true,
      query: '',
      groups: gushiCatalog.groupByDynasty(this.rawPoems, '')
    });
  },

  closeCatalog: function () {
    this.setData({ catalogOpen: false });
  },

  onMaskTap: function () {
    this.closeCatalog();
  },

  noop: function () {},

  onSearchInput: function (event) {
    var q = (event.detail && event.detail.value) || '';
    this.setData({
      query: q,
      groups: gushiCatalog.groupByDynasty(this.rawPoems, q)
    });
  },

  onPickPoem: function (event) {
    var idx = Number(event.currentTarget.dataset.index);
    if (Number.isInteger(idx)) {
      this.openPoem(idx, this.data.playing);
    }
  },

  onTouchStart: function (event) {
    var touch = event.touches && event.touches[0];
    if (!touch) return;
    this.tsY = touch.clientY;
    this.tsX = touch.clientX;
  },

  onTouchEnd: function (event) {
    var touch = event.changedTouches && event.changedTouches[0];
    if (!touch || !this.tsY) return;
    var dy = this.tsY - touch.clientY;
    var dx = this.tsX - touch.clientX;
    this.tsY = 0;
    if (Math.abs(dy) < 60 || Math.abs(dy) < Math.abs(dx) * 1.3) return;
    if (dy > 0) this.onNext();
    else this.onPrev();
  },

  onHide: function () {
    if (this.audio && this.data.playing) {
      try { this.audio.pause(); } catch (e) {}
      this.setData({ playing: false });
    }
  },

  onUnload: function () {
    this.destroyAudio();
  }
});
