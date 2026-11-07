// 自動對打測試：讓一個「測試機器人」代替玩家，每個造型的打法都在三種難度各打 20 局。
// 檢查：每局都能正常打完、R-11 發球不會犯規、疊上打法個性後難度越高 R-11 拿的分仍然越多。
// 執行：node selfplay.test.js
const E = require('./engine.js');
const SK = require('./skins.js');

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

function playGame(diff, seed, robotStyle) {
  const rnd = mulberry32(seed);
  const g = E.createGame(diff, { rng: mulberry32(seed + 1), style: robotStyle });
  const dt = 1 / 60, st = { robotServeFaults: 0 };
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
    g.events.length = 0;
  }
  return { g, st };
}

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  通過  ' : '  失敗  ') + msg); if (!cond) fails++; };
for (const skin of SK.list) {
  const style = E.STYLES[skin.style];
  console.log(`${skin.title}（打法：${style ? style.name : skin.style}）`);
  if (!style) { ok(false, `${skin.title} 的打法 ${skin.style} 不在 engine.js 的 STYLES 裡`); continue; }
  const robotPts = {};
  for (const diff of ['easy', 'normal', 'hard']) {
    let unfinished = 0, faults = 0, pp = 0, pr = 0, longest = 0;
    for (let s = 1; s <= 20; s++) {
      const { g, st } = playGame(diff, s * 131, skin.style);
      if (!g.winner) unfinished++;
      faults += st.robotServeFaults; pp += g.score.p; pr += g.score.r; longest = Math.max(longest, g.longest);
    }
    robotPts[diff] = pr;
    const nm = E.DIFFS[diff].name;
    console.log(`  ${nm}：測試機器人 ${pp} 分、R-11 ${pr} 分，最長回合 ${longest} 拍`);
    ok(unfinished === 0, `${nm} 20 局都正常打完`);
    ok(faults === 0, `${nm} R-11 發球沒有犯規`);
  }
  ok(robotPts.easy < robotPts.normal && robotPts.normal < robotPts.hard, `${skin.title}：難度越高，R-11 拿的分越多`);
}
console.log(fails ? `\n${fails} 項失敗` : '\n全部通過');
process.exit(fails ? 1 : 0);
