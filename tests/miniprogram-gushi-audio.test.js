const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const mpRoot = path.join(__dirname, '..', 'miniprogram');
const GUSHI_PAGE = '../miniprogram/pages/gushi/gushi.js';

function fakeWx() {
  const calls = [];
  const storage = {};
  const files = {};
  const handlers = {};
  let seq = 0;
  const audio = {
    src: '',
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    obeyMuteSwitch: true,
    autoplay: true,
    play: function () { calls.push('play'); },
    pause: function () { calls.push('pause'); },
    stop: function () { calls.push('stop'); },
    destroy: function () { calls.push('destroy'); },
    seek: function (t) { audio.currentTime = t; calls.push('seek:' + t); },
    onPlay: function (fn) { handlers.play = fn; },
    onPause: function (fn) { handlers.pause = fn; },
    onStop: function (fn) { handlers.stop = fn; },
    onEnded: function (fn) { handlers.ended = fn; },
    onTimeUpdate: function (fn) { handlers.tick = fn; },
    onCanplay: function (fn) { handlers.canplay = fn; },
    onError: function (fn) { handlers.error = fn; }
  };
  const wxApi = {
    calls: calls,
    audio: audio,
    handlers: handlers,
    storage: storage,
    files: files,
    downloadFail: null,
    getStorageSync: function (key) { return storage[key] || null; },
    setStorageSync: function (key, value) { storage[key] = value; },
    showToast: function (opts) { calls.push('toast:' + opts.title); },
    createInnerAudioContext: function () { calls.push('createAudio'); return audio; },
    downloadFile: function (opts) {
      if (wxApi.downloadFail) {
        opts.fail(wxApi.downloadFail);
        return;
      }
      opts.success({ statusCode: 200, tempFilePath: 'tmp-' + (++seq), dataLength: 30 });
    },
    getFileSystemManager: function () {
      return {
        accessSync: function (p) { if (!files[p]) throw new Error('missing'); },
        unlinkSync: function (p) { delete files[p]; calls.push('unlink:' + p); },
        saveFile: function (opts) {
          const saved = 'saved-' + opts.tempFilePath;
          files[saved] = true;
          opts.success({ savedFilePath: saved });
        },
        getFileInfo: function (opts) { opts.success({ size: 30 }); }
      };
    }
  };
  return wxApi;
}

function makePage(wxApi) {
  let pageConfig = null;
  global.wx = wxApi;
  global.Page = function (cfg) { pageConfig = cfg; };
  delete require.cache[require.resolve(GUSHI_PAGE)];
  require(GUSHI_PAGE);
  const state = Object.assign({}, pageConfig.data);
  return Object.assign({}, pageConfig, {
    data: state,
    audio: null,
    setData: function (patch) { Object.assign(state, patch); }
  });
}

function count(calls, name) {
  return calls.filter(function (call) { return call === name; }).length;
}

test('gushi 音频忽略真机静音开关，并绑定失败与可播回调', function () {
  const wxApi = fakeWx();
  const ctx = makePage(wxApi);
  ctx.onLoad({});
  ctx.onStart();
  assert.equal(wxApi.audio.obeyMuteSwitch, false);
  assert.equal(typeof wxApi.handlers.error, 'function');
  assert.equal(typeof wxApi.handlers.canplay, 'function');
  assert.ok(wxApi.audio.src.indexOf('/gushi/assets/audio/p001.m4a') > 0);
  assert.equal(ctx.data.playing, true);
  assert.ok(count(wxApi.calls, 'play') >= 1);
  ctx.onUnload();
});

test('真机缓存在播放器里解不出来时，自动切回网络音频并清掉坏缓存', function () {
  const wxApi = fakeWx();
  const badPath = 'wxfile://store_bad.m4a';
  wxApi.files[badPath] = true;
  wxApi.storage['ggs-offline-index-v1'] = [{
    id: 'p001', app: 'gushi', kind: 'audio', path: badPath, bytes: 30, lastUsed: Date.now()
  }];
  const ctx = makePage(wxApi);
  ctx.onLoad({});
  ctx.onStart();
  assert.equal(wxApi.audio.src, badPath);
  assert.equal(ctx.data.offlineNote, '正在使用本机缓存');

  wxApi.handlers.error({ errMsg: 'innerAudioContext error: format not support', errCode: 10002 });

  assert.ok(wxApi.audio.src.indexOf('/gushi/assets/audio/p001.m4a') > 0);
  assert.equal(ctx.data.offlineNote, '本机缓存不可播，已改用网络音频');
  assert.equal(wxApi.storage['ggs-offline-index-v1'].length, 0);
  assert.ok(wxApi.calls.indexOf('unlink:' + badPath) >= 0);
  assert.equal(ctx.data.audioError, '');
  assert.equal(ctx.data.playing, true);
  ctx.onUnload();
});

test('远程流式失败后，下载到本机临时文件继续播放', function () {
  const wxApi = fakeWx();
  const ctx = makePage(wxApi);
  ctx.onLoad({});
  ctx.onStart();
  wxApi.handlers.error({ errMsg: 'innerAudioContext error', errCode: 10002 });
  assert.ok(wxApi.audio.src.indexOf('tmp-') === 0);
  assert.equal(ctx.data.offlineNote, '已改用下载后的本机音频');
  assert.equal(ctx.data.audioError, '');
  assert.equal(ctx.data.playing, true);
  ctx.onUnload();
});

test('下载兜底也失败时，页面给出域名配置提示而不是无声无进度', function () {
  const wxApi = fakeWx();
  wxApi.downloadFail = { errMsg: 'downloadFile:fail url not in domain list' };
  const ctx = makePage(wxApi);
  ctx.onLoad({});
  ctx.onStart();
  wxApi.handlers.error({ errMsg: 'innerAudioContext error', errCode: 10002 });
  assert.match(ctx.data.audioError, /downloadFile 合法域名/);
  assert.equal(ctx.data.playing, false);
  assert.ok(wxApi.calls.some(function (call) { return call.indexOf('toast:') === 0; }));
  ctx.onUnload();
});

test('微信错误码 10004 会翻译成机型解码问题', function () {
  const wxApi = fakeWx();
  const ctx = makePage(wxApi);
  ctx.onLoad({});
  ctx.onStart();
  // 先走完下载兜底，再报格式错，此时才轮到 InnerAudioContext 的错误分类
  wxApi.handlers.error({ errMsg: 'innerAudioContext error', errCode: 10002 });
  wxApi.handlers.error({ errMsg: 'innerAudioContext error', errCode: 10004 });
  assert.match(ctx.data.audioError, /解码/);
  ctx.onUnload();
});

test('点错误提示重试会重新放开三级兜底', function () {
  const wxApi = fakeWx();
  wxApi.downloadFail = { errMsg: 'downloadFile:fail timeout' };
  const ctx = makePage(wxApi);
  ctx.onLoad({});
  ctx.onStart();
  wxApi.handlers.error({ errMsg: 'innerAudioContext error', errCode: 10002 });
  assert.equal(ctx.data.playing, false);
  wxApi.downloadFail = null;
  ctx.onRetryAudio();
  assert.ok(wxApi.audio.src.indexOf('/gushi/assets/audio/p001.m4a') > 0);
  assert.equal(ctx.data.audioError, '');
  assert.equal(ctx.data.playing, true);
  ctx.onUnload();
});

test('音频可播回调会补一次播放，绕开真机换源竞态', function () {
  const wxApi = fakeWx();
  const ctx = makePage(wxApi);
  ctx.onLoad({});
  ctx.onStart();
  const before = count(wxApi.calls, 'play');
  wxApi.handlers.canplay();
  assert.equal(count(wxApi.calls, 'play'), before + 1);
  ctx.onUnload();
});

test('点句跳转后进度事件不再被 seekEcho 的未初始化变量吞掉', function () {
  const wxApi = fakeWx();
  const ctx = makePage(wxApi);
  ctx.onLoad({});
  ctx.onStart();
  ctx.onLineTap({ currentTarget: { dataset: { index: 2 } } });
  assert.equal(ctx.data.activeLine, 2);
  // 播放器回传了跳转后的下一个真实时间点
  wxApi.audio.currentTime = 6.5;
  wxApi.audio.duration = 11.76;
  wxApi.handlers.tick();
  assert.equal(ctx.data.currentTime, 6.5);
  assert.equal(ctx.data.curClock, '0:06');
  assert.ok(ctx.data.seekPercent > 0);
  ctx.onUnload();
});

test('gushi 页面能显示音频错误提示', function () {
  const wxml = fs.readFileSync(path.join(mpRoot, 'pages', 'gushi', 'gushi.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(mpRoot, 'pages', 'gushi', 'gushi.wxss'), 'utf8');
  assert.match(wxml, /\{\{audioError\}\}/);
  assert.match(wxml, /bindtap="onRetryAudio"/);
  assert.match(wxss, /\.poem-note-error/);
});

test('小程序启动时全局关掉 iOS 静音跟随', function () {
  const appSrc = fs.readFileSync(path.join(mpRoot, 'app.js'), 'utf8');
  assert.match(appSrc, /setInnerAudioOption/);
  assert.match(appSrc, /obeyMuteSwitch: false/);
});

test.after(function () {
  delete global.wx;
  delete global.Page;
});
