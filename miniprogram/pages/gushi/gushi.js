/* 一年级必背古诗 70 首 · 微信小程序页 */
var gushiCatalog = require('../../shared/gushi-catalog.js');
var poemsData = require('../../shared/poems-data.js');
var platform = require('../../shared/platform.js');
var config = require('../../shared/config.js');
var offlineStore = require('../../shared/offline-store.js');
var navMetrics = require('../../shared/nav-metrics.js');

var RATE_KEY = 'gushi_rate';
var PLAY_MODE_KEY = 'gushi_play_mode';
var LAST_POEM_KEY = 'gushi_last_index';

var PLAY_MODE_ICONS = {
  'sequence': '⇥',
  'loop-all': '🔁',
  'loop-one': '🔂',
  'shuffle': '🔀'
};

/* 真机上音频起不来时，把 InnerAudioContext 的报错翻成人能看懂的一句话。
 * errCode 是微信定的：10002 网络、10003 文件、10004 格式、-1 未知。 */
function describeAudioError(err) {
  var text = err ? String(err.errMsg || '') : '';
  var code = err ? Number(err.errCode) : 0;
  if (/domain|合法域名|url not in|urlCheck/i.test(text)) {
    return '音频域名未加入小程序 downloadFile 合法域名';
  }
  if (code === 10002 || /network|timeout|time ?out|net::/i.test(text)) {
    return '朗读音频下载失败，请检查手机网络';
  }
  if (code === 10004 || code === 10003 || /format|decode|unsupport|不支持/i.test(text)) {
    return '当前机型无法解码这段朗读音频';
  }
  return '朗读音频加载失败' + (text ? '（' + text.slice(0, 60) + '）' : '，请点播放重试');
}

/* downloadFile 的报错比 InnerAudioContext 的 10002 具体得多，单独翻译。 */
function describeDownloadError(err) {
  var msg = err ? String(err.errMsg || '') : '';
  if (/domain|合法域名|not in|urlCheck/i.test(msg)) {
    return '域名未配置：把 goodgoodstudy-daydayup.pages.dev 加进小程序 downloadFile 合法域名';
  }
  if (/timeout|time ?out/i.test(msg)) return '下载朗读音频超时，请检查手机网络';
  return '朗读音频下载失败' + (msg ? '（' + msg.slice(0, 70) + '）' : '');
}

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
    seekPercent: 0,
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
    offlineNote: '',
    audioError: '',
    navHeight: navMetrics.FALLBACK_STATUS + navMetrics.FALLBACK_CONTENT
  },

  onLoad: function (options) {
    this.setData({ navHeight: navMetrics.metrics().navHeight });
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
    /* iOS 真机侧边的静音键会让 InnerAudioContext 静音，PC 模拟器不受影响。
     * 朗读必须出声，所以忽略静音开关；要在第一次 play 之前设置。 */
    try { audio.obeyMuteSwitch = false; } catch (e) {}
    try { audio.autoplay = false; } catch (e) {}
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
        /* cur 必须先算出来：早先 seekEcho(cur) 用的是提升后的 undefined，
         * 会把跳转后的进度事件整段吞掉，进度条看起来就像卡死了。 */
        var cur = Number(audio.currentTime) || 0;
        if (self.scrubbing || self.seekEcho(cur)) return;
        var dur = Number(audio.duration) || (self.data.poem && self.data.poem.audioDuration) || 0;
        var lineTimes = (self.data.poem && self.data.poem.lineTimes) || [];
        self.markAudioReady();
        self.setData({
          currentTime: cur,
          duration: dur,
          seekPercent: self.seekPercentOf(cur, dur),
          curClock: gushiCatalog.formatClock(cur),
          durClock: gushiCatalog.formatClock(dur),
          activeLine: gushiCatalog.activeLineIndex(lineTimes, cur, false)
        });
      });
    }
    if (typeof audio.onCanplay === 'function') {
      audio.onCanplay(function () {
        self.markAudioReady();
        /* 真机上 stop() → src → play() 有竞态，第一次 play 可能被吞掉。
         * 音频真正可播时补一次，play 本身是幂等的。 */
        if (self._wantPlay) self.playAudio();
      });
    }
    if (typeof audio.onError === 'function') {
      audio.onError(function (err) { self.onAudioError(err); });
    }
    this.audio = audio;
    return audio;
  },

  destroyAudio: function () {
    this.clearAudioWatch();
    this._wantPlay = false;
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
    this.scrubbing = false;
    this.seekHoldUntil = 0;

    var loopOrRandom = this.data.playMode !== 'sequence' && this.rawPoems.length > 1;
    this.setData({
      view: 'poem',
      index: clamped,
      poem: enriched,
      activeLine: -1,
      playing: false,
      currentTime: 0,
      duration: dur,
      seekPercent: 0,
      curClock: '0:00',
      durClock: gushiCatalog.formatClock(dur),
      prevDisabled: !loopOrRandom && clamped <= 0,
      nextDisabled: !loopOrRandom && clamped >= this.rawPoems.length - 1,
      catalogOpen: false,
      offlineNote: '',
      audioError: ''
    });
    if (this.storage) this.storage.set(LAST_POEM_KEY, clamped);

    var audio = this.ensureAudio();
    var localSrc = '';
    if (this.offline && enriched.id) {
      try { localSrc = this.offline.lookup(enriched.id) || ''; } catch (e) { localSrc = ''; }
    }
    this._remoteAudio = enriched.audioUrl;
    this._poemId = enriched.id;
    this._usingLocalSrc = Boolean(localSrc);
    this._fallbackStage = 0;
    this._audioReady = false;
    this._wantPlay = Boolean(autoplay);
    this.clearAudioWatch();
    if (localSrc) this.setData({ offlineNote: '正在使用本机缓存' });
    if (audio) {
      try { audio.stop(); } catch (e) {}
      audio.src = localSrc || enriched.audioUrl;
      this.applyRate(audio);
      if (autoplay) this.playAudio();
    }
  },

  /* 所有播放入口都走这里，统一倍速、状态和失败看门狗。 */
  playAudio: function () {
    var audio = this.audio;
    if (!audio) return;
    this._wantPlay = true;
    this.applyRate(audio);
    try { audio.play(); } catch (e) {}
    this.setData({ playing: true, audioError: '' });
    this.armAudioWatch();
  },

  applyRate: function (audio) {
    if (!audio) return;
    var rate = Number(this.data.rate) || 1;
    /* 部分真机基础库只认 0.5~2，超出范围就按原速播 */
    if (rate < 0.5 || rate > 2) rate = 1;
    try { audio.playbackRate = rate; } catch (e) {}
  },

  markAudioReady: function () {
    this._audioReady = true;
    this.clearAudioWatch();
    /* 已经失败并停在错误态时，别让迟到的 onCanplay 把提示抹掉 */
    if (this.data.audioError && this._wantPlay) this.setData({ audioError: '' });
  },

  onAudioError: function (err) {
    /* 三级兜底：本机缓存 → 网络流式 → 下载到本机再播。
     * 真机流式播放常因域名或服务器不支持 Range 报 10002，
     * 整文件下载后播本地路径能绕开；下载失败则把真实原因显示出来。 */
    if (this._usingLocalSrc && this._remoteAudio && this.audio) {
      this._usingLocalSrc = false;
      this._audioReady = false;
      if (this.offline && typeof this.offline.forget === 'function') {
        try { this.offline.forget(this._poemId); } catch (e) {}
      }
      this.setData({ offlineNote: '本机缓存不可播，已改用网络音频' });
      try {
        this.audio.src = this._remoteAudio;
        this.applyRate(this.audio);
        this.audio.play();
      } catch (e) {}
      this.armAudioWatch();
      return;
    }
    if (this._fallbackStage < 2 && this._remoteAudio && this.audio) {
      this._fallbackStage = 2;
      this.tryDownloadAndPlay();
      return;
    }
    this.failAudio(describeAudioError(err));
  },

  tryDownloadAndPlay: function () {
    var self = this;
    if (typeof wx === 'undefined' || typeof wx.downloadFile !== 'function' || !this._remoteAudio) {
      this.failAudio('朗读音频加载失败，且当前环境不支持下载重试');
      return;
    }
    this.clearAudioWatch();
    this.setData({ audioError: '正在重新下载朗读音频…' });
    wx.downloadFile({
      url: this._remoteAudio,
      timeout: 15000,
      success: function (res) {
        if (!res || res.statusCode !== 200 || !res.tempFilePath) {
          self.failAudio('朗读音频下载返回异常（HTTP ' + (res && res.statusCode) + '）');
          return;
        }
        self._audioReady = false;
        try {
          self.audio.src = res.tempFilePath;
          self.applyRate(self.audio);
          self.setData({ audioError: '', offlineNote: '已改用下载后的本机音频' });
          self.playAudio();
        } catch (e) {
          self.failAudio('下载成功但本机音频仍无法播放');
        }
      },
      fail: function (err) {
        self.failAudio(describeDownloadError(err));
      }
    });
  },

  /* 红条可直接点：用户手动重试时把三级兜底重新放开 */
  onRetryAudio: function () {
    if (!this.audio || !this._remoteAudio) return;
    this._fallbackStage = 0;
    this._usingLocalSrc = false;
    this._audioReady = false;
    try { this.audio.src = this._remoteAudio; } catch (e) {}
    this.playAudio();
  },

  failAudio: function (tip) {
    this.clearAudioWatch();
    this._wantPlay = false;
    this.setData({ playing: false, audioError: tip || '朗读音频加载失败，请点播放重试' });
    if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
      wx.showToast({ title: '朗读加载失败', icon: 'none', duration: 2200 });
    }
  },

  /* 真机上音频可能因域名、格式或竞态悄悄不播。10 秒还没有任何进度就给个明确提示。 */
  armAudioWatch: function () {
    var self = this;
    this.clearAudioWatch();
    this._audioTimer = setTimeout(function () {
      self._audioTimer = null;
      if (!self._wantPlay || self._audioReady || self.data.audioError) return;
      self.failAudio('朗读一直没开始播放，请检查手机网络或静音开关');
    }, 10000);
  },

  clearAudioWatch: function () {
    if (this._audioTimer) {
      clearTimeout(this._audioTimer);
      this._audioTimer = null;
    }
  },

  retainCurrent: function () {
    if (!this.offline || !this._poemId || !this._remoteAudio) return;
    if (this._usingLocalSrc) return;
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
    this._wantPlay = false;
    this.clearAudioWatch();
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
      this.seekHoldUntil = 0;
      this.setData({ currentTime: 0, seekPercent: 0, curClock: '0:00', activeLine: -1 });
      if (audio) {
        try { audio.seek(0); } catch (e) {}
        this.playAudio();
      }
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
      this._wantPlay = false;
      this.clearAudioWatch();
      this.setData({ playing: false });
    } else {
      this._fallbackStage = 0;
      this._usingLocalSrc = false;
      this.playAudio();
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
      if (!this.data.playing) this.playAudio();
    }
    this.seekHoldTime = target;
    this.seekHoldUntil = Date.now() + 1500;
    this.setData({
      currentTime: target,
      seekPercent: this.seekPercentOf(target, this.data.duration),
      curClock: gushiCatalog.formatClock(target),
      activeLine: idx
    });
  },

  seekPercentOf: function (cur, dur) {
    var duration = Number(dur) || 0;
    var time = Number(cur) || 0;
    if (!(duration > 0)) return 0;
    return Math.round(Math.min(1, Math.max(0, time / duration)) * 10000) / 100;
  },

  seekEcho: function (time) {
    if (!this.seekHoldUntil) return false;
    if (Date.now() >= this.seekHoldUntil) {
      this.seekHoldUntil = 0;
      return false;
    }
    if (Math.abs((Number(time) || 0) - (Number(this.seekHoldTime) || 0)) <= 1.5) {
      this.seekHoldUntil = 0;
      return false;
    }
    return true;
  },

  placeSeek: function (touch, commit) {
    var rect = this._seekRect;
    var duration = Number(this.data.duration) || 0;
    if (!touch || !rect || !(rect.width > 0) || !(duration > 0)) {
      if (commit) this.scrubbing = false;
      return;
    }
    var x = Number(touch.clientX);
    if (!(x >= 0)) x = Number(touch.pageX) || 0;
    var ratio = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
    var val = ratio * duration;
    var lineTimes = (this.data.poem && this.data.poem.lineTimes) || [];
    this.setData({
      seekPercent: Math.round(ratio * 10000) / 100,
      curClock: gushiCatalog.formatClock(val)
    });
    if (!commit) return;
    this.scrubbing = false;
    this.seekHoldTime = val;
    this.seekHoldUntil = Date.now() + 1500;
    if (this.audio && typeof this.audio.seek === 'function') this.audio.seek(val);
    this.setData({
      currentTime: val,
      seekPercent: this.seekPercentOf(val, duration),
      curClock: gushiCatalog.formatClock(val),
      activeLine: gushiCatalog.activeLineIndex(lineTimes, val, false)
    });
  },

  onSeekTouchStart: function (event) {
    if (!(Number(this.data.duration) > 0)) return;
    this.scrubbing = true;
    this._seekCommit = false;
    this._seekRect = null;
    var touch = event.touches && event.touches[0];
    this._pendingSeekTouch = touch || null;
    var self = this;
    if (typeof wx === 'undefined' || typeof wx.createSelectorQuery !== 'function') return;
    wx.createSelectorQuery().in(this).select('.seek-track').boundingClientRect(function (rect) {
      self._seekRect = rect;
      if (self._pendingSeekTouch) self.placeSeek(self._pendingSeekTouch, Boolean(self._seekCommit));
    }).exec();
  },

  onSeekTouchMove: function (event) {
    if (!this.scrubbing) return;
    var touch = event.touches && event.touches[0];
    if (!touch) return;
    this._pendingSeekTouch = touch;
    if (this._seekRect) this.placeSeek(touch, false);
  },

  onSeekTouchEnd: function (event) {
    var touch = (event.changedTouches && event.changedTouches[0]) || this._pendingSeekTouch;
    if (touch) this._pendingSeekTouch = touch;
    this._seekCommit = true;
    if (this._seekRect && touch) this.placeSeek(touch, true);
    else if (this._seekRect) this.scrubbing = false;
  },

  onCycleRate: function () {
    var next = gushiCatalog.nextRate(this.data.rate);
    if (this.storage) this.storage.set(RATE_KEY, next);
    this.setData({
      rate: next,
      rateLabel: (next === 1 ? '1' : next) + '×'
    });
    this.applyRate(this.audio);
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
    this._wantPlay = false;
    this.clearAudioWatch();
  },

  onUnload: function () {
    this.destroyAudio();
  }
});
