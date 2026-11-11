// R-11 桌球引擎：球的物理、比賽規則、機器人 AI。不碰畫面，瀏覽器和 Node.js 都能跑。
// 座標單位是公尺：y 朝上（桌面 = 0），z 朝玩家為正，x 朝玩家右手邊為正。
(function (root) {
  'use strict';
  const G = 9.81, R = 0.02;
  const HX = 0.7625, HZ = 1.37, NET_H = 0.1525, NET_X = HX + 0.1525, FLOOR = -0.76;
  // e：落台後往上彈的比例；kh：沒有旋轉的球落台後往前的速度剩多少
  const SPIN = { none: { e: 0.89, kh: 0.97 }, top: { e: 0.8 }, back: { e: 0.7 } };
  // 旋轉的強度：spinTop +1 是最強上旋、-1 是最強下旋；spinSide +1 往 +x 彎、-1 往 -x 彎。
  // 落台往上彈的比例在 SPIN.none 和 SPIN.top／SPIN.back 之間依強度內插。
  const SPINFX = {
    magTop: 3.2, magBack: 2.4, magSide: 3.2, // 飛行中的額外加速度（m/s²）：上旋往下壓、下旋往上托、側旋往旁邊彎
    kickSide: 0.7, // 側旋落台後往旁邊多拐的速度（m/s）
    // 落台時球底和桌面的摩擦：上旋的球底往後轉，桌面把球往前推（加速）；下旋的球底往前轉，桌面把球往後拖（減速）。
    // 跟真的球一樣，推或拖的速度 = 摩擦係數 × 旋轉強度 × (1 + e) × 落台時往下的速度，所以球砸得越重，效果越明顯。
    fricTop: 0.26, fricBack: 0.4,
    minKeep: 0.2, // 下旋再強，落台後往前的速度至少剩這個比例（球不會倒著跑回去）
    contactSide: 0.9, // 打在球的側面（球偏離拍子中心）時最多帶出多少側旋
    blockIn: 6, blockPad: 0.3, // 擋球：來球比 blockIn 快（m/s），而且拍子幾乎沒動（比 blockPad 慢）
    sweetLead: 0.09, // 最佳擊球點在最高點之前幾秒（遊戲時間）：球快到最高點、還在上升的時候
    perfectFast: 0.95, // 完美時機的回球飛行時間乘這個倍數（球比較快）
    perfectErr: 0.12, // R-11 接完美時機的球，多出的失誤（乘 rErrK）
    keepTop: 0.5, keepSide: 0.7, // 落台後剩下的旋轉比例
    recvY: 0.6, recvX: 0.45, recvSig: 0.03, // 接球時沒化解掉的來球旋轉讓回球偏掉多少
    smashTop: 1, // 扣殺帶的上旋
    loopBack: 0.12, // 擊球前從拍子拉到最後面的位置往前揮超過這個距離（公尺），就算引拍拉球
    edgeW: 0.045, // 擊球範圍外面再一圈（公尺）也算打到，但是打在拍子邊緣（擦邊）
  };
  const PAD_HIST = 0.4; // 記住拍子最近幾秒的路徑，用來判斷引拍
  const SUB = 1 / 500;
  const PAD = { xMin: -1.05, xMax: 1.05, zMin: 0.9, zMax: 2.05, restZ: 1.62 };
  const ROB = { zRest: -1.62, zDeep: -1.85, xMax: 1.0 };

  // perfect：完美時機的寬度（球離最高點前後幾秒內打到都算，遊戲時間）；sweet：要不要在畫面上標出最佳擊球點
  // spin：R-11 一般回球帶旋轉的機率；spinMax：它打出的最強旋轉；rSpinErr：接到旋轉球時多出的失誤率
  const DIFFS = {
    easy: { key: 'easy', name: '簡單', ts: 0.47, pReach: 0.2, rReach: 0.15, rSpeed: 1.45, rZ: 0.8, rReact: 0.24, rNoise: 0.07, rErr: 0.12, rErrK: 0.26, rTf: [0.56, 0.64], spread: 0.3, corner: 0, smash: 0.03, drop: 0, rZmin: -1.0, spin: 0.08, spinMax: 0.5, rSpinErr: 0.3, hint: true, perfect: 0.075, sweet: true },
    normal: { key: 'normal', name: '普通', ts: 0.55, pReach: 0.17, rReach: 0.16, rSpeed: 2.0, rZ: 0.75, rReact: 0.16, rNoise: 0.035, rErr: 0.06, rErrK: 0.2, rTf: [0.46, 0.54], spread: 0.45, corner: 0.4, smash: 0.25, drop: 0.06, rZmin: -0.95, spin: 0.3, spinMax: 0.75, rSpinErr: 0.2, hint: false, perfect: 0.05, sweet: true },
    hard: { key: 'hard', name: '困難', ts: 0.63, pReach: 0.155, rReach: 0.17, rSpeed: 2.7, rZ: 0.7, rReact: 0.1, rNoise: 0.015, rErr: 0.03, rErrK: 0.14, rTf: [0.38, 0.46], spread: 0.6, corner: 0.8, smash: 0.55, drop: 0.12, rZmin: -0.9, spin: 0.55, spinMax: 1.0, rSpinErr: 0.12, hint: false, perfect: 0.035, sweet: false },
  };

  // 打法個性：每個造型一種（skins.js 的 style），疊在難度上，只改 R-11 回球和發球的選擇。
  //   smash／drop／corner：扣殺、放短、打大角度的機率，先乘 xxxK 再加 xxxAdd（簡單難度只加一半）
  //   spread：打中路時左右範圍的倍數　tempo：回球飛行時間的倍數（小於 1 球比較快）　err：失誤率的倍數
  //   dropZ：玩家站得比這裡遠（公尺）才會放短，預設 1.6
  const STYLES = {
    allround: { key: 'allround', name: '均衡' },
    smash: { key: 'smash', name: '愛扣殺', smashK: 1.5, smashAdd: 0.3, tempo: 0.95, err: 1.15 },
    drop: { key: 'drop', name: '愛放短', dropK: 1.5, dropAdd: 0.22, dropZ: 1.35, smashK: 0.6, spread: 0.85 },
    angle: { key: 'angle', name: '愛打大角度', cornerK: 1.2, cornerAdd: 0.4, spread: 1.3, err: 1.1 },
    steady: { key: 'steady', name: '穩定不失誤', err: 0.55, smashK: 0.4, cornerK: 0.5, spread: 0.8, tempo: 1.05 },
    speed: { key: 'speed', name: '快攻', tempo: 0.86, err: 1.2, smashK: 1.1, spread: 1.1 },
    trick: { key: 'trick', name: '變化多端', dropK: 1.3, dropAdd: 0.12, dropZ: 1.45, cornerK: 1.1, cornerAdd: 0.2, smashK: 0.8, spread: 1.2, err: 1.05 },
    lob: { key: 'lob', name: '高吊守備', tempo: 1.1, err: 0.5, smashK: 0.15, dropK: 0.5, spread: 1.3 },
  };
  let defaultStyle = 'allround';
  // 難度參數疊上打法個性，回傳新的一份（不改 DIFFS）
  function styled(d, s) {
    const w = d.key === 'easy' ? 0.5 : 1;
    const mix = (k, max) => clamp(d[k] * (s[k + 'K'] || 1) + (s[k + 'Add'] || 0) * w, 0, max);
    return Object.assign({}, d, {
      smash: mix('smash', 0.9), drop: mix('drop', 0.6), corner: mix('corner', 0.95),
      spread: clamp(d.spread * (s.spread || 1), 0.15, 0.66), rTf: d.rTf.map((t) => t * (s.tempo || 1)),
      rErr: d.rErr * (s.err || 1), rErrK: d.rErrK * (s.err || 1), dropZ: s.dropZ || 1.6, style: s.key,
    });
  }
  // g.style 是這局的打法，g.diff 變成「難度疊上打法」的參數（key、name 還是難度的）
  function applyStyle(g, key) {
    g.style = STYLES[key] || STYLES.allround;
    g.diff = styled(DIFFS[g.diff.key] || DIFFS.normal, g.style);
  }
  // 換造型時呼叫：之後 createGame 沒指定 opts.style 就用這個打法；有給 g 就連這局一起換
  function setStyle(key, g) {
    defaultStyle = STYLES[key] ? key : 'allround';
    if (g) applyStyle(g, defaultStyle);
  }

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  let rng = Math.random;
  const rand = (a, b) => a + (b - a) * rng();
  function gauss() { let u = 0; while (!u) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); }

  // ---------- spin ----------
  // 'none'／'top'／'back' 這些舊的旋轉名稱換成強度
  function toSpin(s) {
    if (s && typeof s === 'object') return { top: s.top || 0, side: s.side || 0 };
    return { top: s === 'top' ? 1 : s === 'back' ? -1 : 0, side: 0 };
  }
  function spinLabel(top, side) {
    if (Math.abs(side) >= 0.3 && Math.abs(side) >= Math.abs(top)) return 'side';
    return top >= 0.2 ? 'top' : top <= -0.2 ? 'back' : 'none';
  }
  function setSpin(b, top, side) {
    b.spinTop = clamp(top, -1, 1); b.spinSide = clamp(side, -1, 1); b.spin = spinLabel(b.spinTop, b.spinSide);
  }
  // 旋轉造成的加速度：gy 是往下的總加速度（上旋比重力大、下旋比重力小），ax 是側旋的橫向加速度
  function spinAccel(top, side) {
    return { gy: G + (top >= 0 ? SPINFX.magTop : SPINFX.magBack) * top, ax: SPINFX.magSide * side };
  }
  // 接球時，來球旋轉沒被自己的旋轉抵消的部分會讓回球偏掉：下旋往下（掛網）、上旋往上（出界）、側旋往旁邊
  function receiveKick(inc, own) {
    const t = inc.top < 0 ? Math.min(0, inc.top + Math.max(0, own.top)) : Math.max(0, inc.top + Math.min(0, own.top));
    const s = inc.side < 0 ? Math.min(0, inc.side + Math.max(0, own.side)) : Math.max(0, inc.side + Math.min(0, own.side));
    return { vx: SPINFX.recvX * s, vy: SPINFX.recvY * t };
  }

  // ---------- ball physics: exact constant-acceleration kinematics, event-driven collisions ----------
  function stepBall(b, dt, ev) {
    if (typeof b.spinTop !== 'number' || typeof b.spinSide !== 'number') { const w = toSpin(b.spin); setSpin(b, w.top, w.side); }
    let rem = dt;
    for (let guard = 0; rem > 1e-10 && guard < 6; guard++) {
      const h = rem, A = spinAccel(b.spinTop, b.spinSide), gy = A.gy, ax = A.ax;
      let tNet = Infinity, tTab = Infinity, tFlo = Infinity;
      const nz = b.z + b.vz * h;
      if (b.z !== 0 && (b.z > 0) !== (nz > 0)) {
        const tc = (b.z / (b.z - nz)) * h;
        const yc = b.y + b.vy * tc - 0.5 * gy * tc * tc, xc = b.x + b.vx * tc + 0.5 * ax * tc * tc;
        if (Math.abs(xc) <= NET_X && yc < NET_H + R && yc > 0) tNet = tc;
      }
      const ny = b.y + b.vy * h - 0.5 * gy * h * h;
      if (b.y >= R - 1e-9 && ny < R) {
        const t = (b.vy + Math.sqrt(Math.max(0, b.vy * b.vy + 2 * gy * (b.y - R)))) / gy;
        if (t <= h) {
          const xi = b.x + b.vx * t + 0.5 * ax * t * t, zi = b.z + b.vz * t;
          if (Math.abs(xi) <= HX && Math.abs(zi) <= HZ) tTab = t;
        }
      }
      const fy = FLOOR + R;
      if (b.y >= fy && ny < fy) {
        const t = (b.vy + Math.sqrt(Math.max(0, b.vy * b.vy + 2 * gy * (b.y - fy)))) / gy;
        if (t <= h) tFlo = t;
      }
      const tE = Math.min(tNet, tTab, tFlo);
      const ta = tE === Infinity ? h : Math.max(0, tE);
      b.x += b.vx * ta + 0.5 * ax * ta * ta; b.vx += ax * ta;
      b.z += b.vz * ta; b.y += b.vy * ta - 0.5 * gy * ta * ta; b.vy -= gy * ta;
      rem -= ta;
      if (tE === Infinity) break;
      if (tE === tNet) {
        const s = b.vz < 0 ? 1 : -1; // side the ball came from
        setSpin(b, b.spinTop * 0.3, b.spinSide * 0.3);
        if (b.y < NET_H + R * 0.25) {
          b.z = s * (R + 0.003); b.vz = -b.vz * 0.12; b.vx *= 0.3; b.vy = Math.min(b.vy, 0) * 0.3 - 0.2;
          ev.push({ type: 'net' });
        } else {
          b.z = -s * 0.003; b.vz *= 0.45; b.vx *= 0.6; b.vy = Math.abs(b.vy) * 0.25 + 0.5;
          ev.push({ type: 'netcord' });
        }
      } else if (tE === tTab) {
        const t = b.spinTop, s = b.spinSide, P = t >= 0 ? SPIN.top : SPIN.back, k = Math.abs(t);
        const e = SPIN.none.e + (P.e - SPIN.none.e) * k;
        const vh = Math.hypot(b.vx, b.vz), dv = t * (t >= 0 ? SPINFX.fricTop : SPINFX.fricBack) * (1 + e) * Math.abs(b.vy);
        const kh = vh > 1e-6 ? Math.max(vh * SPIN.none.kh + dv, vh * SPINFX.minKeep) / vh : SPIN.none.kh;
        b.y = R; b.vy = -b.vy * e; b.vx = b.vx * kh + SPINFX.kickSide * s; b.vz *= kh;
        setSpin(b, t * SPINFX.keepTop, s * SPINFX.keepSide);
        ev.push({ type: 'bounce', side: b.z > 0 ? 'p' : 'r', x: b.x, z: b.z, speed: Math.hypot(b.vx, b.vz) });
      } else {
        setSpin(b, 0, 0);
        b.y = fy; b.vy = -b.vy * 0.55; b.vx *= 0.7; b.vz *= 0.7;
        if (Math.abs(b.vy) < 0.25) { b.vy = 0; b.vx *= 0.9; b.vz *= 0.9; }
        ev.push({ type: 'floor', speed: Math.abs(b.vy) });
      }
    }
    if (Math.abs(b.z) > 4.5 || Math.abs(b.x) > 3.5) { b.vx = b.vz = 0; ev.push({ type: 'far' }); }
  }

  // velocity that lands the ball on (xt, R, zt) after Tf seconds; w = { top, side } is the spin it will carry (optional)
  function aimVelocity(b, xt, zt, Tf, w) {
    const A = spinAccel(w ? w.top || 0 : 0, w ? w.side || 0 : 0);
    return { vx: (xt - b.x - 0.5 * A.ax * Tf * Tf) / Tf, vy: (R - b.y + 0.5 * A.gy * Tf * Tf) / Tf, vz: (zt - b.z) / Tf };
  }
  // height margin over the net tape (m); positive = clears
  function netMargin(b, v, w) {
    if (v.vz === 0 || (b.z > 0) === (v.vz > 0)) return 1;
    const tn = -b.z / v.vz, gy = spinAccel(w ? w.top || 0 : 0, 0).gy;
    return b.y + v.vy * tn - 0.5 * gy * tn * tn - (NET_H + R);
  }

  // legal serve: first bounce on the server's half (B1), then on the receiver's half at (x2, z2)
  function servePlan(x0, z0, x2, z2, margin) {
    const s = Math.sign(z0), mg = margin === undefined ? 0.035 : margin;
    let best = null;
    for (const fz of [0.55, 0.47, 0.63, 0.4, 0.7, 0.33, 0.78]) {
      const z1 = s * fz * HZ;
      const f1 = (z1 - z0) / (z2 - z0), x1 = x0 + f1 * (x2 - x0);
      const d1 = Math.hypot(x1 - x0, z1 - z0), d2 = Math.hypot(x2 - x1, z2 - z1);
      const fn = (0 - z1) / (z2 - z1);
      const h = margin === undefined ? Math.max(0.17, (NET_H + mg) / (4 * fn * (1 - fn))) : (NET_H + mg) / (4 * fn * (1 - fn));
      const vyb = Math.sqrt(2 * G * h), t2 = (2 * vyb) / G, vh = d2 / t2;
      const vhb = vh / SPIN.none.kh, vyImp = -vyb / SPIN.none.e, t1 = d1 / vhb;
      const y0 = R - vyImp * t1 - 0.5 * G * t1 * t1, vy0 = vyImp + G * t1;
      const L = Math.hypot(x2 - x0, z2 - z0);
      const plan = { y0, v: { vx: ((x2 - x0) / L) * vhb, vy: vy0, vz: ((z2 - z0) / L) * vhb }, x2, z2, b1: { x: x1, z: z1 } };
      const score = Math.abs(y0 - 0.26);
      if (y0 >= 0.08 && y0 <= 0.55 && (!best || score < best.score)) { plan.score = score; best = plan; }
    }
    return best;
  }

  // ---------- game ----------
  // opts.mode：'cpu'（預設，對戰 R-11）或 'pvp'（雙人對戰：'r' 那一邊改由玩家 2 用 pad2 操控）
  const BEST_OF = [1, 3, 5];
  const BREAK_SECS = 3.2; // 一局打完、下一局開始前的休息時間（秒）
  const gamesToWin = (g) => Math.floor(g.match.bestOf / 2) + 1;

  function createGame(diffKey, opts) {
    opts = opts || {};
    if (opts.rng) rng = opts.rng;
    const g = {
      mode: opts.mode === 'pvp' ? 'pvp' : 'cpu',
      diff: DIFFS[diffKey] || DIFFS.normal,
      score: { p: 0, r: 0 }, first: opts.first || 'p', server: 'p',
      phase: 'serveWait', timer: 0, hitter: 'p',
      serveOwn: false, recvBounced: false, netTouched: false, netHit: false,
      ball: { x: 0, y: 0.12, z: PAD.restZ, vx: 0, vy: 0, vz: 0, spin: 'none', spinTop: 0, spinSide: 0 },
      pad: { x: 0, y: 0.2, z: PAD.restZ, vx: 0, vz: 0, tx: 0, tz: PAD.restZ, lock: false, swing: 0 },
      robot: { x: 0, y: 0.2, z: ROB.zRest, plan: null, react: 0, noise: 0, lock: false, swing: 0, mood: 'idle', moodT: 0, tossHand: 0 },
      // 雙人模式玩家 2 的球拍：世界座標，在遠端（z < 0），可動範圍是 PAD 前後翻過來
      pad2: { x: 0, y: 0.2, z: -PAD.restZ, vx: 0, vz: 0, tx: 0, tz: -PAD.restZ, lock: false, swing: 0 },
      rallyHits: 0, longest: 0, smashWins: 0, totalHits: { p: 0, r: 0 }, perfects: { p: 0, r: 0 }, lastPerfect: false,
      aim: { x: 0, z: -0.8 }, serveData: null, lastShot: { p: 'drive', r: 'drive' },
      hint: null, winner: null, events: [], time: 0,
      // 整場比賽：bestOf 是幾戰幾勝（1、3、5），games 是各贏幾局，history 是打完的每局比分
      match: { bestOf: BEST_OF.includes(opts.bestOf) ? opts.bestOf : 1, games: { p: 0, r: 0 }, gameNo: 1, history: [] },
    };
    applyStyle(g, opts.style || defaultStyle);
    resetForServe(g, true);
    return g;
  }

  function otherSide(s) { return s === 'p' ? 'r' : 'p'; }
  // 某一邊的玩家球拍：'p' 是玩家（玩家 1），'r' 只有雙人模式才有（玩家 2）
  function padOf(g, s) { return s === 'r' ? g.pad2 : g.pad; }
  const human = (g, s) => s === 'p' || g.mode === 'pvp';

  function resetForServe(g, initial) {
    const sp = g.score.p, sr = g.score.r, n = sp + sr, other = otherSide(g.first);
    g.server = sp >= 10 && sr >= 10 ? (n % 2 === 0 ? g.first : other) : Math.floor(n / 2) % 2 === 0 ? g.first : other;
    g.phase = 'serveWait'; g.timer = human(g, g.server) ? 0 : 1.1;
    g.hitter = g.server; g.serveOwn = false; g.recvBounced = false; g.netTouched = false; g.netHit = false;
    g.rallyHits = 0; g.pad.lock = false; g.robot.lock = false; g.robot.plan = null; g.hint = null; g.sweet = null; g.serveData = null;
    g.pad2.lock = false;
    const b = g.ball; b.vx = b.vy = b.vz = 0; setSpin(b, 0, 0);
    holdBall(g);
    const gp = sp >= 10 && sp > sr ? 'p' : sr >= 10 && sr > sp ? 'r' : null;
    g.events.push({ kind: 'serveReady', server: g.server, deuce: sp >= 10 && sp === sr, gamePoint: gp, initial: !!initial });
  }

  // 發球的路線是直線，球從桌子寬度外面拋，第一跳就會落在桌外，所以拋球位置限制在桌子寬度內
  const SERVE_X = HX - 0.06;
  function holdBall(g) {
    const b = g.ball;
    if (g.server === 'p') { b.x = clamp(g.pad.x - 0.13, -SERVE_X, SERVE_X); b.z = Math.max(g.pad.z, 1.45) - 0.02; b.y = 0.12; }
    else if (g.mode === 'pvp') { b.x = clamp(g.pad2.x + 0.13, -SERVE_X, SERVE_X); b.z = Math.min(g.pad2.z, -1.45) + 0.02; b.y = 0.12; }
    else { b.x = clamp(g.robot.x + 0.13, -SERVE_X, SERVE_X); b.z = Math.min(g.robot.z, -1.45) + 0.02; b.y = 0.12; }
  }

  // 發球瞄準點跟著發球那一方的球拍走（雙人模式玩家 2 發球時前後翻過來）
  function updateAim(g) {
    const s = g.server === 'r' ? -1 : 1, p = padOf(g, g.server);
    const zn = clamp((s * p.z - 1.4) / (PAD.zMax - 1.4), 0, 1);
    g.aim.x = clamp(p.x * 0.85, -0.62, 0.62);
    g.aim.z = -s * (0.42 + 0.78 * zn);
  }

  // who：'p'（玩家、玩家 1）或 'r'（雙人模式的玩家 2）；不是他發球就不理
  function serve(g, who) {
    who = who || 'p';
    if (g.phase === 'serveWait' && g.server === who && human(g, who)) startToss(g);
  }

  function startToss(g) {
    const S = g.server, b = g.ball;
    let x2, z2;
    if (human(g, S)) { updateAim(g); x2 = g.aim.x; z2 = g.aim.z; padOf(g, S).lock = true; }
    else {
      const d = g.diff, r = rng();
      x2 = d.corner > 0 && rng() < d.corner ? Math.sign(rng() - 0.5) * rand(0.35, 0.6) : rand(-d.spread, d.spread);
      z2 = r < 0.3 ? rand(0.42, 0.6) : rand(0.8, 1.15);
      g.robot.lock = true;
    }
    let plan = servePlan(b.x, b.z, x2, z2, rng() < 0.035 ? -0.007 : undefined);
    if (!plan) plan = servePlan(b.x, b.z, 0, S === 'p' ? -0.8 : 0.8);
    g.serveData = plan;
    b.vx = b.vz = 0; setSpin(b, 0, 0);
    b.vy = Math.sqrt(2 * G * (Math.max(plan.y0 + 0.16, 0.4) - b.y));
    g.phase = 'toss';
    g.events.push({ kind: 'toss', who: S });
  }

  function strikeServe(g) {
    const b = g.ball, plan = g.serveData, S = g.server;
    b.y = plan.y0; b.vx = plan.v.vx; b.vy = plan.v.vy; b.vz = plan.v.vz; setSpin(b, 0, 0);
    g.phase = 'serve'; g.hitter = S; g.serveOwn = false; g.recvBounced = false; g.netTouched = false; g.netHit = false;
    g.rallyHits = 1; g.totalHits[S]++;
    g.lastShot[S] = 'serve';
    if (g.mode === 'pvp') { const p = padOf(g, S); p.swing = 1; p.lock = false; g.hint = predictBounce(g, otherSide(S)); g.sweet = predictSweet(g, otherSide(S)); }
    else if (S === 'p') { g.pad.swing = 1; g.pad.lock = false; planRobot(g); }
    else { g.robot.swing = 1; g.robot.lock = false; g.hint = predictBounce(g, 'p'); g.sweet = predictSweet(g, 'p'); }
    g.events.push({ kind: 'hit', who: S, type: 'serve', x: b.x });
  }

  function point(g, winner, reason) {
    if (g.phase === 'dead' || g.phase === 'over') return;
    g.score[winner]++;
    g.longest = Math.max(g.longest, g.rallyHits);
    if (winner === 'p' && g.hitter === 'p' && g.lastShot.p === 'smash') g.smashWins++;
    g.phase = 'dead'; g.timer = 1.55; g.robot.plan = null; g.hint = null; g.sweet = null;
    g.robot.mood = winner === 'r' ? 'happy' : 'sad'; g.robot.moodT = 1.9;
    const sp = g.score.p, sr = g.score.r;
    // gameOver：這一局打完；over：整場比賽打完（一局制時兩個一樣）
    const gameOver = (sp >= 11 || sr >= 11) && Math.abs(sp - sr) >= 2;
    let over = false;
    if (gameOver) {
      const m = g.match;
      m.games[winner]++; m.history.push({ p: sp, r: sr });
      over = m.games[winner] >= gamesToWin(g);
      if (over) g.winner = winner; else g.gameWinner = winner;
    }
    g.events.push({ kind: 'point', winner, reason, hitter: g.hitter, rally: g.rallyHits, shot: g.lastShot[g.hitter], over, gameOver, games: { p: g.match.games.p, r: g.match.games.r }, gameNo: g.match.gameNo });
  }

  // 下一局：比分歸零；上一局先接發球的人這局先發球（正式規則）
  function nextGame(g) {
    g.match.gameNo++; g.gameWinner = null;
    g.score.p = 0; g.score.r = 0;
    g.first = otherSide(g.first);
    resetForServe(g, true);
  }

  function letServe(g) {
    if (g.phase === 'dead') return;
    g.phase = 'dead'; g.timer = 1.3; g.robot.plan = null; g.hint = null; g.sweet = null; g.isLet = true;
    g.events.push({ kind: 'let' });
  }

  function afterPoint(g) {
    g.isLet = false;
    if (g.winner) { g.phase = 'over'; g.events.push({ kind: 'gameover', winner: g.winner }); return; }
    if (g.gameWinner) {
      const m = g.match;
      g.phase = 'break'; g.timer = BREAK_SECS;
      g.events.push({ kind: 'gameEnd', winner: g.gameWinner, gameNo: m.gameNo, games: { p: m.games.p, r: m.games.r }, last: m.history[m.history.length - 1] });
      return;
    }
    resetForServe(g);
  }

  function handleBallEvent(g, e) {
    if (e.type === 'bounce') g.events.push({ kind: 'bounce', x: e.x, z: e.z, speed: e.speed });
    else if (e.type === 'net') g.events.push({ kind: 'net' });
    else if (e.type === 'netcord') g.events.push({ kind: 'netcord', live: g.phase === 'rally' });
    else if (e.type === 'floor' && e.speed > 0.3) g.events.push({ kind: 'floor', speed: e.speed });
    if (g.phase !== 'serve' && g.phase !== 'rally') return;
    const H = g.hitter, O = otherSide(H);
    if (e.type === 'netcord') { g.netTouched = true; return; }
    if (e.type === 'net') { g.netHit = true; return; }
    if (g.phase === 'serve') {
      if (e.type === 'bounce') {
        if (!g.serveOwn) { if (e.side === H) g.serveOwn = true; else point(g, O, 'serveFault'); }
        else if (e.side === H) point(g, O, g.netHit ? 'net' : 'serveFault');
        else if (g.netTouched) letServe(g);
        else { g.phase = 'rally'; g.recvBounced = true; }
      } else if (e.type === 'floor' || e.type === 'far') point(g, O, g.netHit ? 'net' : 'serveFault');
      return;
    }
    if (e.type === 'bounce') {
      if (e.side === H) point(g, O, g.netHit ? 'net' : 'ownSide');
      else if (g.recvBounced) point(g, H, 'double');
      else g.recvBounced = true;
    } else if (e.type === 'floor' || e.type === 'far') {
      if (g.recvBounced) point(g, H, 'miss');
      else point(g, O, g.netHit ? 'net' : 'out');
    }
  }

  // ---------- shots ----------
  // spin: { top, side } or the old names 'none' / 'top' / 'back'
  function launch(g, v, spin) {
    const b = g.ball, w = toSpin(spin);
    b.vx = v.vx; b.vy = v.vy; b.vz = v.vz; setSpin(b, w.top, w.side);
    g.recvBounced = false; g.netTouched = false; g.netHit = false;
    g.rallyHits++;
  }

  // who：'p'（玩家、玩家 1）或 'r'（雙人模式的玩家 2）。
  // 都在擊球者自己的視角算（s = -1 時左右、前後翻過來），瞄準點和側旋最後再轉回世界座標。
  // 引拍：擊球前 PAD_HIST 秒內拍子走過的路，在擊球者自己的視角算。
  //   back：從拉到最後面的位置往前揮了多遠（公尺）；lat：往前揮的同時往自己右手邊移了多少（往左是負的）
  function swingPath(p, s) {
    const h = p.hist;
    if (!h || h.length < 3) return { back: 0, lat: 0 };
    let iMax = 0;
    for (let i = 1; i < h.length; i++) if (s * h[i].z > s * h[iMax].z) iMax = i;
    return { back: Math.max(0, s * (h[iMax].z - p.z)), lat: s * (p.x - h[iMax].x) };
  }
  function trackPad(p, t) {
    const h = p.hist || (p.hist = []);
    h.push({ x: p.x, z: p.z, t });
    while (h.length && t - h[0].t > PAD_HIST) h.shift();
  }
  // 擦邊的程度：0 是打在拍面上；球在擊球範圍外面那一圈時是 0.35～1（越外面越偏）
  function edgeOf(g, p, b) {
    const dx = Math.abs(b.x - p.x), R = g.diff.pReach;
    return dx <= R ? 0 : 0.35 + 0.65 * clamp((dx - R) / SPINFX.edgeW, 0, 1);
  }

  // 擊球時機：球落台彈起後，快到最高點、還在上升的時候（最佳擊球點）打到就是「完美」。
  // tau 是離最佳擊球點的時間（秒，遊戲時間）：負的是太早（球才剛彈起來），正的是太晚（球已經過了最高點往下掉）
  function timingOf(g, b) {
    const tau = -b.vy / spinAccel(b.spinTop || 0, 0).gy + SPINFX.sweetLead, w = g.diff.perfect || 0.065;
    return { tau, grade: Math.abs(tau) <= w ? 'perfect' : tau < 0 ? 'early' : 'late' };
  }

  function playerHit(g, who) {
    who = who === 'r' ? 'r' : 'p';
    const s = who === 'r' ? -1 : 1, b = g.ball, p = padOf(g, who), d = g.diff;
    const off = clamp((s * (b.x - p.x)) / d.pReach, -1, 1), edge = edgeOf(g, p, b);
    const push = -s * p.vz, side = s * p.vx;
    const inc = { top: b.spinTop || 0, side: b.spinSide || 0 }; // 來球的旋轉（側旋是世界座標）
    const tm = timingOf(g, b), perfect = tm.grade === 'perfect' && edge === 0;
    let type = 'drive', Tf, zt, top = 0;
    let sig = 0.05 + 0.11 * off * off + SPINFX.recvSig * (Math.abs(inc.top) + Math.abs(inc.side));
    if (push > 1.0) {
      type = 'smash';
      const k = clamp((push - 1.0) / 1.6, 0, 1);
      Tf = 0.36 - 0.08 * k; zt = -1.02 - 0.12 * rng(); top = SPINFX.smashTop; sig += 0.04;
    } else if (push < -0.8) {
      type = 'drop'; Tf = 0.56; zt = -0.34 - 0.14 * rng(); top = -1;
    } else if (push > 0.35) { // 輕推：上旋
      type = 'loop'; top = 0.45 + 0.45 * clamp((push - 0.35) / 0.65, 0, 1);
      Tf = 0.5 - 0.1 * clamp(push, 0, 1); zt = -0.8 - 0.35 * rng();
    } else if (push < -0.3) { // 輕拉：下旋長球
      type = 'chop'; top = -(0.45 + 0.45 * clamp((-push - 0.3) / 0.5, 0, 1));
      Tf = 0.54; zt = -0.7 - 0.38 * rng();
    } else if (Math.hypot(push, side) < SPINFX.blockPad && Math.hypot(b.vx, b.vz) >= SPINFX.blockIn) {
      // 擋球：拍子不動去擋快球，借來球的力量回去；球比較短、比較穩，來球的旋轉也卸掉一半
      type = 'block'; Tf = clamp(0.52 - 0.025 * (Math.hypot(b.vx, b.vz) - SPINFX.blockIn), 0.42, 0.52);
      zt = -0.62 - 0.34 * rng(); sig *= 0.7;
    } else {
      Tf = 0.5 - 0.1 * clamp(push, 0, 1); zt = -0.72 - 0.4 * rng();
    }
    // 引拍後往前揮＝拉球：拉得越後面、揮得越快，上旋越強。斜著往前揮，有一部分變成側旋（側上旋）
    const sw = swingPath(p, s);
    let loopSide = 0;
    if (type !== 'smash' && push > 0.25 && sw.back >= SPINFX.loopBack) {
      const k = clamp(0.45 + 2.2 * (sw.back - SPINFX.loopBack) + 0.3 * clamp(push, 0, 1), 0.45, 1);
      const ang = Math.atan2(sw.lat, sw.back); // 0：直直往前拉；接近 ±90°：幾乎是橫著拉
      type = 'loop'; top = Math.max(top, k * Math.cos(ang)); loopSide = 0.9 * k * Math.sin(ang);
    }
    // 左右揮：側旋，球往揮的方向彎（落點照舊，彎度算在瞄準裡），揮得越快側旋越強。
    // 往自己右手邊揮是右側旋、往左揮是左側旋；平著橫揮會帶一點上旋，往後拉著橫揮則是側下旋
    const swipe = Math.sign(side) * clamp((Math.abs(side) - 0.8) / 1.4, 0, 1);
    if (swipe !== 0 && type === 'drive') top = Math.max(top, 0.3 * Math.abs(swipe));
    // 打在球的哪一側：球偏在拍子中心的右邊＝拍子摩擦到球的左側，球往右彎；偏在左邊＝摩擦球的右側，球往左彎。
    // 拍子動得越快摩擦越多；跟揮拍方向相反的那一側會把側旋抵消，甚至反過來
    const offC = Math.sign(off) * clamp((Math.abs(off) - 0.25) / 0.6, 0, 1);
    const contact = SPINFX.contactSide * offC * clamp(Math.hypot(push, side) / 1.2, 0, 1);
    const w = { top, side: s * clamp(swipe + loopSide + contact, -1, 1) };
    if (d.key === 'easy') sig *= 0.6;
    if (perfect) { sig = 0; Tf *= SPINFX.perfectFast; } // 完美時機：落點不會偏、球比較快
    let xt = 0.42 * off + 0.24 * side + gauss() * sig;
    xt = d.key === 'easy' ? clamp(xt, -0.72, 0.72) : clamp(xt, -1.3, 1.3);
    zt += gauss() * sig * 0.6;
    if (perfect) { xt = clamp(xt, -(HX - 0.1), HX - 0.1); zt = clamp(zt, -(HZ - 0.12), -0.25); } // 一定打在桌上
    xt *= s; zt *= s;
    let v = aimVelocity(b, xt, zt, Tf, w);
    if (type !== 'smash' || b.y > 0.16 || perfect) {
      for (let n = 0; n < 14 && netMargin(b, v, w) < 0.02; n++) { Tf += 0.03; v = aimVelocity(b, xt, zt, Tf, w); }
    }
    if (edge > 0) {
      // 擦邊：球打在拍子邊緣，力量和旋轉大多傳不過去，球往打到的那一側歪掉，高度也不穩
      const out = Math.sign(b.x - p.x) || 1;
      v.vx = v.vx * (1 - 0.35 * edge) + out * (0.5 + 1.1 * edge) * (0.6 + 0.4 * rng());
      v.vz *= 0.88 - 0.3 * edge;
      v.vy += (rng() * 1.6 - 0.5) * (0.4 + 0.6 * edge);
      w.top = w.top * (1 - 0.75 * edge) + (rng() - 0.5) * 0.3;
      w.side = w.side * (1 - 0.75 * edge) + out * 0.3 * edge;
      type = 'edge';
    }
    // 來球的旋轉讓回球偏掉：完美時機完全化解，擋球卸掉一半
    const kick = receiveKick(inc, w), kk = perfect ? 0 : type === 'block' ? 0.5 : 1;
    v.vx += kick.vx * kk; v.vy += kick.vy * kk;
    if (perfect) g.perfects[who]++;
    g.lastPerfect = perfect;
    g.hitter = who; g.lastShot[who] = type; g.totalHits[who]++; p.swing = 1;
    launch(g, v, w);
    g.events.push({ kind: 'hit', who, type, x: b.x, speed: Math.hypot(v.vx, v.vz), spin: b.spin, spinTop: b.spinTop, spinSide: b.spinSide, edge, timing: tm.grade, perfect });
    if (g.mode === 'pvp') { g.hint = predictBounce(g, otherSide(who)); g.sweet = predictSweet(g, otherSide(who)); }
    else planRobot(g);
  }

  function robotHit(g) {
    const b = g.ball, r = g.robot, d = g.diff, p = g.pad;
    const off = clamp(Math.abs(b.x - r.x) / d.rReach, 0, 1);
    const inc = g.lastShot.p, spinIn = Math.abs(b.spinTop || 0) + Math.abs(b.spinSide || 0);
    const errP = d.rErr + d.rErrK * (0.7 * off * off + (inc === 'smash' ? 0.7 : 0) + (inc === 'drop' ? 0.45 : 0) + (g.lastPerfect ? SPINFX.perfectErr : 0)) + d.rSpinErr * spinIn;
    let type = 'drive', v;
    const w = { top: 0, side: 0 };
    const awayX = () => -Math.sign(p.x || rng() - 0.5) * rand(0.35, 0.62);
    if (rng() < errP) {
      const m = rng();
      type = 'error';
      if (m < 0.4) {
        const tn = rand(0.12, 0.2), xt = rand(-0.4, 0.4), yn = NET_H * rand(0.3, 1.12);
        v = { vx: (xt - b.x) / tn, vy: (yn - b.y + 0.5 * G * tn * tn) / tn, vz: (0 - b.z) / tn };
      } else if (m < 0.75) {
        v = aimVelocity(b, rand(-0.5, 0.5), HZ + rand(0.1, 0.35), rand(d.rTf[0], d.rTf[1]));
      } else {
        v = aimVelocity(b, Math.sign(rng() - 0.5) * (HX + rand(0.08, 0.3)), rand(0.5, 1.1), rand(d.rTf[0], d.rTf[1]));
      }
    } else {
      let xt, zt, Tf;
      if (b.y > 0.3 && rng() < d.smash) { type = 'smash'; Tf = rand(0.3, 0.34); zt = rand(0.95, 1.15); xt = awayX(); w.top = SPINFX.smashTop; }
      else if (rng() < d.drop && p.z > (d.dropZ || 1.6)) { type = 'drop'; Tf = 0.56; zt = rand(0.3, 0.42); xt = rand(-0.4, 0.4); w.top = -1; }
      else {
        Tf = rand(d.rTf[0], d.rTf[1]); zt = rand(0.55, 1.15); xt = d.corner > 0 && rng() < d.corner ? awayX() : rand(-d.spread, d.spread);
        if (rng() < d.spin) { // 旋轉球：上旋、下旋長球，或往外彎的側旋
          const k = d.spinMax * rand(0.55, 1), m = rng();
          if (m < 0.4) { type = 'loop'; w.top = k; }
          else if (m < 0.75) { type = 'chop'; w.top = -k; Tf += 0.04; }
          else { w.side = (xt >= 0 ? 1 : -1) * k; w.top = 0.3 * k; }
        }
      }
      v = aimVelocity(b, xt, zt, Tf, w);
      for (let n = 0; n < 14 && netMargin(b, v, w) < 0.03; n++) { Tf += 0.03; v = aimVelocity(b, xt, zt, Tf, w); }
    }
    g.hitter = 'r'; g.lastShot.r = type; g.totalHits.r++; r.swing = 1; r.plan = null;
    launch(g, v, w);
    g.hint = predictBounce(g, 'p'); g.sweet = predictSweet(g, 'p');
    g.events.push({ kind: 'hit', who: 'r', type, x: b.x, speed: Math.hypot(v.vx, v.vz), spin: b.spin, spinTop: b.spinTop, spinSide: b.spinSide });
  }

  function checkHits(g) {
    if (g.phase !== 'rally' || !g.recvBounced) return;
    const b = g.ball;
    if (g.hitter === 'r' && b.vz > 0) {
      const p = g.pad;
      if (Math.abs(b.z - p.z) < 0.075 && Math.abs(b.x - p.x) < g.diff.pReach + SPINFX.edgeW && b.y > -0.1 && b.y < 0.9) playerHit(g);
    } else if (g.hitter === 'p' && b.vz < 0 && g.mode === 'pvp') {
      const q = g.pad2;
      if (Math.abs(b.z - q.z) < 0.075 && Math.abs(b.x - q.x) < g.diff.pReach + SPINFX.edgeW && b.y > -0.1 && b.y < 0.9) playerHit(g, 'r');
    } else if (g.hitter === 'p' && b.vz < 0) {
      const r = g.robot;
      if (Math.abs(b.z - r.z) < 0.075 && Math.abs(b.x - r.x) < g.diff.rReach && b.y > -0.1 && b.y < 0.9) robotHit(g);
    }
  }

  // ---------- prediction ----------
  function predictBounce(g, side) {
    const s = Object.assign({}, g.ball), ev = [];
    for (let t = 0; t < 3; t += 1 / 240) {
      ev.length = 0; stepBall(s, 1 / 240, ev);
      for (const e of ev) {
        if (e.type === 'bounce' && e.side === side) return { x: e.x, z: e.z };
        if (e.type === 'floor' || e.type === 'far') return null;
      }
    }
    return null;
  }

  // 最佳擊球點：球在 side 那一邊落台彈起後，快到最高點的位置（在這附近打到就是完美時機）
  function predictSweet(g, side) {
    const s = Object.assign({}, g.ball), ev = [];
    let bounced = false;
    for (let t = 0; t < 3; t += 1 / 240) {
      ev.length = 0; stepBall(s, 1 / 240, ev);
      for (const e of ev) {
        if (e.type === 'bounce' && e.side === side && !bounced) bounced = true;
        else if (e.type !== 'netcord') return null;
      }
      if (bounced && s.vy <= SPINFX.sweetLead * spinAccel(s.spinTop || 0, 0).gy) return { x: s.x, y: s.y, z: s.z };
    }
    return null;
  }

  function planRobot(g) {
    const s = Object.assign({}, g.ball), ev = [], dt = 1 / 240, zMin = g.diff.rZmin;
    let bounced = false, apex = null, plane = null, last = null;
    outer: for (let t = 0; t < 3; t += dt) {
      ev.length = 0; stepBall(s, dt, ev);
      for (const e of ev) {
        if (e.type === 'bounce') { if (e.side === 'r') { if (bounced) break outer; bounced = true; } else if (bounced) break outer; }
        if (e.type === 'floor' || e.type === 'far') break outer;
      }
      if (bounced) {
        if (!apex && s.vy <= 0) apex = { x: s.x, y: s.y, z: s.z };
        if (!plane && s.z <= zMin) plane = { x: s.x, y: s.y, z: s.z };
        last = { x: s.x, y: s.y, z: s.z };
        if (s.z < ROB.zDeep) break;
      }
    }
    const r = g.robot;
    if (!bounced || !last) { r.plan = null; return; }
    let target;
    if (apex && apex.z <= zMin && apex.z >= ROB.zDeep) target = apex;
    else if (apex && apex.z > zMin) target = plane || last;
    else target = last;
    r.plan = { x: clamp(target.x, -ROB.xMax, ROB.xMax), y: target.y, z: clamp(target.z, ROB.zDeep, zMin) };
    r.react = g.diff.rReact; r.noise = gauss() * g.diff.rNoise;
  }

  function moveRobot(g, h) {
    if (g.mode === 'pvp') return; // 雙人模式沒有 R-11
    const r = g.robot, d = g.diff, b = g.ball;
    if (r.lock) { r.x = b.x; r.z = Math.min(b.z - 0.03, -1.4); r.y = b.y; return; }
    let tx = r.x * 0.995, tz = ROB.zRest;
    const live = (g.phase === 'rally' || g.phase === 'serve') && g.hitter === 'p';
    if (live && r.plan) {
      r.react -= h;
      if (r.react <= 0) { tx = r.plan.x + r.noise; tz = r.plan.z; } else { tx = r.x; tz = r.z; }
    } else if (g.phase === 'serveWait' && g.server === 'r') { tx = r.x; tz = -1.5; }
    else if (live) { tx = r.x; tz = r.z; }
    const sx = d.rSpeed * h, sz = d.rSpeed * d.rZ * h;
    r.x += clamp(tx - r.x, -sx, sx); r.z += clamp(tz - r.z, -sz, sz);
    const ty = live && b.z < 0 ? clamp(b.y, -0.05, 0.7) : 0.22;
    r.y += (ty - r.y) * (1 - Math.exp(-h * 14));
  }

  function substep(g, h) {
    const b = g.ball, ev = [];
    if (g.phase === 'serveWait') {
      if (human(g, g.server)) updateAim(g);
      holdBall(g); moveRobot(g, h); return;
    }
    if (g.phase === 'toss') {
      stepBall(b, h, ev);
      if (g.server === 'p') { g.pad.x = b.x; g.pad.z = b.z + 0.03; }
      else if (g.mode === 'pvp') { g.pad2.x = b.x; g.pad2.z = b.z - 0.03; }
      if (b.vy < 0 && b.y <= g.serveData.y0) strikeServe(g);
      moveRobot(g, h); return;
    }
    stepBall(b, h, ev);
    for (const e of ev) handleBallEvent(g, e);
    checkHits(g);
    moveRobot(g, h);
  }

  // paddle follows its target (tx, tz); its smoothed velocity decides the shot
  function movePad(p, dt, zLo, zHi) {
    if (!p.lock) {
      const k = 1 - Math.exp(-dt * 24);
      const nx = p.x + (clamp(p.tx, PAD.xMin, PAD.xMax) - p.x) * k;
      const nz = p.z + (clamp(p.tz, zLo, zHi) - p.z) * k;
      const a = 1 - Math.exp(-dt / 0.07);
      p.vx += ((nx - p.x) / Math.max(dt, 1e-4) - p.vx) * a;
      p.vz += ((nz - p.z) / Math.max(dt, 1e-4) - p.vz) * a;
      p.x = nx; p.z = nz;
    } else { p.vx *= 0.8; p.vz *= 0.8; }
    p.swing = Math.max(0, p.swing - dt * 5);
  }
  // paddle rises to meet a ball coming its way
  function padHeight(p, b, coming, dt) {
    const ty = p.lock ? b.y : coming ? clamp(b.y, -0.05, 0.7) : 0.2;
    p.y += (ty - p.y) * (1 - Math.exp(-dt * 16));
  }

  // dt in real seconds. Paddle targets (pad.tx, pad.tz; pad2 in two-player mode) are set by the input layer.
  function update(g, dt) {
    dt = Math.min(dt, 0.05);
    g.time += dt;
    const p = g.pad, b = g.ball, pvp = g.mode === 'pvp';
    movePad(p, dt, PAD.zMin, PAD.zMax); trackPad(p, g.time);
    if (pvp) { movePad(g.pad2, dt, -PAD.zMax, -PAD.zMin); trackPad(g.pad2, g.time); }
    g.robot.swing = Math.max(0, g.robot.swing - dt * 5);
    if (g.robot.moodT > 0) { g.robot.moodT -= dt; if (g.robot.moodT <= 0) g.robot.mood = 'idle'; }
    if (g.phase === 'over') return;
    let rem = dt * g.diff.ts;
    while (rem > 1e-10) { const h = Math.min(SUB, rem); substep(g, h); rem -= h; }
    if (g.phase === 'dead') { g.timer -= dt; if (g.timer <= 0) afterPoint(g); }
    else if (g.phase === 'break') { g.timer -= dt; if (g.timer <= 0) nextGame(g); }
    else if (g.phase === 'serveWait' && !human(g, g.server)) { g.timer -= dt; if (g.timer <= 0) startToss(g); }
    const live = g.phase === 'rally' || g.phase === 'serve';
    padHeight(p, b, live && g.hitter === 'r' && b.z > 0, dt);
    if (pvp) padHeight(g.pad2, b, live && g.hitter === 'p' && b.z < 0, dt);
  }

  const API = { _test: { point, resetForServe, afterPoint, playerHit, robotHit, nextGame, checkHits, swingPath, timingOf }, BEST_OF, BREAK_SECS, G, R, HX, HZ, NET_H, NET_X, FLOOR, PAD, ROB, DIFFS, STYLES, setStyle, SPIN, SPINFX, createGame, update, serve, stepBall, servePlan, aimVelocity, netMargin, predictBounce, predictSweet, timingOf, spinAccel, receiveKick, setRng: (f) => { rng = f; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.PingPong = API;
})(this);
