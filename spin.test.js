// 旋轉測試：上旋、下旋、側旋在飛行和落台時的效果，擊球手勢打出的旋轉，接旋轉球的影響。
// 執行：node spin.test.js
const E = require('./engine.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  通過  ' : '  失敗  ') + msg); if (!cond) fails++; };
const f2 = (v) => v.toFixed(2);

// 球從桌面正上方以同樣速度落台，回傳剛彈起的速度和彈起後的最高點
function bounce(top, side, vy, vz) {
  const b = { x: 0, y: E.R + 1e-4, z: -0.6, vx: 0, vy: vy || -2.5, vz: vz || -4, spin: 'none', spinTop: top, spinSide: side || 0 };
  const ev = [];
  let after = null;
  for (let i = 0; i < 4000; i++) {
    ev.length = 0; E.stepBall(b, 1 / 2000, ev);
    if (!after && ev.some((e) => e.type === 'bounce')) after = { vy: b.vy, vz: b.vz, vx: b.vx, apex: b.y };
    if (after) { after.apex = Math.max(after.apex, b.y); if (b.vy < 0) break; }
  }
  return after;
}
// 用同樣的出手速度飛到第一次落台，回傳落點
function landing(top, side) {
  const b = { x: 0, y: 0.3, z: 1.2, vx: 0, vy: 1.2, vz: -5, spin: 'none', spinTop: top, spinSide: side || 0 };
  const ev = [];
  for (let i = 0; i < 3000; i++) {
    ev.length = 0; E.stepBall(b, 1 / 1000, ev);
    const hit = ev.find((e) => e.type === 'bounce');
    if (hit) return { x: hit.x, z: hit.z };
  }
  return null;
}

console.log('落台');
const flat = bounce(0), back = bounce(-1), top = bounce(1), side = bounce(0, 0.9);
ok(back.apex < flat.apex, `下旋彈得比無旋轉低（最高 ${f2(back.apex)} m，無旋轉 ${f2(flat.apex)} m）`);
ok(Math.abs(back.vz) < Math.abs(flat.vz), `下旋落台後往前跑得比無旋轉慢（${f2(-back.vz)} m/s，無旋轉 ${f2(-flat.vz)} m/s）`);
ok(top.apex < flat.apex, `上旋彈得比無旋轉低（最高 ${f2(top.apex)} m）`);
ok(Math.abs(top.vz) > Math.abs(flat.vz), `上旋落台後往前衝得比無旋轉快（${f2(-top.vz)} m/s）`);
ok(side.vx > 0.3 && flat.vx === 0, `往 +x 的側旋落台後往 +x 拐（橫向 ${f2(side.vx)} m/s）`);
const half = bounce(-0.5);
ok(half.apex < flat.apex && half.apex > back.apex, '旋轉越強效果越明顯：半下旋介於無旋轉和強下旋之間');
// 落台前往前的速度是 4 m/s
ok(-top.vz > 4.5 && -flat.vz < 4, `上旋落台後比落台前還快（4.00 → ${f2(-top.vz)} m/s），無旋轉只會稍微變慢（${f2(-flat.vz)} m/s）`);
ok(-back.vz < 3 && -back.vz > 0, `下旋落台後明顯變慢，但不會倒著跑（4.00 → ${f2(-back.vz)} m/s）`);
const halfTop = bounce(0.5);
ok(-halfTop.vz > -flat.vz && -halfTop.vz < -top.vz && -half.vz < -flat.vz && -half.vz > -back.vz, '旋轉越強，加速或減速越多');
const topHard = bounce(1, 0, -4), topSoft = bounce(1, 0, -1.2);
ok(-topHard.vz > -top.vz && -topSoft.vz < -top.vz, `球砸得越重，上旋往前衝得越多（輕落 ${f2(-topSoft.vz)}、重落 ${f2(-topHard.vz)} m/s）`);
const backSlow = bounce(-1, 0, -4, -1);
ok(-backSlow.vz > 0 && -backSlow.vz < 0.5, `很慢的強下旋落台後幾乎停住，但還是往前（${f2(-backSlow.vz)} m/s）`);
const diag = bounce(1, 0, -2.5, -4), diagX = (() => { const b = { x: 0, y: E.R + 1e-4, z: -0.6, vx: 1, vy: -2.5, vz: -4, spin: 'none', spinTop: 1, spinSide: 0 }, ev = []; E.stepBall(b, 1 / 2000, ev); return b; })();
ok(Math.abs(diagX.vx / diagX.vz - 1 / -4) < 1e-9 && diag.vx === 0, '上旋加速是順著球前進的方向，斜著飛的球不會被改變方向');

console.log('飛行');
const lf = landing(0), lt = landing(0.8), lb = landing(-0.8), ls = landing(0, 0.9), lsl = landing(0, -0.9);
ok(lt.z > lf.z, `上旋往下墜，落點比無旋轉近（z ${f2(lt.z)}，無旋轉 ${f2(lf.z)}）`);
ok(lb.z < lf.z, `下旋往上飄，落點比無旋轉遠（z ${f2(lb.z)}）`);
ok(ls.x > 0.05 && lsl.x < -0.05 && Math.abs(lf.x) < 1e-9, `側旋在空中往旋轉方向彎（落點 x ${f2(ls.x)} 和 ${f2(lsl.x)}）`);

console.log('瞄準');
let worst = 0;
for (const w of [{ top: 0, side: 0 }, { top: 0.8, side: 0 }, { top: -0.8, side: 0 }, { top: 0, side: 0.9 }, { top: 0.3, side: -0.7 }]) {
  const b = { x: 0.2, y: 0.25, z: 1.5, spin: 'none', spinTop: w.top, spinSide: w.side };
  Object.assign(b, E.aimVelocity(b, -0.3, -0.9, 0.5, w));
  const ev = [];
  for (let i = 0; i < 2000; i++) {
    ev.length = 0; E.stepBall(b, 1 / 1000, ev);
    const hit = ev.find((e) => e.type === 'bounce' || e.type === 'net' || e.type === 'floor');
    if (hit) { worst = Math.max(worst, hit.type === 'bounce' ? Math.hypot(hit.x + 0.3, hit.z + 0.9) : 9); break; }
  }
}
ok(worst < 0.01, `帶旋轉瞄準時，彎度和下墜都算進去，落點誤差 ${(worst * 100).toFixed(1)} 公分`);
const bv = { x: 0, y: 0.25, z: 1.5 }, v0 = E.aimVelocity(bv, 0, -0.9, 0.5);
ok(E.netMargin(bv, v0, { top: 1 }) < E.netMargin(bv, v0), '同樣出手速度，上旋過網的高度比較低');

console.log('擊球手勢');
const g = E.createGame('normal', { rng: () => 0.5 });
function hitWith(vz, vx, incoming) {
  g.phase = 'rally'; g.hitter = 'r'; g.recvBounced = true;
  Object.assign(g.ball, { x: 0, y: 0.25, z: 1.6, vx: 0, vy: -1.5, vz: 4, spinTop: incoming ? incoming.top : 0, spinSide: incoming ? incoming.side : 0 });
  Object.assign(g.pad, { x: 0, z: 1.6, vz, vx, hist: [] });
  E._test.playerHit(g);
  return { type: g.lastShot.p, top: g.ball.spinTop, side: g.ball.spinSide, vy: g.ball.vy, vx: g.ball.vx, speed: Math.hypot(g.ball.vx, g.ball.vz) };
}
const hFlat = hitWith(0, 0), hLoop = hitWith(-0.7, 0), hSmash = hitWith(-1.8, 0), hChop = hitWith(0.55, 0), hDrop = hitWith(1.2, 0);
ok(hFlat.type === 'drive' && hFlat.top === 0 && hFlat.side === 0, '不前後動 → 平擊，沒有旋轉');
ok(hLoop.type === 'loop' && hLoop.top > 0.4, `輕推 → 上旋（強度 ${f2(hLoop.top)}）`);
ok(hSmash.type === 'smash' && hSmash.top > 0.4, '用力推 → 扣殺，帶上旋');
ok(hChop.type === 'chop' && hChop.top < -0.4, `輕拉 → 下旋長球（強度 ${f2(hChop.top)}）`);
ok(hDrop.type === 'drop' && hDrop.top < -0.4, '用力拉 → 放短，帶下旋');
const hSmallSide = hitWith(0, 0.6), hSideR = hitWith(0, 2.2), hSideL = hitWith(0, -2.2), hSideMid = hitWith(0, 1.4);
ok(hSmallSide.side === 0, '小幅左右移動只改方向，不帶側旋');
ok(hSideR.side > 0.5 && hSideL.side < -0.5, '快速往右揮 → 往右彎的側旋；往左揮 → 往左彎');
ok(hSideMid.side > 0.2 && hSideMid.side < hSideR.side, `揮得越快側旋越強（1.4 m/s：${f2(hSideMid.side)}，2.2 m/s：${f2(hSideR.side)}）`);
const pSlow = hitWith(-0.4, 0), pFast = hitWith(-0.95, 0), pSmash = hitWith(-1.2, 0), pSmashMax = hitWith(-2.6, 0);
ok(pFast.speed > pSlow.speed + 0.3 && pSmash.speed > pFast.speed && pSmashMax.speed > pSmash.speed, `推得越快球越快（${f2(pSlow.speed)} → ${f2(pFast.speed)} → 扣殺 ${f2(pSmash.speed)} → ${f2(pSmashMax.speed)} m/s）`);

// 雙人模式的玩家 2 站在另一端：他的右手邊是 -x、往網子是 +z，旋轉也要照他的方向
function hitWith2(vz, vx) {
  const x = E.createGame('normal', { rng: () => 0.5, mode: 'pvp' });
  x.phase = 'rally'; x.hitter = 'p'; x.recvBounced = true;
  Object.assign(x.ball, { x: 0, y: 0.25, z: -1.6, vx: 0, vy: -1.5, vz: -4, spinTop: 0, spinSide: 0 });
  Object.assign(x.pad2, { x: 0, z: -1.6, vz, vx, hist: [] });
  E._test.playerHit(x, 'r');
  return { type: x.lastShot.r, top: x.ball.spinTop, side: x.ball.spinSide, land: E.predictBounce(x, 'p') };
}
const p2SideR = hitWith2(0, -2.2), p2Loop = hitWith2(0.7, 0), p2Chop = hitWith2(-0.55, 0);
ok(p2SideR.side < -0.5 && p2SideR.land && p2SideR.land.x < 0, `雙人模式玩家 2 往自己右手邊快速揮 → 球往他的右手邊（-x）彎（側旋 ${f2(p2SideR.side)}）`);
ok(p2Loop.type === 'loop' && p2Loop.top > 0.4 && p2Chop.type === 'chop' && p2Chop.top < -0.4, '雙人模式玩家 2 往網子輕推 → 上旋；往後輕拉 → 下旋');

console.log('引拍（擊球前的揮拍路徑）');
// 拍子的路徑：從 (x0, z0) 拉到 (x0, z0 + back)，再往前揮到擊球點 (x0 + lat, z0)；擊球者是玩家 1
function hitWithSwing(back, lat, push) {
  g.phase = 'rally'; g.hitter = 'r'; g.recvBounced = true;
  Object.assign(g.ball, { x: lat, y: 0.25, z: 1.6, vx: 0, vy: -1.5, vz: 4, spinTop: 0, spinSide: 0 });
  const t0 = g.time, path = [];
  for (let i = 0; i <= 6; i++) path.push({ x: 0, z: 1.6 + (back * i) / 6, t: t0 - 0.38 + i * 0.03 }); // 往後拉
  for (let i = 1; i <= 8; i++) path.push({ x: (lat * i) / 8, z: 1.6 + back - (back * i) / 8, t: t0 - 0.2 + i * 0.025 }); // 往前揮
  Object.assign(g.pad, { x: lat, z: 1.6, vz: -push, vx: 0, hist: path });
  E._test.playerHit(g);
  return { type: g.lastShot.p, top: g.ball.spinTop, side: g.ball.spinSide };
}
const sw = E._test.swingPath({ x: 0.15, z: 1.6, hist: [{ x: 0, z: 1.6 }, { x: 0, z: 1.9 }, { x: 0.15, z: 1.6 }] }, 1);
ok(Math.abs(sw.back - 0.3) < 1e-9 && Math.abs(sw.lat - 0.15) < 1e-9, '引拍路徑：拉到最後面再往前揮 0.30 公尺，同時往右 0.15 公尺');
const lStraight = hitWithSwing(0.3, 0, 0.5), lShort = hitWithSwing(0.14, 0, 0.5), lNone = hitWithSwing(0, 0, 0.3);
ok(lStraight.type === 'loop' && lStraight.top > 0.8 && Math.abs(lStraight.side) < 0.05, `引拍後直直往前揮 → 拉球，強上旋（${f2(lStraight.top)}），沒有側旋`);
ok(lShort.top < lStraight.top, `引拍越長上旋越強（短引拍 ${f2(lShort.top)} < 長引拍 ${f2(lStraight.top)}）`);
ok(lNone.type === 'drive' && lNone.top === 0, '沒有引拍、輕輕往前 → 平擊，跟原本一樣');
const lRight = hitWithSwing(0.25, 0.2, 0.5), lLeft = hitWithSwing(0.25, -0.2, 0.5);
ok(lRight.type === 'loop' && lRight.top > 0.4 && lRight.side > 0.4, `從左後往右前斜著揮 → 側上旋：上旋 ${f2(lRight.top)}、右側旋 ${f2(lRight.side)}`);
ok(lLeft.top > 0.4 && lLeft.side < -0.4, `從右後往左前斜著揮 → 側上旋：上旋 ${f2(lLeft.top)}、左側旋 ${f2(lLeft.side)}`);
const hSideTop = hitWith(0, 2.2), hSideBack = hitWith(0.55, 2.2);
ok(hSideTop.top > 0.15 && hSideTop.side > 0.5, `平著快速橫揮 → 側旋帶一點上旋（上旋 ${f2(hSideTop.top)}）`);
ok(hSideBack.top < -0.4 && hSideBack.side > 0.5, `往後輕拉同時快速橫揮 → 側下旋（下旋 ${f2(hSideBack.top)}、側旋 ${f2(hSideBack.side)}）`);

console.log('打在球的哪一側');
// 球在拍子中心右邊 dx 公尺（負的是左邊）被打到：球偏右＝拍子摩擦到球的左側，偏左＝摩擦到球的右側
function hitOff(dx, vz, vx) {
  g.phase = 'rally'; g.hitter = 'r'; g.recvBounced = true;
  Object.assign(g.ball, { x: dx, y: 0.25, z: 1.6, vx: 0, vy: -1.5, vz: 4, spinTop: 0, spinSide: 0 });
  Object.assign(g.pad, { x: 0, z: 1.6, vz, vx, hist: [] });
  E._test.playerHit(g);
  return { type: g.lastShot.p, top: g.ball.spinTop, side: g.ball.spinSide };
}
const RR = E.DIFFS.normal.pReach;
const oL = hitOff(-0.8 * RR, -0.7, 0), oR = hitOff(0.8 * RR, -0.7, 0), oC = hitOff(0.15 * RR, -0.7, 0), oStill = hitOff(0.8 * RR, 0, 0);
ok(oL.side < -0.3 && oL.top > 0.4, `往前打在球的右側（球偏在拍子左邊）→ 球往左彎，上旋還在（側旋 ${f2(oL.side)}）`);
ok(oR.side > 0.3 && Math.abs(oR.side + oL.side) < 1e-9, `打在球的另一側（左側）→ 側旋反過來，球往右彎（${f2(oR.side)}）`);
ok(oC.side === 0 && oStill.side === 0, '打在球的正後方，或拍子沒有動，都不會帶側旋');
const oSlowPush = hitOff(0.8 * RR, -0.4, 0);
ok(oSlowPush.side > 0 && oSlowPush.side < oR.side, `拍子動得越快，摩擦出的側旋越強（${f2(oSlowPush.side)} < ${f2(oR.side)}）`);
const swNat = hitOff(0.8 * RR, 0, 1.5), swOpp = hitOff(-0.8 * RR, 0, 1.5), swMid = hitOff(0, 0, 1.5);
ok(swNat.side > swMid.side && swMid.side > 0, `往右揮、順著打在球的左側 → 側旋更強（${f2(swMid.side)} → ${f2(swNat.side)}）`);
ok(swOpp.side < -0.1, `往右揮卻打在球的右側 → 側旋反過來（${f2(swMid.side)} → ${f2(swOpp.side)}）`);
const oChop = hitOff(0.8 * RR, 0.55, 0);
ok(oChop.type === 'chop' && oChop.top < -0.4 && oChop.side > 0.3, `往後拉（削）球的側面 → 側下旋（下旋 ${f2(oChop.top)}、側旋 ${f2(oChop.side)}）`);
// 玩家 2 的左右是反的：球在 -x 那邊＝在他的拍子右邊
const x2 = E.createGame('normal', { rng: () => 0.5, mode: 'pvp' });
x2.phase = 'rally'; x2.hitter = 'p'; x2.recvBounced = true;
Object.assign(x2.ball, { x: -0.8 * RR, y: 0.25, z: -1.6, vx: 0, vy: -1.5, vz: -4, spinTop: 0, spinSide: 0 });
Object.assign(x2.pad2, { x: 0, z: -1.6, vz: 0.7, vx: 0, hist: [] });
E._test.playerHit(x2, 'r');
ok(x2.ball.spinSide < -0.3, `雙人模式玩家 2 打在球的左側（球在他的拍子右邊）→ 球往他的右手邊（-x）彎（${f2(x2.ball.spinSide)}）`);

console.log('擦邊（球打在拍子邊緣）');
// 球在拍子右邊 dx 公尺的地方被打到，其他條件跟 hitWith(0, 0) 一樣
function hitAt(dx) {
  g.phase = 'rally'; g.hitter = 'r'; g.recvBounced = true; g.events.length = 0;
  Object.assign(g.ball, { x: dx, y: 0.25, z: 1.6, vx: 0, vy: -1.5, vz: 4, spinTop: 0, spinSide: 0 });
  Object.assign(g.pad, { x: 0, z: 1.6, vz: -0.7, vx: 0, hist: [] });
  E._test.playerHit(g);
  const e = g.events.find((x) => x.kind === 'hit');
  return { type: e.type, edge: e.edge, vx: g.ball.vx, vz: g.ball.vz, top: g.ball.spinTop };
}
const R = E.DIFFS.normal.pReach, W = E.SPINFX.edgeW;
const cIn = hitAt(R * 0.9), cEdge = hitAt(R + W * 0.5), cFar = hitAt(R + W * 0.95);
ok(cIn.type === 'loop' && cIn.edge === 0, '球在擊球範圍內 → 正常擊球');
ok(cEdge.type === 'edge' && cEdge.edge > 0.35 && cFar.edge > cEdge.edge, `球在範圍外面那一圈 → 擦邊，越外面越偏（${f2(cEdge.edge)} → ${f2(cFar.edge)}）`);
ok(cEdge.vx > cIn.vx + 0.3, `擦邊的球往打到的那一側（右邊）歪掉（橫向速度 ${f2(cIn.vx)} → ${f2(cEdge.vx)}）`);
ok(Math.abs(cEdge.vz) < Math.abs(cIn.vz) && Math.abs(cEdge.top) < Math.abs(cIn.top), '擦邊的球比較慢，旋轉也大多傳不過去');
// 撞擊判定：讓球從擊球範圍內／那一圈／圈外經過拍子，看有沒有打到
function passBy(dx) {
  const x = E.createGame('normal', { rng: () => 0.5 });
  x.phase = 'rally'; x.hitter = 'r'; x.recvBounced = true;
  Object.assign(x.ball, { x: dx, y: 0.25, z: 1.6, vx: 0, vy: 0, vz: 4 });
  Object.assign(x.pad, { x: 0, z: 1.6 });
  E._test.checkHits(x);
  return x.hitter === 'p';
}
ok(passBy(R * 0.95) && passBy(R + W * 0.8), '球從拍子範圍內，或範圍外面一小圈經過，都算打到');
ok(!passBy(R + W + 0.02), '再外面就打不到了');

console.log('擊球時機');
// 球以往上速度 vy 經過拍子時被打到（vy 大＝才剛彈起來，負的＝已經往下掉）；incoming 是來球的旋轉
function hitTimed(vy, opt) {
  opt = opt || {};
  const x = E.createGame(opt.diff || 'normal', { rng: opt.rng || (() => 0.5) });
  x.phase = 'rally'; x.hitter = 'r'; x.recvBounced = true;
  Object.assign(x.ball, { x: opt.dx || 0, y: opt.y || 0.25, z: 1.6, vx: 0, vy, vz: opt.vz || 4, spinTop: opt.top || 0, spinSide: opt.side || 0 });
  Object.assign(x.pad, { x: 0, z: 1.6, vz: opt.pvz === undefined ? -0.7 : opt.pvz, vx: 0, hist: [] });
  E._test.playerHit(x);
  const e = x.events.find((q) => q.kind === 'hit');
  return { e, g: x, land: E.predictBounce(x, 'r'), speed: Math.hypot(x.ball.vx, x.ball.vz), vy: x.ball.vy, vx: x.ball.vx };
}
const lead = E.SPINFX.sweetLead * E.G; // 最佳擊球點的往上速度（沒有旋轉時）
const tP = hitTimed(lead), tEarly = hitTimed(lead + 1.5), tLate = hitTimed(lead - 1.5);
ok(tP.e.perfect && tP.e.timing === 'perfect' && tP.g.perfects.p === 1, '球快到最高點時打到 → 完美');
ok(!tEarly.e.perfect && tEarly.e.timing === 'early', '球才剛彈起來就打 → 太早');
ok(!tLate.e.perfect && tLate.e.timing === 'late' && tLate.g.perfects.p === 0, '球已經往下掉才打 → 太晚');
const wN = E.DIFFS.normal.perfect * E.G, inN = hitTimed(lead + wN * 0.9), outN = hitTimed(lead + wN * 1.1);
ok(inN.e.perfect && !outN.e.perfect, `普通難度：離最佳擊球點 ${E.DIFFS.normal.perfect} 秒以內才算完美`);
ok(E.DIFFS.easy.perfect > E.DIFFS.normal.perfect && E.DIFFS.normal.perfect > E.DIFFS.hard.perfect, '難度越高，完美時機越窄');
ok(hitTimed(lead + wN * 1.3, { diff: 'easy' }).e.perfect && !hitTimed(lead + wN * 0.9, { diff: 'hard' }).e.perfect, '同一個時機：簡單算完美，困難不算');
ok(tP.speed > tLate.speed, `完美時機的球比較快（${f2(tLate.speed)} → ${f2(tP.speed)} m/s）`);
// 亂數很偏、打在拍子邊邊、來球帶強旋轉：完美時機還是打在桌上
let allIn = true, someOut = false;
for (const r of [0.02, 0.2, 0.5, 0.8, 0.98]) for (const dx of [-0.16, 0, 0.16]) {
  const a = hitTimed(lead, { rng: () => r, dx, top: 0.9, side: 0.8 }), z = hitTimed(lead - 1.5, { rng: () => r, dx, top: 0.9, side: 0.8 });
  if (!a.land) allIn = false;
  if (!z.land) someOut = true;
}
ok(allIn, '完美時機：不管亂數、打在拍子哪裡、來球多轉，回球都落在對面桌上');
ok(someOut, '同樣的球太晚打，有些會出界或掛網');
const kP = hitTimed(lead, { pvz: 0, top: 0.6 }), kL = hitTimed(lead - 1.5, { pvz: 0, top: 0.6 }), k0 = hitTimed(lead - 1.5, { pvz: 0 });
ok(kL.vy > k0.vy + 0.2 && Math.abs(kP.vy - hitTimed(lead, { pvz: 0 }).vy) < 1e-9, '完美時機完全化解來球的旋轉；太晚打，上旋還是讓回球往上飄');
const eP = hitTimed(lead, { dx: E.DIFFS.normal.pReach + 0.02 });
ok(eP.e.type === 'edge' && !eP.e.perfect, '擦邊的球就算時機對，也不算完美');
// R-11 接完美時機的球比較容易失誤
function robotErrs(perfect) {
  let n = 0, seed = 11; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const x = E.createGame('normal', { rng });
  for (let i = 0; i < 3000; i++) {
    x.phase = 'rally'; x.hitter = 'p'; x.recvBounced = true; x.lastPerfect = perfect; x.lastShot.p = 'drive';
    Object.assign(x.ball, { x: 0, y: 0.25, z: -1.6, vx: 0, vy: -0.5, vz: -4, spinTop: 0, spinSide: 0 }); x.robot.x = 0;
    E._test.robotHit(x); if (x.lastShot.r === 'error') n++;
  }
  return n / 3000;
}
const rE0 = robotErrs(false), rE1 = robotErrs(true);
ok(rE1 > rE0 + 0.01, `R-11 接完美時機的球比較容易失誤（${(rE0 * 100).toFixed(1)}% → ${(rE1 * 100).toFixed(1)}%）`);
// 最佳擊球點的預測：球真的飛到那裡時，時機剛好是完美的正中間
const gs = E.createGame('normal', { rng: () => 0.5 });
gs.phase = 'rally'; gs.hitter = 'p'; gs.recvBounced = true;
Object.assign(gs.ball, { x: 0, y: 0.25, z: -1.6, vx: 0, vy: -0.5, vz: -4, spinTop: 0, spinSide: 0 });
E._test.robotHit(gs);
const sw2 = gs.sweet, fly = Object.assign({}, gs.ball), evs = [];
let tauAt = null;
for (let i = 0; i < 4000 && tauAt === null; i++) { E.stepBall(fly, 1 / 2000, evs); if (fly.z >= sw2.z) tauAt = E.timingOf(gs, fly).tau; }
ok(sw2 && sw2.z > 0.9 && sw2.y > 0.05 && Math.abs(tauAt) < 0.01, `準星標的位置就是最佳擊球點（z ${f2(sw2.z)}、高 ${f2(sw2.y)} m，誤差 ${Math.abs(tauAt).toFixed(3)} 秒）`);

console.log('擋球');
const bFast = hitTimed(-1.5, { pvz: 0, vz: 7 }), bSlow = hitTimed(-1.5, { pvz: 0, vz: 4 }), bMove = hitTimed(-1.5, { pvz: -0.7, vz: 7 });
ok(bFast.e.type === 'block', '拍子不動、來球很快 → 擋球');
ok(bSlow.e.type === 'drive' && bMove.e.type !== 'block', '來球不快是平擊；拍子有在動就不是擋球');
const bSpin = hitTimed(-1.5, { pvz: 0, vz: 7, top: 0.6 }), bNo = hitTimed(-1.5, { pvz: 0, vz: 7 });
const dBlock = bSpin.vy - bNo.vy, dDrive = kL.vy - k0.vy;
ok(dBlock > 0.05 && dBlock < dDrive * 0.6, `擋球把來球的旋轉卸掉一半（上飄 ${f2(dDrive)} → ${f2(dBlock)} m/s）`);
ok(hitTimed(-1.5, { pvz: 0, vz: 9 }).speed > bFast.speed, '來球越快，擋回去的球也越快（借力）');

console.log('接旋轉球');
const inBack = { top: -0.5, side: 0 }, inTop = { top: 0.5, side: 0 }, inSide = { top: 0, side: 0.6 };
const rFlatBack = hitWith(0, 0, inBack), rLoopBack = hitWith(-0.7, 0, inBack), rFlatTop = hitWith(0, 0, inTop), rChopTop = hitWith(0.55, 0, inTop);
ok(rFlatBack.vy < hFlat.vy - 0.2, `平擊接下旋，回球往下掉（出手往上速度 ${f2(rFlatBack.vy)}，接無旋轉 ${f2(hFlat.vy)}）`);
ok(Math.abs(rLoopBack.vy - hLoop.vy) < 1e-9, '輕推（上旋）接下旋可以化解，回球跟接無旋轉球一樣');
ok(rFlatTop.vy > hFlat.vy + 0.2, '平擊接上旋，回球往上飄（容易出界）');
ok(Math.abs(rChopTop.vy - hChop.vy) < 1e-9, '輕拉（下旋）接上旋可以化解');
ok(hitWith(0, 0, inSide).vx > hFlat.vx + 0.1, '接側旋，回球往旋轉方向偏');
const k = E.receiveKick({ top: -0.5, side: -0.4 }, { top: 0.2, side: 0.4 });
ok(k.vy < 0 && k.vx === 0, '只抵消一部分時，剩下的旋轉還是有影響；反向側旋可以抵消側旋');

console.log('R-11');
const gr = E.createGame('hard', { rng: () => 0.04 }); // 亂數固定 0.04：比失誤率 0.03 高、比旋轉機率低，一定打旋轉球
gr.phase = 'rally'; gr.hitter = 'p'; gr.recvBounced = true; gr.pad.x = 0.5; gr.pad.z = 1.4;
Object.assign(gr.ball, { x: 0, y: 0.25, z: -1.6, vx: 0, vy: -1.5, vz: -4, spinTop: 0, spinSide: 0 });
E._test.robotHit(gr);
ok(Math.abs(gr.ball.spinTop) + Math.abs(gr.ball.spinSide) > 0.3, `困難的 R-11 會打旋轉球（這球是 ${gr.lastShot.r}，旋轉 ${f2(gr.ball.spinTop)}／${f2(gr.ball.spinSide)}）`);
ok(E.DIFFS.easy.spin < E.DIFFS.normal.spin && E.DIFFS.normal.spin < E.DIFFS.hard.spin, '難度越高，R-11 越常打旋轉球（DIFFS.spin）');

console.log(fails ? `\n${fails} 項失敗` : '\n全部通過');
process.exit(fails ? 1 : 0);
