/* 小程序播放会话。
 * 与网页共用 catalog.js、progress.js 和进度键 english-player-progress-v1。
 * 音频使用 wx.createInnerAudioContext。
 * 视频使用页面里的 <video>，当前时间由 bindtimeupdate 回写，跳转用 VideoContext.seek。
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
    var playMode = progress && progress.normalizePlayMode ? progress.normalizePlayMode(opts.playMode) : 'sequence';
    var videoTime = 0;
    var videoDuration = 0;
    var lastTick = 0;
    /* 自然结束后播放器仍停在结尾。记进度前先把它当成 0，避免切回来立刻再次结束。 */
    var reportZero = false;

    function srcOf(media) {
      if (media && media.offlineSrc) return media.offlineSrc;
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
      opts.onProgress(progress.createSnapshot(item, currentTime(), rate, now, playMode));
    }

    function currentTime() {
      if (reportZero) return 0;
      if (mode === 'audio' && audio) return Number(audio.currentTime) || 0;
      return videoTime;
    }

    function duration() {
      if (mode === 'audio' && audio) return Number(audio.duration) || 0;
      return videoDuration;
    }

    function applyRate() {
      if (audio) {
        try { audio.playbackRate = rate; } catch (err) { /* 低版本基础库可能没有该字段 */ }
      }
      if (video && typeof video.playbackRate === 'function') {
        try { video.playbackRate(rate); } catch (err) { /* 忽略不支持的倍速调用 */ }
      }
    }

    function attachVideo() {
      if (mode !== 'video' || !wxApi || typeof wxApi.createVideoContext !== 'function') return false;
      if (video) return true;
      video = wxApi.createVideoContext(opts.videoId || 'english-video', opts.pageContext);
      applyRate();
      return Boolean(video);
    }

    return {
      load: function (media) {
        if (!media) return;
        note(true);
        reportZero = false;
        item = media;
        videoTime = 0;
        videoDuration = 0;
        if (media.kind === 'audio') {
          if (!wxApi || typeof wxApi.createInnerAudioContext !== 'function') {
            throw new Error('当前环境没有音频上下文');
          }
          destroyAudio();
          audio = wxApi.createInnerAudioContext();
          /* iOS 真机静音键会让 InnerAudioContext 静音，跟读音频同样要忽略它 */
          try { audio.obeyMuteSwitch = false; } catch (err) {}
          audio.src = srcOf(media);
          audio.autoplay = false;
          if (typeof audio.onPlay === 'function') {
            audio.onPlay(function () {
              if (opts.onStateChange) opts.onStateChange(true);
            });
          }
          if (typeof audio.onPause === 'function') {
            audio.onPause(function () {
              if (opts.onStateChange) opts.onStateChange(false);
            });
          }
          if (typeof audio.onStop === 'function') {
            audio.onStop(function () {
              if (opts.onStateChange) opts.onStateChange(false);
            });
          }
          if (typeof audio.onCanplay === 'function') {
            audio.onCanplay(function () {
              if (opts.onCanplay) opts.onCanplay(duration());
            });
          }
          if (typeof audio.onWaiting === 'function') {
            audio.onWaiting(function () {
              if (opts.onWaiting) opts.onWaiting();
            });
          }
          if (typeof audio.onTimeUpdate === 'function') {
            audio.onTimeUpdate(function () {
              note(false);
              if (opts.onTimeUpdate) opts.onTimeUpdate(currentTime(), duration());
            });
          }
          if (typeof audio.onEnded === 'function') {
            audio.onEnded(function () {
              reportZero = true;
              videoTime = 0;
              note(true);
              if (opts.onStateChange) opts.onStateChange(false);
              if (opts.onEnded) opts.onEnded();
            });
          }
          if (typeof audio.onError === 'function') {
            audio.onError(function (err) {
              if (opts.onError) opts.onError(err);
            });
          }
          mode = 'audio';
          video = null;
          applyRate();
          return;
        }
        destroyAudio();
        mode = 'video';
        video = null;
        if (opts.onVideoSrc) opts.onVideoSrc(srcOf(media));
      },
      attachVideo: attachVideo,
      play: function () {
        if (mode === 'audio' && audio) {
          applyRate();
          audio.play();
          return true;
        }
        if (mode === 'video' && video && typeof video.play === 'function') {
          applyRate();
          video.play();
          return true;
        }
        return false;
      },
      pause: function () {
        if (mode === 'audio' && audio) audio.pause();
        else if (video) video.pause();
        note(true);
      },
      /* 拖动进度条时可能还没走到 onVideoLoadedMeta，这里保证 VideoContext 已绑定。
       * 返回是否真的把位置交给了播放器，页面据此决定要不要用页面级 context 兜底。 */
      seek: function (time) {
        var next = Math.max(0, Number(time) || 0);
        var applied = false;
        if (mode === 'audio' && audio && typeof audio.seek === 'function') {
          audio.seek(next);
          applied = true;
        } else if (mode === 'video') {
          if (!video) attachVideo();
          videoTime = next;
          if (video && typeof video.seek === 'function') {
            video.seek(next);
            applied = true;
          }
        }
        note(true);
        return applied;
      },
      setRate: function (nextRate) {
        rate = progress ? progress.normalizeRate(nextRate) : nextRate;
        applyRate();
        note(true);
        return rate;
      },
      setPlayMode: function (nextMode) {
        playMode = progress && progress.normalizePlayMode ? progress.normalizePlayMode(nextMode) : nextMode;
        note(true);
        return playMode;
      },
      noteVideoTime: function (time, dur) {
        videoTime = Math.max(0, Number(time) || 0);
        if (dur != null && Number(dur) > 0) videoDuration = Number(dur);
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
      getDuration: duration,
      getRate: function () { return rate; },
      getPlayMode: function () { return playMode; },
      getItem: function () { return item; },
      save: function () { note(true); },
      markEnded: function () {
        reportZero = true;
        videoTime = 0;
      },
      clearEnded: function () {
        reportZero = false;
      },
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
