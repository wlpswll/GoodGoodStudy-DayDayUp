const test = require('node:test');
const assert = require('node:assert/strict');
const adapter = require('../miniprogram/player-adapter.js');
const progress = require('../english/js/progress.js');
const catalog = require('../english/js/catalog.js');

function fakeWx() {
  const calls = [];
  const wxApi = {
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
      wxApi.lastAudio = audio;
      calls.push('audio');
      return audio;
    },
    createVideoContext: function (id, pageContext) {
      calls.push('video:' + id);
      calls.push('video-page:' + Boolean(pageContext));
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
  return wxApi;
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
  assert.equal(wxApi.lastAudio.obeyMuteSwitch, false, '真机静音开关不该拦住跟读音频');
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
  const pageContext = {};
  let videoSrc = '';
  const session = adapter.createMiniProgramPlayer({
    wx: wxApi,
    pageContext: pageContext,
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
  assert.equal(wxApi.calls.indexOf('video:english-video'), -1);
  session.attachVideo();
  session.noteVideoTime(8);
  assert.equal(session.getCurrentTime(), 8);
  assert.equal(session.setRate(0.85), 1);
  assert.match(videoSrc, /U1/);
  assert.equal(videoSrc.indexOf(' '), -1);
  assert.ok(wxApi.calls.some(function (call) { return call === 'video:english-video'; }));
  assert.ok(wxApi.calls.indexOf('video-page:true') >= 0);
  assert.equal(session.setMaxWindow(true), true);
  assert.equal(session.setMaxWindow(false), true);
  assert.ok(wxApi.calls.indexOf('full:0') >= 0);
  assert.ok(wxApi.calls.indexOf('exit-full') >= 0);
});

test('小程序视频未绑定上下文时，拖动进度条会自动绑定并跳转', function () {
  const wxApi = fakeWx();
  const snapshots = [];
  const session = adapter.createMiniProgramPlayer({
    wx: wxApi,
    pageContext: {},
    progress: progress,
    catalog: catalog,
    videoId: 'english-video',
    mediaBaseUrl: 'https://cdn.example/english',
    onProgress: function (snapshot) { snapshots.push(snapshot); }
  });
  session.load({
    id: '一上英语课本跟读视频/U2跟读.mp4',
    kind: 'video',
    src: '一上英语课本跟读视频/U2跟读.mp4'
  });
  assert.equal(wxApi.calls.indexOf('video:english-video'), -1);
  assert.equal(session.seek(120), true);
  assert.ok(wxApi.calls.indexOf('video:english-video') >= 0, '应自动创建 VideoContext');
  assert.ok(wxApi.calls.indexOf('video-seek:120') >= 0, '应把目标时间交给播放器');
  assert.equal(session.getCurrentTime(), 120);
  assert.equal(snapshots[snapshots.length - 1].currentTime, 120);
  session.destroy();
});

test('小程序页面可直接被微信环境加载，且不跨越小程序目录边界', function () {
  const fs = require('node:fs');
  const path = require('node:path');
  const mpRoot = path.join(__dirname, '..', 'miniprogram');

  assert.ok(fs.existsSync(path.join(mpRoot, 'project.config.json')));
  assert.ok(fs.existsSync(path.join(mpRoot, 'shared', 'catalog.js')));
  assert.ok(fs.existsSync(path.join(mpRoot, 'shared', 'progress.js')));
  assert.ok(fs.existsSync(path.join(mpRoot, 'shared', 'platform.js')));
  assert.ok(fs.existsSync(path.join(mpRoot, 'shared', 'media-data.js')));
  assert.ok(fs.existsSync(path.join(mpRoot, 'shared', 'gushi-catalog.js')));
  assert.ok(fs.existsSync(path.join(mpRoot, 'shared', 'poems-data.js')));

  const appJson = JSON.parse(fs.readFileSync(path.join(mpRoot, 'app.json'), 'utf8'));
  assert.deepEqual(appJson.pages, ['pages/home/home', 'pages/gushi/gushi', 'pages/player/player', 'pages/games/games']);
  assert.equal(appJson.lazyCodeLoading, 'requiredComponents');
  const projectConfig = JSON.parse(fs.readFileSync(path.join(mpRoot, 'project.config.json'), 'utf8'));
  assert.equal(projectConfig.setting.es6, false);

  const pageSrc = fs.readFileSync(path.join(mpRoot, 'pages', 'player', 'player.js'), 'utf8');
  assert.equal(pageSrc.indexOf('require(\'../../../'), -1);
  assert.match(pageSrc, /select\('#english-video'\)/);
  assert.match(pageSrc, /query\.context/);
  const playerWxml = fs.readFileSync(path.join(mpRoot, 'pages', 'player', 'player.wxml'), 'utf8');
  assert.match(playerWxml, /mediaStatus === 'loading'/);
  assert.match(playerWxml, /onRetryMedia/);
  assert.match(playerWxml, /<slider/);
  assert.match(playerWxml, /bindchange="onSeekChange"/);
  assert.match(playerWxml, /videoMounted/);
  assert.match(playerWxml, /class="now-main"/);
  assert.match(playerWxml, /class="now-meta"/);
  assert.match(playerWxml, /videoFitted/);
  assert.equal(playerWxml.indexOf('cover-view'), -1);
  const gushiWxml = fs.readFileSync(path.join(mpRoot, 'pages', 'gushi', 'gushi.wxml'), 'utf8');
  assert.match(gushiWxml, /is-punct/);
  assert.match(gushiWxml, /rt-hold/);

  let pageConfig = null;
  const navCalls = [];
  global.wx = {
    getStorageSync: function () { return null; },
    setStorageSync: function () {},
    navigateTo: function (opts) { navCalls.push('to:' + opts.url); },
    navigateBack: function () { navCalls.push('back'); },
    reLaunch: function (opts) { navCalls.push('relaunch:' + opts.url); },
    navigateToMiniProgram: function (opts) { navCalls.push('miniapp:' + opts.appId); },
    setClipboardData: function (opts) { navCalls.push('clip:' + opts.data); if (opts.success) opts.success(); },
    showToast: function () {},
    createInnerAudioContext: fakeWx().createInnerAudioContext,
    createVideoContext: fakeWx().createVideoContext
  };
  global.getCurrentPages = function () { return [{}]; };
  global.Page = function (cfg) { pageConfig = cfg; };
  try {
    // 1. 首页加载、两扇门跳转、内置益智游戏跳转与外部微信小游戏跳转
    delete require.cache[require.resolve('../miniprogram/pages/home/home.js')];
    require('../miniprogram/pages/home/home.js');
    assert.ok(pageConfig);
    assert.equal(pageConfig.data.games.length, 5);
    pageConfig.goGushi();
    pageConfig.goEnglish();
    pageConfig.onOpenGame({ currentTarget: { dataset: { id: 'weiqi' } } });
    pageConfig.onJumpMiniApp({ currentTarget: { dataset: { id: 'xiangqi', appid: 'wx7db5c3d985e2b0ff' } } });
    assert.deepEqual(navCalls, [
      'to:/pages/gushi/gushi',
      'to:/pages/player/player',
      'to:/pages/games/games?id=weiqi',
      'miniapp:wx7db5c3d985e2b0ff'
    ]);

    // 2. 古诗 70 首页面加载、选诗、逐句点读与语速切换
    delete require.cache[require.resolve('../miniprogram/pages/gushi/gushi.js')];
    require('../miniprogram/pages/gushi/gushi.js');
    assert.ok(pageConfig);
    const gushiState = Object.assign({}, pageConfig.data);
    const gushiCtx = Object.assign({}, pageConfig, {
      data: gushiState,
      setData: function (patch) { Object.assign(gushiState, patch); }
    });
    gushiCtx.onLoad({});
    assert.equal(gushiState.total, 70);
    gushiCtx.onStart();
    assert.equal(gushiState.view, 'poem');
    assert.equal(gushiState.poem.title, '江南');
    assert.equal(gushiState.poem.scene, 'lotus');
    assert.ok(gushiState.poem.imageUrl.indexOf('/gushi/assets/images/poem-001.jpg') > 0);
    gushiCtx.onCycleRate();
    assert.equal(gushiState.rate, 1);
    gushiCtx.onLineTap({ currentTarget: { dataset: { index: 2 } } });
    assert.equal(gushiState.activeLine, 2);
    gushiCtx.onUnload();

    // 3. 英语跟读页面加载
    delete require.cache[require.resolve('../miniprogram/pages/player/player.js')];
    require('../miniprogram/pages/player/player.js');
    assert.ok(pageConfig);
    const state = Object.assign({}, pageConfig.data);
    const ctx = Object.assign({}, pageConfig, {
      data: state,
      setData: function (patch) { Object.assign(state, patch); }
    });
    ctx.onLoad();
    assert.equal(state.groups.length, 2);
    assert.ok(state.mediaBaseUrl.indexOf('https://goodgoodstudy-daydayup.pages.dev/english') === 0);
    // 验证播放模式切换、目录折叠与列表/播放器视图切换
    assert.equal(state.playMode, 'sequence');
    ctx.onCyclePlayMode();
    assert.equal(state.playMode, 'loop-all');
    ctx.onPick({ currentTarget: { dataset: { id: '一上英语课本跟读视频/U1跟读.mp4' } } });
    assert.equal(state.view, 'player');
    // 拖动进度条：不管有没有本机缓存，都直接 seek 当前视频，
    // 不下载整段视频、不换播放地址、不暂停、不回退进度。
    const remoteSrc = 'https://cdn.example/english/U2跟读.mp4';
    function makeSeekCtx(hasLocalFile) {
      const calls = [];
      const seekState = Object.assign({}, pageConfig.data, {
        isVideo: true,
        playing: true,
        duration: 100,
        currentTime: 2,
        videoSrc: remoteSrc,
        offlineNote: '正在使用本机缓存'
      });
      const seekCtx = Object.assign({}, pageConfig, {
        data: seekState,
        currentItem: { id: 'u2', kind: 'video' },
        offline: {
          lookup: function () { return hasLocalFile ? 'wxfile://saved-u2.mp4' : ''; },
          retain: function () { calls.push('download'); return Promise.resolve(''); }
        },
        _remoteSrc: remoteSrc,
        _retainPromises: {},
        _mountedVideoContext: {
          seek: function (time) { calls.push('ctx-seek:' + time); }
        },
        session: {
          attachVideo: function () { calls.push('attach'); return true; },
          seek: function (time) { calls.push('seek:' + time); return true; },
          pause: function () { calls.push('session-pause'); },
          noteVideoTime: function () {}
        },
        setData: function (patch, callback) {
          Object.assign(seekState, patch);
          if (callback) callback();
        }
      });
      return { ctx: seekCtx, state: seekState, calls: calls };
    }

    [false, true].forEach(function (hasLocalFile) {
      const env = makeSeekCtx(hasLocalFile);
      env.ctx.onSeekChange({ detail: { value: 42 } });
      assert.ok(env.calls.indexOf('seek:42') >= 0, '应直接跳转当前 VideoContext');
      assert.equal(env.calls.indexOf('download'), -1, '跳转不应触发整段视频下载');
      assert.equal(env.calls.indexOf('session-pause'), -1, '跳转不应暂停视频');
      assert.equal(env.state.videoSrc, remoteSrc, '跳转不应切换播放地址');
      assert.equal(env.state.currentTime, 42);
      assert.equal(env.state.curClock, '0:42');
      assert.equal(env.state.seekPercent, 42);
      assert.equal(env.state.playing, true, '应保持原来的播放状态');
      assert.equal(env.state.seekingVideo, false);
      assert.equal(env.state.offlineNote, '正在使用本机缓存');
    });

    // 会话层没拿到上下文时，退回页面级 VideoContext 再试一次
    const fallback = makeSeekCtx(false);
    fallback.ctx.session.seek = function () { return false; };
    assert.equal(fallback.ctx.seekVideo(42), true);
    assert.ok(fallback.calls.indexOf('ctx-seek:42') >= 0);
    assert.equal(fallback.state.offlineNote, '正在使用本机缓存');
    ctx.showLibrary();
    assert.equal(state.view, 'library');

    // 4. 5 合 1 益智小游戏页面（围棋、五子棋、象棋、飞行棋、小钢琴）交互验证
    delete require.cache[require.resolve('../miniprogram/pages/games/games.js')];
    require('../miniprogram/pages/games/games.js');
    assert.ok(pageConfig);
    const gameState = Object.assign({}, pageConfig.data);
    const gameCtx = Object.assign({}, pageConfig, {
      data: gameState,
      setData: function (patch) { Object.assign(gameState, patch); }
    });
    gameCtx.onLoad({ id: 'gomoku' });
    assert.equal(gameState.activeGame, 'gomoku');
    gameCtx.onGomokuTap({ currentTarget: { dataset: { r: 5, c: 5 } } });
    assert.equal(gameState.gomokuBoard[5][5].color, 1);

    gameCtx.onSwitchGame({ currentTarget: { dataset: { id: 'weiqi' } } });
    gameCtx.onWeiqiTap({ currentTarget: { dataset: { r: 4, c: 4 } } });
    assert.equal(gameState.weiqiBoard[4][4].color, 1);

    // 验证围棋切换 13 路与 19 路、自由围空模式与三级难度切换
    gameCtx.onSetDifficulty({ currentTarget: { dataset: { diff: 3 } } });
    assert.equal(gameState.difficulty, 3);
    gameCtx.onSetWeiqiSize({ currentTarget: { dataset: { size: 19 } } });
    assert.equal(gameState.weiqiSize, 19);
    assert.equal(gameState.weiqiBoard.length, 19);
    gameCtx.onSetWeiqiRule({ currentTarget: { dataset: { rule: 'free' } } });
    assert.equal(gameState.weiqiRule, 'free');

    // 验证五子棋切换 15 路标准棋盘
    gameCtx.onSwitchGame({ currentTarget: { dataset: { id: 'gomoku' } } });
    gameCtx.onSetGomokuSize({ currentTarget: { dataset: { size: 15 } } });
    assert.equal(gameState.gomokuSize, 15);
    assert.equal(gameState.gomokuBoard.length, 15);

    gameCtx.onSwitchGame({ currentTarget: { dataset: { id: 'xiangqi' } } });
    gameCtx.onXiangqiTap({ currentTarget: { dataset: { r: 6, c: 0 } } }); // 选兵
    gameCtx.onXiangqiTap({ currentTarget: { dataset: { r: 5, c: 0 } } }); // 兵进一步
    assert.equal(gameState.xiangqiBoard[5][0].code, 'rP');

    // 验证飞行棋四色十字航道、4 机编队与同色连跳
    gameCtx.onSwitchGame({ currentTarget: { dataset: { id: 'ludo' } } });
    assert.equal(gameState.ludoRedPlanes.length, 4);
    assert.equal(gameState.ludoBluePlanes.length, 4);
    const engine = require('../miniprogram/shared/games-engine.js');
    assert.equal(engine.LUDO_RING_COORDS.length, 40);
    engine.applyLudoDice(gameCtx.ludo, 6);
    engine.moveLudoToken(gameCtx.ludo, 0); // 1号机起飞至第1步
    assert.equal(gameCtx.ludo.tokens.r[0], 1);
    engine.applyLudoDice(gameCtx.ludo, 4);
    engine.moveLudoToken(gameCtx.ludo, 0); // 1 + 4 = 5（红格），触发同色连跳 +4 -> 9
    assert.equal(gameCtx.ludo.tokens.r[0], 9);

    gameCtx.onSwitchGame({ currentTarget: { dataset: { id: 'piano' } } });
    assert.equal(gameState.expectedNote, 1);
    gameCtx.onPressKey({ currentTarget: { dataset: { note: 1 } } });
    assert.equal(gameState.pianoStep, 1);
    gameCtx.onUnload();
  } finally {
    delete global.wx;
    delete global.getCurrentPages;
    delete global.Page;
  }
});

