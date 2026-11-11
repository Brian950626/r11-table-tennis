// 旋轉測試：上旋、下旋、側旋在飛行和落台時的效果，擊球手勢打出的旋轉，接旋轉球的影響。
// 執行：node spin.test.js
const E = require('./engine.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  通過  ' : '  失敗  ') + msg); if (!cond) fails++; };
const f2 = (v) => v.toFixed(2);

// 球從桌面正上方以同樣速度落台，回傳剛彈起的速度和彈起後的最高點
function bounce(top, side) {
  const b = { x: 0, y: E.R + 1e-4, z: -0.6, vx: 0, vy: -2.5, vz: -4, spin: 'none', spinTop: top, spinSide: side || 0 };
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
  Object.assign(g.ball, { x: 0, y: 0.25, z: 1.6, vx: 0, vy: -0.5, vz: 4, spinTop: incoming ? incoming.top : 0, spinSide: incoming ? incoming.side : 0 });
  Object.assign(g.pad, { x: 0, z: 1.6, vz, vx, hist: [] });
  E._test.playerHit(g);
  return { type: g.lastShot.p, top: g.ball.spinTop, side: g.ball.spinSide, vy: g.ball.vy, vx: g.ball.vx };
}
const hFlat = hitWith(0, 0), hLoop = hitWith(-0.7, 0), hSmash = hitWith(-1.8, 0), hChop = hitWith(0.55, 0), hDrop = hitWith(1.2, 0);
ok(hFlat.type === 'drive' && hFlat.top === 0 && hFlat.side === 0, '不前後動 → 平擊，沒有旋轉');
ok(hLoop.type === 'loop' && hLoop.top > 0.4, `輕推 → 上旋（強度 ${f2(hLoop.top)}）`);
ok(hSmash.type === 'smash' && hSmash.top > 0.4, '用力推 → 扣殺，帶上旋');
ok(hChop.type === 'chop' && hChop.top < -0.4, `輕拉 → 下旋長球（強度 ${f2(hChop.top)}）`);
ok(hDrop.type === 'drop' && hDrop.top < -0.4, '用力拉 → 放短，帶下旋');
const hSmallSide = hitWith(0, 0.6), hSideR = hitWith(0, 2.2), hSideL = hitWith(0, -2.2);
ok(hSmallSide.side === 0, '小幅左右移動只改方向，不帶側旋');
ok(hSideR.side > 0.5 && hSideL.side < -0.5, '快速往右揮 → 往右彎的側旋；往左揮 → 往左彎');

// 雙人模式的玩家 2 站在另一端：他的右手邊是 -x、往網子是 +z，旋轉也要照他的方向
function hitWith2(vz, vx) {
  const x = E.createGame('normal', { rng: () => 0.5, mode: 'pvp' });
  x.phase = 'rally'; x.hitter = 'p'; x.recvBounced = true;
  Object.assign(x.ball, { x: 0, y: 0.25, z: -1.6, vx: 0, vy: -0.5, vz: -4, spinTop: 0, spinSide: 0 });
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
  Object.assign(g.ball, { x: lat, y: 0.25, z: 1.6, vx: 0, vy: -0.5, vz: 4, spinTop: 0, spinSide: 0 });
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

console.log('擦邊（球打在拍子邊緣）');
// 球在拍子右邊 dx 公尺的地方被打到，其他條件跟 hitWith(0, 0) 一樣
function hitAt(dx) {
  g.phase = 'rally'; g.hitter = 'r'; g.recvBounced = true; g.events.length = 0;
  Object.assign(g.ball, { x: dx, y: 0.25, z: 1.6, vx: 0, vy: -0.5, vz: 4, spinTop: 0, spinSide: 0 });
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
Object.assign(gr.ball, { x: 0, y: 0.25, z: -1.6, vx: 0, vy: -0.5, vz: -4, spinTop: 0, spinSide: 0 });
E._test.robotHit(gr);
ok(Math.abs(gr.ball.spinTop) + Math.abs(gr.ball.spinSide) > 0.3, `困難的 R-11 會打旋轉球（這球是 ${gr.lastShot.r}，旋轉 ${f2(gr.ball.spinTop)}／${f2(gr.ball.spinSide)}）`);
ok(E.DIFFS.easy.spin < E.DIFFS.normal.spin && E.DIFFS.normal.spin < E.DIFFS.hard.spin, '難度越高，R-11 越常打旋轉球（DIFFS.spin）');

console.log(fails ? `\n${fails} 項失敗` : '\n全部通過');
process.exit(fails ? 1 : 0);
