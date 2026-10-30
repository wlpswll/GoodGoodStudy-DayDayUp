/* 小程序示例页。拷到小程序工程后，把 mediaBaseUrl 换成可访问的媒体目录。
 * 进度键、字段和分组规则与网页 english/js 相同。
 */
var catalog = require('../../../js/catalog.js');
var progress = require('../../../js/progress.js');
var platform = require('../../../js/platform.js');
var adapter = require('../../player-adapter.js');

Page({
  data: {
    mediaBaseUrl: '',
    groups: [],
    title: '',
    folder: '',
    kind: '',
    rateLabel: '1×',
    maxLabel: '最大窗口',
    rates: progress.RATES,
    currentTime: 0,
    videoSrc: '',
    hint: ''
  },

  onLoad: function () {
    var storage = platform.createStorage({ wx: wx });
    var saved = progress.readProgress(storage);
    this.storage = storage;
    this.session = adapter.createMiniProgramPlayer({
      wx: wx,
      progress: progress,
      catalog: catalog,
      mediaBaseUrl: this.data.mediaBaseUrl,
      videoId: 'english-video',
      playbackRate: saved ? saved.playbackRate : progress.DEFAULT_RATE,
      onVideoSrc: function (src) { this.setData({ videoSrc: src }); }.bind(this),
      onProgress: function (snapshot) { progress.writeProgress(storage, snapshot); }
    });
    this.saved = saved;
    this.loadCatalog();
  },

  loadCatalog: function () {
    var items = [];
    try { items = require('../../../data/media.json').items || []; } catch (err) { items = []; }
    var resume = progress.resolveResume(this.saved, items);
    this.items = items;
    this.setData({
      groups: catalog.groupCatalog(items),
      rateLabel: progress.formatRate(this.session.getRate()),
      hint: resume && resume.media ? '上次播放到 ' + progress.formatClock(resume.currentTime) : ''
    });
    if (resume && resume.media) this.open(resume.media, resume.currentTime);
  },

  open: function (item, seekTime) {
    if (seekTime == null) seekTime = progress.timeFor(progress.readProgress(this.storage), item.id);
    this.session.load(item);
    this.setData({
      title: item.title,
      folder: item.folder,
      kind: item.kind === 'video' ? '视频' : '音频',
      videoSrc: item.kind === 'video' ? catalog.resolveSrc(item, this.data.mediaBaseUrl) : ''
    });
    if (seekTime) this.session.seek(seekTime);
  },

  onPick: function (event) {
    var id = event.currentTarget.dataset.id;
    var found = (this.items || []).filter(function (item) { return item.id === id; })[0];
    if (found) this.open(found);
  },

  onPlay: function () { this.session.play(); },
  onPause: function () { this.session.pause(); },
  onVideoTime: function (event) {
    var time = event.detail && event.detail.currentTime;
    this.session.noteVideoTime(time);
    this.setData({ currentTime: time || 0 });
  },
  onMax: function () {
    var next = this.data.maxLabel !== '还原窗口';
    if (this.session.setMaxWindow(next)) this.setData({ maxLabel: next ? '还原窗口' : '最大窗口' });
  },
  onFullScreenChange: function (event) {
    var full = event.detail && (event.detail.fullScreen || event.detail.fullscreen);
    this.setData({ maxLabel: full ? '还原窗口' : '最大窗口' });
  },
  onRate: function (event) {
    var rate = this.session.setRate(Number(event.currentTarget.dataset.rate));
    this.setData({ rateLabel: progress.formatRate(rate) });
  },
  onHide: function () { this.session.save(); },
  onUnload: function () { this.session.destroy(); }
});
