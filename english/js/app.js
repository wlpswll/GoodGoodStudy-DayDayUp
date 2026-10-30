/* 英语跟读播放页。分组和断点在 catalog.js / progress.js，这里只绑定页面。 */
(function () {
  var catalog = window.EnglishCatalog;
  var progressApi = window.EnglishProgress;
  var platform = window.EnglishPlatform;
  var state = {
    items: [],
    groups: [],
    current: null,
    rate: progressApi.DEFAULT_RATE,
    storage: platform.createStorage(),
    pendingSeek: null,
    scrubbing: false,
    writingSeek: false,
    maxWindow: false,
    usingFullscreen: false,
    leaveRequested: false,
    collapsed: {},
    scrubTime: null,
    seekAttempts: 0,
    restored: false,
    catalogOpen: false,
    lastWrite: 0
  };
  var el = {};

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function closest(node, selector) {
    while (node && node.nodeType === 1) {
      if (node.matches && node.matches(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }
  function withSC(url) {
    return window.__withSC ? window.__withSC(url) : url;
  }
  function activeMedia() {
    return state.current && state.current.kind === 'video' ? el.video : el.audio;
  }
  function kindQueue() {
    if (!state.current) return [];
    return catalog.flattenKind(state.groups, state.current.kind);
  }
  function findById(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) return state.items[i];
    }
    return null;
  }

  function cache() {
    ['library', 'player', 'loading', 'libraryList', 'librarySearch', 'catalogList', 'catalogSearch',
      'catalog', 'catalogBtn', 'closeCatalog', 'catCount', 'homeBtn', 'counter', 'stage', 'video',
      'audio', 'playBtn', 'prevBtn', 'nextBtn', 'seek', 'curTime', 'durTime', 'speedBtn', 'speedMenu',
      'speedWrap', 'maxBtn', 'nowTitle', 'nowFolder', 'nowKind', 'resumeHint', 'mediaError', 'resumeCard',
      'resumeTitle', 'resumeTime', 'libSub'].forEach(function (id) {
      el[id] = $(id);
    });
    el.audio = document.createElement('audio');
    el.audio.id = 'audio';
    el.audio.setAttribute('preload', 'metadata');
    el.audio.setAttribute('playsinline', '');
    el.audio.setAttribute('webkit-playsinline', '');
    el.audio.style.display = 'none';
    document.body.appendChild(el.audio);
    el.video.playsInline = true;
  }

  function showLibrary() {
    el.player.classList.remove('active');
    el.library.classList.add('active');
    closeCatalog();
    updateResumeCard();
  }
  function showPlayer() {
    el.library.classList.remove('active');
    el.player.classList.add('active');
  }

  function foldKey(kind, folder) {
    return kind + '/' + folder;
  }
  function renderList(container, query) {
    var html = '';
    var searching = !!String(query || '').trim();
    state.groups.forEach(function (group) {
      var foldersHtml = '';
      var visible = 0;
      group.folders.forEach(function (folder) {
        var items = folder.items.filter(function (item) {
          return catalog.matchesQuery(item, query);
        });
        if (!items.length) return;
        visible += items.length;
        var key = foldKey(group.kind, folder.name);
        var folded = !searching && !!state.collapsed[key];
        foldersHtml += '<div class="cat-group' + (folded ? ' is-folded' : '') + '">' +
          '<button type="button" class="cat-fold" data-fold="' + esc(key) + '" aria-expanded="' + (folded ? 'false' : 'true') + '">' +
          '<span>' + esc(folder.name) + '</span>' +
          '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
          '<div class="cat-grid">';
        items.forEach(function (item) {
          var current = state.current && state.current.id === item.id ? ' current' : '';
          foldersHtml += '<button type="button" class="cat-item' + current + '" data-id="' + esc(item.id) + '">' +
            '<span class="badge">' + (item.kind === 'video' ? '视频' : '音频') + '</span>' +
            '<span class="meta"><span class="t">' + esc(item.title) + '</span>' +
            '<span class="a">' + esc(String(item.ext || '').toUpperCase()) + '</span></span></button>';
        });
        foldersHtml += '</div></div>';
      });
      if (!visible) return;
      html += '<section class="kind-block" data-kind="' + group.kind + '"><h3>' + esc(group.label) +
        ' <em>' + visible + '</em></h3>' + foldersHtml + '</section>';
    });
    container.innerHTML = html || '<div class="cat-empty">没有找到相关内容</div>';
  }
  function renderLists() {
    var libraryTop = el.libraryList.scrollTop;
    var catalogTop = el.catalogList.scrollTop;
    renderList(el.libraryList, el.librarySearch.value);
    renderList(el.catalogList, el.catalogSearch.value);
    el.libraryList.scrollTop = libraryTop;
    el.catalogList.scrollTop = catalogTop;
  }

  function saveTime() {
    if (state.scrubbing && Number.isFinite(state.scrubTime)) return state.scrubTime;
    if (state.pendingSeek != null) return state.pendingSeek;
    try {
      var time = activeMedia().currentTime;
      return isFinite(time) && time > 0 ? time : 0;
    } catch (err) { return 0; }
  }
  function saveNow(force) {
    if (!state.current) return;
    var now = Date.now();
    if (!force && now - state.lastWrite < 1000) return;
    state.lastWrite = now;
    progressApi.writeProgress(state.storage, progressApi.createSnapshot(state.current, saveTime(), state.rate, now));
    updateResumeCard();
  }
  function updateResumeCard() {
    var saved = progressApi.readProgress(state.storage);
    var resume = progressApi.resolveResume(saved, state.items);
    if (!resume || !resume.media) {
      el.resumeCard.hidden = true;
      return;
    }
    el.resumeCard.hidden = false;
    el.resumeTitle.textContent = resume.media.title;
    el.resumeTime.textContent = progressApi.formatClock(resume.currentTime);
  }

  function clearError() {
    el.mediaError.hidden = true;
    el.mediaError.textContent = '';
  }
  function showError(message) {
    el.mediaError.hidden = false;
    el.mediaError.textContent = message;
  }
  function setPlaying(playing) {
    el.playBtn.classList.toggle('playing', playing);
    el.stage.classList.toggle('playing', playing);
    el.playBtn.setAttribute('aria-label', playing ? '暂停' : '播放');
  }
  function updateProgress(forced) {
    var media = activeMedia();
    var duration = media.duration || 0;
    if (state.scrubbing && forced == null) {
      el.durTime.textContent = progressApi.formatClock(duration);
      return;
    }
    var time = forced != null ? forced : (media.currentTime || 0);
    var max = isFinite(duration) && duration > 0 ? duration : 100;
    state.writingSeek = true;
    if (Number(el.seek.max) !== max) el.seek.max = max;
    el.seek.value = time;
    setTimeout(function () { state.writingSeek = false; }, 0);
    el.seek.style.setProperty('--pct', (duration ? (time / duration * 100) : 0) + '%');
    el.curTime.textContent = progressApi.formatClock(time);
    el.durTime.textContent = progressApi.formatClock(duration);
  }
  function updateNav() {
    var queue = kindQueue();
    var index = -1;
    for (var i = 0; i < queue.length; i++) {
      if (state.current && queue[i].id === state.current.id) index = i;
    }
    var label = state.current && state.current.kind === 'video' ? '视频' : '音频';
    el.counter.textContent = label + ' ' + (index + 1) + ' / ' + queue.length;
    el.prevBtn.disabled = index <= 0;
    el.nextBtn.disabled = index < 0 || index >= queue.length - 1;
  }
  function renderMeta(item) {
    el.nowKind.textContent = item.kind === 'video' ? '视频' : '音频';
    el.nowTitle.textContent = item.title;
    el.nowFolder.textContent = item.folder;
    el.resumeHint.hidden = !state.restored;
    updateMaxButton();
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || null;
  }
  function updateMaxButton() {
    var video = !!(state.current && state.current.kind === 'video');
    el.maxBtn.hidden = !video;
    el.maxBtn.setAttribute('aria-pressed', state.maxWindow ? 'true' : 'false');
    el.maxBtn.setAttribute('aria-label', state.maxWindow ? '退出全屏' : '全屏');
  }
  function nativeVideoFullscreen() {
    var ua = navigator.userAgent || '';
    var touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return (/iPhone|iPad|iPod/.test(ua) || touchMac) && typeof el.video.webkitEnterFullscreen === 'function';
  }
  function enterMax() {
    if (!state.current || state.current.kind !== 'video') return;
    closeCatalog();
    if (nativeVideoFullscreen()) {
      try {
        el.video.webkitEnterFullscreen();
        return;
      } catch (err) { /* 继续尝试标准全屏 */ }
    }
    var target = el.player;
    var request = target.requestFullscreen || target.webkitRequestFullscreen || target.webkitRequestFullScreen;
    state.maxWindow = true;
    el.player.classList.add('is-max');
    updateMaxButton();
    if (!request) return;
    var pending;
    try { pending = request.call(target); } catch (err) { pending = null; }
    if (pending && pending.then) {
      pending.then(function () { state.usingFullscreen = true; }).catch(function () {
        state.usingFullscreen = false;
      });
    }
  }
  function finishExit() {
    state.leaveRequested = false;
    state.maxWindow = false;
    state.usingFullscreen = false;
    el.player.classList.remove('is-max');
    updateMaxButton();
  }
  function exitMax() {
    if (!state.maxWindow && !fullscreenElement()) {
      updateMaxButton();
      return;
    }
    state.leaveRequested = true;
    state.maxWindow = false;
    state.usingFullscreen = false;
    el.player.classList.remove('is-max');
    updateMaxButton();
    var exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
    if (exit) {
      try {
        var pending = exit.call(document);
        if (pending && pending.then) {
          pending.then(function () {
            if (!fullscreenElement()) finishExit();
          }).catch(function () {
            if (!fullscreenElement()) finishExit();
          });
        }
      } catch (err) { /* 系统全屏退出失败时仍还原页面布局 */ }
    }
    if (el.video.webkitExitFullscreen) {
      try { el.video.webkitExitFullscreen(); } catch (err) { /* 视频自己的全屏可能已经结束 */ }
    }
    if (!fullscreenElement()) finishExit();
  }
  function toggleMax() {
    if (state.maxWindow || fullscreenElement()) exitMax();
    else enterMax();
  }
  function onFullscreenChange() {
    if (state.leaveRequested) {
      if (!fullscreenElement()) finishExit();
      return;
    }
    if (fullscreenElement()) {
      state.usingFullscreen = true;
      state.maxWindow = true;
      el.player.classList.add('is-max');
    } else if (state.usingFullscreen) {
      state.usingFullscreen = false;
      state.maxWindow = false;
      el.player.classList.remove('is-max');
    }
    updateMaxButton();
  }

  function seekableHas(media, time) {
    var ranges = media.seekable;
    if (!ranges || !ranges.length) return media.readyState >= 1;
    for (var i = 0; i < ranges.length; i++) {
      if (time >= ranges.start(i) - 0.05 && time <= ranges.end(i) + 0.35) return true;
    }
    return false;
  }
  var applyingSeek = false;
  function applyPendingSeek() {
    if (applyingSeek || state.pendingSeek == null || state.scrubbing || !state.current) return;
    var media = activeMedia();
    if (media.seeking) return;
    var duration = media.duration;
    if (!isFinite(duration) || duration <= 0) return;
    var time = progressApi.clampResumeTime(state.pendingSeek, duration);
    if (time <= 0.2) {
      state.pendingSeek = null;
      state.seekAttempts = 0;
      return;
    }
    if (Math.abs((media.currentTime || 0) - time) <= 0.5) {
      state.pendingSeek = null;
      state.seekAttempts = 0;
      updateProgress();
      if (state.restored) el.resumeHint.hidden = false;
      return;
    }
    if (!seekableHas(media, time) || state.seekAttempts > 12) return;
    state.seekAttempts += 1;
    applyingSeek = true;
    try { media.currentTime = time; } catch (err) { /* 等下一次 progress 再试 */ }
    applyingSeek = false;
  }

  function loadSource(item, seekTime) {
    var media = item.kind === 'video' ? el.video : el.audio;
    var other = item.kind === 'video' ? el.audio : el.video;
    try { other.pause(); } catch (err) { /* 另一路可能还没有地址 */ }
    other.removeAttribute('src');
    try { other.load(); } catch (err) { /* 清空失败时忽略 */ }
    state.pendingSeek = seekTime > 0.2 ? seekTime : null;
    state.seekAttempts = 0;
    el.stage.classList.toggle('is-video', item.kind === 'video');
    el.stage.classList.toggle('is-audio', item.kind === 'audio');
    clearError();
    setPlaying(false);
    media.playbackRate = state.rate;
    media.src = withSC(catalog.resolveSrc(item, ''));
    try { media.load(); } catch (err) { /* 部分浏览器在赋值 src 时已经开始加载 */ }
  }

  function openItem(item, options) {
    var opts = options || {};
    var same = state.current && state.current.id === item.id && activeMedia().getAttribute('src');
    if (state.current && state.current.id !== item.id) saveNow(true);
    var seekTime = opts.seekTime;
    if (seekTime == null) seekTime = progressApi.timeFor(progressApi.readProgress(state.storage), item.id);
    state.current = item;
    state.restored = Number(seekTime) > 0.2 && (!!opts.restored || opts.seekTime == null);
    showPlayer();
    renderMeta(item);
    if (!same) loadSource(item, seekTime || 0);
    else if (opts.seekTime != null) {
      state.pendingSeek = opts.seekTime;
      applyPendingSeek();
    }
    updateNav();
    renderLists();
    closeCatalog();
    closeSpeed();
    if (!item || item.kind !== 'video') exitMax();
    else updateMaxButton();
    if (opts.autoplay) tryPlay();
    saveNow(true);
  }

  function step(delta) {
    var queue = kindQueue();
    var index = -1;
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].id === state.current.id) index = i;
    }
    var next = queue[index + delta];
    if (next) openItem(next, { autoplay: !activeMedia().paused });
  }
  function tryPlay() {
    var pending = activeMedia().play();
    if (pending && pending.catch) {
      pending.catch(function () {
        showError('没能开始播放，请再按一次播放');
      });
    }
  }
  function togglePlay() {
    if (!state.current) return;
    if (activeMedia().paused) tryPlay();
    else activeMedia().pause();
  }

  function applyRate(rate, persist) {
    state.rate = progressApi.normalizeRate(rate);
    el.audio.playbackRate = state.rate;
    el.video.playbackRate = state.rate;
    el.speedBtn.textContent = progressApi.formatRate(state.rate);
    el.speedBtn.classList.toggle('active', state.rate !== 1);
    el.speedBtn.setAttribute('aria-label', '选择倍速，当前 ' + state.rate + ' 倍');
    var buttons = el.speedMenu.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-selected', Number(buttons[i].getAttribute('data-rate')) === state.rate ? 'true' : 'false');
    }
    if (persist) saveNow(true);
  }
  function closeSpeed() {
    el.speedMenu.hidden = true;
    el.speedBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleSpeed() {
    var open = el.speedMenu.hidden;
    el.speedMenu.hidden = !open;
    el.speedBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function openCatalog() {
    state.catalogOpen = true;
    el.catalog.classList.add('open');
    el.catalog.setAttribute('aria-hidden', 'false');
    el.catalogSearch.value = '';
    renderLists();
  }
  function closeCatalog() {
    state.catalogOpen = false;
    el.catalog.classList.remove('open');
    el.catalog.setAttribute('aria-hidden', 'true');
  }

  function onMediaEvent(event, handler) {
    el.audio.addEventListener(event, function (ev) {
      if (!state.current || state.current.kind === 'video') return;
      handler(ev);
    });
    el.video.addEventListener(event, function (ev) {
      if (!state.current || state.current.kind !== 'video') return;
      handler(ev);
    });
  }

  function bindList(container) {
    container.addEventListener('click', function (event) {
      var fold = closest(event.target, '.cat-fold');
      if (fold) {
        var key = fold.getAttribute('data-fold');
        state.collapsed[key] = !state.collapsed[key];
        renderLists();
        return;
      }
      var button = closest(event.target, '.cat-item');
      if (!button) return;
      var item = findById(button.getAttribute('data-id'));
      if (item) openItem(item, { autoplay: true, restored: false });
    });
  }
  function finishScrub() {
    var time = state.scrubTime;
    state.scrubbing = false;
    state.scrubTime = null;
    if (!Number.isFinite(time) || !state.current) return;
    state.pendingSeek = time;
    try { activeMedia().currentTime = time; } catch (err) { /* 松手时再跳一次 */ }
    updateProgress(time);
    saveNow(true);
  }

  function bind() {
    progressApi.RATES.forEach(function (rate) {
      var button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'option');
      button.setAttribute('data-rate', String(rate));
      button.textContent = progressApi.formatRate(rate);
      button.addEventListener('click', function () {
        applyRate(rate, true);
        closeSpeed();
      });
      el.speedMenu.appendChild(button);
    });
    applyRate(state.rate, false);

    el.homeBtn.addEventListener('click', function () {
      saveNow(true);
      exitMax();
      try { activeMedia().pause(); } catch (err) { /* 尚未加载 */ }
      showLibrary();
    });
    el.maxBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      toggleMax();
    });
    el.resumeCard.addEventListener('click', function () {
      var resume = progressApi.resolveResume(progressApi.readProgress(state.storage), state.items);
      if (resume && resume.media) openItem(resume.media, { seekTime: resume.currentTime, restored: true, autoplay: true });
    });
    el.catalogBtn.addEventListener('click', openCatalog);
    el.closeCatalog.addEventListener('click', closeCatalog);
    el.catalog.addEventListener('click', function (event) {
      if (event.target === el.catalog) closeCatalog();
    });
    el.librarySearch.addEventListener('input', renderLists);
    el.catalogSearch.addEventListener('input', renderLists);
    bindList(el.libraryList);
    bindList(el.catalogList);
    el.playBtn.addEventListener('click', togglePlay);
    el.stage.addEventListener('click', togglePlay);
    el.prevBtn.addEventListener('click', function () { step(-1); });
    el.nextBtn.addEventListener('click', function () { step(1); });
    el.speedBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      toggleSpeed();
    });
    document.addEventListener('click', function (event) {
      if (!el.speedWrap.contains(event.target)) closeSpeed();
    });

    el.seek.addEventListener('pointerdown', function () { state.scrubbing = true; });
    el.seek.addEventListener('input', function (event) {
      if (state.writingSeek) return;
      if (event && event.isTrusted === false) return;
      var media = activeMedia();
      var duration = media.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      var time = parseFloat(el.seek.value);
      if (!Number.isFinite(time)) return;
      el.curTime.textContent = progressApi.formatClock(time);
      el.seek.style.setProperty('--pct', (time / duration * 100) + '%');
      if (!state.scrubbing) {
        state.pendingSeek = time;
        try { media.currentTime = time; } catch (err) { /* 键盘跳转失败时保持原位 */ }
        saveNow(true);
        return;
      }
      state.scrubTime = time;
      state.pendingSeek = null;
      try { media.currentTime = time; } catch (err) { /* 缓冲不够时松手再跳 */ }
    });
    ['change', 'pointerup', 'pointercancel', 'touchend', 'mouseup'].forEach(function (name) {
      el.seek.addEventListener(name, finishScrub);
    });

    onMediaEvent('loadedmetadata', function () {
      activeMedia().playbackRate = state.rate;
      applyPendingSeek();
      updateProgress();
    });
    onMediaEvent('canplay', applyPendingSeek);
    onMediaEvent('progress', applyPendingSeek);
    onMediaEvent('timeupdate', function () {
      if (!state.scrubbing) updateProgress();
      saveNow(false);
    });
    onMediaEvent('seeked', function () {
      applyPendingSeek();
      saveNow(true);
    });
    onMediaEvent('play', function () {
      state.restored = false;
      el.resumeHint.hidden = true;
      setPlaying(true);
    });
    onMediaEvent('pause', function () {
      setPlaying(false);
      saveNow(true);
    });
    onMediaEvent('ended', function () {
      setPlaying(false);
      updateProgress();
      saveNow(true);
    });
    onMediaEvent('error', function () {
      showError('这个格式当前浏览器播不了，可以换一个课，或换用支持该格式的环境');
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') saveNow(true);
    });
    window.addEventListener('pagehide', function () { saveNow(true); });
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    el.video.addEventListener('webkitbeginfullscreen', function () {
      state.usingFullscreen = true;
      state.maxWindow = true;
      el.player.classList.add('is-max');
      updateMaxButton();
    });
    el.video.addEventListener('webkitendfullscreen', function () {
      state.usingFullscreen = false;
      state.maxWindow = false;
      el.player.classList.remove('is-max');
      updateMaxButton();
    });
    document.addEventListener('keydown', function (event) {
      var tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (event.key === 'Escape' && state.maxWindow) {
        exitMax();
        return;
      }
      if (state.catalogOpen && event.key === 'Escape') {
        closeCatalog();
        return;
      }
      if (state.catalogOpen || !el.player.classList.contains('active')) return;
      if (event.key === ' ') {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'ArrowRight') step(1);
    });

    function warm() {
      try { el.audio.load(); el.video.load(); } catch (err) { /* 预热失败不影响点播 */ }
    }
    if (window.WeixinJSBridge) warm();
    else document.addEventListener('WeixinJSBridgeReady', warm, false);
  }

  function boot(data) {
    state.items = data.items || [];
    state.groups = catalog.groupCatalog(state.items);
    var videos = 0;
    var audios = 0;
    state.items.forEach(function (item) {
      if (item.kind === 'video') videos += 1;
      else if (item.kind === 'audio') audios += 1;
    });
    el.libSub.textContent = '共 ' + state.items.length + ' 个 · 视频 ' + videos + ' · 音频 ' + audios;
    el.catCount.textContent = state.items.length + ' 个';
    var saved = progressApi.readProgress(state.storage);
    var resume = progressApi.resolveResume(saved, state.items);
    state.rate = resume ? resume.playbackRate : progressApi.DEFAULT_RATE;
    applyRate(state.rate, false);
    renderLists();
    updateResumeCard();
    if (resume && resume.media) {
      openItem(resume.media, { seekTime: resume.currentTime, restored: true, autoplay: false });
    }
    el.loading.classList.add('hide');
  }

  function fail(message) {
    el.loading.innerHTML = '<div class="loading-inner">' + esc(message) +
      '<br><span style="font-size:12px;letter-spacing:0">请用本地网页服务打开 english/index.html</span></div>';
  }

  function init() {
    if (!catalog || !progressApi || !platform) {
      fail('播放脚本不完整');
      return;
    }
    cache();
    bind();
    fetch(withSC('data/media.json')).then(function (response) {
      if (!response.ok) throw new Error('清单没有读到');
      return response.json();
    }).then(boot).catch(function (err) {
      fail(err && err.message ? err.message : '清单没有读到');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
