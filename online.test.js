// 連線對戰測試：快照轉成加入者的視角、事件和輸入的轉換，以及用 JSON 模擬網路打完一整場。
// 不會真的連網路（連線在 index.html 用 PeerJS）。執行：node online.test.js
const E = require('./engine.js');
const O = require('./online.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  通過  ' : '  失敗  ') + msg); if (!cond) fails++; };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-3);
const wire = (o) => JSON.parse(JSON.stringify(o)); // 模擬網路：只有 JSON 傳得過去

console.log('房號');
ok(O.validCode('0427') && O.validCode(' 1234 ') && !O.validCode('123') && !O.validCode('12a4') && !O.validCode(''), '房號是 4 位數字');
let codesOk = true;
for (let i = 0; i < 200; i++) { const c = O.newCode(); if (!O.validCode(c)) codesOk = false; }
ok(codesOk && O.roomId('1234') === 'r11tt-1234', '產生的房號都合法，連線 ID 有固定前綴');

console.log('視角轉換');
const host = E.createGame('normal', { mode: 'pvp', bestOf: 3 });
host.pad.x = 0.3; host.pad.z = 1.5; host.pad2.x = -0.4; host.pad2.z = -1.7; host.pad2.y = 0.31; host.pad2.swing = 0.5;
Object.assign(host.ball, { x: 0.25, y: 0.3, z: -0.8, vx: 1, vy: 0.5, vz: 4, spinTop: 0.6, spinSide: 0.4 });
host.score.p = 7; host.score.r = 4; host.phase = 'rally'; host.hitter = 'r'; host.server = 'p';
host.match.games.p = 1; host.match.history.push({ p: 11, r: 8 }); host.match.gameNo = 2;
host.sweet = { x: 0.2, y: 0.3, z: 1.7 };
const view = E.createGame('normal', { mode: 'pvp' });
const ev0 = O.applySnapshot(view, wire(O.snapshot(host, [], false)));
ok(Array.isArray(ev0) && ev0.length === 0, '快照套用成功');
ok(near(view.ball.x, -0.25) && near(view.ball.z, 0.8) && near(view.ball.vz, -4) && near(view.ball.vy, 0.5), '球的左右、前後翻過來，高度不變');
ok(near(view.ball.spinTop, 0.6) && near(view.ball.spinSide, -0.4), '上旋不變；側旋在世界座標所以變號（從另一端看還是往同一邊彎）');
ok(view.score.p === 4 && view.score.r === 7 && view.server === 'r' && view.hitter === 'p', '比分、發球方、擊球方都換成加入者的視角（加入者是 p）');
ok(view.match.games.p === 0 && view.match.games.r === 1 && view.match.history[0].p === 8 && view.match.gameNo === 2 && view.match.bestOf === 3, '局數和每局比分也對調');
ok(near(view.pad2.x, -0.3) && near(view.pad2.z, -1.5) && near(view.robot.x, -0.3) && near(view.robot.z, -1.5), '房主的球拍變成遠端的對手');
ok(near(view.pad.y, 0.31) && near(view.pad.swing, 0.5), '自己的球拍只拿高度和揮拍（位置由自己的手指決定）');
ok(near(view.sweet.z, -1.7) && near(view.sweet.x, -0.2), '最佳擊球點也翻過來');
// 同一顆球在兩邊飛：落點也互為鏡像
const hb = Object.assign({}, host.ball), vb = Object.assign({}, view.ball);
for (let i = 0; i < 200; i++) { E.stepBall(hb, 1 / 500, []); E.stepBall(vb, 1 / 500, []); }
ok(near(hb.x, -vb.x, 1e-6) && near(hb.z, -vb.z, 1e-6) && near(hb.y, vb.y, 1e-6), '球在兩邊用同樣的物理飛 0.4 秒，位置還是互為鏡像（側旋的彎法一致）');

console.log('事件');
const evs = O.applySnapshot(view, wire(O.snapshot(host, [
  { kind: 'hit', who: 'p', type: 'loop', x: 0.3, speed: 6, spinTop: 0.7, spinSide: 0.2, timing: 'perfect', perfect: true },
  { kind: 'point', winner: 'r', reason: 'out', hitter: 'p', rally: 5, shot: 'loop', over: false, gameOver: false, games: { p: 1, r: 0 }, gameNo: 2 },
  { kind: 'serveReady', server: 'r', deuce: false, gamePoint: 'p', initial: false },
  { kind: 'bounce', x: 0.1, z: -0.5, speed: 5 },
], false)));
ok(evs.length === 4 && evs[0].who === 'r' && evs[0].x === -0.3 && evs[0].spinSide === -0.2 && evs[0].perfect === true, '房主的擊球在加入者那邊是對手（r）打的，位置翻過來');
ok(evs[1].winner === 'p' && evs[1].hitter === 'r' && evs[1].games.p === 0 && evs[1].games.r === 1, '得分事件：贏的人、局數都對調');
ok(evs[2].server === 'p' && evs[2].gamePoint === 'r' && evs[3].z === 0.5, '發球方、賽末點、落台位置都轉好');
const junk = O.applySnapshot(view, wire(Object.assign(O.snapshot(host, [], false), { ev: [
  { kind: 'hit', who: 'x', type: '<img src=x>', x: 'a', speed: 1e999 }, { kind: 'eval' }, null, 5, { kind: 'point', winner: 'p', games: 'zz' },
] })));
ok(junk.length === 2 && junk[0].who === undefined && junk[0].type === undefined && junk[0].x === undefined && junk[1].games === undefined, '不認得的事件、奇怪的欄位都丟掉');
ok(O.applySnapshot(view, { t: 's', v: 99, b: [0, 0, 0, 0, 0, 0, 0, 0] }) === null && O.applySnapshot(view, { t: 's', v: O.VERSION, b: [1] }) === null, '版本不同或格式不對的快照不套用');
const bad = O.snapshot(host, [], false); bad.b = [NaN, 'x', null, 1, 2, 3, 9, -9]; bad.ph = 'hack'; bad.sv = 'q';
O.applySnapshot(view, wire(bad));
ok(view.ball.x === -0 && view.ball.y === 0 && view.ball.spinTop === 1 && view.ball.spinSide === 1 && view.phase === 'rally' && view.server === 'r', '奇怪的數字當 0、旋轉限制在 ±1，不認得的階段和發球方維持原樣');

console.log('輸入');
const msg = wire(O.inputMsg(0.5, 1.7));
const inp = O.readInput(msg, E.PAD);
ok(near(inp.tx, -0.5) && near(inp.tz, -1.7), '加入者在近端往右 0.5、離網 1.7 → 房主的 pad2 在 x -0.5、z -1.7');
const far = O.readInput({ t: 'i', x: 99, z: 99 }, E.PAD);
ok(far.tx === E.PAD.xMax && far.tz === -E.PAD.zMin && O.readInput({ t: 'i', x: 'a', z: 1 }, E.PAD) === null, '超出範圍的位置會被限制；不是數字就不收');

console.log('模擬連線打完一場');
// 房主跑引擎；加入者只靠快照畫畫面，球拍往自己畫面上的最佳擊球點站。中間的網路只傳 JSON。
function playMatch(seed, delayFrames) {
  let s = seed; E.setRng(() => (s = (s * 16807) % 2147483647) / 2147483647);
  const g = E.createGame('normal', { mode: 'pvp', bestOf: 3 });
  const v = E.createGame('normal', { mode: 'pvp' });
  const toJoiner = [], toHost = [];
  const seen = { p: 0, r: 0 }, hostPts = { p: 0, r: 0 };
  let joinerServes = 0, frames = 0, mismatch = 0, gameOverSeen = null, extraOk = true;
  // 兩邊都會站歪：每顆來球隨機偏一點，才會有人失分
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let offH = 0, offJ = 0, lastH = null, lastJ = null;
  const dt = 1 / 60;
  for (; frames < 60 * 60 * 25 && g.phase !== 'over'; frames++) {
    // 房主：自己的球拍跟著最佳擊球點，該發球就發
    if (g.hitter !== lastH) { lastH = g.hitter; offH = (rnd() - 0.5) * 0.5; }
    if (g.sweet && g.hitter === 'r') { g.pad.tx = g.sweet.x + offH; g.pad.tz = g.sweet.z; }
    if (g.phase === 'serveWait' && g.server === 'p' && frames % 20 === 0) E.serve(g, 'p');
    // 房主收到加入者的訊息（延遲 delayFrames 幀）
    while (toHost.length && toHost[0].at <= frames) {
      const m = toHost.shift().m;
      const inp = O.readInput(m, E.PAD);
      if (inp) { g.pad2.tx = inp.tx; g.pad2.tz = inp.tz; }
      if (m.t === 'serve') E.serve(g, 'r');
    }
    E.update(g, dt);
    for (const e of g.events) if (e.kind === 'point') hostPts[e.winner]++;
    toJoiner.push({ at: frames + delayFrames, m: wire(O.snapshot(g, g.events, false)) });
    g.events.length = 0;
    // 加入者：套快照、自己推球、決定球拍往哪站
    let got = false;
    while (toJoiner.length && toJoiner[0].at <= frames) {
      const evs = O.applySnapshot(v, toJoiner.shift().m);
      got = true;
      for (const e of evs) {
        if (e.kind === 'point') seen[e.winner]++;
        if (e.kind === 'gameover') gameOverSeen = e.winner;
      }
    }
    if (!got) { const before = v.ball.z; O.extrapolate(E, v, dt); if (!isFinite(v.ball.z) || !isFinite(before)) extraOk = false; }
    let tx = v.pad.x, tz = v.pad.z;
    if (v.hitter !== lastJ) { lastJ = v.hitter; offJ = (rnd() - 0.5) * 0.5; }
    if (v.sweet && v.hitter === 'r') { tx = v.sweet.x + offJ; tz = v.sweet.z; }
    E.movePad(v.pad, dt, E.PAD.zMin, E.PAD.zMax);
    v.pad.tx = tx; v.pad.tz = tz;
    toHost.push({ at: frames + delayFrames, m: wire(O.inputMsg(tx, tz)) });
    if (v.phase === 'serveWait' && v.server === 'p' && frames % 20 === 0) { toHost.push({ at: frames + delayFrames, m: { t: 'serve' } }); joinerServes++; }
    if (v.score.p !== g.score.r && toJoiner.length === 0 && delayFrames === 0) mismatch++;
  }
  // 把還在路上的快照送完
  while (toJoiner.length) for (const e of O.applySnapshot(v, toJoiner.shift().m)) { if (e.kind === 'point') seen[e.winner]++; if (e.kind === 'gameover') gameOverSeen = e.winner; }
  E.setRng(Math.random);
  return { g, v, seen, hostPts, joinerServes, frames, mismatch, gameOverSeen, extraOk };
}
const r0 = playMatch(7, 0), r3 = playMatch(11, 3);
ok(r0.g.phase === 'over' && r0.v.phase === 'over', `沒有延遲：三戰兩勝打完（房主局數 ${r0.g.match.games.p}:${r0.g.match.games.r}，共 ${r0.hostPts.p + r0.hostPts.r} 分）`);
ok(r0.seen.p === r0.hostPts.r && r0.seen.r === r0.hostPts.p, `加入者收到的每一分都對得上（加入者看到 ${r0.seen.p}:${r0.seen.r}）`);
ok(r0.v.match.games.p === r0.g.match.games.r && r0.v.match.games.r === r0.g.match.games.p && r0.gameOverSeen === O.other(r0.g.winner) && r0.v.winner === O.other(r0.g.winner), '最後的局數和贏家在加入者那邊是對調的');
ok(r0.joinerServes > 0 && r0.hostPts.r > 0, '加入者按發球，房主那邊真的由加入者發球；加入者也拿得到分');
ok(r3.g.phase === 'over' && r3.seen.p === r3.hostPts.r && r3.seen.r === r3.hostPts.p && r3.extraOk, `延遲 3 幀（約 50 毫秒）也能打完，分數一致（加入者看到 ${r3.seen.p}:${r3.seen.r}）`);
const size = JSON.stringify(O.snapshot(r0.g, [{ kind: 'hit', who: 'p', type: 'loop', x: 0.3, speed: 6, spinTop: 0.7, spinSide: 0.2, timing: 'perfect', perfect: true }], false)).length;
ok(size < 700, `一張快照約 ${size} 字元（每秒 60 張約 ${Math.round((size * 60) / 1024)} KB）`);

console.log(fails ? `\n${fails} 項失敗` : '\n全部通過');
process.exit(fails ? 1 : 0);
