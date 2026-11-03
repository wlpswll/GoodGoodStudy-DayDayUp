/* 轻松一刻 · 益智小游戏引擎（支持 9/13/19 路围棋、多档 AI 难度、精选同款优质外部小游戏/H5 平台） */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MiniGamesEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  var DIFFICULTIES = [
    { id: 1, name: '入门', desc: '适合初学启蒙，AI 步法温和' },
    { id: 2, name: '进阶', desc: '攻守兼备，会主动封堵与吃子' },
    { id: 3, name: '高手', desc: '深度算路，挑战大孩子与家长' }
  ];

  var GAMES = [
    {
      id: 'weiqi',
      icon: '⚫',
      shortLabel: '围',
      name: '围棋',
      badge: '9/13/19路',
      note: '支持 9 路、13 路、19 路标准棋盘，可选吃子赛与自由对局，三级 AI 难度',
      externalName: '腾讯少儿围棋',
      appId: 'wx2c348cf579062e56',
      recommendations: [
        { name: '腾讯少儿围棋', type: '微信小游戏', appId: 'wx2c348cf579062e56', desc: '腾讯出品，闯关式少儿学棋与在线匹配' },
        { name: '野狐围棋', type: '微信小游戏', appId: 'wx0f8e1a2f6f0a5c8e', desc: '全国棋童与职业棋手聚集的对弈平台' },
        { name: '101围棋网', type: '精选网页', url: 'https://www.101weiqi.com/', desc: '海量死活题、手筋闯关与定式词典' },
        { name: '在线围棋 OGS', type: '精选网页', url: 'https://online-go.com/', desc: '免安装全尺寸 9/13/19 路 AI 与全球对弈' }
      ]
    },
    {
      id: 'gomoku',
      icon: '⚪',
      shortLabel: '五',
      name: '五子棋',
      badge: '15路连珠',
      note: '标准 15×15 棋盘，三级 AI 算路（含活三冲四双杀防守），支持双人同屏',
      externalName: '欢乐五子棋',
      appId: 'wx79adefc4c59f3c0e',
      recommendations: [
        { name: '腾讯欢乐五子棋', type: '微信小游戏', appId: 'wx79adefc4c59f3c0e', desc: '经典五子连珠、残局闯关与好友联机' },
        { name: 'PaperGames 五子棋', type: '精选网页', url: 'https://papergames.io/zh/%E4%BA%94%E5%AD%90%E6%A3%8B', desc: '清爽无广，直接匹配全球玩家或机器人' }
      ]
    },
    {
      id: 'xiangqi',
      icon: '🐘',
      shortLabel: '象',
      name: '中国象棋',
      badge: '楚河汉界',
      note: '标准 9×10 棋盘，内置多步极小化极大搜索 AI，支持入门/进阶/高手三档',
      externalName: '天天象棋',
      appId: 'wx7db5c3d985e2b0ff',
      recommendations: [
        { name: '腾讯天天象棋', type: '微信小游戏', appId: 'wx7db5c3d985e2b0ff', desc: '权威棋力评测、楚汉残局闯关与复盘学棋' },
        { name: '学习盒子象棋', type: '精选网页', url: 'https://www.studybox.cn/zh/game', desc: '适合儿童的纯净在线象棋与脑力训练' }
      ]
    },
    {
      id: 'ludo',
      icon: '✈️',
      shortLabel: '飞',
      name: '飞行棋',
      badge: '策略竞速',
      note: '双机编队航道竞速，三级策略 AI（优先撞子、跳格与安全停靠）',
      externalName: '飞行棋大作战',
      appId: 'wxf4b4e5a1d9c6e8a0',
      recommendations: [
        { name: '飞行棋大作战', type: '微信小游戏', appId: 'wxf4b4e5a1d9c6e8a0', desc: '支持四色同屏与微信好友房间联机' },
        { name: 'Hi8 29合1棋类馆', type: '精选网页', url: 'https://hi8.com/c/board', desc: '含飞行棋、跳棋、国际象棋、军棋等 29 种棋类' }
      ]
    },
    {
      id: 'piano',
      icon: '🎹',
      shortLabel: '琴',
      name: '八音盒钢琴',
      badge: '名曲进阶',
      note: '从启蒙儿歌到古典名曲《欢乐颂》《卡农》《致爱丽丝》，支持跟弹与盲弹闯关',
      externalName: '完美钢琴',
      appId: '',
      wide: true,
      recommendations: [
        { name: 'FreePlay 音乐与益智馆', type: '精选网页', url: 'https://freeplayisok.com/zh', desc: '免下载在线钢琴、数独、2048 合集' }
      ]
    }
  ];

  /* ==================== 1. 五子棋 (Gomoku · 支持 13/15 路与三级 AI) ==================== */
  var GOMOKU_SIZE = 13;

  function createGomoku(size, difficulty) {
    var n = size || GOMOKU_SIZE;
    var board = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(0);
      board.push(row);
    }
    return {
      size: n,
      difficulty: difficulty || 2,
      board: board,
      turn: 1, // 1: 黑, 2: 白
      winner: 0,
      winCells: [],
      history: []
    };
  }

  function getGomokuStarPoints(size) {
    if (size === 15) return [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];
    if (size === 13) return [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]];
    var mid = Math.floor(size / 2);
    return [[2, 2], [2, size - 3], [mid, mid], [size - 3, 2], [size - 3, size - 3]];
  }

  function checkGomokuWin(board, r, c, color) {
    var n = board.length;
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var d = 0; d < dirs.length; d++) {
      var dr = dirs[d][0], dc = dirs[d][1];
      var cells = [[r, c]];
      for (var step = 1; step < 5; step++) {
        var nr = r + dr * step, nc = c + dc * step;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n || board[nr][nc] !== color) break;
        cells.push([nr, nc]);
      }
      for (var step2 = 1; step2 < 5; step2++) {
        var nr2 = r - dr * step2, nc2 = c - dc * step2;
        if (nr2 < 0 || nr2 >= n || nc2 < 0 || nc2 >= n || board[nr2][nc2] !== color) break;
        cells.push([nr2, nc2]);
      }
      if (cells.length >= 5) return cells;
    }
    return null;
  }

  function placeGomoku(state, r, c) {
    if (!state || state.winner) return false;
    var n = state.size;
    if (r < 0 || r >= n || c < 0 || c >= n || state.board[r][c] !== 0) return false;
    var color = state.turn;
    state.board[r][c] = color;
    state.history.push({ r: r, c: c, color: color });
    var winCells = checkGomokuWin(state.board, r, c, color);
    if (winCells) {
      state.winner = color;
      state.winCells = winCells;
    } else if (state.history.length >= n * n) {
      state.winner = 3;
    } else {
      state.turn = color === 1 ? 2 : 1;
    }
    return true;
  }

  function undoGomoku(state, steps) {
    var count = steps || 1;
    while (count > 0 && state.history.length > 0) {
      var last = state.history.pop();
      state.board[last.r][last.c] = 0;
      state.turn = last.color;
      state.winner = 0;
      state.winCells = [];
      count--;
    }
  }

  function evaluateGomokuPoint(board, r, c, color) {
    var n = board.length;
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    var total = 0;
    var liveThrees = 0;
    var fours = 0;
    for (var d = 0; d < dirs.length; d++) {
      var dr = dirs[d][0], dc = dirs[d][1];
      var count = 1, openEnds = 0;
      var s1 = 1;
      while (s1 < 5) {
        var nr = r + dr * s1, nc = c + dc * s1;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) break;
        if (board[nr][nc] === color) { count++; s1++; }
        else { if (board[nr][nc] === 0) openEnds++; break; }
      }
      var s2 = 1;
      while (s2 < 5) {
        var nr2 = r - dr * s2, nc2 = c - dc * s2;
        if (nr2 < 0 || nr2 >= n || nc2 < 0 || nc2 >= n) break;
        if (board[nr2][nc2] === color) { count++; s2++; }
        else { if (board[nr2][nc2] === 0) openEnds++; break; }
      }
      if (count >= 5) total += 200000;
      else if (count === 4 && openEnds === 2) { total += 30000; fours++; }
      else if (count === 4 && openEnds === 1) { total += 5000; fours++; }
      else if (count === 3 && openEnds === 2) { total += 3600; liveThrees++; }
      else if (count === 3 && openEnds === 1) total += 400;
      else if (count === 2 && openEnds === 2) total += 260;
      else if (count === 2 && openEnds === 1) total += 40;
    }
    // 双活三 / 冲四活三绝杀加分
    if (fours >= 2 || (fours >= 1 && liveThrees >= 1)) total += 18000;
    else if (liveThrees >= 2) total += 9000;
    return total;
  }

  function pickGomokuAiMove(state, difficulty) {
    var n = state.size;
    var diff = difficulty || state.difficulty || 2;
    var aiColor = state.turn;
    var humanColor = aiColor === 1 ? 2 : 1;
    var mid = Math.floor(n / 2);
    if (state.history.length === 0) return { r: mid, c: mid };

    var candidates = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (state.board[r][c] !== 0) continue;
        var attack = evaluateGomokuPoint(state.board, r, c, aiColor);
        var defend = evaluateGomokuPoint(state.board, r, c, humanColor);
        var centerBias = (n - Math.abs(r - mid) - Math.abs(c - mid)) * 2;
        var score = 0;
        if (diff === 1) {
          // 入门：重视直接连子，偶尔忽略复杂双活三
          score = attack * 0.9 + defend * 0.75 + centerBias;
        } else if (diff === 2) {
          // 进阶：标准攻防平衡
          score = attack * 1.1 + defend * 1.05 + centerBias;
        } else {
          // 高手：必杀优先 + 严密防守 + 往前多算一步对方反击
          score = (attack >= 200000 ? attack * 2 : attack * 1.18) + (defend >= 25000 ? defend * 1.35 : defend * 1.12) + centerBias;
        }
        candidates.push({ r: r, c: c, score: score });
      }
    }
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return b.score - a.score; });

    // 高手模式：对前 5 个候选点做二层前瞻
    if (diff >= 3 && candidates.length > 1 && candidates[0].score < 150000) {
      var topK = candidates.slice(0, Math.min(5, candidates.length));
      var bestMove = topK[0];
      var bestNet = -999999;
      topK.forEach(function (cand) {
        state.board[cand.r][cand.c] = aiColor;
        var maxHumanReply = 0;
        for (var rr = 0; rr < n; rr++) {
          for (var cc = 0; cc < n; cc++) {
            if (state.board[rr][cc] !== 0) continue;
            var reply = evaluateGomokuPoint(state.board, rr, cc, humanColor);
            if (reply > maxHumanReply) maxHumanReply = reply;
          }
        }
        state.board[cand.r][cand.c] = 0;
        var net = cand.score - maxHumanReply * 0.45;
        if (net > bestNet) {
          bestNet = net;
          bestMove = cand;
        }
      });
      return { r: bestMove.r, c: bestMove.c };
    }

    // 入门模式：若非必防点，在前 2 名中轻微波动，给孩子赢面
    if (diff === 1 && candidates.length > 1 && candidates[0].score < 4000) {
      return { r: candidates[0].r, c: candidates[0].c };
    }
    return { r: candidates[0].r, c: candidates[0].c };
  }

  /* ==================== 2. 围棋 (9 / 13 / 19 路 · 支持吃子赛与自由对局 + 三级 AI) ==================== */
  var WEIQI_SIZES = [9, 13, 19];

  function getWeiqiStarPoints(size) {
    if (size === 19) {
      return [
        [3, 3], [3, 9], [3, 15],
        [9, 3], [9, 9], [9, 15],
        [15, 3], [15, 9], [15, 15]
      ];
    }
    if (size === 13) {
      return [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]];
    }
    return [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]];
  }

  function createWeiqi(targetCaptures, size, difficulty, ruleMode) {
    var n = WEIQI_SIZES.indexOf(Number(size)) >= 0 ? Number(size) : 9;
    var board = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(0);
      board.push(row);
    }
    var target = targetCaptures != null ? Number(targetCaptures) : 3;
    return {
      size: n,
      difficulty: difficulty || 2,
      ruleMode: ruleMode || (target > 0 ? 'capture' : 'free'), // 'capture': 吃子赛, 'free': 自由围空对弈
      board: board,
      turn: 1, // 1: 黑, 2: 白
      captures: { 1: 0, 2: 0 },
      target: target,
      winner: 0,
      lastMove: null,
      koPoint: null,
      history: []
    };
  }

  function cloneBoard(board) {
    return board.map(function (row) { return row.slice(); });
  }

  function getGroupAndLiberties(board, startR, startC) {
    var n = board.length;
    var color = board[startR][startC];
    if (!color) return { stones: [], liberties: 0 };
    var visited = {};
    var libertySet = {};
    var stones = [];
    var queue = [[startR, startC]];
    visited[startR + ',' + startC] = true;
    var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    while (queue.length > 0) {
      var cur = queue.shift();
      var r = cur[0], c = cur[1];
      stones.push([r, c]);
      for (var i = 0; i < dirs.length; i++) {
        var nr = r + dirs[i][0], nc = c + dirs[i][1];
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        var key = nr + ',' + nc;
        if (board[nr][nc] === 0) {
          libertySet[key] = true;
        } else if (board[nr][nc] === color && !visited[key]) {
          visited[key] = true;
          queue.push([nr, nc]);
        }
      }
    }
    return {
      stones: stones,
      liberties: Object.keys(libertySet).length
    };
  }

  function placeWeiqi(state, r, c) {
    if (!state || state.winner) return { ok: false, reason: '对局已结束' };
    var n = state.size;
    if (r < 0 || r >= n || c < 0 || c >= n || state.board[r][c] !== 0) {
      return { ok: false, reason: '交叉点已有棋子' };
    }
    if (state.koPoint && state.koPoint.r === r && state.koPoint.c === c) {
      return { ok: false, reason: '打劫禁入（需先找劫材）' };
    }
    var color = state.turn;
    var opp = color === 1 ? 2 : 1;
    var nextBoard = cloneBoard(state.board);
    nextBoard[r][c] = color;

    var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    var captured = [];
    for (var i = 0; i < dirs.length; i++) {
      var nr = r + dirs[i][0], nc = c + dirs[i][1];
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (nextBoard[nr][nc] === opp) {
        var grp = getGroupAndLiberties(nextBoard, nr, nc);
        if (grp.liberties === 0) {
          grp.stones.forEach(function (pt) {
            nextBoard[pt[0]][pt[1]] = 0;
            captured.push(pt);
          });
        }
      }
    }

    var selfGrp = getGroupAndLiberties(nextBoard, r, c);
    if (selfGrp.liberties === 0 && captured.length === 0) {
      return { ok: false, reason: '禁入点（此处落子无气）' };
    }

    if (state.history) {
      state.history.push({
        board: cloneBoard(state.board),
        turn: state.turn,
        captures: { 1: state.captures[1], 2: state.captures[2] },
        lastMove: state.lastMove,
        koPoint: state.koPoint
      });
    }

    state.board = nextBoard;
    state.captures[color] += captured.length;
    state.lastMove = { r: r, c: c, captured: captured.length };

    if (captured.length === 1 && selfGrp.stones.length === 1 && selfGrp.liberties === 1) {
      state.koPoint = { r: captured[0][0], c: captured[0][1] };
    } else {
      state.koPoint = null;
    }

    if (state.ruleMode !== 'free' && state.target > 0 && state.captures[color] >= state.target) {
      state.winner = color;
    } else {
      state.turn = opp;
    }
    return { ok: true, captured: captured.length };
  }

  function undoWeiqi(state, steps) {
    if (!state || !state.history) return;
    var count = steps || 1;
    while (count > 0 && state.history.length > 0) {
      var prev = state.history.pop();
      state.board = prev.board;
      state.turn = prev.turn;
      state.captures = prev.captures;
      state.lastMove = prev.lastMove;
      state.koPoint = prev.koPoint;
      state.winner = 0;
      count--;
    }
  }

  function countWeiqiTerritory(state) {
    var n = state.size;
    var blackStones = 0, whiteStones = 0;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (state.board[r][c] === 1) blackStones++;
        else if (state.board[r][c] === 2) whiteStones++;
      }
    }
    return {
      blackTotal: blackStones + state.captures[1],
      whiteTotal: whiteStones + state.captures[2]
    };
  }

  function pickWeiqiAiMove(state, difficulty) {
    var n = state.size;
    var diff = difficulty || state.difficulty || 2;
    var color = state.turn;
    var opp = color === 1 ? 2 : 1;
    var mid = Math.floor(n / 2);
    var stars = getWeiqiStarPoints(n);
    var starMap = {};
    stars.forEach(function (pt) { starMap[pt[0] + ',' + pt[1]] = true; });

    var best = null;
    var bestScore = -99999;

    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (state.board[r][c] !== 0) continue;
        var sim = {
          size: n,
          board: cloneBoard(state.board),
          turn: color,
          captures: { 1: state.captures[1], 2: state.captures[2] },
          target: state.target,
          ruleMode: state.ruleMode,
          koPoint: state.koPoint,
          winner: 0
        };
        var res = placeWeiqi(sim, r, c);
        if (!res.ok) continue;
        var selfGrp = getGroupAndLiberties(sim.board, r, c);
        // 避免自填叫吃（送吃）
        if (selfGrp.liberties === 1 && res.captured === 0) {
          if (diff >= 2) continue;
        }

        var score = res.captured * 800 + Math.min(selfGrp.liberties, 5) * 22;

        // 检查紧气、打吃与救己方叫吃棋块
        var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (var d = 0; d < dirs.length; d++) {
          var nr = r + dirs[d][0], nc = c + dirs[d][1];
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
          if (sim.board[nr][nc] === opp) {
            var oppGrp = getGroupAndLiberties(sim.board, nr, nc);
            if (oppGrp.liberties === 1) score += diff >= 2 ? 360 : 140; // 叫吃对方
            else if (oppGrp.liberties === 2) score += diff >= 3 ? 120 : 50;
          } else if (state.board[nr][nc] === color) {
            var oldSelf = getGroupAndLiberties(state.board, nr, nc);
            if (oldSelf.liberties === 1 && selfGrp.liberties >= 2) {
              score += diff >= 2 ? 420 : 120; // 长气救子
            }
          }
        }

        // 高手/进阶模式重视金角银边与星位占角
        if (starMap[r + ',' + c]) score += diff >= 2 ? 45 : 15;
        if (r === 0 || r === n - 1 || c === 0 || c === n - 1) score -= 25; // 避免早早在一路爬
        score += (n - Math.abs(r - mid) - Math.abs(c - mid)) * 2;

        if (score > bestScore) {
          bestScore = score;
          best = { r: r, c: c };
        }
      }
    }
    return best;
  }

  /* ==================== 3. 中国象棋 (Xiangqi · 三级搜索 AI) ==================== */
  var XIANGQI_LABELS = {
    rK: '帅', rA: '仕', rB: '相', rN: '马', rR: '车', rC: '炮', rP: '兵',
    bK: '将', bA: '士', bB: '象', bN: '马', bR: '车', bC: '炮', bP: '卒'
  };
  var PIECE_VALUE = { K: 10000, R: 95, C: 48, N: 42, B: 22, A: 20, P: 14 };

  function initialXiangqiBoard() {
    return [
      ['bR', 'bN', 'bB', 'bA', 'bK', 'bA', 'bB', 'bN', 'bR'],
      ['', '', '', '', '', '', '', '', ''],
      ['', 'bC', '', '', '', '', '', 'bC', ''],
      ['bP', '', 'bP', '', 'bP', '', 'bP', '', 'bP'],
      ['', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', ''],
      ['rP', '', 'rP', '', 'rP', '', 'rP', '', 'rP'],
      ['', 'rC', '', '', '', '', '', 'rC', ''],
      ['', '', '', '', '', '', '', '', ''],
      ['rR', 'rN', 'rB', 'rA', 'rK', 'rA', 'rB', 'rN', 'rR']
    ];
  }

  function createXiangqi(difficulty) {
    return {
      difficulty: difficulty || 2,
      board: initialXiangqiBoard(),
      turn: 'r',
      winner: '',
      lastMove: null,
      history: []
    };
  }

  function sideOf(piece) { return piece ? piece.charAt(0) : ''; }
  function typeOf(piece) { return piece ? piece.charAt(1) : ''; }
  function inBoundsXq(r, c) { return r >= 0 && r < 10 && c >= 0 && c < 9; }

  function inPalace(side, r, c) {
    if (c < 3 || c > 5) return false;
    return side === 'r' ? (r >= 7 && r <= 9) : (r >= 0 && r <= 2);
  }

  function getValidXiangqiMoves(board, r, c) {
    var piece = board[r] && board[r][c];
    if (!piece) return [];
    var side = sideOf(piece);
    var kind = typeOf(piece);
    var moves = [];

    function tryPush(nr, nc) {
      if (!inBoundsXq(nr, nc)) return;
      if (sideOf(board[nr][nc]) !== side) moves.push({ r: nr, c: nc });
    }

    if (kind === 'K') {
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) {
        var nr = r + d[0], nc = c + d[1];
        if (inPalace(side, nr, nc)) tryPush(nr, nc);
      });
      var dir = side === 'r' ? -1 : 1;
      var scan = r + dir;
      while (scan >= 0 && scan < 10) {
        var p = board[scan][c];
        if (p) {
          if (typeOf(p) === 'K' && sideOf(p) !== side) moves.push({ r: scan, c: c });
          break;
        }
        scan += dir;
      }
    } else if (kind === 'A') {
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (d) {
        var nr = r + d[0], nc = c + d[1];
        if (inPalace(side, nr, nc)) tryPush(nr, nc);
      });
    } else if (kind === 'B') {
      [[-2, -2, -1, -1], [-2, 2, -1, 1], [2, -2, 1, -1], [2, 2, 1, 1]].forEach(function (d) {
        var nr = r + d[0], nc = c + d[1];
        var er = r + d[2], ec = c + d[3];
        if (!inBoundsXq(nr, nc)) return;
        if (side === 'r' && nr < 5) return;
        if (side === 'b' && nr > 4) return;
        if (board[er][ec] === '') tryPush(nr, nc);
      });
    } else if (kind === 'N') {
      [
        [-2, -1, -1, 0], [-2, 1, -1, 0],
        [2, -1, 1, 0], [2, 1, 1, 0],
        [-1, -2, 0, -1], [1, -2, 0, -1],
        [-1, 2, 0, 1], [1, 2, 0, 1]
      ].forEach(function (d) {
        var nr = r + d[0], nc = c + d[1];
        var lr = r + d[2], lc = c + d[3];
        if (inBoundsXq(nr, nc) && board[lr][lc] === '') tryPush(nr, nc);
      });
    } else if (kind === 'R' || kind === 'C') {
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) {
        var nr = r + d[0], nc = c + d[1];
        var jumped = false;
        while (inBoundsXq(nr, nc)) {
          var target = board[nr][nc];
          if (!jumped) {
            if (!target) {
              moves.push({ r: nr, c: nc });
            } else {
              if (kind === 'R' && sideOf(target) !== side) moves.push({ r: nr, c: nc });
              jumped = true;
              if (kind === 'R') break;
            }
          } else if (target) {
            if (sideOf(target) !== side) moves.push({ r: nr, c: nc });
            break;
          }
          nr += d[0];
          nc += d[1];
        }
      });
    } else if (kind === 'P') {
      var forward = side === 'r' ? -1 : 1;
      tryPush(r + forward, c);
      var crossed = side === 'r' ? (r <= 4) : (r >= 5);
      if (crossed) {
        tryPush(r, c - 1);
        tryPush(r, c + 1);
      }
    }
    return moves;
  }

  function moveXiangqi(state, fromR, fromC, toR, toC) {
    if (!state || state.winner) return false;
    var piece = state.board[fromR] && state.board[fromR][fromC];
    if (!piece || sideOf(piece) !== state.turn) return false;
    var valid = getValidXiangqiMoves(state.board, fromR, fromC);
    var allowed = valid.some(function (m) { return m.r === toR && m.c === toC; });
    if (!allowed) return false;

    var captured = state.board[toR][toC];
    if (state.history) {
      state.history.push({
        fromR: fromR, fromC: fromC, toR: toR, toC: toC,
        piece: piece, captured: captured, turn: state.turn
      });
    }
    state.board[toR][toC] = piece;
    state.board[fromR][fromC] = '';
    state.lastMove = { fromR: fromR, fromC: fromC, toR: toR, toC: toC, captured: captured };

    if (typeOf(captured) === 'K') {
      state.winner = state.turn;
    } else {
      state.turn = state.turn === 'r' ? 'b' : 'r';
    }
    return true;
  }

  function undoXiangqi(state, steps) {
    if (!state || !state.history) return;
    var count = steps || 1;
    while (count > 0 && state.history.length > 0) {
      var last = state.history.pop();
      state.board[last.fromR][last.fromC] = last.piece;
      state.board[last.toR][last.toC] = last.captured;
      state.turn = last.turn;
      state.winner = '';
      count--;
    }
  }

  function evaluateXiangqiBoard(board, perspectiveSide) {
    var score = 0;
    for (var r = 0; r < 10; r++) {
      for (var c = 0; c < 9; c++) {
        var p = board[r][c];
        if (!p) continue;
        var s = sideOf(p), k = typeOf(p);
        var val = PIECE_VALUE[k] || 10;
        // 过河兵升值、中路控制加分
        if (k === 'P') {
          var crossed = s === 'r' ? (r <= 4) : (r >= 5);
          if (crossed) val += 14;
        }
        val += (4 - Math.abs(4 - c)) * 0.8;
        score += (s === perspectiveSide ? val : -val);
      }
    }
    return score;
  }

  function listAllXiangqiMoves(board, side) {
    var all = [];
    for (var r = 0; r < 10; r++) {
      for (var c = 0; c < 9; c++) {
        if (sideOf(board[r][c]) !== side) continue;
        var ms = getValidXiangqiMoves(board, r, c);
        ms.forEach(function (m) {
          var target = board[m.r][m.c];
          var capGain = target ? (PIECE_VALUE[typeOf(target)] * 10) : 0;
          all.push({ fromR: r, fromC: c, toR: m.r, toC: m.c, capGain: capGain });
        });
      }
    }
    all.sort(function (a, b) { return b.capGain - a.capGain; });
    return all;
  }

  function pickXiangqiAiMove(state, difficulty) {
    var side = state.turn;
    var opp = side === 'r' ? 'b' : 'r';
    var diff = difficulty || state.difficulty || 2;
    var candidates = listAllXiangqiMoves(state.board, side);
    if (!candidates.length) return null;

    if (diff === 1) {
      // 入门：单层评估
      candidates.forEach(function (m) {
        var piece = state.board[m.fromR][m.fromC];
        var cap = state.board[m.toR][m.toC];
        state.board[m.toR][m.toC] = piece;
        state.board[m.fromR][m.fromC] = '';
        m.score = evaluateXiangqiBoard(state.board, side);
        state.board[m.fromR][m.fromC] = piece;
        state.board[m.toR][m.toC] = cap;
      });
      candidates.sort(function (a, b) { return b.score - a.score; });
      return candidates[0];
    }

    // 进阶 & 高手：2 层极小化极大搜索（防丢车、算交换）
    var limit = diff >= 3 ? Math.min(candidates.length, 28) : Math.min(candidates.length, 14);
    var bestMove = candidates[0];
    var bestScore = -999999;

    for (var i = 0; i < limit; i++) {
      var m = candidates[i];
      var piece = state.board[m.fromR][m.fromC];
      var cap = state.board[m.toR][m.toC];
      if (typeOf(cap) === 'K') return m;

      state.board[m.toR][m.toC] = piece;
      state.board[m.fromR][m.fromC] = '';

      var oppMoves = listAllXiangqiMoves(state.board, opp);
      var oppLimit = diff >= 3 ? Math.min(oppMoves.length, 18) : Math.min(oppMoves.length, 8);
      var worstReply = 999999;
      if (!oppMoves.length) {
        worstReply = evaluateXiangqiBoard(state.board, side);
      } else {
        for (var j = 0; j < oppLimit; j++) {
          var om = oppMoves[j];
          var opPiece = state.board[om.fromR][om.fromC];
          var opCap = state.board[om.toR][om.toC];
          state.board[om.toR][om.toC] = opPiece;
          state.board[om.fromR][om.fromC] = '';
          var val = evaluateXiangqiBoard(state.board, side);
          state.board[om.fromR][om.fromC] = opPiece;
          state.board[om.toR][om.toC] = opCap;
          if (val < worstReply) worstReply = val;
        }
      }

      state.board[m.fromR][m.fromC] = piece;
      state.board[m.toR][m.toC] = cap;

      if (worstReply > bestScore) {
        bestScore = worstReply;
        bestMove = m;
      }
    }
    return bestMove;
  }

  /* ==================== 4. 飞行棋 (Ludo · 标准十字四色航道 + 同色跳格 + 四机编队) ==================== */
  var LUDO_RING_COORDS = [
    // Quadrant 0: 左臂上沿 -> 上臂左沿 -> 上臂顶沿
    [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 4], [0, 5], [0, 6],
    // Quadrant 1: 上臂右沿 -> 右臂上沿 -> 右臂右沿
    [0, 7], [1, 7], [2, 7], [3, 7], [3, 8], [3, 9], [3, 10], [4, 10], [5, 10], [6, 10],
    // Quadrant 2: 右臂下沿 -> 下臂右沿 -> 下臂底沿
    [7, 10], [7, 9], [7, 8], [7, 7], [8, 7], [9, 7], [10, 7], [10, 6], [10, 5], [10, 4],
    // Quadrant 3: 下臂左沿 -> 左臂下沿 -> 左臂左沿
    [10, 3], [9, 3], [8, 3], [7, 3], [7, 2], [7, 1], [7, 0], [6, 0], [5, 0], [4, 0]
  ];
  var LUDO_COLORS = ['r', 'y', 'b', 'g'];
  var LUDO_TRACK_LEN = 39; // 第 1..39 步在外环跑道，第 40..42 步在终点直道，第 43 步抵达终点大本营
  var LUDO_GOAL_STEP = 43;

  var LUDO_HOME_LANES = {
    r: [[5, 1], [5, 2], [5, 3], [5, 4.15]],
    y: [[1, 5], [2, 5], [3, 5], [4.15, 5]],
    b: [[5, 9], [5, 8], [5, 7], [5, 5.85]],
    g: [[9, 5], [8, 5], [7, 5], [5.85, 5]]
  };

  var LUDO_HANGAR_SLOTS = {
    r: [[0.8, 0.8], [0.8, 2.0], [2.0, 0.8], [2.0, 2.0]],
    y: [[0.8, 8.0], [0.8, 9.2], [2.0, 8.0], [2.0, 9.2]],
    b: [[8.0, 8.0], [8.0, 9.2], [9.2, 8.0], [9.2, 9.2]],
    g: [[8.0, 0.8], [8.0, 2.0], [9.2, 0.8], [9.2, 2.0]]
  };

  function createLudo(difficulty) {
    return {
      difficulty: difficulty || 2,
      turn: 'r',
      dice: 0,
      rolled: false,
      tokens: {
        r: [0, 0, 0, 0],
        b: [0, 0, 0, 0]
      },
      winner: '',
      log: '点击「掷骰子」开始飞行（掷出 5 或 6 起飞，踩中同色格自动连跳 +4 步）'
    };
  }

  function ludoGlobalPos(side, step) {
    if (step < 1 || step > LUDO_TRACK_LEN) return -1;
    var offset = side === 'r' ? 0 : 20;
    return ((step - 1) + offset) % 40;
  }

  function ludoTokenCoord(side, tokenIdx, step) {
    if (step <= 0) {
      var slots = LUDO_HANGAR_SLOTS[side] || LUDO_HANGAR_SLOTS.r;
      var pt = slots[tokenIdx % slots.length];
      return { r: pt[0], c: pt[1], zone: 'hangar' };
    }
    if (step >= 1 && step <= LUDO_TRACK_LEN) {
      var gIdx = ludoGlobalPos(side, step);
      var rc = LUDO_RING_COORDS[gIdx];
      return { r: rc[0], c: rc[1], zone: 'ring', ringIdx: gIdx };
    }
    var lane = LUDO_HOME_LANES[side] || LUDO_HOME_LANES.r;
    var laneIdx = Math.min(lane.length - 1, step - LUDO_TRACK_LEN - 1);
    var lpt = lane[laneIdx];
    return { r: lpt[0], c: lpt[1], zone: step >= LUDO_GOAL_STEP ? 'goal' : 'lane' };
  }

  function canMoveLudoToken(state, side, tokenIdx, dice) {
    var cur = state.tokens[side][tokenIdx];
    if (cur === LUDO_GOAL_STEP) return false;
    if (cur === 0) return dice >= 5;
    return cur > 0 && cur < LUDO_GOAL_STEP;
  }

  function applyLudoDice(state, diceValue) {
    if (!state || state.winner) return { movable: [] };
    var d = diceValue || (Math.floor(Math.random() * 6) + 1);
    state.dice = d;
    state.rolled = true;
    var side = state.turn;
    var planeCount = state.tokens[side].length;
    var movable = [];
    for (var i = 0; i < planeCount; i++) {
      if (canMoveLudoToken(state, side, i, d)) movable.push(i);
    }
    if (!movable.length) {
      state.rolled = false;
      var sideName = side === 'r' ? '红方' : '蓝方';
      state.log = sideName + '掷出 ' + d + ' 点，暂无可飞行的飞机，换对方掷骰';
      state.turn = side === 'r' ? 'b' : 'r';
    }
    return { dice: d, movable: movable };
  }

  function pickLudoAiToken(state, movable) {
    if (!movable || !movable.length) return 0;
    if (movable.length === 1) return movable[0];
    var side = state.turn;
    var opp = side === 'r' ? 'b' : 'r';
    var d = state.dice;
    var bestIdx = movable[0];
    var bestScore = -999;

    movable.forEach(function (idx) {
      var cur = state.tokens[side][idx];
      var next = cur === 0 ? 1 : (cur + d);
      if (next > LUDO_GOAL_STEP) next = LUDO_GOAL_STEP - (next - LUDO_GOAL_STEP);
      var score = 0;
      if (next === LUDO_GOAL_STEP) score += 260;
      if (cur === 0) score += 95;
      if (next >= 1 && next <= LUDO_TRACK_LEN) {
        var myGlobal = ludoGlobalPos(side, next);
        if (LUDO_COLORS[myGlobal % 4] === side && next + 4 <= LUDO_TRACK_LEN) {
          score += 75; // 同色跳格加分
          next += 4;
          myGlobal = ludoGlobalPos(side, next);
        }
        state.tokens[opp].forEach(function (oppStep) {
          if (oppStep >= 1 && oppStep <= LUDO_TRACK_LEN && ludoGlobalPos(opp, oppStep) === myGlobal) {
            score += 320; // 撞回对方飞机高优先级
          }
        });
      }
      score += next;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }

  function moveLudoToken(state, tokenIdx) {
    if (!state || !state.rolled || state.winner) return false;
    var side = state.turn;
    var opp = side === 'r' ? 'b' : 'r';
    var sideName = side === 'r' ? '红方' : '蓝方';
    var d = state.dice;
    if (!canMoveLudoToken(state, side, tokenIdx, d)) return false;

    var cur = state.tokens[side][tokenIdx];
    var next = cur === 0 ? 1 : (cur + d);
    // 超过终点步数时反弹退回（经典飞行棋规则）
    if (next > LUDO_GOAL_STEP) {
      next = LUDO_GOAL_STEP - (next - LUDO_GOAL_STEP);
    }

    var jumpMsg = '';
    if ( cur > 0 && next >= 1 && next <= LUDO_TRACK_LEN - 4) {
      var gPos = ludoGlobalPos(side, next);
      if (LUDO_COLORS[gPos % 4] === side) {
        next += 4;
        jumpMsg = '，踩中同色格跳跃 +4 步';
      }
    }

    state.tokens[side][tokenIdx] = next;

    var hitMsg = '';
    if (next >= 1 && next <= LUDO_TRACK_LEN) {
      var myGlobal = ludoGlobalPos(side, next);
      for (var j = 0; j < state.tokens[opp].length; j++) {
        var oppStep = state.tokens[opp][j];
        if (oppStep >= 1 && oppStep <= LUDO_TRACK_LEN && ludoGlobalPos(opp, oppStep) === myGlobal) {
          state.tokens[opp][j] = 0;
          hitMsg = '，撞回对方' + (j + 1) + '号机！';
        }
      }
    }

    state.rolled = false;
    var goalCount = state.tokens[side].filter(function (s) { return s === LUDO_GOAL_STEP; }).length;
    if (goalCount >= 2) {
      state.winner = side;
      state.log = '🎉 ' + sideName + '两架飞机率先凯旋，赢得胜利！';
      return true;
    }

    if (cur === 0) {
      state.log = sideName + (tokenIdx + 1) + '号机起飞出库' + hitMsg;
    } else if (next === LUDO_GOAL_STEP) {
      state.log = '🏆 ' + sideName + (tokenIdx + 1) + '号机精准抵达终点大本营！';
    } else {
      state.log = sideName + (tokenIdx + 1) + '号机前进 ' + d + ' 步' + jumpMsg + hitMsg;
    }

    if (d !== 6) {
      state.turn = opp;
    } else {
      state.log += '（掷出 6 点，奖励再掷一次！）';
    }
    return true;
  }

  /* ==================== 5. 八音盒钢琴 (Piano · 启蒙儿歌 + 进阶古典名曲) ==================== */
  var PIANO_KEYS = [
    { note: 1, solfege: 'Do', label: '1', name: 'C4', freq: 261.63, color: '#c94635' },
    { note: 2, solfege: 'Re', label: '2', name: 'D4', freq: 293.66, color: '#d97a36' },
    { note: 3, solfege: 'Mi', label: '3', name: 'E4', freq: 329.63, color: '#c99f2c' },
    { note: 4, solfege: 'Fa', label: '4', name: 'F4', freq: 349.23, color: '#4d8f5d' },
    { note: 5, solfege: 'Sol', label: '5', name: 'G4', freq: 392.00, color: '#3b7db8' },
    { note: 6, solfege: 'La', label: '6', name: 'A4', freq: 440.00, color: '#5661b3' },
    { note: 7, solfege: 'Si', label: '7', name: 'B4', freq: 493.88, color: '#7e5296' },
    { note: 8, solfege: 'Do⁺', label: '1̇', name: 'C5', freq: 523.25, color: '#b4452f' }
  ];

  var PIANO_SONGS = [
    {
      id: 'star',
      title: '小星星',
      level: '入门',
      notes: [1, 1, 5, 5, 6, 6, 5, 4, 4, 3, 3, 2, 2, 1],
      lyrics: ['一', '闪', '一', '闪', '亮', '晶', '晶', '满', '天', '都', '是', '小', '星', '星']
    },
    {
      id: 'tiger',
      title: '两只老虎',
      level: '入门',
      notes: [1, 2, 3, 1, 1, 2, 3, 1, 3, 4, 5, 3, 4, 5],
      lyrics: ['两', '只', '老', '虎', '两', '只', '老', '虎', '跑', '得', '快', '跑', '得', '快']
    },
    {
      id: 'joy',
      title: '欢乐颂',
      level: '进阶',
      notes: [3, 3, 4, 5, 5, 4, 3, 2, 1, 1, 2, 3, 3, 2, 2],
      lyrics: ['快', '乐', '女', '神', '圣', '洁', '美', '丽', '灿', '烂', '光', '芒', '照', '大', '地']
    },
    {
      id: 'jasmine',
      title: '茉莉花',
      level: '进阶',
      notes: [3, 3, 5, 6, 8, 8, 6, 5, 5, 6, 5, 3, 3, 5, 6, 8, 8, 6, 5, 5, 6, 5],
      lyrics: ['好', '一', '朵', '美', '丽', '的', '茉', '莉', '花', '芬', '芳', '好', '一', '朵', '美', '丽', '的', '茉', '莉', '花', '满', '枝']
    },
    {
      id: 'canon',
      title: '卡农（经典乐段）',
      level: '高手',
      notes: [8, 7, 6, 5, 4, 3, 4, 5, 8, 7, 6, 5, 4, 3, 4, 2, 1, 3, 5, 6, 4, 6, 5, 7, 8],
      lyrics: ['高', '音', '婉', '转', '流', '淌', '回', '旋', '春', '风', '化', '雨', '润', '物', '无', '声', '低', '吟', '浅', '唱', '步', '步', '生', '花', '终']
    }
  ];

  function buildToneWavDataUri(freq, durationSec) {
    var sampleRate = 8000;
    var dur = durationSec || 0.28;
    var numSamples = Math.floor(sampleRate * dur);
    var dataSize = numSamples;
    var buffer = new Array(44 + dataSize);

    function writeStr(offset, str) {
      for (var i = 0; i < str.length; i++) buffer[offset + i] = str.charCodeAt(i);
    }
    function writeU32(offset, val) {
      buffer[offset] = val & 255;
      buffer[offset + 1] = (val >> 8) & 255;
      buffer[offset + 2] = (val >> 16) & 255;
      buffer[offset + 3] = (val >> 24) & 255;
    }
    function writeU16(offset, val) {
      buffer[offset] = val & 255;
      buffer[offset + 1] = (val >> 8) & 255;
    }

    writeStr(0, 'RIFF');
    writeU32(4, 36 + dataSize);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    writeU32(16, 16);
    writeU16(20, 1);
    writeU16(22, 1);
    writeU32(24, sampleRate);
    writeU32(28, sampleRate);
    writeU16(32, 1);
    writeU16(34, 8);
    writeStr(36, 'data');
    writeU32(40, dataSize);

    for (var s = 0; s < numSamples; s++) {
      var t = s / sampleRate;
      var env = Math.exp(-t * 6.5);
      var wave = Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t);
      var sample = Math.max(-1, Math.min(1, wave * env * 0.7));
      buffer[44 + s] = Math.floor((sample + 1) * 127.5);
    }

    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var b64 = '';
    for (var idx = 0; idx < buffer.length; idx += 3) {
      var b0 = buffer[idx];
      var b1 = idx + 1 < buffer.length ? buffer[idx + 1] : 0;
      var b2 = idx + 2 < buffer.length ? buffer[idx + 2] : 0;
      var triplet = (b0 << 16) | (b1 << 8) | b2;
      b64 += chars.charAt((triplet >> 18) & 63);
      b64 += chars.charAt((triplet >> 12) & 63);
      b64 += idx + 1 < buffer.length ? chars.charAt((triplet >> 6) & 63) : '=';
      b64 += idx + 2 < buffer.length ? chars.charAt(triplet & 63) : '=';
    }
    return 'data:audio/wav;base64,' + b64;
  }

  return {
    DIFFICULTIES: DIFFICULTIES,
    GAMES: GAMES,
    GOMOKU_SIZE: GOMOKU_SIZE,
    getGomokuStarPoints: getGomokuStarPoints,
    createGomoku: createGomoku,
    placeGomoku: placeGomoku,
    undoGomoku: undoGomoku,
    pickGomokuAiMove: pickGomokuAiMove,
    WEIQI_SIZES: WEIQI_SIZES,
    getWeiqiStarPoints: getWeiqiStarPoints,
    createWeiqi: createWeiqi,
    placeWeiqi: placeWeiqi,
    undoWeiqi: undoWeiqi,
    countWeiqiTerritory: countWeiqiTerritory,
    pickWeiqiAiMove: pickWeiqiAiMove,
    XIANGQI_LABELS: XIANGQI_LABELS,
    createXiangqi: createXiangqi,
    getValidXiangqiMoves: getValidXiangqiMoves,
    moveXiangqi: moveXiangqi,
    undoXiangqi: undoXiangqi,
    pickXiangqiAiMove: pickXiangqiAiMove,
    LUDO_RING_COORDS: LUDO_RING_COORDS,
    LUDO_COLORS: LUDO_COLORS,
    LUDO_HOME_LANES: LUDO_HOME_LANES,
    LUDO_HANGAR_SLOTS: LUDO_HANGAR_SLOTS,
    LUDO_TRACK_LEN: LUDO_TRACK_LEN,
    LUDO_GOAL_STEP: LUDO_GOAL_STEP,
    createLudo: createLudo,
    ludoGlobalPos: ludoGlobalPos,
    ludoTokenCoord: ludoTokenCoord,
    canMoveLudoToken: canMoveLudoToken,
    applyLudoDice: applyLudoDice,
    pickLudoAiToken: pickLudoAiToken,
    moveLudoToken: moveLudoToken,
    PIANO_KEYS: PIANO_KEYS,
    PIANO_SONGS: PIANO_SONGS,
    buildToneWavDataUri: buildToneWavDataUri
  };
});
