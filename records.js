// R-11 成績紀錄：整理每局結果、算統計和排行榜，以及 localStorage 讀寫。
// 不碰畫面（DOM），瀏覽器和 Node.js 都能跑；records.test.js 會直接 require 它。
// 存進 localStorage 的資料都當作「可能壞掉」：讀出來一律重新檢查，壞的那筆直接丟掉。
(function (root) {
  'use strict';
  const KEY = 'r11-records', NAME_KEY = 'r11-name', VERSION = 1;
  const MAX_GAMES = 500; // 最多保留最近幾局
  const NAME_MAX = 12; // 暱稱最多幾個字
  const TOP_N = 5; // 排行榜每個難度列幾名
  const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/; // 難度、造型、模式的 id
  const MAX_TIME = 8.64e15; // Date 能表示的最大毫秒數

  const isInt = (v) => typeof v === 'number' && Number.isInteger(v);
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const cleanId = (v) => (typeof v === 'string' && ID_RE.test(v) ? v : '');

  // ---------- 暱稱 ----------
  // 去掉控制字元、隱形字元（零寬字元、文字方向控制）、換行、私用區和還沒定義的字元，
  // 也去掉看起來是空白的填充字（例如韓文填充字、點字空白），避免「看不見的名字」。
  const BAD_CHARS = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Cs}\p{Zl}\p{Zp}ᅟᅠㅤﾠ⠀]/gu;
  const SPACES = /[\s\p{Zs}]+/gu;
  const MARK_PILE = /(\p{M}{2})\p{M}+/gu; // 疊太多層的變音符號（會往上下撐出畫面）
  const LEAD_MARKS = /^\p{M}+/u;
  function cleanName(v) {
    if (typeof v !== 'string') return '';
    let s = v.slice(0, 200);
    try { s = s.normalize('NFC'); } catch (e) { /* 舊瀏覽器沒有 normalize */ }
    s = s.replace(SPACES, ' ').replace(BAD_CHARS, '').replace(MARK_PILE, '$1').trim().replace(LEAD_MARKS, '');
    return Array.from(s).slice(0, NAME_MAX).join('').trim();
  }

  // ---------- 單局紀錄 ----------
  // 11 分制、領先 2 分才結束：10:10 以前一定是 11:x，之後一定剛好差 2 分
  function isFinalScore(p, r) {
    const hi = Math.max(p, r), lo = Math.min(p, r);
    if (hi < 11) return false;
    return lo < 10 ? hi === 11 : hi - lo === 2;
  }

  // 把任何東西整理成一筆乾淨的紀錄；不像一局打完的比賽就回傳 null
  // { at: 時間戳（毫秒）, mode: 'cpu', diff, skin: 造型 id, name: 暱稱, p: 玩家分數, r: R-11 分數, win, secs: 比賽秒數, rally: 最長來回拍數 }
  function sanitizeGame(x) {
    if (!x || typeof x !== 'object') return null;
    const { at, p, r } = x;
    if (!isNum(at) || at <= 0 || at > MAX_TIME) return null;
    if (!isInt(p) || !isInt(r) || p < 0 || r < 0 || p > 99 || r > 99 || !isFinalScore(p, r)) return null;
    const diff = cleanId(x.diff);
    if (!diff) return null;
    return {
      at: Math.round(at),
      mode: cleanId(x.mode) || 'cpu',
      diff,
      skin: cleanId(x.skin),
      name: cleanName(x.name),
      p, r, win: p > r,
      secs: isNum(x.secs) && x.secs >= 0 ? Math.min(Math.round(x.secs), 359999) : null,
      rally: isInt(x.rally) && x.rally >= 0 ? Math.min(x.rally, 9999) : null,
    };
  }
  const cleanList = (games) => (Array.isArray(games) ? games : []).map(sanitizeGame).filter(Boolean);

  // ---------- 整包資料 ----------
  const empty = () => ({ v: VERSION, games: [] });
  function parse(raw) {
    let data = null;
    if (typeof raw === 'string' && raw) {
      try { data = JSON.parse(raw); } catch (e) { data = null; }
    }
    const list = data && Array.isArray(data.games) ? data.games : Array.isArray(data) ? data : [];
    return { v: VERSION, games: cleanList(list).slice(-MAX_GAMES) };
  }
  function serialize(state) {
    return JSON.stringify({ v: VERSION, games: cleanList(state && state.games).slice(-MAX_GAMES) });
  }
  // 回傳新的資料，不改原本的
  function addGame(state, game) {
    const g = sanitizeGame(game);
    const games = cleanList(state && state.games);
    if (g) games.push(g);
    return { v: VERSION, games: games.slice(-MAX_GAMES) };
  }

  // ---------- 統計 ----------
  const margin = (g) => g.p - g.r;
  const byTime = (a, b) => a.at - b.at;
  // 排行榜：贏越多分越前面；一樣多就比誰贏得快；再一樣就先做到的排前面
  function compareWins(a, b) {
    if (margin(a) !== margin(b)) return margin(b) - margin(a);
    if ((a.secs == null) !== (b.secs == null)) return a.secs == null ? 1 : -1;
    if (a.secs !== b.secs) return a.secs - b.secs;
    return byTime(a, b);
  }
  function pick(list, better) {
    let best = null;
    for (const g of list) if (!best || better(g, best)) best = g;
    return best;
  }
  const rate = (won, played) => (played ? won / played : null);

  // diffKeys：難度由簡單到困難的順序（例如 ['easy', 'normal', 'hard']），分差一樣時難度高的算比較厲害
  function summarize(games, diffKeys) {
    const list = cleanList(games).filter((g) => g.mode === 'cpu');
    const order = Array.isArray(diffKeys) ? diffKeys : [];
    const rank = (k) => order.indexOf(k);
    let cur = 0, best = 0, won = 0;
    for (const g of list) {
      if (g.win) { won++; cur++; if (cur > best) best = cur; } else cur = 0;
    }
    const wins = list.filter((g) => g.win);
    const bestWin = pick(wins, (a, b) => margin(a) !== margin(b) ? margin(a) > margin(b)
      : rank(a.diff) !== rank(b.diff) ? rank(a.diff) > rank(b.diff) : compareWins(a, b) < 0);
    const keys = order.slice();
    for (const g of list) if (!keys.includes(g.diff)) keys.push(g.diff);
    const byDiff = {};
    for (const k of keys) {
      const mine = list.filter((g) => g.diff === k), w = mine.filter((g) => g.win);
      byDiff[k] = {
        played: mine.length, won: w.length, lost: mine.length - w.length, rate: rate(w.length, mine.length),
        top: w.slice().sort(compareWins).slice(0, TOP_N),
        longestRally: pick(mine.filter((g) => g.rally != null), (a, b) => a.rally > b.rally || (a.rally === b.rally && a.at < b.at)),
        fastestWin: pick(w.filter((g) => g.secs != null), (a, b) => a.secs < b.secs || (a.secs === b.secs && a.at < b.at)),
      };
    }
    return {
      played: list.length, won, lost: list.length - won, rate: rate(won, list.length),
      streak: { current: cur, best },
      bestWin,
      byDiff,
      recent: list.slice(-8).reverse(),
    };
  }

  // 這局打完後有沒有破紀錄（給結算畫面用）。prevGames 是這局之前的紀錄
  function achievements(prevGames, game) {
    const g = sanitizeGame(game);
    const out = { firstWin: false, bestMargin: false, longestRally: false, streak: 0, bestStreak: false };
    if (!g || g.mode !== 'cpu') return out;
    const prev = cleanList(prevGames).filter((x) => x.mode === 'cpu');
    const before = summarize(prev, [g.diff]), after = summarize(prev.concat([g]), [g.diff]);
    const was = before.byDiff[g.diff], prevWins = prev.filter((x) => x.diff === g.diff && x.win);
    if (g.win) {
      out.firstWin = prevWins.length === 0;
      out.bestMargin = prevWins.length > 0 && prevWins.every((x) => margin(g) > margin(x));
    }
    out.longestRally = g.rally != null && g.rally > 0 && !!was.longestRally && g.rally > was.longestRally.rally;
    out.streak = after.streak.current;
    out.bestStreak = out.streak >= 2 && out.streak > before.streak.best;
    return out;
  }

  // ---------- 顯示用的格式 ----------
  const p2 = (n) => String(n).padStart(2, '0');
  function formatRate(r) { return isNum(r) ? Math.round(r * 100) + '%' : '—'; }
  function formatDuration(secs) {
    if (!isNum(secs) || secs < 0) return '—';
    const s = Math.round(secs);
    return Math.floor(s / 60) + ':' + p2(s % 60);
  }
  function formatDate(at) {
    const d = new Date(at);
    return isNum(at) && !isNaN(d) ? `${d.getFullYear()}/${p2(d.getMonth() + 1)}/${p2(d.getDate())}` : '—';
  }
  function formatShort(at) {
    const d = new Date(at);
    return isNum(at) && !isNaN(d) ? `${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}` : '—';
  }

  // ---------- localStorage ----------
  // 有些瀏覽器光是讀 window.localStorage 就會丟錯
  function storageOf(w) {
    try { return w && w.localStorage ? w.localStorage : null; } catch (e) { return null; }
  }
  // storage 是 localStorage 或任何有 getItem／setItem／removeItem 的物件；null 代表不能存
  function createStore(storage) {
    const st = storage || null;
    function usable() {
      if (!st) return false;
      try { st.setItem(KEY + '-check', '1'); st.removeItem(KEY + '-check'); return true; } catch (e) { return false; }
    }
    function load() {
      if (!st) return empty();
      try { return parse(st.getItem(KEY)); } catch (e) { return empty(); }
    }
    function save(state) {
      if (!st) return false;
      try { st.setItem(KEY, serialize(state)); return true; } catch (e) { return false; }
    }
    // 記一局：每次都重新讀出來再加，兩個分頁同時開也不會蓋掉對方的紀錄
    function record(info, now) {
      const game = sanitizeGame(Object.assign({}, info, { at: isNum(now) ? now : Date.now() }));
      const prev = load();
      if (!game) return { saved: false, game: null, prev: prev.games, state: prev };
      const state = addGame(prev, game);
      return { saved: save(state), game, prev: prev.games, state };
    }
    function clear() {
      if (!st) return false;
      try { st.removeItem(KEY); return true; } catch (e) { return false; }
    }
    function getName() {
      if (!st) return '';
      try { return cleanName(st.getItem(NAME_KEY)); } catch (e) { return ''; }
    }
    function setName(v) {
      const n = cleanName(v);
      if (st) {
        try { if (n) st.setItem(NAME_KEY, n); else st.removeItem(NAME_KEY); } catch (e) { /* 存不了就算了 */ }
      }
      return n;
    }
    return { usable, load, save, record, clear, getName, setName };
  }

  const API = {
    KEY, NAME_KEY, VERSION, MAX_GAMES, NAME_MAX, TOP_N,
    cleanName, isFinalScore, sanitizeGame, parse, serialize, addGame, summarize, achievements,
    formatRate, formatDuration, formatDate, formatShort, storageOf, createStore,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.R11Records = API;
})(this);
