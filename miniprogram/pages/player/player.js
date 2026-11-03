/* 英语跟读 · 微信小程序页（与 H5 端 english/index.html 视图、目录折叠、搜索、播放控制与播放模式完全对齐） */
var catalog = require('../../shared/catalog.js');
var progress = require('../../shared/progress.js');
var platform = require('../../shared/platform.js');
var mediaData = require('../../shared/media-data.js');
var config = require('../../shared/config.js');
var adapter = require('../../player-adapter.js');
var offlineStore = require('../../shared/offline-store.js');

var PLAY_MODE_ICONS = {
  'sequence': '⇥',
  'loop-all': '🔁',
  'loop-one': '🔂',
  'shuffle': '🔀'
};

Page({
  data: {
    mediaBaseUrl: config.ENGLISH_BASE_URL,
    view: 'library', // 'library' | 'player'
    totalCount: 0,
    videoCount: 0,
    audioCount: 0,
    libSub: '',
    groups: [],
    catalogGroups: [],
    collapsed: {},
    libraryQuery: '',
    catalogQuery: '',
    catalogOpen: false,

    // 继续播放卡片
    hasResume: false,
    resumeTitle: '',
    resumeTime: '0:00',

    // 当前课程信息
    currentId: '',
    title: '选择一课',
    folder: '',
    kind: '音频',
    isVideo: false,
    videoSrc: '',
    videoInitial: 0,
    stageHeight: 280,
    counter: '音频 0 / 0',
    prevDisabled: true,
    nextDisabled: true,
    restoredHint: false,
    mediaStatus: '',
    mediaError: '',
    offlineNote: '',

    // 播放状态、进度、倍速与播放模式
    playing: false,
    currentTime: 0,
    duration: 0,
    seekValue: 0,
    seekMax: 1,
    curClock: '0:00',
    durClock: '0:00',
    videoFitted: false,
    stageWidth: 0,
    stageHeight: 0,
    rates: progress.RATES,
    rate: progress.DEFAULT_RATE,
    rateLabel: '1×',
    speedMenuOpen: false,
    playMode: progress.DEFAULT_PLAY_MODE,
    playModeLabel: progress.formatPlayMode(progress.DEFAULT_PLAY_MODE),
    playModeIcon: PLAY_MODE_ICONS[progress.DEFAULT_PLAY_MODE],
    maxLabel: '最大窗口'
  },

  onLoad: function () {
    var storage = platform.createStorage({ wx: typeof wx !== 'undefined' ? wx : null });
    var saved = progress.readProgress(storage);
    var self = this;
    this.storage = storage;
    this.saved = saved;
    this.scrubbing = false;
    this.offline = offlineStore.createMiniOffline({ wx: typeof wx !== 'undefined' ? wx : null });

    var initRate = saved ? saved.playbackRate : progress.DEFAULT_RATE;
    var initMode = saved && saved.playMode ? saved.playMode : progress.DEFAULT_PLAY_MODE;

    this.session = adapter.createMiniProgramPlayer({
      wx: typeof wx !== 'undefined' ? wx : null,
      progress: progress,
      catalog: catalog,
      mediaBaseUrl: this.data.mediaBaseUrl,
      videoId: 'english-video',
      playbackRate: initRate,
      playMode: initMode,
      onVideoSrc: function (src) {
        self._pendingVideoSrc = src || '';
      },
      onProgress: function (snapshot) {
        progress.writeProgress(storage, snapshot);
        self.updateResumeCard();
      },
      onStateChange: function (playing) {
        self.setData({ playing: Boolean(playing) });
      },
      onCanplay: function () {
        self.markMediaReady();
        self.retainCurrent();
      },
      onWaiting: function () {
        if (!self.data.duration && self.data.mediaStatus !== 'error') {
          self.setData({ mediaStatus: 'loading' });
        }
      },
      onTimeUpdate: function (cur, dur) {
        if (self.scrubbing) return;
        var knownDur = dur || self.data.duration || 0;
        var patch = self.clockPatch(cur, knownDur);
        if ((knownDur > 0 || cur > 0) && self.data.mediaStatus === 'loading') {
          patch.mediaStatus = 'ready';
          patch.mediaError = '';
          self.clearLoadWatch();
        }
        self.setData(patch);
      },
      onEnded: function () {
        self.scrubbing = false;
        self.setData({ playing: false, currentTime: 0, seekValue: 0, curClock: '0:00' });
        self.step(1, true);
      },
      onError: function () {
        self.failMedia('当前音频加载失败，请检查网络后重试');
      }
    });

    this.loadCatalog();
  },

  loadCatalog: function () {
    var items = (mediaData && mediaData.items) || [];
    this.items = items;
    this.rawGroups = catalog.groupCatalog(items);

    var videos = 0, audios = 0;
    items.forEach(function (item) {
      if (item.kind === 'video') videos++;
      else if (item.kind === 'audio') audios++;
    });

    var resume = progress.resolveResume(this.saved, items);
    var rate = resume ? resume.playbackRate : progress.DEFAULT_RATE;
    var playMode = resume && resume.playMode ? resume.playMode : progress.DEFAULT_PLAY_MODE;

    this.session.setRate(rate);
    this.session.setPlayMode(playMode);

    this.setData({
      totalCount: items.length,
      videoCount: videos,
      audioCount: audios,
      libSub: '共 ' + items.length + ' 个 · 视频 ' + videos + ' · 音频 ' + audios,
      rate: rate,
      rateLabel: progress.formatRate(rate),
      playMode: playMode,
      playModeLabel: progress.formatPlayMode(playMode),
      playModeIcon: PLAY_MODE_ICONS[playMode] || '⇥'
    });

    this.refreshLists();
    this.updateResumeCard();

    if (resume && resume.media) {
      this.open(resume.media, resume.currentTime, { autoplay: false, restored: resume.currentTime > 0.2, stayLibrary: false });
    }
  },

  buildFilteredGroups: function (query) {
    var q = String(query || '').trim();
    var searching = Boolean(q);
    var collapsed = this.data.collapsed || {};
    var out = [];

    (this.rawGroups || []).forEach(function (group) {
      var folders = [];
      var visible = 0;
      group.folders.forEach(function (folder) {
        var matched = folder.items.filter(function (item) {
          return catalog.matchesQuery(item, q);
        });
        if (!matched.length) return;
        visible += matched.length;
        var key = group.kind + '/' + folder.name;
        var folded = !searching && Boolean(collapsed[key]);
        folders.push({
          name: folder.name,
          foldKey: key,
          folded: folded,
          items: matched.map(function (it) {
            return Object.assign({}, it, {
              extUpper: String(it.ext || '').toUpperCase(),
              badgeText: it.kind === 'video' ? '视频' : '音频'
            });
          })
        });
      });
      if (visible > 0) {
        out.push({
          kind: group.kind,
          label: group.label,
          count: visible,
          folders: folders
        });
      }
    });
    return out;
  },

  refreshLists: function () {
    this.setData({
      groups: this.buildFilteredGroups(this.data.libraryQuery),
      catalogGroups: this.buildFilteredGroups(this.data.catalogQuery)
    });
  },

  updateResumeCard: function () {
    var saved = progress.readProgress(this.storage);
    var resume = progress.resolveResume(saved, this.items);
    if (!resume || !resume.media) {
      this.setData({ hasResume: false, resumeTitle: '', resumeTime: '0:00' });
      return;
    }
    this.setData({
      hasResume: true,
      resumeTitle: resume.media.title,
      resumeTime: progress.formatClock(resume.currentTime)
    });
  },

  kindQueue: function () {
    if (!this.currentItem) return [];
    return catalog.flattenKind(this.rawGroups, this.currentItem.kind);
  },

  updateNavState: function () {
    var queue = this.kindQueue();
    var cur = this.currentItem;
    var index = -1;
    for (var i = 0; i < queue.length; i++) {
      if (cur && queue[i].id === cur.id) index = i;
    }
    var label = cur && cur.kind === 'video' ? '视频' : '音频';
    var loopOrRandom = this.data.playMode !== 'sequence' && queue.length > 1;
    this.setData({
      counter: label + ' ' + (index + 1) + ' / ' + queue.length,
      prevDisabled: !loopOrRandom && index <= 0,
      nextDisabled: !loopOrRandom && (index < 0 || index >= queue.length - 1)
    });
  },

  open: function (item, seekTime, options) {
    var opts = options || {};
    if (!item) return;
    if (seekTime == null) seekTime = progress.timeFor(progress.readProgress(this.storage), item.id);
    var safeSeek = Number(seekTime) > 0.2 ? Number(seekTime) : 0;

    this.currentItem = item;
    this.pendingVideoSeek = item.kind === 'video' ? safeSeek : 0;
    this._pendingVideoSrc = '';
    var isVideo = item.kind === 'video';
    var remoteSrc = catalog.resolveSrc(item, this.data.mediaBaseUrl);
    var localSrc = '';
    if (this.offline && this.data.mediaStatus !== 'error') {
      try { localSrc = this.offline.lookup(item.id) || ''; } catch (err) { localSrc = ''; }
    }
    this._remoteSrc = remoteSrc;
    var playItem = localSrc ? Object.assign({}, item, { offlineSrc: localSrc }) : item;
    this.session.load(playItem);

    var resolvedSrc = localSrc || this._pendingVideoSrc || remoteSrc;
    if (!localSrc && isVideo && resolvedSrc && this.data.mediaStatus === 'error') {
      resolvedSrc += (resolvedSrc.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
    }
    var self = this;

    this.setData({
      view: opts.stayLibrary ? 'library' : 'player',
      currentId: item.id,
      title: item.title,
      folder: item.folder,
      kind: isVideo ? '视频' : '音频',
      isVideo: isVideo,
      videoSrc: isVideo ? resolvedSrc : '',
      videoInitial: safeSeek,
      playing: Boolean(opts.autoplay),
      currentTime: safeSeek,
      duration: 0,
      seekValue: Math.round(safeSeek),
      seekMax: 1,
      curClock: progress.formatClock(safeSeek),
      durClock: '0:00',
      videoFitted: false,
      stageWidth: 0,
      stageHeight: 0,
      restoredHint: safeSeek > 0.2 && Boolean(opts.restored),
      mediaStatus: 'loading',
      mediaError: '',
      offlineNote: localSrc ? '正在使用本机缓存' : '',
      catalogOpen: false,
      speedMenuOpen: false
    }, function () {
      if (!isVideo) return;
      if (!resolvedSrc) {
        self.failMedia('没有可播放的视频地址');
        return;
      }
      self.finishVideoOpen(Boolean(opts.autoplay));
    });

    if (!isVideo) {
      if (safeSeek > 0.2) this.session.seek(safeSeek);
      if (opts.autoplay) this.session.play();
    }

    this.updateNavState();
    this.refreshLists();
    this.armLoadWatch(isVideo);
    this.session.save();
  },

  markMediaReady: function () {
    this.clearLoadWatch();
    if (this.data.mediaStatus === 'ready') return;
    this.setData({ mediaStatus: 'ready', mediaError: '' });
  },

  failMedia: function (tip) {
    this.clearLoadWatch();
    var text = tip || '加载失败，请检查网络后重试';
    this.setData({
      playing: false,
      mediaStatus: 'error',
      mediaError: text
    });
    if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
      wx.showToast({ title: '加载失败', icon: 'none', duration: 2200 });
    }
  },

  armLoadWatch: function (isVideo) {
    var self = this;
    this.clearLoadWatch();
    if (typeof wx === 'undefined' || typeof wx.createSelectorQuery !== 'function') return;
    this._loadTimer = setTimeout(function () {
      self._loadTimer = null;
      if (self.data.mediaStatus !== 'loading') return;
      self.failMedia(isVideo ? '视频加载失败，请检查网络后重试' : '音频加载失败，请检查网络后重试');
    }, 60000);
  },

  clearLoadWatch: function () {
    if (this._loadTimer) {
      clearTimeout(this._loadTimer);
      this._loadTimer = null;
    }
  },

  finishVideoOpen: function (autoplay) {
    var self = this;
    var run = function () {
      self.session.attachVideo();
      if (autoplay || self.data.playing) self.session.play();
      if (self.pendingVideoSeek > 0.2) self.session.seek(self.pendingVideoSeek);
    };
    if (typeof wx !== 'undefined' && typeof wx.nextTick === 'function') wx.nextTick(run);
    else run();
  },

  onRetryMedia: function () {
    if (!this.currentItem) return;
    this.open(this.currentItem, this.data.currentTime, { autoplay: true, restored: false });
  },

  onPick: function (event) {
    var id = event.currentTarget.dataset.id;
    var found = (this.items || []).filter(function (item) { return item.id === id; })[0];
    if (found) this.open(found, null, { autoplay: true, restored: true });
  },

  onResumeTap: function () {
    var saved = progress.readProgress(this.storage);
    var resume = progress.resolveResume(saved, this.items);
    if (resume && resume.media) {
      this.open(resume.media, resume.currentTime, { autoplay: true, restored: true });
    }
  },

  onToggleFold: function (event) {
    var key = event.currentTarget.dataset.fold;
    if (!key) return;
    var next = Object.assign({}, this.data.collapsed);
    next[key] = !next[key];
    this.setData({ collapsed: next });
    this.refreshLists();
  },

  onLibrarySearch: function (event) {
    var val = (event.detail && event.detail.value) || '';
    this.setData({ libraryQuery: val });
    this.refreshLists();
  },

  onCatalogSearch: function (event) {
    var val = (event.detail && event.detail.value) || '';
    this.setData({ catalogQuery: val });
    this.refreshLists();
  },

  openCatalog: function () {
    this.setData({ catalogOpen: true, catalogQuery: '', speedMenuOpen: false });
    this.refreshLists();
  },

  closeCatalog: function () {
    this.setData({ catalogOpen: false });
  },

  onMaskTap: function () {
    this.closeCatalog();
  },

  noop: function () {},

  showLibrary: function () {
    this.session.pause();
    this.session.save();
    this.setData({
      view: 'library',
      playing: false,
      catalogOpen: false,
      speedMenuOpen: false
    });
    this.updateResumeCard();
  },

  onTogglePlay: function () {
    if (!this.currentItem) return;
    if (this.data.playing) {
      this.onPause();
    } else {
      this.onPlay();
    }
  },

  onPlay: function () {
    if (this.data.mediaStatus === 'error' && this.currentItem) {
      this.open(this.currentItem, this.data.currentTime, { autoplay: true, restored: false });
      return;
    }
    if (this.data.isVideo) this.session.attachVideo();
    this.session.play();
    this.setData({ playing: true, restoredHint: false });
  },

  onPause: function () {
    this.session.pause();
    this.setData({ playing: false });
  },

  step: function (delta, fromEnded) {
    var queue = this.kindQueue();
    if (!queue.length || !this.currentItem) return;
    var index = -1;
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].id === this.currentItem.id) index = i;
    }
    var reason = fromEnded ? 'ended' : (delta < 0 ? 'prev' : 'next');
    var decision = progress.pickNextIndex(index, queue.length, this.data.playMode, reason);
    if (decision.index < 0) return;

    if (decision.replay) {
      this.session.seek(0);
      this.setData({ currentTime: 0, seekValue: 0, curClock: '0:00', playing: true });
      this.session.play();
      return;
    }

    var nextItem = queue[decision.index];
    if (nextItem) {
      var seekTo = fromEnded ? 0 : null;
      var auto = fromEnded ? true : this.data.playing;
      this.open(nextItem, seekTo, { autoplay: auto, restored: !fromEnded });
    }
  },

  onPrev: function () {
    this.step(-1, false);
  },

  onNext: function () {
    this.step(1, false);
  },

  clockPatch: function (cur, dur) {
    var known = Number(dur) || 0;
    var patch = {
      currentTime: cur,
      duration: known,
      curClock: progress.formatClock(cur),
      durClock: progress.formatClock(known)
    };
    if (!this.scrubbing) {
      patch.seekMax = Math.max(1, Math.round(known) || 1);
      patch.seekValue = Math.min(patch.seekMax, Math.max(0, Math.round(cur)));
    }
    return patch;
  },

  retainCurrent: function () {
    if (!this.offline || !this.currentItem || !this._remoteSrc) return;
    var self = this;
    this.offline.retain(this.currentItem.id, this._remoteSrc, {
      app: 'english',
      kind: this.currentItem.kind
    }).then(function (path) {
      if (path) self.setData({ offlineNote: '已保存到本机，断网后仍可播放' });
    });
  },

  onSeekStart: function () {
    if (this.data.duration > 0) this.scrubbing = true;
  },

  onSeekChanging: function (event) {
    this.scrubbing = true;
    var val = Number(event.detail && event.detail.value) || 0;
    this.setData({ curClock: progress.formatClock(val) });
  },

  onSeekChange: function (event) {
    var val = Number(event.detail && event.detail.value) || 0;
    this.scrubbing = false;
    this.session.seek(val);
    this.setData({
      currentTime: val,
      seekValue: val,
      curClock: progress.formatClock(val)
    });
  },

  fitVideoFrame: function (videoWidth, videoHeight) {
    var ratio = Number(videoHeight) / Number(videoWidth);
    if (!(ratio > 0) || typeof wx === 'undefined' || typeof wx.createSelectorQuery !== 'function') return;
    var self = this;
    wx.createSelectorQuery().in(this)
      .select('.player').boundingClientRect()
      .select('.topbar').boundingClientRect()
      .select('.now').boundingClientRect()
      .select('.controls').boundingClientRect()
      .exec(function (rects) {
        var player = rects && rects[0];
        if (!player || !(player.width > 0) || !(player.height > 0)) return;
        var top = rects[1] || {};
        var now = rects[2] || {};
        var controls = rects[3] || {};
        var maxW = player.width - player.width / 750 * 48;
        var used = (top.height || 0) + (now.height || 0) + (controls.height || 0) + 8;
        var maxH = Math.max(180, player.height - used);
        var width = maxW;
        var height = width * ratio;
        if (height > maxH) {
          height = maxH;
          width = height / ratio;
        }
        self.setData({
          videoFitted: true,
          stageWidth: Math.round(width),
          stageHeight: Math.round(height)
        });
      });
  },

  onVideoLoadedMeta: function (event) {
    var detail = (event && event.detail) || {};
    var dur = Number(detail.duration) || 0;
    this.markMediaReady();
    if (dur > 0) this.setData(this.clockPatch(this.data.currentTime, dur));
    if (!this.data.videoFitted) this.fitVideoFrame(detail.width, detail.height);
    if (this.pendingVideoSeek && this.pendingVideoSeek > 0.2) {
      var target = progress.clampResumeTime(this.pendingVideoSeek, dur);
      this.pendingVideoSeek = 0;
      if (target > 0.2) this.session.seek(target);
    }
    if (this.data.playing) {
      this.session.attachVideo();
      this.session.play();
    }
  },

  onVideoTime: function (event) {
    if (this.scrubbing) return;
    var detail = (event && event.detail) || {};
    var time = Number(detail.currentTime) || 0;
    var dur = Number(detail.duration) || this.data.duration || 0;
    this.session.noteVideoTime(time, dur);
    var patch = this.clockPatch(time, dur);
    if (dur > 0 && this.data.mediaStatus === 'loading') {
      patch.mediaStatus = 'ready';
      patch.mediaError = '';
      this.clearLoadWatch();
    }
    this.setData(patch);
  },

  onVideoWaiting: function () {
    if (this.data.mediaStatus === 'error' || this.data.duration > 0) return;
    this.setData({ mediaStatus: 'loading' });
  },

  onVideoPlay: function () {
    this.setData({ playing: true, restoredHint: false });
    if (this.data.duration > 0) this.markMediaReady();
    this.retainCurrent();
  },

  onVideoPause: function () {
    this.setData({ playing: false });
  },

  onVideoEnded: function () {
    this.scrubbing = false;
    this.setData({ playing: false, currentTime: 0, seekValue: 0, curClock: '0:00' });
    this.step(1, true);
  },

  onVideoError: function (event) {
    var raw = String((event && event.detail && event.detail.errMsg) || '');
    var tip = '视频加载失败，请检查网络后重试';
    if (/domain|合法域名/i.test(raw)) {
      tip = '视频域名未配置，请检查小程序合法域名';
    } else if (raw) {
      tip = '视频无法播放：' + raw.slice(0, 42);
    }
    this.failMedia(tip);
  },

  onMax: function () {
    var next = this.data.maxLabel !== '还原窗口';
    if (this.session.setMaxWindow(next)) {
      this.setData({ maxLabel: next ? '还原窗口' : '最大窗口' });
    }
  },

  onFullScreenChange: function (event) {
    var full = event.detail && (event.detail.fullScreen || event.detail.fullscreen);
    this.setData({ maxLabel: full ? '还原窗口' : '最大窗口' });
  },

  toggleSpeedMenu: function () {
    this.setData({ speedMenuOpen: !this.data.speedMenuOpen });
  },

  onRate: function (event) {
    var rate = this.session.setRate(Number(event.currentTarget.dataset.rate));
    this.setData({
      rate: rate,
      rateLabel: progress.formatRate(rate),
      speedMenuOpen: false
    });
  },

  onCyclePlayMode: function () {
    var nextMode = progress.nextPlayMode(this.data.playMode);
    this.session.setPlayMode(nextMode);
    this.setData({
      playMode: nextMode,
      playModeLabel: progress.formatPlayMode(nextMode),
      playModeIcon: PLAY_MODE_ICONS[nextMode] || '⇥'
    });
    this.updateNavState();
    if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
      wx.showToast({ title: progress.formatPlayMode(nextMode), icon: 'none', duration: 900 });
    }
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

  onHide: function () { this.session.save(); },
  onUnload: function () {
    this.clearLoadWatch();
    this.session.destroy();
  }
});
