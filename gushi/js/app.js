/* 古诗70首 · 纯前端交互（无框架、无外部依赖，微信/QQ内置浏览器可用） */
(function () {
  'use strict';

  function withSC(url) {
    return (window.__withSC && url) ? window.__withSC(url) : (url || '');
  }
  var DATA_URL = withSC('data/poems.json');
  var sceneClasses = ['scene-ink', 'scene-petal', 'scene-lotus', 'scene-mountain',
    'scene-grassland', 'scene-playful', 'scene-autumn', 'scene-moon', 'scene-snow', 'scene-rain'];

  var SPEEDS = [1, 1.25, 0.75, 0.85];  // 点击语速按钮依次循环
  var DEFAULT_RATE = 0.85;             // 默认语速
  var state = { data: null, poems: [], noIndex: {}, index: -1, catalogOpen: false, scrubbing: false, rate: DEFAULT_RATE };
  var el = {};

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rubyLine(text, pys) {
    var out = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      var py = pys && pys[i];
      if (py && py !== ch && /[\u4e00-\u9fff]/.test(ch)) {
        out += '<ruby>' + esc(ch) + '<rt>' + esc(py) + '</rt></ruby>';
      } else {
        out += esc(ch);
      }
    }
    return out;
  }

  function closest(node, selector) {
    while (node && node.nodeType === 1) {
      if (node.matches && node.matches(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  function cache() {
    ['cover', 'poem', 'loading', 'startBtn', 'homeBtn', 'catalogBtn', 'catalog', 'closeCatalog',
      'catalogList', 'catCount', 'searchInput', 'counter', 'artwork', 'artImg', 'artBlur',
      'poemTitle', 'poemAuthor', 'poemLines', 'poemScroll', 'scene', 'particles', 'playBtn',
      'prevBtn', 'nextBtn', 'seek', 'curTime', 'durTime', 'speedBtn', 'audio'].forEach(function (id) {
        el[id] = $(id);
      });
  }

  /* ---------- 数据加载 ---------- */
  function load() {
    fetch(DATA_URL).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      state.data = d;
      state.poems = d.poems || [];
      state.poems.forEach(function (p, i) { state.noIndex[p.no] = i; });
      el.catCount.textContent = state.poems.length + ' 首';
      buildCatalog();
      route();
      el.loading.classList.add('hide');
    }).catch(function (err) {
      el.loading.innerHTML = '<div class="loading-inner">加载失败：' + esc(err.message) +
        '<br><span style="font-size:12px;letter-spacing:0">请通过网页或本地服务打开，不要直接双击 index.html</span></div>';
    });
  }

  /* ---------- 路由 ---------- */
  function setHash(path) {
    try { history.pushState(null, '', location.pathname + location.search + path); }
    catch (e) { location.hash = path; }
  }
  function parseHash(hash) {
    var m = (hash || '').match(/^#\/p\/(\d+)$/);
    return m ? { type: 'poem', no: parseInt(m[1], 10) } : { type: 'cover' };
  }
  function route() {
    var r = parseHash(location.hash);
    if (r.type === 'cover') { showCover(); return; }
    var idx = state.noIndex[r.no];
    if (idx != null) showPoem(idx, null, false);
    else { setHash('#/'); showCover(); }
  }

  /* ---------- 导航 ---------- */
  function navTo(index, dir, autoplay) {
    if (!state.poems.length || index < 0 || index >= state.poems.length) return;
    setHash('#/p/' + state.poems[index].no);
    showPoem(index, dir, autoplay);
  }
  function navNext() {
    if (state.index < state.poems.length - 1) navTo(state.index + 1, 'next', isPlaying());
  }
  function navPrev() {
    if (state.index > 0) navTo(state.index - 1, 'prev', isPlaying());
  }
  function goCover() { setHash('#/'); showCover(); }

  /* ---------- 渲染 ---------- */
  function showCover() {
    stopAudio();
    state.index = -1;
    el.poem.classList.remove('active');
    el.cover.classList.add('active');
    closeCatalog();
  }

  function showPoem(index, dir, autoplay) {
    index = Math.max(0, Math.min(state.poems.length - 1, index));
    var p = state.poems[index];
    var changed = state.index !== index;

    stopAudio();
    state.index = index;

    el.counter.textContent = (index + 1) + ' / ' + state.poems.length;
    el.poemTitle.innerHTML = rubyLine(p.title, p.titlePinyins);
    el.poemAuthor.textContent = p.dynasty ? (p.dynasty + ' · ' + p.author) : p.author;

    var n = p.lines.length;
    el.poem.style.setProperty('--line-size',
      n >= 8 ? 'clamp(16px,4.1vw,21px)' : n >= 6 ? 'clamp(17px,4.4vw,23px)' : 'clamp(19px,5vw,25px)');
    var html = '';
    for (var i = 0; i < p.lines.length; i++) {
      html += '<p class="line" data-i="' + i + '">' + rubyLine(p.lines[i], (p.linePinyins || [])[i]) + '</p>';
    }
    el.poemLines.innerHTML = html;

    setScene(p);
    el.artwork.classList.remove('reveal');
    el.artImg.onload = function () { el.artwork.classList.add('reveal'); };
    el.artImg.onerror = function () { el.artwork.classList.add('reveal'); };
    var imgSrc = withSC(p.image);
    el.artImg.src = imgSrc;
    el.artBlur.style.backgroundImage = 'url("' + imgSrc + '")';

    el.audio.src = withSC(p.audio);
    el.audio.load();
    resetProgress();

    el.prevBtn.disabled = index <= 0;
    el.nextBtn.disabled = index >= state.poems.length - 1;
    updateCatalogCurrent();

    if (changed) {
      el.cover.classList.remove('active');
      el.poem.classList.add('active');
      el.poem.classList.remove('enter-next', 'enter-prev');
      void el.poem.offsetWidth;
      if (dir) el.poem.classList.add(dir === 'next' ? 'enter-next' : 'enter-prev');
      closeCatalog();
    }
    if (autoplay) tryPlay();
  }

  function resetProgress() {
    el.seek.value = 0;
    el.seek.style.setProperty('--pct', '0%');
    el.curTime.textContent = '0:00';
    el.durTime.textContent = '0:00';
  }

  /* ---------- 场景 ---------- */
  function sceneFor(p) {
    var t = p.title + p.lines.join('') + p.author + p.dynasty;
    if (/竹|石灰|墨梅|人杰/.test(t)) return 'ink';
    if (/大雪|寒江雪|雪满|雪纷纷|风雪/.test(t)) return 'snow';
    if (/敕勒|穹庐|牛羊/.test(t)) return 'grassland';
    if (/莲|荷|蜻蜓/.test(t)) return 'lotus';
    if (/明月|月落|秋月|洞庭|湖光|异乡|思亲|故园|思乡|愁眠/.test(t)) return 'moon';
    if (/稚子|小娃|儿童|散学|纸鸢|偷采|骑黄牛|捕鸣蝉|学种瓜|鹅/.test(t)) return 'playful';
    if (/雨|清明/.test(t)) return 'rain';
    if (/霜叶|夕阳|黄昏|落叶|暮|秋夜|秋风/.test(t)) return 'autumn';
    if (/春江|江花|百花|采得/.test(t)) return 'petal';
    if (/山|江|河|海|湖|浪|云|峰|岭|潭|瀑布|岳|原/.test(t)) return 'mountain';
    if (/花|春|柳|莺|桃|杏|东风|芳|绿/.test(t)) return 'petal';
    return 'ink';
  }

  var particleCfg = {
    ink: { n: 10 }, petal: { n: 14 }, lotus: { n: 7, kind: 'ripple', extra: 6, kind2: 'glow', top2: true },
    mountain: { n: 5, kind: 'cloud', top: true }, grassland: { n: 6, kind: 'cloud', top: true },
    playful: { n: 7, top: true }, autumn: { n: 14 }, moon: { n: 12, top: true, extra: 3, kind2: 'cloud', top2: true },
    snow: { n: 20 }, rain: { n: 18 }
  };
  function buildParticles(name) {
    var c = particleCfg[name] || particleCfg.ink;
    var html = '';
    function rand(a, b) { return a + Math.random() * (b - a); }
    function one(kind, top) {
      var style = 'left:' + rand(0, 100).toFixed(1) + '%;animation-delay:-' + rand(0, 10).toFixed(1) + 's;';
      if (kind !== 'rain') style += 'animation-duration:' + rand(7, 11).toFixed(1) + 's;';
      if (top) style += 'top:' + rand(6, 74).toFixed(1) + '%;';
      return '<span class="particle"' + (kind ? ' data-kind="' + kind + '"' : '') + ' style="' + style + '"></span>';
    }
    for (var i = 0; i < c.n; i++) html += one(c.kind, c.top);
    if (c.extra) for (var j = 0; j < c.extra; j++) html += one(c.kind2, c.top2);
    return html;
  }
  function setScene(p) {
    var name = sceneFor(p);
    el.poem.classList.remove.apply(el.poem.classList, sceneClasses);
    el.poem.classList.add('scene-' + name);
    el.particles.innerHTML = buildParticles(name);
  }

  /* ---------- 目录 ---------- */
  function buildCatalog() {
    var groups = [], map = {};
    state.poems.forEach(function (p, i) {
      var d = p.dynasty || '其他';
      if (!map[d]) { map[d] = { name: d, items: [] }; groups.push(map[d]); }
      map[d].items.push({ p: p, i: i });
    });
    var html = '';
    groups.forEach(function (g) {
      html += '<div class="cat-group"><h4>' + esc(g.name) + '</h4><div class="cat-grid">';
      g.items.forEach(function (it) {
        var key = esc((it.p.no + ' ' + it.p.title + ' ' + it.p.author + ' ' + it.p.dynasty).toLowerCase());
        html += '<button class="cat-item" data-index="' + it.i + '" data-key="' + key + '">' +
          '<span class="n">' + it.p.no + '</span><span class="t">' + esc(it.p.title) + '</span>' +
          '<span class="a">' + esc(it.p.author) + '</span></button>';
      });
      html += '</div></div>';
    });
    html += '<div class="cat-empty" id="catEmpty" style="display:none">没有找到相关的诗</div>';
    el.catalogList.innerHTML = html;

    el.catalogList.addEventListener('click', function (e) {
      var btn = closest(e.target, '.cat-item');
      if (!btn) return;
      var was = isPlaying();
      navTo(parseInt(btn.getAttribute('data-index'), 10), null, was);
    });
  }
  function filterCatalog() {
    var q = (el.searchInput.value || '').trim().toLowerCase();
    var items = el.catalogList.querySelectorAll('.cat-item');
    var groups = el.catalogList.querySelectorAll('.cat-group');
    for (var i = 0; i < items.length; i++) {
      items[i].style.display = (!q || items[i].getAttribute('data-key').indexOf(q) >= 0) ? '' : 'none';
    }
    var total = 0;
    for (var g = 0; g < groups.length; g++) {
      var its = groups[g].querySelectorAll('.cat-item'), vis = 0;
      for (var k = 0; k < its.length; k++) if (its[k].style.display !== 'none') vis++;
      groups[g].style.display = vis ? '' : 'none';
      total += vis;
    }
    var empty = $('catEmpty');
    if (empty) empty.style.display = total ? 'none' : 'block';
  }
  function updateCatalogCurrent() {
    var items = el.catalogList.querySelectorAll('.cat-item');
    for (var i = 0; i < items.length; i++) {
      if (parseInt(items[i].getAttribute('data-index'), 10) === state.index) items[i].classList.add('current');
      else items[i].classList.remove('current');
    }
  }
  function openCatalog() {
    state.catalogOpen = true;
    el.catalog.classList.add('open');
    el.catalog.setAttribute('aria-hidden', 'false');
    el.searchInput.value = '';
    filterCatalog();
    updateCatalogCurrent();
  }
  function closeCatalog() {
    state.catalogOpen = false;
    el.catalog.classList.remove('open');
    el.catalog.setAttribute('aria-hidden', 'true');
  }

  /* ---------- 音频 ---------- */
  function isPlaying() { return !el.audio.paused && !el.audio.ended; }
  function stopAudio() { try { el.audio.pause(); el.audio.currentTime = 0; } catch (e) {} }
  function tryPlay() {
    try {
      var pr = el.audio.play();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (e) {}
  }
  function togglePlay() { if (el.audio.paused) tryPlay(); else el.audio.pause(); }
  function fmtTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }
  function updateProgress(force) {
    var d = el.audio.duration || 0;
    var t = force != null ? force : el.audio.currentTime;
    el.seek.max = d || 100;
    el.seek.value = t;
    el.seek.style.setProperty('--pct', (d ? (t / d * 100) : 0) + '%');
    el.curTime.textContent = fmtTime(t);
    el.durTime.textContent = fmtTime(d);
  }
  function updateHighlight() {
    if (state.index < 0) return;
    var p = state.poems[state.index], times = p.lineTimes;
    var lines = el.poemLines.children;
    var active = -1;
    if (times && times.length && !el.audio.ended) {
      var t = el.audio.currentTime;
      for (var i = 0; i < times.length; i++) {
        if (t >= times[i]) active = i; else break;
      }
    }
    for (var j = 0; j < lines.length; j++) {
      if (j === active) lines[j].classList.add('active');
      else lines[j].classList.remove('active');
    }
  }

  /* ---------- 手势与事件 ---------- */
  var tsY = 0, tsX = 0;
  function bindTouch() {
    el.poemScroll.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { tsY = 0; return; }
      tsY = e.touches[0].clientY;
      tsX = e.touches[0].clientX;
    }, { passive: true });
    el.poemScroll.addEventListener('touchend', function (e) {
      if (!tsY) return;
      var cy = e.changedTouches[0].clientY, cx = e.changedTouches[0].clientX;
      var dy = tsY - cy, dx = tsX - cx;
      tsY = 0;
      if (Math.abs(dy) < 55 || Math.abs(dy) < Math.abs(dx) * 1.3) return;
      var atTop = el.poemScroll.scrollTop <= 1;
      var atBottom = el.poemScroll.scrollTop + el.poemScroll.clientHeight >= el.poemScroll.scrollHeight - 2;
      if (dy > 0) { if (atBottom) navNext(); }
      else { if (atTop) navPrev(); }
    }, { passive: true });
  }

  function bind() {
    el.startBtn.addEventListener('click', function () { navTo(0, 'next', true); });
    el.homeBtn.addEventListener('click', goCover);
    el.catalogBtn.addEventListener('click', openCatalog);
    el.closeCatalog.addEventListener('click', closeCatalog);
    el.catalog.addEventListener('click', function (e) { if (e.target === el.catalog) closeCatalog(); });
    el.searchInput.addEventListener('input', filterCatalog);
    el.playBtn.addEventListener('click', togglePlay);
    el.prevBtn.addEventListener('click', navPrev);
    el.nextBtn.addEventListener('click', navNext);

    el.poemLines.addEventListener('click', function (e) {
      var line = closest(e.target, '.line');
      if (!line || state.index < 0) return;
      var i = parseInt(line.getAttribute('data-i'), 10);
      var times = state.poems[state.index].lineTimes;
      if (times && times[i] != null) {
        try { el.audio.currentTime = times[i]; } catch (err) {}
        if (el.audio.paused) tryPlay();
      }
    });

    function applyRate(r) {
      state.rate = r;
      el.audio.playbackRate = r;
      el.speedBtn.textContent = (r === 1 ? '1' : r) + '×';
      if (r === 1) el.speedBtn.classList.remove('active');
      else el.speedBtn.classList.add('active');
      try { localStorage.setItem('gushi_rate', String(r)); } catch (e) {}
    }
    el.speedBtn.addEventListener('click', function () {
      var i = SPEEDS.indexOf(state.rate);
      applyRate(SPEEDS[(i + 1) % SPEEDS.length]);
    });
    try {
      var saved = parseFloat(localStorage.getItem('gushi_rate'));
      applyRate(SPEEDS.indexOf(saved) >= 0 ? saved : DEFAULT_RATE);
    } catch (e) {
      applyRate(DEFAULT_RATE);
    }

    el.seek.addEventListener('input', function () {
      if (!el.audio.duration) return;
      state.scrubbing = true;
      var t = parseFloat(el.seek.value);
      if (el.audio.readyState > 0) { try { el.audio.currentTime = t; } catch (e) {} }
      updateProgress(t);
    });
    ['change', 'touchend', 'mouseup'].forEach(function (ev) {
      el.seek.addEventListener(ev, function () { state.scrubbing = false; });
    });

    el.audio.addEventListener('loadedmetadata', function () {
      el.audio.playbackRate = state.rate;
      updateProgress();
    });
    el.audio.addEventListener('timeupdate', function () {
      if (!state.scrubbing) updateProgress();
      updateHighlight();
    });
    el.audio.addEventListener('play', function () {
      el.playBtn.classList.add('playing');
      el.playBtn.setAttribute('aria-label', '暂停朗读');
    });
    el.audio.addEventListener('pause', function () {
      el.playBtn.classList.remove('playing');
      el.playBtn.setAttribute('aria-label', '播放朗读');
    });
    el.audio.addEventListener('ended', function () {
      el.playBtn.classList.remove('playing');
      updateProgress();
      updateHighlight();
    });

    bindTouch();
    document.addEventListener('keydown', function (e) {
      if (state.catalogOpen) { if (e.key === 'Escape') closeCatalog(); return; }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); navNext(); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); navPrev(); }
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'Home' || e.key === 'Escape') { goCover(); }
    });
    window.addEventListener('popstate', route);

    // 微信内置浏览器音频预热（iOS 需在用户手势/桥接就绪后加载）
    function onBridgeReady() { try { el.audio.load(); } catch (e) {} }
    if (window.WeixinJSBridge) onBridgeReady();
    else document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false);
    document.addEventListener('touchstart', function () {
      if (el.audio.src && el.audio.readyState === 0) { try { el.audio.load(); } catch (e) {} }
    }, { passive: true, once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  function init() { cache(); bind(); load(); }
})();
