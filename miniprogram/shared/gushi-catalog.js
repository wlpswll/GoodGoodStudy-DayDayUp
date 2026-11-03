/* 古诗70首 · 跨端纯逻辑层（浏览器、Node 测试、微信小程序共用） */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GushiCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var SPEEDS = [1, 1.25, 0.75, 0.85];
  var DEFAULT_RATE = 0.85;

  var PLAY_MODES = ['sequence', 'loop-all', 'loop-one', 'shuffle'];
  var DEFAULT_PLAY_MODE = 'sequence';
  var PLAY_MODE_LABELS = {
    'sequence': '顺序播放',
    'loop-all': '列表循环',
    'loop-one': '单曲循环',
    'shuffle': '随机播放'
  };

  function normalizePlayMode(mode) {
    var m = String(mode || '');
    return PLAY_MODES.indexOf(m) >= 0 ? m : DEFAULT_PLAY_MODE;
  }

  function nextPlayMode(mode) {
    var cur = normalizePlayMode(mode);
    var idx = PLAY_MODES.indexOf(cur);
    return PLAY_MODES[(idx + 1) % PLAY_MODES.length];
  }

  function formatPlayMode(mode) {
    var cur = normalizePlayMode(mode);
    return PLAY_MODE_LABELS[cur] || PLAY_MODE_LABELS[DEFAULT_PLAY_MODE];
  }

  function pickNextIndex(currentIndex, total, mode, reason, randFn) {
    var n = Number(total) || 0;
    if (n <= 0) return { index: -1, replay: false };
    var cur = Math.max(0, Math.min(n - 1, Number(currentIndex) || 0));
    var m = normalizePlayMode(mode);
    var why = reason || 'ended';

    if (why === 'ended' && m === 'loop-one') {
      return { index: cur, replay: true };
    }

    if (m === 'shuffle') {
      if (n === 1) {
        return { index: 0, replay: why === 'ended' };
      }
      var rng = typeof randFn === 'function' ? randFn : Math.random;
      var offset = 1 + Math.floor(rng() * (n - 1));
      return { index: (cur + offset) % n, replay: false };
    }

    var delta = why === 'prev' ? -1 : 1;
    var next = cur + delta;
    if (next >= 0 && next < n) {
      return { index: next, replay: false };
    }

    if (m === 'loop-all' || m === 'loop-one') {
      var wrapped = next < 0 ? (n - 1) : 0;
      return { index: wrapped, replay: n === 1 };
    }

    return { index: -1, replay: false };
  }

  function isHanzi(ch) {
    return /[\u4e00-\u9fff]/.test(ch);
  }

  function tokenizeRuby(text, pinyins) {
    var s = String(text == null ? '' : text);
    var pys = Array.isArray(pinyins) ? pinyins : [];
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var py = pys[i];
      var hasPy = Boolean(py && py !== ch && isHanzi(ch));
      out.push({
        ch: ch,
        py: hasPy ? String(py) : ''
      });
    }
    return out;
  }

  function sceneFor(poem) {
    if (!poem) return 'ink';
    var lines = Array.isArray(poem.lines) ? poem.lines.join('') : '';
    var t = (poem.title || '') + lines + (poem.author || '') + (poem.dynasty || '');
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

  function groupByDynasty(poems, query) {
    var q = String(query || '').trim().toLowerCase();
    var groups = [];
    var map = {};
    (poems || []).forEach(function (p, index) {
      if (!p) return;
      var key = [p.no, p.title, p.author, p.dynasty].join(' ').toLowerCase();
      if (q && key.indexOf(q) < 0) return;
      var dynasty = p.dynasty || '其他';
      if (!map[dynasty]) {
        map[dynasty] = { name: dynasty, items: [] };
        groups.push(map[dynasty]);
      }
      map[dynasty].items.push({
        index: index,
        no: p.no,
        id: p.id,
        title: p.title,
        author: p.author,
        dynasty: dynasty
      });
    });
    return groups;
  }

  function activeLineIndex(lineTimes, currentTime, ended) {
    if (ended || !Array.isArray(lineTimes) || !lineTimes.length) return -1;
    var t = Number(currentTime) || 0;
    var active = -1;
    for (var i = 0; i < lineTimes.length; i++) {
      if (t >= lineTimes[i]) active = i;
      else break;
    }
    return active;
  }

  function nextRate(current) {
    var idx = SPEEDS.indexOf(Number(current));
    if (idx < 0) return DEFAULT_RATE;
    return SPEEDS[(idx + 1) % SPEEDS.length];
  }

  function normalizeRate(rate) {
    var r = Number(rate);
    return SPEEDS.indexOf(r) >= 0 ? r : DEFAULT_RATE;
  }

  function formatClock(seconds) {
    var s = Number(seconds);
    if (!Number.isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60);
    var ss = Math.floor(s % 60);
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function resolveAssetUrl(relPath, baseUrl) {
    var p = String(relPath || '').replace(/^\/+/, '');
    if (!p) return '';
    var encoded = p.split('/').map(function (seg) {
      return encodeURIComponent(seg);
    }).join('/');
    if (!baseUrl) return encoded;
    return String(baseUrl).replace(/\/+$/, '') + '/' + encoded;
  }

  function enrichPoem(poem, baseUrl) {
    if (!poem) return null;
    var lines = Array.isArray(poem.lines) ? poem.lines : [];
    var linePinyins = Array.isArray(poem.linePinyins) ? poem.linePinyins : [];
    return {
      id: poem.id,
      no: poem.no,
      title: poem.title,
      dynasty: poem.dynasty || '',
      author: poem.author || '',
      authorLabel: poem.dynasty ? (poem.dynasty + ' · ' + poem.author) : (poem.author || ''),
      titleTokens: tokenizeRuby(poem.title, poem.titlePinyins),
      lineTokens: lines.map(function (line, i) {
        return tokenizeRuby(line, linePinyins[i]);
      }),
      lines: lines,
      lineTimes: Array.isArray(poem.lineTimes) ? poem.lineTimes : [],
      audioDuration: Number(poem.audioDuration) || 0,
      scene: sceneFor(poem),
      imageUrl: resolveAssetUrl(poem.image, baseUrl),
      audioUrl: resolveAssetUrl(poem.audio, baseUrl)
    };
  }

  return {
    SPEEDS: SPEEDS,
    DEFAULT_RATE: DEFAULT_RATE,
    PLAY_MODES: PLAY_MODES,
    DEFAULT_PLAY_MODE: DEFAULT_PLAY_MODE,
    PLAY_MODE_LABELS: PLAY_MODE_LABELS,
    normalizePlayMode: normalizePlayMode,
    nextPlayMode: nextPlayMode,
    formatPlayMode: formatPlayMode,
    pickNextIndex: pickNextIndex,
    tokenizeRuby: tokenizeRuby,
    sceneFor: sceneFor,
    groupByDynasty: groupByDynasty,
    activeLineIndex: activeLineIndex,
    nextRate: nextRate,
    normalizeRate: normalizeRate,
    formatClock: formatClock,
    resolveAssetUrl: resolveAssetUrl,
    enrichPoem: enrichPoem
  };
});
