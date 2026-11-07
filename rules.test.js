// 規則測試：確認出界、掛網、漏接、發球順序、Deuce、擦網重發都判定正確，單人和雙人模式都測。
// 執行：node rules.test.js
const E = require('./engine.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  通過  ' : '  失敗  ') + msg); if (!cond) fails++; };

// 跑到出現得分或重發為止，回傳過程中的事件
function runUntilPoint(g, secs) {
  const out = [];
  for (let i = 0; i < secs * 120; i++) {
    E.update(g, 1 / 120);
    out.push(...g.events); g.events.length = 0;
    if (out.some((e) => e.kind === 'point' || e.kind === 'let')) break;
  }
  return out;
}
// 設定成「某一方剛擊球」的狀態
function rallyFrom(g, hitter, pos, target, flightTime) {
  g.phase = 'rally'; g.hitter = hitter; g.recvBounced = false; g.netHit = false; g.netTouched = false;
  Object.assign(g.ball, pos, { spin: 'none' });
  Object.assign(g.ball, E.aimVelocity(g.ball, target.x, target.z, flightTime));
  g.robot.plan = null;
  g.pad.tx = 1.0; g.pad.tz = 2.0; // 玩家球拍移到旁邊，不要碰到球
}
const pointOf = (ev) => ev.find((e) => e.kind === 'point');

console.log('回合判定');
let g = E.createGame('normal'); g.events.length = 0;
rallyFrom(g, 'p', { x: 0, y: 0.25, z: 1.5 }, { x: 0, z: -1.7 }, 0.45);
let pt = pointOf(runUntilPoint(g, 4));
ok(pt && pt.winner === 'r' && pt.reason === 'out', '玩家打出底線 → 機器人得分（出界）');

g = E.createGame('normal'); g.events.length = 0;
g.phase = 'rally'; g.hitter = 'p'; g.pad.tz = 2.0;
Object.assign(g.ball, { x: 0, y: 0.25, z: 1.5, vx: 0, spin: 'none', vz: -1.5 / 0.25, vy: (0.08 - 0.25 + 0.5 * 9.81 * 0.25 * 0.25) / 0.25 });
pt = pointOf(runUntilPoint(g, 4));
ok(pt && pt.winner === 'r' && pt.reason === 'net', '玩家打太低掛網 → 機器人得分（掛網）');

g = E.createGame('normal'); g.events.length = 0;
rallyFrom(g, 'r', { x: 0, y: 0.25, z: -1.6 }, { x: 0.3, z: 0.9 }, 0.5);
g.pad.tx = -1.0; g.pad.x = -1.0;
pt = pointOf(runUntilPoint(g, 4));
ok(pt && pt.winner === 'r' && pt.reason === 'miss', '機器人打進好球、玩家沒接 → 機器人得分（漏接）');

console.log('發球');
g = E.createGame('normal', { first: 'r' }); g.events.length = 0; g.pad.tx = 1.0; g.pad.tz = 2.0;
const bounces = [];
for (let i = 0; i < 600 && bounces.length < 2; i++) {
  E.update(g, 1 / 120);
  for (const e of g.events) if (e.kind === 'bounce') bounces.push(e.z > 0 ? '玩家' : '機器人');
  g.events.length = 0;
}
ok(bounces[0] === '機器人' && bounces[1] === '玩家', `機器人發球先彈自己這邊再過網（${bounces.join('→')}）`);

g = E.createGame('normal');
const order = [];
for (const [p, r] of [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [4, 1], [10, 10], [11, 10], [11, 11], [12, 11]]) {
  g.score.p = p; g.score.r = r; g.winner = null; E._test.resetForServe(g);
  order.push(`${p}:${r}=${g.server}`);
}
ok(order.join(' ') === '0:0=p 1:0=p 1:1=r 2:1=r 3:1=p 4:1=p 10:10=p 11:10=r 11:11=p 12:11=r', '每 2 分換發、10:10 後每分換發');

let lets = 0, scoreKept = true;
for (let k = 0; k < 400 && lets < 3; k++) {
  g = E.createGame('normal', { first: 'r' }); g.pad.tx = 1.0; g.pad.tz = 2.0; g.events.length = 0;
  if (runUntilPoint(g, 5).some((e) => e.kind === 'let')) { lets++; if (g.score.p || g.score.r) scoreKept = false; }
}
ok(lets > 0 && scoreKept, '發球擦網落在對面 → 重發，比分不變');

// 玩家站在各種位置發球（包含左右最邊邊），發球失誤不能太多
let seed = 7;
const lcg = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
let serves = 0, serveFaults = 0;
for (let i = 0; i < 15; i++) for (let j = 0; j < 6; j++) {
  g = E.createGame('normal', { rng: lcg }); g.events.length = 0;
  g.pad.tx = E.PAD.xMin + ((E.PAD.xMax - E.PAD.xMin) * i) / 14; g.pad.tz = E.PAD.zMin + ((E.PAD.zMax - E.PAD.zMin) * j) / 5;
  for (let k = 0; k < 60; k++) E.update(g, 1 / 60);
  E.serve(g); serves++;
  const p = pointOf(runUntilPoint(g, 3));
  if (p && p.reason === 'serveFault') serveFaults++;
}
ok(serveFaults <= serves * 0.05, `玩家從各種站位發球，失誤 ${serveFaults}／${serves} 球（不超過 5%）`);
E.setRng(Math.random);

console.log('比賽結束條件');
const finish = (p, r, winner) => { const x = E.createGame('normal'); x.score.p = p; x.score.r = r; x.phase = 'rally'; x.hitter = 'p'; E._test.point(x, winner, 'miss'); return x.winner; };
ok(finish(10, 9, 'p') === 'p', '11:9 結束');
ok(finish(10, 10, 'p') === null, '11:10 還沒結束（要領先 2 分）');
ok(finish(11, 10, 'p') === 'p', '12:10 結束');

console.log('雙人對戰（玩家 1 在近端 p、玩家 2 在遠端 r）');
function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pvp = (o) => E.createGame('normal', Object.assign({ mode: 'pvp' }, o));
const step = (x, secs) => { const out = []; for (let i = 0; i < secs * 120; i++) { E.update(x, 1 / 120); out.push(...x.events); x.events.length = 0; } return out; };

g = pvp({ rng: mulberry32(11) });
const order2 = [];
let deuceFlag = false;
for (const [p, r] of [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [4, 1], [10, 10], [11, 10], [11, 11], [12, 11]]) {
  g.score.p = p; g.score.r = r; g.winner = null; g.events.length = 0; E._test.resetForServe(g);
  order2.push(`${p}:${r}=${g.server}`);
  if (p === 10 && r === 10) deuceFlag = g.events.some((e) => e.kind === 'serveReady' && e.deuce);
}
ok(order2.join(' ') === '0:0=p 1:0=p 1:1=r 2:1=r 3:1=p 4:1=p 10:10=p 11:10=r 11:11=p 12:11=r', '每 2 分換發、10:10 後每分換發');
ok(deuceFlag, '10:10 時通知 Deuce');

g = pvp({ first: 'r' }); g.events.length = 0;
g.pad2.tx = 0.5; g.pad2.tz = -2.0; g.pad.tx = 1.0; g.pad.tz = 2.0;
step(g, 1.5);
const waited = g.phase === 'serveWait' && g.server === 'r';
ok(Math.abs(g.ball.x - (g.pad2.x + 0.13)) < 0.02 && g.ball.z < -1.4, '等發球時球拿在玩家 2 的球拍旁邊');
E.serve(g, 'p'); const p1Ignored = g.phase === 'serveWait';
E.serve(g, 'r');
ok(waited && p1Ignored && g.phase === 'toss', '玩家 2 發球要自己按，不會自動發；玩家 1 按發球沒有用');
const bounces2 = [];
for (let i = 0; i < 600 && bounces2.length < 2; i++) {
  E.update(g, 1 / 120);
  for (const e of g.events) if (e.kind === 'bounce') bounces2.push(e);
  g.events.length = 0;
}
const sides2 = bounces2.map((e) => (e.z > 0 ? '玩家 1' : '玩家 2')).join('→');
ok(sides2 === '玩家 2→玩家 1', `玩家 2 發球先彈自己這邊再過網（${sides2}）`);
ok(bounces2[1] && bounces2[1].x > 0.2 && bounces2[1].z > 0.9, '玩家 2 發球的落點跟著他的球拍：拍子往 +x、站得遠 → 發到 +x 的深處');

// 玩家 1 打過去，玩家 2 站在球的路線上接，玩家 1 不回擊
g = pvp({ rng: mulberry32(5) }); g.events.length = 0;
rallyFrom(g, 'p', { x: 0, y: 0.25, z: 1.5 }, { x: 0.2, z: -0.9 }, 0.5);
const path = Object.assign({}, g.ball), pev = [];
let bounced = false, meetX = null;
for (let t = 0; t < 3 && meetX === null; t += 1 / 480) {
  pev.length = 0; E.stepBall(path, 1 / 480, pev);
  if (pev.some((e) => e.type === 'bounce')) bounced = true;
  if (bounced && path.z <= -1.6) meetX = path.x;
}
Object.assign(g.pad2, { x: meetX, tx: meetX, z: -1.6, tz: -1.6 });
const ev2 = runUntilPoint(g, 5), hitR = ev2.find((e) => e.kind === 'hit' && e.who === 'r'), pt2 = pointOf(ev2);
ok(hitR, '玩家 2 站對位置就接得到球');
ok(pt2 && pt2.winner === 'r' && pt2.reason === 'miss' && g.score.r === 1, '玩家 2 打回去、玩家 1 沒接 → 玩家 2 得分（漏接）');

// 玩家 2 的擊球是玩家 1 的鏡像：他的「往前」是 +z，他的「右手邊」是 -x
function p2Shot(vx, vz) {
  const x = pvp({ rng: mulberry32(3) }); x.events.length = 0;
  x.phase = 'rally'; x.hitter = 'p'; x.recvBounced = true;
  Object.assign(x.ball, { x: 0, y: 0.35, z: -1.6, vx: 0, vy: 0, vz: -3, spin: 'none' });
  Object.assign(x.pad2, { x: 0, z: -1.6, vx, vz });
  E._test.playerHit(x, 'r');
  return { type: x.events.find((e) => e.kind === 'hit').type, hitter: x.hitter, land: E.predictBounce(x, 'p') };
}
const smash2 = p2Shot(0, 2.0), drop2 = p2Shot(0, -1.5), right2 = p2Shot(-1.5, 0), left2 = p2Shot(1.5, 0);
ok(smash2.type === 'smash' && smash2.hitter === 'r' && smash2.land && smash2.land.z > 0.8, '玩家 2 往網子推（+z）→ 扣殺，打到玩家 1 那邊深處');
ok(drop2.type === 'drop' && drop2.land && drop2.land.z > 0 && drop2.land.z < 0.6, '玩家 2 往後拉（-z）→ 放短，落在玩家 1 那邊網前');
ok(right2.land && left2.land && right2.land.x < -0.15 && left2.land.x > 0.15, '玩家 2 擊球時往自己右手邊（-x）移 → 球往他的右手邊飛');

let lets2 = 0, kept2 = true;
for (let k = 0; k < 400 && lets2 < 3; k++) {
  g = pvp({ first: 'r' }); g.pad.tx = 1.0; g.pad.tz = 2.0; g.events.length = 0;
  E.serve(g, 'r');
  if (runUntilPoint(g, 5).some((e) => e.kind === 'let')) {
    lets2++;
    step(g, 2);
    if (g.score.p || g.score.r || g.phase !== 'serveWait' || g.server !== 'r') kept2 = false;
  }
}
ok(lets2 > 0 && kept2, '玩家 2 發球擦網落在對面 → 重發，比分不變，還是玩家 2 發');

const finish2 = (p, r, winner) => { const x = pvp(); x.score.p = p; x.score.r = r; x.phase = 'rally'; x.hitter = 'r'; E._test.point(x, winner, 'miss'); return x.winner; };
ok(finish2(9, 10, 'r') === 'r', '玩家 2 拿到 11:9 獲勝');
ok(finish2(10, 10, 'r') === null && finish2(11, 11, 'p') === null, 'Deuce 之後 10:11、12:11 都還沒結束');
ok(finish2(11, 12, 'r') === 'r' && finish2(12, 11, 'p') === 'p', 'Deuce 之後領先 2 分才獲勝（11:13、13:11）');

console.log(fails ? `\n${fails} 項失敗` : '\n全部通過');
process.exit(fails ? 1 : 0);
