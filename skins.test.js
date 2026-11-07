// 造型測試：用一個假的畫布把每個造型的每種表情都畫一遍，確認
//   1. 每個造型的 id 不重複，名稱、說明、手臂顏色都有填
//   2. 畫的時候不會出錯
//   3. 沒有畫到頭頂上方太高的地方（會被計分板擋到）
//   4. save() 和 restore() 有成對出現
// 執行：node skins.test.js
const SK = require('./skins.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  通過  ' : '  失敗  ') + msg); if (!cond) fails++; };
const TOP_LIMIT = -104; // 公分；頭頂不要畫到比這更高

// 假的 Canvas 2D 畫布：不真的畫圖，只記錄畫到的最高位置
function mockCanvas() {
  let m = [1, 0, 0, 1, 0, 0], minY = Infinity, depth = 0, bad = null;
  const stack = [];
  const T = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const mul = (n) => {
    const [a, b, c, d, e, f] = m;
    m = [a * n[0] + c * n[1], b * n[0] + d * n[1], a * n[2] + c * n[3], b * n[2] + d * n[3], a * n[4] + c * n[5] + e, b * n[4] + d * n[5] + f];
  };
  const k = () => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  const pt = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) { bad = bad || `座標不是數字 (${x}, ${y})`; return; }
    const p = T(x, y); if (p[1] < minY) minY = p[1];
  };
  const round = (x, y, r) => { if (!Number.isFinite(r) || r < 0) { bad = bad || `半徑不對 (${r})`; return; } const p = T(x, y); if (p[1] - r * k() < minY) minY = p[1] - r * k(); };
  const grad = { addColorStop() {} };
  const ctx = {
    save() { stack.push(m.slice()); depth++; }, restore() { m = stack.pop() || m; depth--; },
    translate(x, y) { mul([1, 0, 0, 1, x, y]); }, scale(x, y) { mul([x, 0, 0, y, 0, 0]); },
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); mul([c, s, -s, c, 0, 0]); },
    setTransform(a, b, c, d, e, f) { m = [a, b, c, d, e, f]; }, transform(a, b, c, d, e, f) { mul([a, b, c, d, e, f]); },
    beginPath() {}, closePath() {}, fill() {}, stroke() {}, clip() {}, setLineDash() {},
    moveTo: pt, lineTo: pt,
    quadraticCurveTo(cx, cy, x, y) { pt(cx, cy); pt(x, y); },
    bezierCurveTo(a, b, c, d, x, y) { pt(a, b); pt(c, d); pt(x, y); },
    arcTo(x1, y1, x2, y2) { pt(x1, y1); pt(x2, y2); },
    arc(x, y, r) { round(x, y, r); },
    ellipse(x, y, rx, ry) { round(x, y, Math.max(rx, ry)); },
    rect(x, y, w, h) { pt(x, y); pt(x + w, y + h); }, fillRect(x, y, w, h) { pt(x, y); pt(x + w, y + h); },
    fillText(s, x, y) { pt(x, y); }, measureText() { return { width: 10 }; },
    createLinearGradient() { return grad; }, createRadialGradient() { return grad; },
  };
  return { ctx, result: () => ({ minY, depth, bad }) };
}

console.log('造型清單');
const ids = SK.list.map((s) => s.id);
ok(ids.length > 0 && new Set(ids).size === ids.length, `id 沒有重複（${ids.join('、')}）`);
for (const s of SK.list) {
  const filled = s.name && s.title && s.desc && s.arm && typeof s.arm.color === 'string' && typeof s.torso === 'function' && typeof s.head === 'function';
  ok(!!filled, `${s.title || s.id}：名稱、說明、手臂顏色、torso、head 都有`);
}

console.log('每種表情都畫一遍');
const states = [
  { mood: 'idle' }, { mood: 'idle', blink: true }, { mood: 'idle', focus: true, look: 3.5 }, { mood: 'idle', focus: true, look: -3.5 },
  { mood: 'happy' }, { mood: 'sad' }, { mood: 'idle', serving: true, freeHand: [20, -30] },
];
for (const s of SK.list) {
  let worst = Infinity, error = null, unbalanced = false, bad = null;
  for (const extra of states) for (const t of [0, 333, 777, 1500, 4200]) for (const bob of [0, 0.8]) for (const reduced of [false, true]) for (const bust of [false, true]) {
    const mc = mockCanvas();
    const st = Object.assign({ t, bob, mood: 'idle', focus: false, blink: false, look: 0, serving: false, freeSide: -1, freeHand: null, reduced, k: 2 }, extra);
    try { SK.draw(mc.ctx, s, st, { bust }); } catch (e) { error = error || e.message; continue; }
    const r = mc.result();
    worst = Math.min(worst, r.minY); if (r.depth !== 0) unbalanced = true; bad = bad || r.bad;
  }
  ok(!error, `${s.title}：畫的時候沒有出錯${error ? '（' + error + '）' : ''}`);
  ok(!bad, `${s.title}：座標和半徑都是正常數字${bad ? '（' + bad + '）' : ''}`);
  ok(worst >= TOP_LIMIT, `${s.title}：最高畫到 y = ${worst.toFixed(1)} 公分（不能高過 ${TOP_LIMIT}）`);
  ok(!unbalanced, `${s.title}：save() 和 restore() 成對`);
}
console.log(fails ? `\n${fails} 項失敗` : '\n全部通過');
process.exit(fails ? 1 : 0);
