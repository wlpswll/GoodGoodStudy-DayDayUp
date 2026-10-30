const test = require('node:test');
const assert = require('node:assert/strict');
const adapter = require('../english/miniprogram/player-adapter.js');
const progress = require('../english/js/progress.js');
const catalog = require('../english/js/catalog.js');

function fakeWx() {
  const calls = [];
  return {
    calls: calls,
    createInnerAudioContext: function () {
      const audio = {
        src: '',
        currentTime: 0,
        playbackRate: 1,
        play: function () { calls.push('play'); },
        pause: function () { calls.push('pause'); },
        stop: function () { calls.push('stop'); },
        destroy: function () { calls.push('destroy'); },
        seek: function (time) { audio.currentTime = time; calls.push('seek:' + time); },
        onTimeUpdate: function (fn) { audio._tick = fn; },
        onEnded: function (fn) { audio._ended = fn; }
      };
      calls.push('audio');
      return audio;
    },
    createVideoContext: function (id) {
      calls.push('video:' + id);
      return {
        play: function () { calls.push('video-play'); },
        pause: function () { calls.push('video-pause'); },
        seek: function (time) { calls.push('video-seek:' + time); },
        playbackRate: function (rate) { calls.push('video-rate:' + rate); },
        requestFullScreen: function (opts) { calls.push('full:' + (opts && opts.direction)); },
        exitFullScreen: function () { calls.push('exit-full'); }
      };
    }
  };
}

test('小程序音频会话能播放、跳转、改倍速并写出同一份进度', function () {
  const wxApi = fakeWx();
  const saved = [];
  const session = adapter.createMiniProgramPlayer({
    wx: wxApi,
    progress: progress,
    catalog: catalog,
    mediaBaseUrl: 'https://cdn.example/english',
    onProgress: function (snapshot) { saved.push(snapshot); }
  });
  const item = {
    id: '一上英语课本跟读mp3/p9 Letters-1.mp3',
    title: 'p9 Letters-1',
    kind: 'audio',
    ext: 'mp3',
    folder: '一上英语课本跟读mp3',
    src: '一上英语课本跟读mp3/p9 Letters-1.mp3'
  };
  session.load(item);
  session.play();
  session.seek(6.5);
  const rate = session.setRate(1.5);
  assert.equal(rate, 1.5);
  assert.equal(session.getCurrentTime(), 6.5);
  assert.ok(wxApi.calls.indexOf('play') >= 0);
  assert.equal(saved[saved.length - 1].mediaId, item.id);
  assert.equal(saved[saved.length - 1].playbackRate, 1.5);
  assert.equal(saved[saved.length - 1].version, 1);
  assert.match(saved[0] ? session.getItem().src : item.src, /p9 Letters-1/);
  session.destroy();
  assert.ok(wxApi.calls.indexOf('destroy') >= 0);
});

test('小程序视频用页面回调记住时间，非法倍速保持为 1', function () {
  const wxApi = fakeWx();
  let videoSrc = '';
  const session = adapter.createMiniProgramPlayer({
    wx: wxApi,
    progress: progress,
    catalog: catalog,
    videoId: 'english-video',
    onVideoSrc: function (src) { videoSrc = src; },
    onProgress: function () {}
  });
  session.load({
    id: '一上英语课本跟读视频/U1跟读.mp4',
    kind: 'video',
    src: '一上英语课本跟读视频/U1跟读.mp4'
  });
  session.noteVideoTime(8);
  assert.equal(session.getCurrentTime(), 8);
  assert.equal(session.setRate(0.85), 1);
  assert.match(videoSrc, /U1/);
  assert.equal(videoSrc.indexOf(' '), -1);
  assert.ok(wxApi.calls.some(function (call) { return call === 'video:english-video'; }));
  assert.equal(session.setMaxWindow(true), true);
  assert.equal(session.setMaxWindow(false), true);
  assert.ok(wxApi.calls.indexOf('full:0') >= 0);
  assert.ok(wxApi.calls.indexOf('exit-full') >= 0);
});
