/* 轻松一刻 · 5 合 1 益智小游戏页面（支持 9/13/19 路真木纹 Canvas 围棋、13/15 路五子棋、三级难度 AI 与精选外部平台） */
var engine = require('../../shared/games-engine.js');

Page({
  data: {
    games: engine.GAMES,
    difficulties: engine.DIFFICULTIES,
    activeGame: 'weiqi',
    currentMeta: engine.GAMES[0],
    vsAi: true,
    difficulty: 2, // 1: 入门, 2: 进阶, 3: 高手
    boardPx: 330,
    xqHeightPx: 366,

    // 围棋 (9 / 13 / 19 路)
    weiqiSize: 9,
    weiqiRule: 'capture', // 'capture' | 'free'
    weiqiBoard: [],
    weiqiCaptures: { 1: 0, 2: 0 },
    weiqiTerritory: { blackTotal: 0, whiteTotal: 0 },
    weiqiTarget: 3,
    weiqiStatus: '',

    // 五子棋 (13 / 15 路)
    gomokuSize: 13,
    gomokuBoard: [],
    gomokuStatus: '',

    // 中国象棋
    xiangqiBoard: [],
    xiangqiStatus: '',

    // 飞行棋
    ludoTurn: 'r',
    ludoDice: 0,
    ludoRolled: false,
    ludoWinner: '',
    ludoLog: '',
    ludoRedPlanes: [],
    ludoBluePlanes: [],
    ludoTrackCells: [],

    // 八音盒小钢琴
    pianoKeys: engine.PIANO_KEYS,
    pianoSongs: engine.PIANO_SONGS,
    pianoSongId: 'star',
    currentSong: engine.PIANO_SONGS[0],
    pianoStep: 0,
    pianoBlind: false,
    expectedNote: 1,
    expectedLyric: '一',
    lastPressedNote: 0,
    autoPlaying: false
  },

  onLoad: function (options) {
    var targetId = (options && options.id) || 'weiqi';
    var exists = engine.GAMES.some(function (g) { return g.id === targetId; });
    if (!exists) targetId = 'weiqi';

    var boardPx = 330;
    if (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function') {
      try {
        var info = wx.getSystemInfoSync();
        if (info && info.windowWidth) {
          boardPx = Math.min(380, Math.max(290, Math.floor(info.windowWidth - 36)));
        }
      } catch (e) {}
    }
    this.setData({
      boardPx: boardPx,
      xqHeightPx: Math.round(boardPx * 1.11)
    });

    this.initAllGames();
    this.switchGame(targetId);
  },

  onUnload: function () {
    this.stopAutoDemo();
    if (this.toneAudio) {
      try { this.toneAudio.destroy(); } catch (e) {}
      this.toneAudio = null;
    }
  },

  initAllGames: function () {
    var diff = this.data.difficulty || 2;
    this.gomoku = engine.createGomoku(this.data.gomokuSize, diff);
    this.weiqi = engine.createWeiqi(3, this.data.weiqiSize, diff, this.data.weiqiRule);
    this.xiangqi = engine.createXiangqi(diff);
    this.xqSelected = null;
    this.ludo = engine.createLudo(diff);
    this.syncGomokuView();
    this.syncWeiqiView();
    this.syncXiangqiView();
    this.syncLudoView();
    this.syncPianoView('star', 0);
  },

  switchGame: function (id) {
    this.stopAutoDemo();
    var meta = engine.GAMES.filter(function (g) { return g.id === id; })[0] || engine.GAMES[0];
    this.setData({
      activeGame: id,
      currentMeta: meta
    });
    if (id === 'weiqi') this.drawWeiqiCanvas();
    if (id === 'gomoku') this.drawGomokuCanvas();
    if (id === 'xiangqi') this.drawXiangqiCanvas();
    if (id === 'ludo') this.drawLudoCanvas();
  },

  onSwitchGame: function (event) {
    var id = event.currentTarget.dataset.id;
    if (id) this.switchGame(id);
  },

  onSetMode: function (event) {
    var ai = Number(event.currentTarget.dataset.ai) === 1;
    this.setData({ vsAi: ai });
  },

  onSetDifficulty: function (event) {
    var diff = Number(event.currentTarget.dataset.diff) || 2;
    this.setData({ difficulty: diff });
    if (this.gomoku) this.gomoku.difficulty = diff;
    if (this.weiqi) this.weiqi.difficulty = diff;
    if (this.xiangqi) this.xiangqi.difficulty = diff;
    if (this.ludo) this.ludo.difficulty = diff;
  },

  onTapRecommendation: function (event) {
    var ds = (event && event.currentTarget && event.currentTarget.dataset) || {};
    var appId = ds.appid;
    var url = ds.url;
    var name = ds.name || '外部应用';

    if (appId && typeof wx !== 'undefined' && typeof wx.navigateToMiniProgram === 'function') {
      wx.navigateToMiniProgram({
        appId: appId,
        fail: function () {
          if (typeof wx.showToast === 'function') {
            wx.showToast({ title: '需在手机真机或正式 AppID 下跳转「' + name + '」', icon: 'none' });
          }
        }
      });
      return;
    }

    if (url && typeof wx !== 'undefined' && typeof wx.setClipboardData === 'function') {
      wx.setClipboardData({
        data: url,
        success: function () {
          if (typeof wx.showToast === 'function') {
            wx.showToast({ title: '已复制「' + name + '」网址', icon: 'success' });
          }
        }
      });
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

  /* ==================== Canvas 高清榧木棋盘绘制器 ==================== */
  computeBoardMetrics: function (n) {
    var sizePx = this.data.boardPx || 330;
    var pad = Math.round(sizePx * (n >= 19 ? 0.055 : n >= 13 ? 0.068 : 0.085));
    var cell = (sizePx - pad * 2) / (n - 1);
    return { sizePx: sizePx, pad: pad, cell: cell, n: n };
  },

  renderBoardCanvas: function (canvasId, n, board, starPoints, lastMove, winCells) {
    if (typeof wx === 'undefined' || typeof wx.createCanvasContext !== 'function') return;
    var ctx = wx.createCanvasContext(canvasId, this);
    var m = this.computeBoardMetrics(n);
    var sizePx = m.sizePx, pad = m.pad, cell = m.cell;

    // 1. 榧木底板与立体边框
    ctx.setFillStyle('#dfb879');
    ctx.fillRect(0, 0, sizePx, sizePx);

    // 柔和木纹细条
    ctx.setStrokeStyle('rgba(150, 98, 42, 0.09)');
    ctx.setLineWidth(2);
    for (var g = 8; g < sizePx; g += 14) {
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(sizePx, g + 4);
      ctx.stroke();
    }

    // 外框粗线
    ctx.setStrokeStyle('#5c3a18');
    ctx.setLineWidth(2.5);
    ctx.strokeRect(pad - 2, pad - 2, sizePx - (pad - 2) * 2, sizePx - (pad - 2) * 2);

    // 2. 纵横网格线
    ctx.setStrokeStyle('#523315');
    ctx.setLineWidth(n >= 19 ? 0.85 : 1.15);
    for (var i = 0; i < n; i++) {
      var pos = pad + i * cell;
      ctx.beginPath();
      ctx.moveTo(pad, pos);
      ctx.lineTo(sizePx - pad, pos);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pos, pad);
      ctx.lineTo(pos, sizePx - pad);
      ctx.stroke();
    }

    // 3. 星位与天元
    var starRadius = n >= 19 ? 2.6 : 3.4;
    ctx.setFillStyle('#472b10');
    (starPoints || []).forEach(function (pt) {
      var sx = pad + pt[1] * cell;
      var sy = pad + pt[0] * cell;
      ctx.beginPath();
      ctx.arc(sx, sy, starRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. 五连高亮光晕
    var winMap = {};
    (winCells || []).forEach(function (pt) { winMap[pt[0] + ',' + pt[1]] = true; });

    // 5. 绘制云子（黑子与白子 + 高光点 + 最新落子红标）
    var stoneRadius = cell * 0.455;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var color = board[r] && board[r][c];
        if (!color) continue;
        var cx = pad + c * cell;
        var cy = pad + r * cell;

        if (winMap[r + ',' + c]) {
          ctx.beginPath();
          ctx.arc(cx, cy, stoneRadius + 3.5, 0, Math.PI * 2);
          ctx.setFillStyle('rgba(180, 69, 47, 0.45)');
          ctx.fill();
        }

        // 投影
        ctx.beginPath();
        ctx.arc(cx + 1.2, cy + 1.8, stoneRadius, 0, Math.PI * 2);
        ctx.setFillStyle('rgba(30, 18, 6, 0.28)');
        ctx.fill();

        // 棋子本体
        ctx.beginPath();
        ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2);
        if (color === 1) {
          ctx.setFillStyle('#1b1b1b');
          ctx.fill();
          // 黑子左上柔光
          ctx.beginPath();
          ctx.arc(cx - stoneRadius * 0.3, cy - stoneRadius * 0.3, stoneRadius * 0.24, 0, Math.PI * 2);
          ctx.setFillStyle('rgba(255, 255, 255, 0.22)');
          ctx.fill();
        } else {
          ctx.setFillStyle('#f7f3ea');
          ctx.fill();
          ctx.setStrokeStyle('rgba(110, 90, 65, 0.45)');
          ctx.setLineWidth(1);
          ctx.stroke();
          // 白子高光
          ctx.beginPath();
          ctx.arc(cx - stoneRadius * 0.28, cy - stoneRadius * 0.28, stoneRadius * 0.28, 0, Math.PI * 2);
          ctx.setFillStyle('rgba(255, 255, 255, 0.85)');
          ctx.fill();
        }

        // 最新一手红芯标记
        if (lastMove && lastMove.r === r && lastMove.c === c) {
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(2.6, stoneRadius * 0.26), 0, Math.PI * 2);
          ctx.setFillStyle('#c93b2b');
          ctx.fill();
        }
      }
    }

    ctx.draw();
  },

  coordFromCanvasTap: function (event, n) {
    var detail = (event && event.detail) || {};
    var target = (event && event.currentTarget) || {};
    var x = detail.x != null ? detail.x - (target.offsetLeft || 0) : 0;
    var y = detail.y != null ? detail.y - (target.offsetTop || 0) : 0;
    var m = this.computeBoardMetrics(n);
    var c = Math.round((x - m.pad) / m.cell);
    var r = Math.round((y - m.pad) / m.cell);
    c = Math.max(0, Math.min(n - 1, c));
    r = Math.max(0, Math.min(n - 1, r));
    return { r: r, c: c };
  },

  /* ==================== 1. 围棋交互（9 / 13 / 19 路） ==================== */
  drawWeiqiCanvas: function () {
    if (!this.weiqi) return;
    var n = this.weiqi.size;
    var stars = engine.getWeiqiStarPoints(n);
    this.renderBoardCanvas('weiqiCanvas', n, this.weiqi.board, stars, this.weiqi.lastMove, null);
  },

  syncWeiqiView: function (extraTip) {
    var st = this.weiqi;
    var stars = {};
    engine.getWeiqiStarPoints(st.size).forEach(function (pt) { stars[pt[0] + ',' + pt[1]] = true; });
    var last = st.lastMove;
    var rows = st.board.map(function (row, r) {
      return row.map(function (val, c) {
        return {
          color: val,
          star: Boolean(stars[r + ',' + c]),
          last: Boolean(last && last.r === r && last.c === c)
        };
      });
    });

    var diffName = (engine.DIFFICULTIES.filter(function (d) { return d.id === st.difficulty; })[0] || {}).name || '进阶';
    var status = extraTip || '';
    if (!status) {
      if (st.winner === 1) status = '🎉 黑方先提满 ' + st.target + ' 子获胜！';
      else if (st.winner === 2) status = '🎉 白方先提满 ' + st.target + ' 子获胜！';
      else status = st.turn === 1 ? ('⚫ 黑方落子（' + st.size + '路 · ' + diffName + '）') : (this.data.vsAi ? '⚪ 书童思考中…' : '⚪ 白方落子');
    }

    this.setData({
      weiqiSize: st.size,
      weiqiRule: st.ruleMode,
      weiqiBoard: rows,
      weiqiCaptures: st.captures,
      weiqiTerritory: engine.countWeiqiTerritory(st),
      weiqiTarget: st.target,
      weiqiStatus: status
    });
    this.drawWeiqiCanvas();
  },

  onSetWeiqiSize: function (event) {
    var size = Number(event.currentTarget.dataset.size) || 9;
    var target = size === 9 ? 3 : (size === 13 ? 5 : 8);
    this.weiqi = engine.createWeiqi(target, size, this.data.difficulty, this.data.weiqiRule);
    this.syncWeiqiView();
  },

  onSetWeiqiRule: function (event) {
    var rule = event.currentTarget.dataset.rule || 'capture';
    var target = this.weiqi.size === 9 ? 3 : (this.weiqi.size === 13 ? 5 : 8);
    this.weiqi = engine.createWeiqi(target, this.weiqi.size, this.data.difficulty, rule);
    this.syncWeiqiView();
  },

  onWeiqiCanvasTap: function (event) {
    var pt = this.coordFromCanvasTap(event, this.weiqi.size);
    this.handleWeiqiMove(pt.r, pt.c);
  },

  onWeiqiTap: function (event) {
    var r = Number(event.currentTarget.dataset.r);
    var c = Number(event.currentTarget.dataset.c);
    this.handleWeiqiMove(r, c);
  },

  handleWeiqiMove: function (r, c) {
    if (this.data.vsAi && this.weiqi.turn === 2) return;
    var res = engine.placeWeiqi(this.weiqi, r, c);
    if (!res.ok) {
      this.syncWeiqiView('⚠️ ' + res.reason);
      return;
    }
    this.syncWeiqiView();

    if (this.data.vsAi && !this.weiqi.winner && this.weiqi.turn === 2) {
      var aiMove = engine.pickWeiqiAiMove(this.weiqi, this.data.difficulty);
      if (aiMove) {
        engine.placeWeiqi(this.weiqi, aiMove.r, aiMove.c);
        this.syncWeiqiView();
      }
    }
  },

  onWeiqiUndo: function () {
    engine.undoWeiqi(this.weiqi, this.data.vsAi ? 2 : 1);
    this.syncWeiqiView();
  },

  onWeiqiReset: function () {
    var target = this.weiqi.size === 9 ? 3 : (this.weiqi.size === 13 ? 5 : 8);
    this.weiqi = engine.createWeiqi(target, this.weiqi.size, this.data.difficulty, this.data.weiqiRule);
    this.syncWeiqiView();
  },

  /* ==================== 2. 五子棋交互（13 / 15 路） ==================== */
  drawGomokuCanvas: function () {
    if (!this.gomoku) return;
    var n = this.gomoku.size;
    var stars = engine.getGomokuStarPoints(n);
    var last = this.gomoku.history.length ? this.gomoku.history[this.gomoku.history.length - 1] : null;
    this.renderBoardCanvas('gomokuCanvas', n, this.gomoku.board, stars, last, this.gomoku.winCells);
  },

  syncGomokuView: function () {
    var st = this.gomoku;
    var winMap = {};
    (st.winCells || []).forEach(function (pt) { winMap[pt[0] + ',' + pt[1]] = true; });
    var last = st.history.length ? st.history[st.history.length - 1] : null;

    var rows = st.board.map(function (row, r) {
      return row.map(function (val, c) {
        return {
          color: val,
          win: Boolean(winMap[r + ',' + c]),
          last: Boolean(last && last.r === r && last.c === c)
        };
      });
    });

    var diffName = (engine.DIFFICULTIES.filter(function (d) { return d.id === st.difficulty; })[0] || {}).name || '进阶';
    var status = '';
    if (st.winner === 1) status = '🎉 黑棋五子连珠获胜！';
    else if (st.winner === 2) status = '🎉 白棋五子连珠获胜！';
    else if (st.winner === 3) status = '🤝 棋盘已满，双方平局';
    else status = st.turn === 1 ? ('⚫ 黑棋落子（' + st.size + '路 · ' + diffName + '）') : (this.data.vsAi ? '⚪ 书童思考中…' : '⚪ 白棋落子');

    this.setData({
      gomokuSize: st.size,
      gomokuBoard: rows,
      gomokuStatus: status
    });
    this.drawGomokuCanvas();
  },

  onSetGomokuSize: function (event) {
    var size = Number(event.currentTarget.dataset.size) || 13;
    this.gomoku = engine.createGomoku(size, this.data.difficulty);
    this.syncGomokuView();
  },

  onGomokuCanvasTap: function (event) {
    var pt = this.coordFromCanvasTap(event, this.gomoku.size);
    this.handleGomokuMove(pt.r, pt.c);
  },

  onGomokuTap: function (event) {
    var r = Number(event.currentTarget.dataset.r);
    var c = Number(event.currentTarget.dataset.c);
    this.handleGomokuMove(r, c);
  },

  handleGomokuMove: function (r, c) {
    if (this.data.vsAi && this.gomoku.turn === 2) return;
    if (!engine.placeGomoku(this.gomoku, r, c)) return;
    this.syncGomokuView();

    if (this.data.vsAi && !this.gomoku.winner && this.gomoku.turn === 2) {
      var aiMove = engine.pickGomokuAiMove(this.gomoku, this.data.difficulty);
      if (aiMove) {
        engine.placeGomoku(this.gomoku, aiMove.r, aiMove.c);
        this.syncGomokuView();
      }
    }
  },

  onGomokuUndo: function () {
    engine.undoGomoku(this.gomoku, this.data.vsAi ? 2 : 1);
    this.syncGomokuView();
  },

  onGomokuReset: function () {
    this.gomoku = engine.createGomoku(this.data.gomokuSize, this.data.difficulty);
    this.syncGomokuView();
  },

  /* ==================== 3. 中国象棋（九宫米字斜线 + 楚河汉界 Canvas 棋盘） ==================== */
  computeXiangqiMetrics: function () {
    var w = this.data.boardPx || 330;
    var h = this.data.xqHeightPx || Math.round(w * 1.11);
    var padX = Math.round(w * 0.08);
    var padY = Math.round(h * 0.072);
    var cellX = (w - padX * 2) / 8;
    var cellY = (h - padY * 2) / 9;
    return { w: w, h: h, padX: padX, padY: padY, cellX: cellX, cellY: cellY };
  },

  drawXiangqiCanvas: function () {
    if (!this.xiangqi || typeof wx === 'undefined' || typeof wx.createCanvasContext !== 'function') return;
    var ctx = wx.createCanvasContext('xiangqiCanvas', this);
    var m = this.computeXiangqiMetrics();
    var w = m.w, h = m.h, padX = m.padX, padY = m.padY, cellX = m.cellX, cellY = m.cellY;

    // 1. 榧木底板与木纹
    ctx.setFillStyle('#dfb879');
    ctx.fillRect(0, 0, w, h);
    ctx.setStrokeStyle('rgba(150, 98, 42, 0.09)');
    ctx.setLineWidth(2);
    for (var g = 10; g < h; g += 15) {
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(w, g + 4);
      ctx.stroke();
    }

    // 2. 双外框
    ctx.setStrokeStyle('#523315');
    ctx.setLineWidth(2.4);
    ctx.strokeRect(padX - 4, padY - 4, w - (padX - 4) * 2, h - (padY - 4) * 2);
    ctx.setLineWidth(1.2);

    // 3. 10 条横线
    for (var r = 0; r < 10; r++) {
      var y = padY + r * cellY;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - padX, y);
      ctx.stroke();
    }

    // 4. 9 条竖线（中间楚河汉界断开，左右边线贯通）
    for (var c = 0; c < 9; c++) {
      var x = padX + c * cellX;
      if (c === 0 || c === 8) {
        ctx.beginPath();
        ctx.moveTo(x, padY);
        ctx.lineTo(x, h - padY);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, padY);
        ctx.lineTo(x, padY + 4 * cellY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, padY + 5 * cellY);
        ctx.lineTo(x, h - padY);
        ctx.stroke();
      }
    }

    // 5. 上下九宫格米字斜线
    ctx.beginPath();
    ctx.moveTo(padX + 3 * cellX, padY);
    ctx.lineTo(padX + 5 * cellX, padY + 2 * cellY);
    ctx.moveTo(padX + 5 * cellX, padY);
    ctx.lineTo(padX + 3 * cellX, padY + 2 * cellY);
    ctx.moveTo(padX + 3 * cellX, padY + 7 * cellY);
    ctx.lineTo(padX + 5 * cellX, padY + 9 * cellY);
    ctx.moveTo(padX + 5 * cellX, padY + 7 * cellY);
    ctx.lineTo(padX + 3 * cellX, padY + 9 * cellY);
    ctx.stroke();

    // 6. 楚河汉界题字
    ctx.setFillStyle('#5c3a18');
    ctx.setFontSize(Math.round(cellY * 0.46));
    ctx.setTextAlign('center');
    ctx.setTextBaseline('middle');
    var riverY = padY + 4.5 * cellY;
    ctx.fillText('楚 河', padX + 2 * cellX, riverY);
    ctx.fillText('汉 界', padX + 6 * cellX, riverY);

    // 7. 走子绿点与吃子红圈提示
    var sel = this.xqSelected;
    var hintMap = {};
    if (sel) {
      engine.getValidXiangqiMoves(this.xiangqi.board, sel.r, sel.c).forEach(function (mv) {
        hintMap[mv.r + ',' + mv.c] = true;
      });
    }

    // 8. 绘制 32 枚立体木雕象棋子
    var pRadius = Math.min(cellX, cellY) * 0.44;
    for (var rr = 0; rr < 10; rr++) {
      for (var cc = 0; cc < 9; cc++) {
        var cx = padX + cc * cellX;
        var cy = padY + rr * cellY;
        var code = this.xiangqi.board[rr][cc];
        var isHint = Boolean(hintMap[rr + ',' + cc]);

        if (code) {
          var isRed = code.charAt(0) === 'r';
          var isSel = Boolean(sel && sel.r === rr && sel.c === cc);

          // 选中光晕
          if (isSel) {
            ctx.beginPath();
            ctx.arc(cx, cy, pRadius + 4, 0, Math.PI * 2);
            ctx.setFillStyle('rgba(180, 69, 47, 0.38)');
            ctx.fill();
          }

          // 棋子阴影
          ctx.beginPath();
          ctx.arc(cx + 1.5, cy + 2.2, pRadius, 0, Math.PI * 2);
          ctx.setFillStyle('rgba(40, 22, 6, 0.32)');
          ctx.fill();

          // 木雕圆饼底
          ctx.beginPath();
          ctx.arc(cx, cy, pRadius, 0, Math.PI * 2);
          ctx.setFillStyle(isSel ? '#fff4d9' : '#faefd8');
          ctx.fill();
          ctx.setStrokeStyle('#7a5229');
          ctx.setLineWidth(1.5);
          ctx.stroke();

          // 内圈双线
          ctx.beginPath();
          ctx.arc(cx, cy, pRadius * 0.82, 0, Math.PI * 2);
          ctx.setStrokeStyle(isRed ? '#b43525' : '#24201c');
          ctx.setLineWidth(1.4);
          ctx.stroke();

          // 棋子汉字
          ctx.setFillStyle(isRed ? '#b43525' : '#24201c');
          ctx.setFontSize(Math.round(pRadius * 1.05));
          ctx.setTextAlign('center');
          ctx.setTextBaseline('middle');
          ctx.fillText(engine.XIANGQI_LABELS[code] || '', cx, cy + 0.5);

          // 可吃子目标红圈
          if (isHint) {
            ctx.beginPath();
            ctx.arc(cx, cy, pRadius + 2.5, 0, Math.PI * 2);
            ctx.setStrokeStyle('#2e8b57');
            ctx.setLineWidth(2.4);
            ctx.stroke();
          }
        } else if (isHint) {
          ctx.beginPath();
          ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
          ctx.setFillStyle('#2e8b57');
          ctx.fill();
        }
      }
    }

    ctx.draw();
  },

  syncXiangqiView: function () {
    var st = this.xiangqi;
    var sel = this.xqSelected;
    var hintMap = {};
    if (sel) {
      engine.getValidXiangqiMoves(st.board, sel.r, sel.c).forEach(function (m) {
        hintMap[m.r + ',' + m.c] = true;
      });
    }

    var rows = st.board.map(function (row, r) {
      return row.map(function (code, c) {
        return {
          code: code,
          side: code ? code.charAt(0) : '',
          label: code ? engine.XIANGQI_LABELS[code] : '',
          selected: Boolean(sel && sel.r === r && sel.c === c),
          hint: Boolean(hintMap[r + ',' + c])
        };
      });
    });

    var diffName = (engine.DIFFICULTIES.filter(function (d) { return d.id === st.difficulty; })[0] || {}).name || '进阶';
    var status = '';
    if (st.winner === 'r') status = '🎉 红方「帅」获胜！';
    else if (st.winner === 'b') status = '🎉 黑方「将」获胜！';
    else status = st.turn === 'r' ? ('🔴 红方走棋（' + diffName + ' · 点棋子见绿点落子）') : '⚫ 黑方走棋';

    this.setData({ xiangqiBoard: rows, xiangqiStatus: status });
    this.drawXiangqiCanvas();
  },

  onXiangqiCanvasTap: function (event) {
    var detail = (event && event.detail) || {};
    var target = (event && event.currentTarget) || {};
    var x = detail.x != null ? detail.x - (target.offsetLeft || 0) : 0;
    var y = detail.y != null ? detail.y - (target.offsetTop || 0) : 0;
    var m = this.computeXiangqiMetrics();
    var c = Math.max(0, Math.min(8, Math.round((x - m.padX) / m.cellX)));
    var r = Math.max(0, Math.min(9, Math.round((y - m.padY) / m.cellY)));
    this.handleXiangqiTap(r, c);
  },

  onXiangqiTap: function (event) {
    var r = Number(event.currentTarget.dataset.r);
    var c = Number(event.currentTarget.dataset.c);
    this.handleXiangqiTap(r, c);
  },

  handleXiangqiTap: function (r, c) {
    var st = this.xiangqi;
    if (st.winner) return;
    if (this.data.vsAi && st.turn === 'b') return;

    var clicked = st.board[r][c];
    var clickedSide = clicked ? clicked.charAt(0) : '';

    if (clickedSide === st.turn) {
      this.xqSelected = { r: r, c: c };
      this.syncXiangqiView();
      return;
    }

    if (this.xqSelected) {
      var moved = engine.moveXiangqi(st, this.xqSelected.r, this.xqSelected.c, r, c);
      if (moved) {
        this.xqSelected = null;
        this.syncXiangqiView();
        if (this.data.vsAi && !st.winner && st.turn === 'b') {
          var ai = engine.pickXiangqiAiMove(st, this.data.difficulty);
          if (ai) {
            engine.moveXiangqi(st, ai.fromR, ai.fromC, ai.toR, ai.toC);
            this.syncXiangqiView();
          }
        }
      }
    }
  },

  onXiangqiUndo: function () {
    engine.undoXiangqi(this.xiangqi, this.data.vsAi ? 2 : 1);
    this.xqSelected = null;
    this.syncXiangqiView();
  },

  onXiangqiReset: function () {
    this.xiangqi = engine.createXiangqi(this.data.difficulty);
    this.xqSelected = null;
    this.syncXiangqiView();
  },

  /* ==================== 4. 飞行棋（标准 11×11 四色十字航道 + 四角停机坪 + 矢量飞机 Canvas） ==================== */
  computeLudoMetrics: function () {
    var sizePx = this.data.boardPx || 330;
    var pad = 8;
    var cell = (sizePx - pad * 2) / 11;
    return { sizePx: sizePx, pad: pad, cell: cell };
  },

  drawAirplaneToken: function (ctx, cx, cy, radius, bgHex, movable, labelNum) {
    if (movable) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 4.5, 0, Math.PI * 2);
      ctx.setFillStyle('rgba(255, 213, 79, 0.85)');
      ctx.fill();
      ctx.setStrokeStyle('#b4452f');
      ctx.setLineWidth(1.6);
      ctx.stroke();
    }

    // 阴影
    ctx.beginPath();
    ctx.arc(cx + 1, cy + 1.6, radius, 0, Math.PI * 2);
    ctx.setFillStyle('rgba(25, 15, 5, 0.3)');
    ctx.fill();

    // 圆形底座
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.setFillStyle(bgHex);
    ctx.fill();
    ctx.setStrokeStyle('#ffffff');
    ctx.setLineWidth(1.6);
    ctx.stroke();

    // 矢量小飞机剪影（机头朝上，掠翼 + 尾翼）
    var r = radius * 0.68;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); // 机鼻
    ctx.lineTo(cx + r * 0.22, cy - r * 0.25);
    ctx.lineTo(cx + r * 0.95, cy + r * 0.15); // 右翼尖
    ctx.lineTo(cx + r * 0.95, cy + r * 0.36);
    ctx.lineTo(cx + r * 0.22, cy + r * 0.18);
    ctx.lineTo(cx + r * 0.18, cy + r * 0.65);
    ctx.lineTo(cx + r * 0.52, cy + r * 0.88); // 右尾翼
    ctx.lineTo(cx + r * 0.52, cy + r * 0.98);
    ctx.lineTo(cx, cy + r * 0.82);
    ctx.lineTo(cx - r * 0.52, cy + r * 0.98); // 左尾翼
    ctx.lineTo(cx - r * 0.52, cy + r * 0.88);
    ctx.lineTo(cx - r * 0.18, cy + r * 0.65);
    ctx.lineTo(cx - r * 0.22, cy + r * 0.18);
    ctx.lineTo(cx - r * 0.95, cy + r * 0.36);
    ctx.lineTo(cx - r * 0.95, cy + r * 0.15); // 左翼尖
    ctx.lineTo(cx - r * 0.22, cy - r * 0.25);
    ctx.closePath();
    ctx.setFillStyle('#ffffff');
    ctx.fill();

    if (labelNum) {
      ctx.setFillStyle(bgHex);
      ctx.setFontSize(Math.max(8, Math.round(radius * 0.68)));
      ctx.setTextAlign('center');
      ctx.setTextBaseline('middle');
      ctx.fillText(String(labelNum), cx, cy + radius * 0.08);
    }
  },

  drawLudoCanvas: function () {
    if (!this.ludo || typeof wx === 'undefined' || typeof wx.createCanvasContext !== 'function') return;
    var ctx = wx.createCanvasContext('ludoCanvas', this);
    var m = this.computeLudoMetrics();
    var sizePx = m.sizePx, pad = m.pad, cell = m.cell;

    var palette = {
      r: '#d9534f',
      y: '#e6a938',
      b: '#3b82c4',
      g: '#439c68'
    };
    var lightPalette = {
      r: '#f9d7d5',
      y: '#fcedc8',
      b: '#d6e8f8',
      g: '#d5f0e0'
    };

    // 1. 宣纸木纹棋盘底
    ctx.setFillStyle('#f7efdc');
    ctx.fillRect(0, 0, sizePx, sizePx);

    // 2. 四个角落 3×3 停机坪机库（红左上、黄右上、蓝右下、绿左下）
    var hangars = [
      { key: 'r', r: 0, c: 0, title: '红方基地' },
      { key: 'y', r: 0, c: 8, title: '黄方基地' },
      { key: 'b', r: 8, c: 8, title: '蓝方基地' },
      { key: 'g', r: 8, c: 0, title: '绿方基地' }
    ];
    hangars.forEach(function (h) {
      var hx = pad + h.c * cell;
      var hy = pad + h.r * cell;
      var hw = cell * 3;
      ctx.setFillStyle(palette[h.key]);
      ctx.fillRect(hx + 1, hy + 1, hw - 2, hw - 2);
      ctx.setFillStyle(lightPalette[h.key]);
      ctx.fillRect(hx + 6, hy + 6, hw - 12, hw - 12);

      // 4 个白色圆形停机位
      var slots = engine.LUDO_HANGAR_SLOTS[h.key] || [];
      slots.forEach(function (pt) {
        var sx = pad + (pt[1] + 0.4) * cell;
        var sy = pad + (pt[0] + 0.4) * cell;
        ctx.beginPath();
        ctx.arc(sx, sy, cell * 0.38, 0, Math.PI * 2);
        ctx.setFillStyle('#ffffff');
        ctx.fill();
        ctx.setStrokeStyle(palette[h.key]);
        ctx.setLineWidth(1.5);
        ctx.stroke();
      });
    });

    // 3. 40 格十字环形四色跑道
    engine.LUDO_RING_COORDS.forEach(function (rc, idx) {
      var cKey = engine.LUDO_COLORS[idx % 4];
      var x = pad + rc[1] * cell;
      var y = pad + rc[0] * cell;
      ctx.setFillStyle(palette[cKey]);
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      ctx.setStrokeStyle('#fffaf0');
      ctx.setLineWidth(1);
      ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);

      // 起飞格五角星/航标点
      if (idx === 0 || idx === 10 || idx === 20 || idx === 30) {
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.22, 0, Math.PI * 2);
        ctx.setFillStyle('#ffffff');
        ctx.fill();
      }
    });

    // 4. 四条彩色终点直道（Home Stretch）
    ['r', 'y', 'b', 'g'].forEach(function (cKey) {
      var lane = engine.LUDO_HOME_LANES[cKey];
      for (var i = 0; i < 3; i++) {
        var pt = lane[i];
        var lx = pad + pt[1] * cell;
        var ly = pad + pt[0] * cell;
        ctx.setFillStyle(lightPalette[cKey]);
        ctx.fillRect(lx + 1, ly + 1, cell - 2, cell - 2);
        ctx.setStrokeStyle(palette[cKey]);
        ctx.setLineWidth(1.5);
        ctx.strokeRect(lx + 2, ly + 2, cell - 4, cell - 4);

        ctx.beginPath();
        ctx.arc(lx + cell / 2, ly + cell / 2, cell * 0.18, 0, Math.PI * 2);
        ctx.setFillStyle(palette[cKey]);
        ctx.fill();
      }
    });

    // 5. 中央 3×3 四色风车三角形终点大本营 (r: 4..7, c: 4..7)
    var gx0 = pad + 4 * cell;
    var gy0 = pad + 4 * cell;
    var gw = cell * 3;
    var gcx = gx0 + gw / 2;
    var gcy = gy0 + gw / 2;

    var tris = [
      { key: 'r', p1: [gx0, gy0], p2: [gx0, gy0 + gw] },
      { key: 'y', p1: [gx0, gy0], p2: [gx0 + gw, gy0] },
      { key: 'b', p1: [gx0 + gw, gy0], p2: [gx0 + gw, gy0 + gw] },
      { key: 'g', p1: [gx0 + gw, gy0 + gw], p2: [gx0, gy0 + gw] }
    ];
    tris.forEach(function (t) {
      ctx.beginPath();
      ctx.moveTo(gcx, gcy);
      ctx.lineTo(t.p1[0], t.p1[1]);
      ctx.lineTo(t.p2[0], t.p2[1]);
      ctx.closePath();
      ctx.setFillStyle(palette[t.key]);
      ctx.fill();
      ctx.setStrokeStyle('#fffaf0');
      ctx.setLineWidth(1.5);
      ctx.stroke();
    });

    // 中央奖杯圆章
    ctx.beginPath();
    ctx.arc(gcx, gcy, cell * 0.42, 0, Math.PI * 2);
    ctx.setFillStyle('#fffaf0');
    ctx.fill();
    ctx.setFillStyle('#b4452f');
    ctx.setFontSize(Math.round(cell * 0.42));
    ctx.setTextAlign('center');
    ctx.setTextBaseline('middle');
    ctx.fillText('终', gcx, gcy + 0.5);

    // 6. 黄/绿机库装饰飞机（让四角停机坪视觉饱满对称）
    var self = this;
    ['y', 'g'].forEach(function (idleSide) {
      var slots = engine.LUDO_HANGAR_SLOTS[idleSide];
      slots.slice(0, 2).forEach(function (pt, idx) {
        var px = pad + (pt[1] + 0.4) * cell;
        var py = pad + (pt[0] + 0.4) * cell;
        self.drawAirplaneToken(ctx, px, py, cell * 0.34, palette[idleSide], false, idx + 1);
      });
    });

    // 7. 绘制红方与蓝方各 4 架实战飞机
    var st = this.ludo;
    this.ludoHitBoxes = [];
    var occupiedCount = {};

    ['r', 'b'].forEach(function (side) {
      var hex = side === 'r' ? '#c93b2b' : '#2b6cb0';
      st.tokens[side].forEach(function (step, idx) {
        var coord = engine.ludoTokenCoord(side, idx, step);
        var baseCx = coord.zone === 'hangar' ? (pad + (coord.c + 0.4) * cell) : (pad + (coord.c + 0.5) * cell);
        var baseCy = coord.zone === 'hangar' ? (pad + (coord.r + 0.4) * cell) : (pad + (coord.r + 0.5) * cell);

        var key = Math.round(baseCx) + ',' + Math.round(baseCy);
        var stackIdx = occupiedCount[key] || 0;
        occupiedCount[key] = stackIdx + 1;
        var offsetX = stackIdx > 0 ? ((stackIdx % 2 === 1 ? 1 : -1) * 4) : 0;
        var offsetY = stackIdx > 0 ? -3 * stackIdx : 0;

        var cx = baseCx + offsetX;
        var cy = baseCy + offsetY;
        var movable = st.rolled && st.turn === side && engine.canMoveLudoToken(st, side, idx, st.dice);

        self.drawAirplaneToken(ctx, cx, cy, cell * 0.38, hex, movable, idx + 1);
        if (side === st.turn) {
          self.ludoHitBoxes.push({ idx: idx, x: cx, y: cy, r: cell * 0.58, movable: movable });
        }
      });
    });

    ctx.draw();
  },

  onLudoCanvasTap: function (event) {
    if (!this.ludo || !this.ludo.rolled) {
      this.onLudoRoll();
      return;
    }
    var detail = (event && event.detail) || {};
    var target = (event && event.currentTarget) || {};
    var x = detail.x != null ? detail.x - (target.offsetLeft || 0) : 0;
    var y = detail.y != null ? detail.y - (target.offsetTop || 0) : 0;

    var boxes = this.ludoHitBoxes || [];
    var chosen = null;
    var minDist = 999999;
    boxes.forEach(function (b) {
      if (!b.movable) return;
      var d = Math.hypot(x - b.x, y - b.y);
      if (d <= b.r * 1.4 && d < minDist) {
        minDist = d;
        chosen = b;
      }
    });
    if (chosen) {
      if (engine.moveLudoToken(this.ludo, chosen.idx)) {
        this.syncLudoView();
        this.runLudoAiIfNeeded();
      }
    }
  },

  syncLudoView: function () {
    var st = this.ludo;
    function shortStatus(step) {
      if (step === 0) return '待命';
      if (step === engine.LUDO_GOAL_STEP) return '凯旋';
      if (step > engine.LUDO_TRACK_LEN) return '冲刺';
      return step + '步';
    }

    var redPlanes = st.tokens.r.map(function (step, idx) {
      var movable = st.rolled && st.turn === 'r' && engine.canMoveLudoToken(st, 'r', idx, st.dice);
      return { idx: idx, step: step, shortStatus: shortStatus(step), movable: movable };
    });

    var bluePlanes = st.tokens.b.map(function (step, idx) {
      var movable = st.rolled && st.turn === 'b' && engine.canMoveLudoToken(st, 'b', idx, st.dice);
      return { idx: idx, step: step, shortStatus: shortStatus(step), movable: movable };
    });

    this.setData({
      ludoTurn: st.turn,
      ludoDice: st.dice,
      ludoRolled: st.rolled,
      ludoWinner: st.winner,
      ludoLog: st.log,
      ludoRedPlanes: redPlanes,
      ludoBluePlanes: bluePlanes
    });
    this.drawLudoCanvas();
  },

  onLudoRoll: function () {
    var st = this.ludo;
    if (st.winner || st.rolled) return;
    var res = engine.applyLudoDice(st);
    this.syncLudoView();

    if (res.movable.length === 1) {
      engine.moveLudoToken(st, res.movable[0]);
      this.syncLudoView();
    }
    this.runLudoAiIfNeeded();
  },

  onLudoMovePlane: function (event) {
    var idx = Number(event.currentTarget.dataset.idx);
    if (!engine.moveLudoToken(this.ludo, idx)) return;
    this.syncLudoView();
    this.runLudoAiIfNeeded();
  },

  runLudoAiIfNeeded: function () {
    var st = this.ludo;
    if (!this.data.vsAi || st.winner || st.turn !== 'b') return;
    var guard = 0;
    while (this.data.vsAi && !st.winner && st.turn === 'b' && guard < 4) {
      guard++;
      var res = engine.applyLudoDice(st);
      if (res.movable.length > 0) {
        var pickIdx = this.data.difficulty >= 2 ? engine.pickLudoAiToken(st, res.movable) : res.movable[0];
        engine.moveLudoToken(st, pickIdx);
      }
    }
    this.syncLudoView();
  },

  onLudoReset: function () {
    this.ludo = engine.createLudo(this.data.difficulty);
    this.syncLudoView();
  },

  /* ==================== 5. 八音盒钢琴交互 ==================== */
  onSetPianoMode: function (event) {
    var blind = Number(event.currentTarget.dataset.blind) === 1;
    this.setData({ pianoBlind: blind });
  },

  syncPianoView: function (songId, step) {
    var song = engine.PIANO_SONGS.filter(function (s) { return s.id === songId; })[0] || engine.PIANO_SONGS[0];
    var idx = step % song.notes.length;
    this.setData({
      pianoSongId: song.id,
      currentSong: song,
      pianoStep: idx,
      expectedNote: song.notes[idx],
      expectedLyric: song.lyrics[idx]
    });
  },

  playPianoTone: function (noteNum) {
    var keyObj = engine.PIANO_KEYS.filter(function (k) { return k.note === noteNum; })[0];
    if (!keyObj) return;

    if (typeof wx !== 'undefined' && typeof wx.createWebAudioContext === 'function') {
      try {
        if (!this.webAudioCtx) this.webAudioCtx = wx.createWebAudioContext();
        var ctx = this.webAudioCtx;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = keyObj.freq;
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
        return;
      } catch (e) {}
    }

    if (typeof wx !== 'undefined' && typeof wx.createInnerAudioContext === 'function') {
      try {
        if (!this.toneAudio) this.toneAudio = wx.createInnerAudioContext();
        this.toneAudio.stop();
        this.toneAudio.src = engine.buildToneWavDataUri(keyObj.freq, 0.28);
        this.toneAudio.play();
      } catch (e) {}
    }
  },

  onPressKey: function (event) {
    var note = Number(event.currentTarget.dataset.note);
    this.playPianoTone(note);
    var song = this.data.currentSong;
    var step = this.data.pianoStep;
    var nextStep = note === song.notes[step] ? ((step + 1) % song.notes.length) : step;

    this.setData({
      lastPressedNote: note,
      pianoStep: nextStep,
      expectedNote: song.notes[nextStep],
      expectedLyric: song.lyrics[nextStep]
    });
  },

  onSelectSong: function (event) {
    var id = event.currentTarget.dataset.id;
    this.stopAutoDemo();
    this.syncPianoView(id, 0);
  },

  onResetSong: function () {
    this.stopAutoDemo();
    this.syncPianoView(this.data.pianoSongId, 0);
  },

  onAutoDemo: function () {
    if (this.data.autoPlaying) {
      this.stopAutoDemo();
      return;
    }
    var self = this;
    this.setData({ autoPlaying: true });
    this.demoTimer = setInterval(function () {
      var song = self.data.currentSong;
      var step = self.data.pianoStep;
      var note = song.notes[step];
      self.onPressKey({ currentTarget: { dataset: { note: note } } });
    }, 450);
  },

  stopAutoDemo: function () {
    if (this.demoTimer) {
      clearInterval(this.demoTimer);
      this.demoTimer = null;
    }
    if (this.data && this.data.autoPlaying) {
      this.setData({ autoPlaying: false });
    }
  }
});
