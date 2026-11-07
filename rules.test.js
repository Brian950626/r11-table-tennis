// 規則測試：確認出界、掛網、漏接、發球順序、Deuce、擦網重發都判定正確。
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

console.log('比賽結束條件');
const finish = (p, r, winner) => { const x = E.createGame('normal'); x.score.p = p; x.score.r = r; x.phase = 'rally'; x.hitter = 'p'; E._test.point(x, winner, 'miss'); return x.winner; };
ok(finish(10, 9, 'p') === 'p', '11:9 結束');
ok(finish(10, 10, 'p') === null, '11:10 還沒結束（要領先 2 分）');
ok(finish(11, 10, 'p') === 'p', '12:10 結束');

console.log(fails ? `\n${fails} 項失敗` : '\n全部通過');
process.exit(fails ? 1 : 0);
