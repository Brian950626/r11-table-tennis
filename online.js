// R-11 連線對戰：兩支裝置之間要傳的資料怎麼打包、怎麼轉成對方的視角。不碰畫面也不碰網路，瀏覽器和 Node.js 都能跑。
//
// 做法（Issue #11 的方案 A）：
// - 建立房間的「房主」跑 engine.js（雙人模式），是唯一的真相；房主自己是 'p'，加入的人是 'r'（pad2）。
// - 加入的人只送自己球拍的目標位置和「發球」，並把房主送來的快照轉成自己的視角來畫：
//   左右、前後都翻過來（x、z 變號），'p' 和 'r' 對調，所以加入的人在畫面上也是近端的 'p'。
// - 這個檔案只處理資料；連線（PeerJS）在 index.html。
(function (root) {
  'use strict';

  const VERSION = 1; // 兩邊的版本不同就不讓連（快照格式改了要加 1）
  const ROOM_PREFIX = 'r11tt-'; // PeerJS 公開伺服器上的 ID 是大家共用的，加前綴避免撞到別人
  const PHASES = ['serveWait', 'toss', 'serve', 'rally', 'dead', 'break', 'over'];

  const other = (s) => (s === 'p' ? 'r' : s === 'r' ? 'p' : s);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d === undefined ? 0 : d);
  const side = (s) => (s === 'p' || s === 'r' ? s : null);
  const r4 = (v) => Math.round(v * 1e4) / 1e4; // 公尺到 0.1 毫米就夠了，快照比較小

  // 房號：4 位數字。PeerJS 的 ID 是 r11tt- 加房號
  function newCode(rng) { return String(1000 + Math.floor((rng || Math.random)() * 9000)); }
  function validCode(code) { return /^\d{4}$/.test(String(code || '').trim()); }
  function roomId(code) { return ROOM_PREFIX + String(code).trim(); }

  // ---------- 房主 → 加入者：快照 ----------
  // g 是房主的遊戲（engine.js 雙人模式），events 是這一幀的事件，paused：房主那邊是不是暫停中
  function snapshot(g, events, paused) {
    const b = g.ball, m = g.match;
    const s = {
      v: VERSION, t: 's',
      ph: g.phase, sv: g.server, ht: g.hitter, fs: g.first, rb: !!g.recvBounced, nt: !!g.netTouched, rh: g.rallyHits | 0,
      sc: [g.score.p, g.score.r],
      b: [r4(b.x), r4(b.y), r4(b.z), r4(b.vx), r4(b.vy), r4(b.vz), r4(b.spinTop || 0), r4(b.spinSide || 0)],
      p1: [r4(g.pad.x), r4(g.pad.y), r4(g.pad.z), r4(g.pad.swing)],
      p2: [r4(g.pad2.x), r4(g.pad2.y), r4(g.pad2.z), r4(g.pad2.swing)],
      aim: [r4(g.aim.x), r4(g.aim.z)],
      hi: g.hint ? [r4(g.hint.x), r4(g.hint.z)] : null,
      sw: g.sweet ? [r4(g.sweet.x), r4(g.sweet.y), r4(g.sweet.z)] : null,
      m: { bo: m.bestOf, g: [m.games.p, m.games.r], n: m.gameNo, h: m.history.map((x) => [x.p, x.r]) },
      st: { lo: g.longest, th: [g.totalHits.p, g.totalHits.r], pf: [g.perfects.p, g.perfects.r] },
      ps: !!paused,
    };
    if (events && events.length) s.ev = events.map(cleanEvent).filter(Boolean);
    return s;
  }

  // 事件只留認得的種類和欄位（資料是從另一台裝置來的，不能直接相信）
  const EVENT_FIELDS = {
    hit: ['who', 'type', 'x', 'speed', 'spinTop', 'spinSide', 'edge', 'timing', 'perfect'],
    bounce: ['x', 'z', 'speed'], net: [], netcord: ['live'], floor: ['speed'], toss: ['who'], let: [],
    point: ['winner', 'reason', 'hitter', 'rally', 'shot', 'over', 'gameOver', 'games', 'gameNo'],
    serveReady: ['server', 'deuce', 'gamePoint', 'initial'],
    gameEnd: ['winner', 'gameNo', 'games', 'last'],
    gameover: ['winner'],
  };
  const SIDE_FIELDS = ['who', 'winner', 'hitter', 'server', 'gamePoint'];
  const PAIR_FIELDS = ['games', 'last'];
  const TEXT_FIELDS = ['type', 'reason', 'shot', 'timing'];
  function cleanEvent(e) {
    if (!e || typeof e !== 'object' || !Object.prototype.hasOwnProperty.call(EVENT_FIELDS, e.kind)) return null;
    const out = { kind: e.kind };
    for (const k of EVENT_FIELDS[e.kind]) {
      const v = e[k];
      if (v === undefined || v === null) continue;
      if (SIDE_FIELDS.includes(k)) { if (side(v)) out[k] = v; }
      else if (PAIR_FIELDS.includes(k)) { if (v && typeof v === 'object') out[k] = { p: num(v.p) | 0, r: num(v.r) | 0 }; }
      else if (TEXT_FIELDS.includes(k)) { if (typeof v === 'string' && /^[a-zA-Z]{1,16}$/.test(v)) out[k] = v; }
      else if (typeof v === 'boolean') out[k] = v;
      else if (typeof v === 'number' && isFinite(v)) out[k] = v;
    }
    return out;
  }
  // 事件換成另一邊的視角：'p'、'r' 對調，左右前後翻過來
  function mirrorEvent(e) {
    const out = {};
    for (const k of Object.keys(e)) {
      const v = e[k];
      if (SIDE_FIELDS.includes(k)) out[k] = other(v);
      else if (PAIR_FIELDS.includes(k)) out[k] = { p: v.r, r: v.p };
      else if (k === 'x' || k === 'z' || k === 'spinSide') out[k] = -v;
      else out[k] = v;
    }
    return out;
  }

  // ---------- 加入者：把快照套到自己的畫面用的 game ----------
  // view 是 createGame(…, { mode: 'pvp' }) 建出來、只用來畫的遊戲物件（不呼叫 update）。
  // 自己的球拍 view.pad 的 x、z 由自己的手指決定（不等網路），所以這裡只更新高度和揮拍。
  // 回傳轉好視角、清理過的事件；快照格式不對時回傳 null，什麼都不改。
  function applySnapshot(view, s) {
    if (!s || s.t !== 's' || s.v !== VERSION || !Array.isArray(s.b) || s.b.length !== 8) return null;
    const ph = PHASES.includes(s.ph) ? s.ph : view.phase;
    view.phase = ph;
    view.server = other(side(s.sv) || other(view.server));
    view.hitter = other(side(s.ht) || other(view.hitter));
    view.first = other(side(s.fs) || other(view.first));
    view.recvBounced = !!s.rb; view.netTouched = !!s.nt; view.rallyHits = num(s.rh) | 0;
    if (Array.isArray(s.sc)) { view.score.p = num(s.sc[1]) | 0; view.score.r = num(s.sc[0]) | 0; }
    const b = view.ball, q = s.b.map((v) => num(v));
    b.x = -q[0]; b.y = q[1]; b.z = -q[2]; b.vx = -q[3]; b.vy = q[4]; b.vz = -q[5];
    b.spinTop = Math.max(-1, Math.min(1, q[6])); b.spinSide = Math.max(-1, Math.min(1, -q[7]));
    // 房主的球拍是我的對手：畫在遠端（view.pad2），也拿來當對手角色的位置（view.robot）
    if (Array.isArray(s.p1)) {
      const o = view.pad2;
      o.x = -num(s.p1[0]); o.y = num(s.p1[1], 0.2); o.z = -num(s.p1[2], 1.62); o.swing = num(s.p1[3]);
      const r = view.robot; r.x = o.x; r.y = o.y; r.z = o.z; r.swing = o.swing;
    }
    if (Array.isArray(s.p2)) { view.pad.y = num(s.p2[1], 0.2); view.pad.swing = Math.max(view.pad.swing || 0, num(s.p2[3])); }
    if (Array.isArray(s.aim)) { view.aim.x = -num(s.aim[0]); view.aim.z = -num(s.aim[1]); }
    view.hint = Array.isArray(s.hi) ? { x: -num(s.hi[0]), z: -num(s.hi[1]) } : null;
    view.sweet = Array.isArray(s.sw) ? { x: -num(s.sw[0]), y: num(s.sw[1]), z: -num(s.sw[2]) } : null;
    if (s.m && typeof s.m === 'object') {
      const m = view.match;
      if ([1, 3, 5].includes(s.m.bo)) m.bestOf = s.m.bo;
      if (Array.isArray(s.m.g)) { m.games.p = num(s.m.g[1]) | 0; m.games.r = num(s.m.g[0]) | 0; }
      m.gameNo = Math.max(1, num(s.m.n, 1) | 0);
      if (Array.isArray(s.m.h)) m.history = s.m.h.slice(0, 5).map((x) => ({ p: num(x && x[1]) | 0, r: num(x && x[0]) | 0 }));
    }
    if (s.st && typeof s.st === 'object') {
      view.longest = num(s.st.lo) | 0;
      if (Array.isArray(s.st.th)) { view.totalHits.p = num(s.st.th[1]) | 0; view.totalHits.r = num(s.st.th[0]) | 0; }
      if (Array.isArray(s.st.pf)) { view.perfects.p = num(s.st.pf[1]) | 0; view.perfects.r = num(s.st.pf[0]) | 0; }
    }
    if (ph === 'over') view.winner = view.match.bestOf > 1 ? (view.match.games.p > view.match.games.r ? 'p' : 'r') : view.score.p > view.score.r ? 'p' : 'r';
    return Array.isArray(s.ev) ? s.ev.slice(0, 40).map(cleanEvent).filter(Boolean).map(mirrorEvent) : [];
  }

  // ---------- 加入者 → 房主：球拍的目標位置 ----------
  // 加入者在自己的視角是近端（z > 0）；送給房主時翻成遠端的 pad2 座標
  function inputMsg(tx, tz) { return { t: 'i', x: r4(-tx), z: r4(-tz) }; }
  // 房主收到後只接受合理範圍內的數字
  function readInput(msg, PAD) {
    if (!msg || msg.t !== 'i') return null;
    const x = num(msg.x, NaN), z = num(msg.z, NaN);
    if (!isFinite(x) || !isFinite(z)) return null;
    return { tx: Math.max(PAD.xMin, Math.min(PAD.xMax, x)), tz: Math.max(-PAD.zMax, Math.min(-PAD.zMin, z)) };
  }

  // 加入者在兩張快照之間自己往前推球，畫面才不會一頓一頓（下一張快照來了就以房主為準）
  const FLYING = ['toss', 'serve', 'rally', 'dead'];
  function extrapolate(E, view, dt) {
    if (!FLYING.includes(view.phase) || dt <= 0) return;
    E.stepBall(view.ball, Math.min(dt, 0.12) * view.diff.ts, []);
  }

  const API = { VERSION, ROOM_PREFIX, newCode, validCode, roomId, snapshot, cleanEvent, mirrorEvent, applySnapshot, inputMsg, readInput, extrapolate, other };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.R11Online = API;
})(this);
