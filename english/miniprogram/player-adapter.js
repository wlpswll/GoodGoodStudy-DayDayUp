/* 小程序播放会话。
 * 与网页共用 catalog.js、progress.js 和进度键 english-player-progress-v1。
 * 音频使用 wx.createInnerAudioContext。
 * 视频使用页面里的 <video>，当前时间由 bindtimeupdate 回写，跳转用 VideoContext.seek。
 * 媒体地址建议走 CDN：把 mediaBaseUrl 设为可访问的目录前缀，不要把现有视频打进安装包。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EnglishMiniProgramPlayer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function createMiniProgramPlayer(options) {
    var opts = options || {};
    var wxApi = opts.wx;
    var progress = opts.progress;
    var catalog = opts.catalog;
    var audio = null;
    var video = null;
    var item = null;
    var mode = '';
    var rate = progress ? progress.normalizeRate(opts.playbackRate) : 1;
    var videoTime = 0;
    var lastTick = 0;

    function srcOf(media) {
      if (catalog && catalog.resolveSrc) return catalog.resolveSrc(media, opts.mediaBaseUrl || '');
      return media && media.src || '';
    }

    function destroyAudio() {
      if (!audio) return;
      try { audio.stop(); } catch (err) { /* 已停止 */ }
      try { audio.destroy(); } catch (err) { /* 已销毁 */ }
      audio = null;
    }

    function note(force) {
      if (!opts.onProgress || !progress || !item) return;
      var now = Date.now();
      if (!force && now - lastTick < 1000) return;
      lastTick = now;
      opts.onProgress(progress.createSnapshot(item, currentTime(), rate, now));
    }

    function currentTime() {
      if (mode === 'audio' && audio) return Number(audio.currentTime) || 0;
      return videoTime;
    }

    function applyRate() {
      if (audio) {
        try { audio.playbackRate = rate; } catch (err) { /* 低版本基础库可能没有该字段 */ }
      }
      if (video && typeof video.playbackRate === 'function') {
        try { video.playbackRate(rate); } catch (err) { /* 忽略不支持的倍速调用 */ }
      }
    }

    return {
      load: function (media) {
        if (!media) return;
        note(true);
        item = media;
        videoTime = 0;
        if (media.kind === 'audio') {
          if (!wxApi || typeof wxApi.createInnerAudioContext !== 'function') {
            throw new Error('当前环境没有音频上下文');
          }
          destroyAudio();
          audio = wxApi.createInnerAudioContext();
          audio.src = srcOf(media);
          audio.autoplay = false;
          if (typeof audio.onTimeUpdate === 'function') {
            audio.onTimeUpdate(function () { note(false); });
          }
          if (typeof audio.onEnded === 'function') {
            audio.onEnded(function () {
              note(true);
              if (opts.onEnded) opts.onEnded();
            });
          }
          mode = 'audio';
          video = null;
          applyRate();
          return;
        }
        destroyAudio();
        mode = 'video';
        if (wxApi && typeof wxApi.createVideoContext === 'function') {
          video = wxApi.createVideoContext(opts.videoId || 'english-video');
        }
        applyRate();
        if (opts.onVideoSrc) opts.onVideoSrc(srcOf(media));
      },
      play: function () {
        if (mode === 'audio' && audio) audio.play();
        else if (video) video.play();
      },
      pause: function () {
        if (mode === 'audio' && audio) audio.pause();
        else if (video) video.pause();
        note(true);
      },
      seek: function (time) {
        var next = Math.max(0, Number(time) || 0);
        if (mode === 'audio' && audio && typeof audio.seek === 'function') audio.seek(next);
        if (mode === 'video') {
          videoTime = next;
          if (video && typeof video.seek === 'function') video.seek(next);
        }
        note(true);
      },
      setRate: function (nextRate) {
        rate = progress ? progress.normalizeRate(nextRate) : nextRate;
        applyRate();
        note(true);
        return rate;
      },
      noteVideoTime: function (time) {
        videoTime = Math.max(0, Number(time) || 0);
        note(false);
      },
      setMaxWindow: function (on) {
        if (mode !== 'video' || !video) return false;
        if (on && typeof video.requestFullScreen === 'function') {
          video.requestFullScreen({ direction: 0 });
          return true;
        }
        if (!on && typeof video.exitFullScreen === 'function') {
          video.exitFullScreen();
          return true;
        }
        return false;
      },
      getCurrentTime: currentTime,
      getRate: function () { return rate; },
      getItem: function () { return item; },
      save: function () { note(true); },
      destroy: function () {
        note(true);
        destroyAudio();
        video = null;
        item = null;
        mode = '';
      }
    };
  }

  return { createMiniProgramPlayer: createMiniProgramPlayer };
});
