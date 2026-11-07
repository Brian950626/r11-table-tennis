// 自動對打測試：讓一個「測試機器人」代替玩家，在三種難度各打 20 局。
// 檢查：每局都能正常打完、R-11 發球不會犯規、難度越高 R-11 拿的分越多、打旋轉球也越多。
// 執行：node selfplay.test.js
const E = require('./engine.js');

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 預測球彈過玩家這邊後，飛到 z = zp 時的左右位置
function predictCross(g, zp) {
  const s = Object.assign({}, g.ball), ev = [];
  let bounced = false;
  for (let t = 0; t < 3; t += 1 / 480) {
    ev.length = 0; E.stepBall(s, 1 / 480, ev);
    for (const e of ev) {
      if (e.type === 'bounce' && e.side === 'p') { if (bounced) return null; bounced = true; }
      if (e.type === 'floor' || e.type === 'far') return null;
    }
    if (bounced && s.z >= zp) return s.x;
  }
  return null;
}

function playGame(diff, seed) {
  const rnd = mulberry32(seed);
  const g = E.createGame(diff, { rng: mulberry32(seed + 1) });
  const dt = 1 / 60, st = { robotServeFaults: 0, robotHits: 0, robotSpin: 0 };
  let waitT = 0, plan = null, style = 'drive';
  for (let frame = 0; frame < 60 * 60 * 40 && g.phase !== 'over'; frame++) {
    const p = g.pad;
    if (g.phase === 'serveWait' && g.server === 'p') {
      p.tx = (rnd() - 0.5) * 1.2; p.tz = 1.4 + rnd() * 0.6;
      waitT += dt; if (waitT > 0.5) { E.serve(g); waitT = 0; }
    }
    if ((g.phase === 'serve' || g.phase === 'rally') && g.hitter === 'r') {
      if (!plan) {
        let zp = 1.6, x = predictCross(g, zp);
        for (const z of [1.3, 1.0]) { if (x !== null) break; zp = z; x = predictCross(g, z); }
        const r = rnd();
        style = r < 0.15 ? 'smash' : r < 0.22 ? 'drop' : 'drive';
        plan = { x: x === null ? p.x : x + (rnd() - 0.5) * 0.18, z: zp };
      }
      p.tx = plan.x + (rnd() - 0.5) * 0.3;
      const dz = plan.z - g.ball.z;
      p.tz = style === 'smash' && dz < 0.35 && g.ball.z > 0 ? plan.z - 0.6 : style === 'drop' && dz < 0.35 && g.ball.z > 0 ? plan.z + 0.6 : plan.z;
    } else plan = null;
    E.update(g, dt);
    for (const e of g.events) if (e.kind === 'point' && e.reason === 'serveFault' && e.hitter === 'r') st.robotServeFaults++;
    for (const e of g.events) if (e.kind === 'hit' && e.who === 'r' && e.type !== 'serve') { st.robotHits++; if (Math.abs(e.spinTop || 0) + Math.abs(e.spinSide || 0) > 0.2) st.robotSpin++; }
    g.events.length = 0;
  }
  return { g, st };
}

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  通過  ' : '  失敗  ') + msg); if (!cond) fails++; };
const robotPts = {}, spinRate = {};
for (const diff of ['easy', 'normal', 'hard']) {
  let unfinished = 0, faults = 0, pp = 0, pr = 0, longest = 0, rHits = 0, rSpin = 0;
  for (let s = 1; s <= 20; s++) {
    const { g, st } = playGame(diff, s * 131);
    if (!g.winner) unfinished++;
    faults += st.robotServeFaults; pp += g.score.p; pr += g.score.r; longest = Math.max(longest, g.longest);
    rHits += st.robotHits; rSpin += st.robotSpin;
  }
  robotPts[diff] = pr; spinRate[diff] = rSpin / Math.max(1, rHits);
  console.log(`${E.DIFFS[diff].name}：測試機器人 ${pp} 分、R-11 ${pr} 分，最長回合 ${longest} 拍，R-11 打旋轉球 ${Math.round(spinRate[diff] * 100)}%`);
  ok(unfinished === 0, `${E.DIFFS[diff].name} 20 局都正常打完`);
  ok(faults === 0, `${E.DIFFS[diff].name} R-11 發球沒有犯規`);
}
ok(robotPts.easy < robotPts.normal && robotPts.normal < robotPts.hard, '難度越高，R-11 拿的分越多');
ok(spinRate.easy < spinRate.normal && spinRate.normal < spinRate.hard, '難度越高，R-11 越常打旋轉球');
console.log(fails ? `\n${fails} 項失敗` : '\n全部通過');
process.exit(fails ? 1 : 0);
