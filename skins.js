// R-11 對手造型（皮膚）：動漫風格的原創角色
// 每個造型都用 Canvas 畫在「本地座標」上：單位是公分、y 朝下，
// 原點在角色中心線、桌面高度（世界座標 y = 0）。
// 參考位置：頭中心約 y = -66（下巴 -48.5、頭頂 -84），肩膀約 y = -40，胸口約 y = -25，地面 y = +76。
// 頭髮最高畫到 y = -95 左右，再高會被畫面上方的計分板擋到（不能高過 -104）。
//
// 畫風：校園戀愛喜劇動畫常見的一般特徵——接近高中生的頭身、下巴偏尖的臉；
// 細長的眼睛，虹膜有漸層、好幾個高光、細睫毛；一束一束的髮絲加上光澤帶；
// 柔和漸層上色、淡淡的臉紅、明亮的粉彩色；表情誇張（閉眼大笑、慌張冒汗）。
// 角色都是原創，不要畫現有作品的角色、髮型組合、制服或標誌。
//
// 新增造型：照下面任何一個 person({...}) 抄一份，改 id、名稱、顏色、頭髮和衣服，
// 再把它加進最下面的 LIST。style 是打法個性，要對應 engine.js 的 STYLES，
// desc 要寫出打法，例如「打法「愛扣殺」：……」。st 參數裡有表情狀態：
//   st.mood   'idle' 平常、'happy' 剛得分、'sad' 剛失分
//   st.focus  球正朝角色飛過來（專注）
//   st.blink  正在眨眼
//   st.look   眼睛跟著球左右看的偏移（公分，約 -3.5 ~ 3.5）
//   st.serving 正在發球（st.freeHand 是拿球那隻手的位置）
//   st.t      時間（毫秒），做動畫用；st.reduced 為 true 時不要做晃動動畫
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;

  // ---------- 畫圖小工具 ----------
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
  function fill(c, style) { c.fillStyle = style; c.fill(); }
  function line(c, style, w) { c.strokeStyle = style; c.lineWidth = w; c.stroke(); }
  function vg(c, y0, y1, a, b) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function hg(c, x0, x1, a, b) { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  // 三段漸層：亮 → 底色 → 暗
  function g3(c, x0, y0, x1, y1, a, b, d) { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, d); return g; }
  function text(c, str, x, y, size, weight, color) {
    c.save(); c.translate(x, y); c.scale(size / 20, size / 20);
    c.font = `${weight} 20px "Saira Condensed", "Arial Narrow", sans-serif`;
    c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(str, 0, 0);
    c.restore();
  }
  // 四角閃光
  function star(c, x, y, r) {
    c.beginPath(); c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.closePath();
  }
  // 五角星
  function star5(c, x, y, R, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    c.closePath();
  }
  function heart(c, x, y, s) {
    c.beginPath(); c.moveTo(x, y + 2.6 * s);
    c.bezierCurveTo(x - 4.2 * s, y - 0.2 * s, x - 2.4 * s, y - 3.4 * s, x, y - 1.3 * s);
    c.bezierCurveTo(x + 2.4 * s, y - 3.4 * s, x + 4.2 * s, y - 0.2 * s, x, y + 2.6 * s); c.closePath();
  }
  function sweat(c, x, y, s) {
    c.beginPath(); c.moveTo(x, y - 4 * s);
    c.quadraticCurveTo(x + 3.2 * s, y + 0.6 * s, x, y + 1.8 * s);
    c.quadraticCurveTo(x - 3.2 * s, y + 0.6 * s, x, y - 4 * s); c.closePath();
    fill(c, vg(c, y - 4 * s, y + 1.8 * s, 'rgba(220,245,255,0.95)', 'rgba(120,195,250,0.95)')); line(c, '#ffffff', 0.4);
  }
  function bow(c, x, y, s, col, edge) {
    for (const e of [-1, 1]) {
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + e * 3.6 * s, y - 3.4 * s, x + e * 4.6 * s, y - 0.4 * s);
      c.quadraticCurveTo(x + e * 3.6 * s, y + 2.8 * s, x, y); c.closePath(); fill(c, col); line(c, edge, 0.4);
      poly(c, [[x, y], [x + e * 2.2 * s, y + 4.6 * s], [x + e * 0.4 * s, y + 4 * s]]); fill(c, col); line(c, edge, 0.35);
    }
    ell(c, x, y, 1.1 * s, 1.1 * s); fill(c, edge);
  }
  const wiggle = (st, period, amp, phase) => (st.reduced ? 0 : Math.sin(st.t / period + (phase || 0)) * amp);

  // ---------- 角色共用的畫法 ----------
  const FAIR = { base: '#fff4ee', base2: '#ffe2d6', shade: 'rgba(232,150,132,0.42)', shade0: 'rgba(232,150,132,0)', line: '#d39a8c', lip: '#b8616c', mouth: '#9c3c4c' };
  const TAN = { base: '#feeadc', base2: '#f6cfb8', shade: 'rgba(210,130,100,0.42)', shade0: 'rgba(210,130,100,0)', line: '#c28a72', lip: '#a85a50', mouth: '#93393f' };

  // 臉：下巴偏尖的瓜子臉
  function facePath(c) {
    c.beginPath(); c.moveTo(-12.4, -76);
    c.bezierCurveTo(-13, -70, -13, -64, -12.4, -60.4); c.bezierCurveTo(-11.6, -55.6, -6.4, -50.6, -1.4, -48.8);
    c.quadraticCurveTo(0, -48.3, 1.4, -48.8); c.bezierCurveTo(6.4, -50.6, 11.6, -55.6, 12.4, -60.4);
    c.bezierCurveTo(13, -64, 13, -70, 12.4, -76); c.bezierCurveTo(12, -86.6, -12, -86.6, -12.4, -76);
    c.closePath();
  }
  // 一束頭髮：從髮根 (x0, y0) 長到髮尖 (x1, y1)，寬 w，中間往旁邊彎 bend
  function strandPath(c, s) {
    const [x0, y0, x1, y1, w, bend] = s;
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = (-dy / L) * w * 0.7, ny = (dx / L) * w * 0.7;
    const mx = (x0 + x1) / 2 + (bend || 0), my = (y0 + y1) / 2;
    c.moveTo(x0 + nx, y0 + ny);
    c.quadraticCurveTo(mx + nx * 0.8, my + ny * 0.8, x1, y1);
    c.quadraticCurveTo(mx - nx * 0.8, my - ny * 0.8, x0 - nx, y0 - ny);
    c.closePath();
  }
  // 一束一束畫，每束有漸層、描邊，中間加一條髮絲線
  function drawStrands(c, list, H, y0, y1) {
    const g = g3(c, 0, y0, 0, y1, H.light, H.base, H.shade);
    for (const s of list) {
      const [x0, sy0, x1, sy1, , bend] = s;
      c.beginPath(); strandPath(c, s); fill(c, g); c.globalAlpha = 0.75; line(c, H.line, 0.32); c.globalAlpha = 1;
      c.beginPath(); c.moveTo(x0 + (x1 - x0) * 0.12, sy0 + (sy1 - sy0) * 0.12);
      c.quadraticCurveTo((x0 + x1) / 2 + (bend || 0) * 0.9, (sy0 + sy1) / 2, x0 + (x1 - x0) * 0.78, sy0 + (sy1 - sy0) * 0.78);
      line(c, H.strand || 'rgba(60,30,40,0.14)', 0.3);
    }
  }
  // 頭頂的頭髮（瀏海後面那一片）
  function capPath(c, C) {
    c.beginPath(); c.moveTo(-C.w, C.yb);
    c.bezierCurveTo(-C.w - 1.2, C.yb - 18, -10.5, C.top, 0, C.top);
    c.bezierCurveTo(10.5, C.top, C.w + 1.2, C.yb - 18, C.w, C.yb);
    c.bezierCurveTo(C.w * 0.7, -76, -C.w * 0.7, -76, -C.w, C.yb); c.closePath();
  }
  // 頭髮的光澤帶：沿著頭頂的弧，下緣一長一短
  function gloss(c, H) {
    const cy = H.glossY || -77, rx = 10.6, ry = 6.2, n = 11, a0 = Math.PI * 1.14, a1 = Math.PI * 1.86;
    c.save(); c.lineCap = 'round'; c.strokeStyle = H.gloss;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n, x = Math.cos(a) * rx, y = cy + Math.sin(a) * ry, d = i % 2 ? 2.6 : 1.5;
      c.lineWidth = i % 2 ? 1.1 : 0.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x * 1.04, y + d); c.stroke();
    }
    c.restore();
  }
  // 身體後面的長頭髮
  function backHair(c, path, H) { path(); fill(c, vg(c, -90, -40, H.shade, H.back)); path(); line(c, H.line, 0.4); }

  // 細長的眼睛：平常、眨眼、專注（眼皮壓低、跟著球看）、開心（閉眼大笑）、難過（慌張發抖）、發球（往上看球）
  function eye(c, st, cx, cy, e, E) {
    const m = st.mood, w = E.w || 4.2, h = E.h || 3.5, hb = E.hb || 2.2, lash = E.lash;
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (m === 'happy') {
      c.beginPath(); c.moveTo(cx - w, cy + 0.9); c.quadraticCurveTo(cx, cy - 3.8, cx + w, cy + 0.9); line(c, lash, 1);
      c.beginPath(); c.moveTo(cx + e * w * 0.92, cy + 0.4); c.lineTo(cx + e * (w + 1.3), cy - 0.5); line(c, lash, 0.45);
      return;
    }
    if (st.blink && m !== 'sad') {
      c.beginPath(); c.moveTo(cx - w, cy - 0.3); c.quadraticCurveTo(cx, cy + 1.9, cx + w, cy - 0.3); line(c, lash, 0.85);
      c.beginPath(); c.moveTo(cx + e * w * 0.45, cy + 1.1); c.lineTo(cx + e * w * 0.58, cy + 2); c.moveTo(cx + e * w * 0.9, cy + 0.2); c.lineTo(cx + e * (w + 1.2), cy - 0.7); line(c, lash, 0.35);
      return;
    }
    const sad = m === 'sad', focus = st.focus && !sad, serve = st.serving && !sad && !focus;
    const open = sad ? 1.18 : focus ? E.focusOpen || 0.72 : E.open || 1;
    const t = (E.tilt || 0) - (sad ? 0.9 : 0), ht = h * open;
    const jit = sad && !st.reduced ? Math.sin(st.t / 45) * 0.22 : 0;
    const xi = cx - e * w + jit, xo = cx + e * w + jit, yi = cy + t * 0.3, yo = cy - t * 0.7;
    const top = () => { c.moveTo(xi, yi); c.bezierCurveTo(xi + e * w * 0.25, yi - ht * 1.3, xo - e * w * 0.35, yo - ht * 1.36, xo, yo); };
    const shape = () => { c.beginPath(); top(); c.bezierCurveTo(xo - e * w * 0.3, yo + hb * 1.3, xi + e * w * 0.3, yi + hb * 1.3, xi, yi); c.closePath(); };
    const sd = st.freeHand ? Math.sign(st.freeHand[0]) || 1 : st.freeSide || 1;
    const lx = serve ? sd * 0.9 : st.look * (E.lookK || 0.24), dy = serve ? -1.1 : 0;
    const ir = sad ? w * 0.36 : w * 0.64, irh = sad ? h * 0.5 : h * 1.02, ix = cx + lx + jit, iy = cy + 0.25 + dy;
    c.save(); shape(); fill(c, '#fffdfb'); c.clip();
    ell(c, ix, iy, ir, irh); fill(c, g3(c, 0, iy - irh, 0, iy + irh, E.irisDark, E.iris, E.irisLight));
    ell(c, ix, iy + irh * 0.06, ir * (E.slit && focus ? 0.2 : 0.44), irh * 0.5); fill(c, E.pupil || '#1d1428');
    ell(c, ix, iy, ir, irh); line(c, E.irisDark, 0.3);
    c.fillStyle = vg(c, cy - ht - 0.6, cy + 0.6, 'rgba(70,45,95,0.5)', 'rgba(70,45,95,0)'); c.fillRect(cx - w - 1.5, cy - ht - 2.5, w * 2 + 3, ht + 3.1);
    ell(c, ix - ir * 0.34, iy - irh * 0.36, ir * 0.38, irh * 0.24); fill(c, '#ffffff');
    ell(c, ix + ir * 0.42, iy + irh * 0.34, ir * 0.16, ir * 0.16); fill(c, 'rgba(255,255,255,0.9)');
    if (sad) { ell(c, cx, cy + hb * 1.05, w * 1.15, hb * 0.55); fill(c, 'rgba(160,215,255,0.65)'); }
    else { star(c, ix + ir * 0.5, iy - irh * 0.52, ir * 0.24); fill(c, 'rgba(255,255,255,0.85)'); }
    c.restore();
    // 上睫毛：中間粗、兩頭細，外眼角多兩根細睫毛
    c.beginPath(); c.moveTo(xi, yi);
    c.bezierCurveTo(xi + e * w * 0.25, yi - ht * 1.3, xo - e * w * 0.35, yo - ht * 1.36, xo + e * 0.5, yo - 0.3);
    c.bezierCurveTo(xo - e * w * 0.35, yo - ht * 1.36 + 1.3, xi + e * w * 0.25, yi - ht * 1.3 + 0.8, xi, yi + 0.15);
    c.closePath(); fill(c, lash);
    c.beginPath(); c.moveTo(xo - e * 0.2, yo - 0.1); c.quadraticCurveTo(xo + e * 1, yo - 0.4, xo + e * 1.8, yo - 1.5); line(c, lash, 0.45);
    c.beginPath(); c.moveTo(xo - e * 1, yo - ht * 0.62); c.lineTo(xo + e * 0.4, yo - ht * 1.02 - 0.5); line(c, lash, 0.35);
    c.beginPath(); c.moveTo(xo - e * 0.3, yo + 0.5); c.quadraticCurveTo(xo - e * w * 0.6, yo + hb * 1.1, cx - e * w * 0.15, cy + hb * 0.98); line(c, E.lower || 'rgba(140,80,90,0.55)', 0.3);
    c.beginPath(); c.moveTo(xi + e * w * 0.55, yi - ht * 1.02 - 0.9); c.quadraticCurveTo(cx + e * w * 0.35, yo - ht * 1.2 - 1.4, xo - e * 0.4, yo - ht * 0.7 - 1.1); line(c, 'rgba(160,95,95,0.4)', 0.28);
    if (sad) {
      const p = st.reduced ? 0.4 : ((st.t + (e > 0 ? 500 : 0)) / 1000) % 1;
      c.save(); c.globalAlpha = 1 - p * 0.8; sweat(c, xo - e * 1.2, cy + hb * 1.6 + p * 6, 0.32); c.restore();
    }
  }
  function brows(c, st, P) {
    const m = st.mood, focus = st.focus && m === 'idle', B = -70.4;
    for (const e of [-1, 1]) {
      let yi = B + 0.2, yo = B + 0.4, k = -0.9;
      if (m === 'happy') { yi -= 1.4; yo -= 1; k = -1.3; }
      else if (m === 'sad') { yi -= 2.2; yo += 1.2; k = -0.2; }
      else if (focus) { yi += 1.5; yo -= 0.7; k = 0.1; }
      else if (st.serving) { yi += 0.6; yo -= 0.2; }
      const xi = e * 2.2, xo = e * 9;
      c.beginPath(); c.moveTo(xi, yi); c.quadraticCurveTo((xi + xo) / 2, (yi + yo) / 2 + k, xo, yo); line(c, P.brow, P.browW || 0.75);
    }
  }
  // 嘴巴；P.mouth 決定平常的樣子：smile、pout（嘟嘴）、fang（虎牙）、cat（ω）、flat、grin、sleepy
  function mouth(c, st, P) {
    const T = P.mouth || 'smile', m = st.mood, y = -54.6, ln = P.skin.lip, dark = P.skin.mouth;
    c.lineCap = 'round';
    if (m === 'happy') {
      // 閉眼大笑：嘴巴張得很大
      const w = T === 'flat' ? 2.2 : 3, d = T === 'flat' ? 2.8 : 3.8;
      const path = T === 'cat'
        ? () => { c.beginPath(); c.moveTo(-2.8, y - 0.5); c.quadraticCurveTo(-1.4, y + 0.5, 0, y - 0.3); c.quadraticCurveTo(1.4, y + 0.5, 2.8, y - 0.5); c.quadraticCurveTo(2, y + 3.4, 0, y + 3.6); c.quadraticCurveTo(-2, y + 3.4, -2.8, y - 0.5); c.closePath(); }
        : () => { c.beginPath(); c.moveTo(-w, y - 0.5); c.quadraticCurveTo(0, y + 0.1, w, y - 0.5); c.quadraticCurveTo(w * 0.85, y + d, 0, y + d); c.quadraticCurveTo(-w * 0.85, y + d, -w, y - 0.5); c.closePath(); };
      path(); fill(c, dark);
      c.save(); path(); c.clip();
      ell(c, 0, y + d * 0.85, w * 0.55, d * 0.3); fill(c, '#ff8d9c');
      if (T === 'grin') { c.fillStyle = '#ffffff'; c.fillRect(-w, y - 0.9, w * 2, 1.1); }
      c.restore();
      path(); line(c, ln, 0.4);
      if (T === 'fang') { poly(c, [[0.8, y - 0.3], [1.9, y - 0.4], [1.35, y + 0.9]]); fill(c, '#ffffff'); }
      return;
    }
    if (m === 'sad') {
      // 慌張的波浪嘴
      c.beginPath(); c.moveTo(-2.4, y + 0.4);
      c.quadraticCurveTo(-1.8, y - 0.6, -1.2, y + 0.2); c.quadraticCurveTo(-0.6, y - 0.8, 0, y); c.quadraticCurveTo(0.6, y - 0.8, 1.2, y + 0.2); c.quadraticCurveTo(1.8, y - 0.6, 2.4, y + 0.4);
      c.quadraticCurveTo(0, y + 2.2, -2.4, y + 0.4); c.closePath(); fill(c, dark); line(c, ln, 0.35);
      return;
    }
    if (st.serving) { ell(c, 0, y + 0.3, 0.75, 0.95); fill(c, dark); return; }
    if (st.focus) {
      if (T === 'fang' || T === 'grin') { rr(c, -1.9, y - 0.5, 3.8, 1.4, 0.6); fill(c, '#ffffff'); line(c, ln, 0.4); c.beginPath(); c.moveTo(-1.7, y + 0.2); c.lineTo(1.7, y + 0.2); line(c, ln, 0.28); }
      else { c.beginPath(); c.moveTo(-1.5, y + 0.4); c.lineTo(1.5, y + 0.2); line(c, ln, 0.55); }
      return;
    }
    c.beginPath();
    if (T === 'cat') { c.arc(-1.1, y - 0.3, 1.1, 0.1, Math.PI - 0.1); c.moveTo(2.2, y - 0.3); c.arc(1.1, y - 0.3, 1.1, 0.1, Math.PI - 0.1); }
    else if (T === 'pout') { c.moveTo(-0.6, y + 0.6); c.lineTo(0.7, y - 0.2); c.lineTo(2, y + 0.6); }
    else if (T === 'flat') { c.moveTo(-1.2, y + 0.2); c.lineTo(1.2, y + 0.2); }
    else if (T === 'fang') { c.moveTo(-2, y - 0.4); c.quadraticCurveTo(0, y + 1.2, 2.3, y - 0.9); }
    else if (T === 'grin') { c.moveTo(-2.3, y - 0.7); c.quadraticCurveTo(0, y + 1.6, 2.3, y - 0.7); }
    else if (T === 'sleepy') { c.arc(0, y - 0.6, 1, Math.PI * 0.2, Math.PI * 0.8); }
    else c.arc(0, y - 1.1, 1.7, Math.PI * 0.18, Math.PI * 0.82);
    line(c, ln, 0.55);
    if (T === 'fang') { poly(c, [[0.6, y + 0.1], [1.5, y - 0.2], [1.1, y + 1]]); fill(c, '#ffffff'); line(c, ln, 0.25); }
  }
  // 腮紅：平常淡淡的，開心（或害羞）時更紅還加斜線，慌張時退掉
  function blush(c, st, P) {
    const m = st.mood, a = m === 'happy' ? 0.55 : m === 'sad' ? 0 : P.blush || 0.24;
    for (const e of [-1, 1]) {
      const x = e * 7.8, y = -58.8;
      if (a > 0) { const g = c.createRadialGradient(x, y, 0, x, y, 3.4); g.addColorStop(0, `rgba(255,120,145,${a})`); g.addColorStop(1, 'rgba(255,120,145,0)'); ell(c, x, y, 3.4, 1.5); fill(c, g); }
      if (m === 'happy' || (P.shy && m === 'idle')) {
        for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x + k * 1.2 - 0.45, y + 0.6); c.lineTo(x + k * 1.2 + 0.45, y - 0.6); line(c, 'rgba(230,80,110,0.6)', 0.3); }
      }
    }
  }
  // 得分：閃光（或愛心）加上笑到發抖的效果線；失分：頭上的陰影線、一直冒汗
  function effects(c, st, P) {
    if (st.mood === 'happy') {
      const p = st.reduced ? 1 : 0.8 + 0.25 * Math.sin(st.t / 150);
      if (P.hearts) { heart(c, 19, -84, 0.85 * p); fill(c, '#ff6f9f'); heart(c, 24, -76, 0.5 * p); fill(c, '#ff9fbf'); }
      else { c.fillStyle = P.spark || '#ffd84d'; star(c, 19.5, -85, 2.8 * p); c.fill(); star(c, 24, -77, 1.7 * p); c.fill(); star(c, -20, -82, 2 * p); c.fill(); }
      for (const e of [-1, 1]) for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(e * 16.2, -58 + k * 2.4); c.lineTo(e * 18.8, -58.6 + k * 3.2); line(c, P.spark || '#ffd84d', 0.5); }
    } else if (st.mood === 'sad') {
      c.save(); c.strokeStyle = 'rgba(90,100,190,0.65)'; c.lineWidth = 0.55;
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k * 2.6, -86 + Math.abs(k)); c.lineTo(k * 2.6, -77.5 + Math.abs(k) * 0.6); c.stroke(); }
      c.restore();
      sweat(c, 15.6, -73, 0.85);
      const p = st.reduced ? 0.5 : (st.t / 700) % 1;
      c.save(); c.globalAlpha = 1 - p; sweat(c, -15 - p * 3, -76 - p * 2, 0.5); sweat(c, 17.6 + p * 3, -82 - p * 2, 0.45); c.restore();
    }
  }
  function drawHead(c, st, P) {
    const S = P.skin, H = P.hair;
    for (const e of [-1, 1]) { ell(c, e * 12.7, -64, 1.9, 3.1); fill(c, S.base2); line(c, S.line, 0.35); ell(c, e * 12.9, -64, 0.8, 1.7); fill(c, S.shade); }
    facePath(c); fill(c, vg(c, -84, -48, S.base, S.base2));
    // 右側的柔和陰影、瀏海落在額頭上的影子；失分時臉色發青
    c.save(); facePath(c); c.clip();
    c.fillStyle = hg(c, 5, 13.6, S.shade0, S.shade); c.fillRect(4, -86, 10, 40);
    if (st.mood === 'sad') { c.fillStyle = vg(c, -84, -60, 'rgba(95,105,205,0.5)', 'rgba(95,105,205,0)'); c.fillRect(-14, -86, 28, 27); }
    c.translate(0.5, 1.9); c.beginPath(); for (const s of P.bangs) strandPath(c, s); fill(c, S.shade);
    c.restore();
    facePath(c); line(c, S.line, 0.45);
    for (const e of [-1, 1]) eye(c, st, e * 5.9, -64.6, e, P.eye);
    c.beginPath(); c.moveTo(0.35, -60.6); c.lineTo(-0.15, -59.3); line(c, S.line, 0.4);
    blush(c, st, P);
    mouth(c, st, P);
    if (P.face) P.face(c, st, P);
    capPath(c, H.cap); fill(c, g3(c, 0, H.cap.top, 0, H.cap.yb, H.light, H.base, H.shade)); line(c, H.line, 0.4);
    if (P.locks) drawStrands(c, P.locks, H, -80, -48);
    drawStrands(c, P.bangs, H, H.cap.top, -64);
    if (H.gloss) gloss(c, H);
    brows(c, st, P);
    if (P.front) P.front(c, st, P);
    effects(c, st, P);
  }

  // 身體：脖子、上衣、短袖、皺褶
  function neck(c, S) {
    const p = () => rr(c, -3.7, -54, 7.4, 13, 2.4);
    p(); fill(c, S.base2);
    c.save(); p(); c.clip(); c.fillStyle = vg(c, -53, -45, S.shade, S.shade0); c.fillRect(-4, -54, 8, 10); c.restore();
  }
  // w 是肩寬的一半，女生約 20、男生約 22
  function bodyPath(c, w) {
    c.beginPath(); c.moveTo(-4.4, -43.4); c.lineTo(4.4, -43.4);
    c.bezierCurveTo(9, -43, w - 3, -42.4, w - 0.6, -39.6); c.bezierCurveTo(w + 1, -37.6, w - 0.4, -30, w - 3.6, -20);
    c.bezierCurveTo(w - 5.6, -12, w - 6.2, -4, w - 5.4, 5); c.lineTo(5.4 - w, 5);
    c.bezierCurveTo(6.2 - w, -4, 5.6 - w, -12, 3.6 - w, -20); c.bezierCurveTo(0.4 - w, -30, -1 - w, -37.6, 0.6 - w, -39.6);
    c.bezierCurveTo(3 - w, -42.4, -9, -43, -4.4, -43.4); c.closePath();
  }
  // 衣服：左上亮、右下暗的柔和漸層
  function cloth(c, path, O, w) { path(); fill(c, g3(c, -w, -44, w, 6, O.light, O.main, O.shade)); path(); line(c, O.line, 0.45); }
  function folds(c, w, col) {
    for (const e of [-1, 1]) {
      c.beginPath(); c.moveTo(e * (w - 4.6), -29); c.quadraticCurveTo(e * (w - 6.4), -23, e * (w - 5.6), -16);
      c.moveTo(e * (w - 7.6), -6); c.quadraticCurveTo(e * (w - 9), -2, e * (w - 8), 3); line(c, col, 0.35);
    }
  }
  function shortSleeves(c, O, w, cuff) {
    for (const e of [-1, 1]) {
      const p = () => {
        c.beginPath(); c.moveTo(e * (w - 6.4), -42.8); c.quadraticCurveTo(e * (w + 0.6), -42.6, e * (w + 1.8), -35.6); c.lineTo(e * (w + 3), -28.2);
        c.quadraticCurveTo(e * (w + 0.2), -26.6, e * (w - 2.6), -26.8); c.lineTo(e * (w - 3.8), -35); c.closePath();
      };
      p(); fill(c, g3(c, e * (w - 6), -43, e * (w + 3), -27, O.light, O.main, O.shade)); p(); line(c, O.line, 0.4);
      if (cuff) { c.beginPath(); c.moveTo(e * (w + 2.7), -29.4); c.quadraticCurveTo(e * w, -28, e * (w - 2.5), -28.2); line(c, cuff, 1.2); }
    }
  }
  function vNeck(c, S, trim, depth) {
    poly(c, [[-3.8, -43.6], [0, -43.6 + depth], [3.8, -43.6]]); fill(c, S.base2);
    c.beginPath(); c.moveTo(-4.5, -43.3); c.lineTo(0, -43.3 + depth + 0.5); c.lineTo(4.5, -43.3); line(c, trim, 1.2);
  }
  function pocket(c, O) {
    const p = () => { c.beginPath(); c.moveTo(-8, -15); c.lineTo(8, -15); c.lineTo(10.6, -2.5); c.lineTo(-10.6, -2.5); c.closePath(); };
    p(); fill(c, g3(c, -10, -15, 10, -2, O.light, O.main, O.shade)); p(); line(c, O.line, 0.4);
  }
  // 側邊的條紋（只畫在上衣裡面）
  function sideStripes(c, w, col) {
    c.save(); bodyPath(c, w); c.clip();
    for (const e of [-1, 1]) { poly(c, [[e * (w - 3.4), -22], [e * (w - 5), 5], [e * (w - 7.2), 5], [e * (w - 5.8), -22]]); fill(c, col); }
    c.restore();
  }
  // 下半身：短褲或裙子、腿、襪子、球鞋（站在地面 y = 76）
  function drawLegs(c, st, P) {
    const L = P.legs, S = P.skin;
    ell(c, 0, 76, 21, 4.2); fill(c, 'rgba(0,0,0,0.35)');
    for (const e of [-1, 1]) {
      const x = e * 6.2;
      const leg = () => { c.beginPath(); c.moveTo(x - 3.6, 6); c.lineTo(x + 3.6, 6); c.bezierCurveTo(x + 3.8, 30, x + 3, 44, x + 2.6, 60); c.lineTo(x - 2.6, 60); c.bezierCurveTo(x - 3, 44, x - 3.6, 30, x - 3.6, 6); c.closePath(); };
      leg(); fill(c, hg(c, x - 3.6, x + 3.6, S.base, S.base2)); leg(); line(c, S.line, 0.35);
      rr(c, x - 2.9, 54, 5.8, 13.5, 1.6); fill(c, hg(c, x - 2.9, x + 2.9, L.sock, L.sockShade || '#d9dde9')); line(c, '#9aa2b8', 0.3);
      const shoe = () => { c.beginPath(); c.moveTo(x - 3.9, 75.6); c.lineTo(x - 3.9, 70); c.quadraticCurveTo(x - 3.9, 66.2, x, 66.2); c.quadraticCurveTo(x + 3.9, 66.2, x + 3.9, 70); c.lineTo(x + 3.9, 75.6); c.closePath(); };
      shoe(); fill(c, vg(c, 66, 76, L.shoe, L.shoeDark || L.shoe)); shoe(); line(c, '#3a3550', 0.4);
      c.beginPath(); c.moveTo(x - 3.6, 74); c.lineTo(x + 3.6, 74); line(c, '#ffffff', 1);
    }
    const p = L.type === 'skirt'
      ? () => poly(c, [[-14.6, -2], [14.6, -2], [18.6, 16.5], [-18.6, 16.5]])
      : () => poly(c, [[-14.6, -2], [14.6, -2], [16.2, 15], [1.8, 15], [0, 10], [-1.8, 15], [-16.2, 15]]);
    p(); fill(c, g3(c, -16, -2, 16, 16, L.light, L.main, L.shade)); p(); line(c, L.line, 0.45);
    if (L.type === 'skirt') for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(k * 4, 0.5); c.lineTo(k * 5.2, 16.5); line(c, L.shade, 0.5); }
    else if (L.stripe) for (const e of [-1, 1]) { c.beginPath(); c.moveTo(e * 14.9, 0); c.lineTo(e * 15.9, 14.2); line(c, L.stripe, 1.2); }
  }

  // 把角色設定包成 draw() 用的造型物件
  function person(P) {
    return {
      id: P.id, name: P.name, title: P.title, desc: P.desc, style: P.style, arm: P.arm,
      legs(c, st) { drawLegs(c, st, P); },
      back(c, st) { if (P.back) P.back(c, st, P); },
      torso(c, st) { neck(c, P.skin); P.outfit(c, st, P); },
      head(c, st) { drawHead(c, st, P); },
    };
  }

  // ---------- 1. 經典・元氣王牌 ----------
  const classic = person({
    id: 'classic', name: '經典', title: '經典・元氣王牌', style: 'allround',
    desc: '薄荷綠短髮、別著星星髮夾的桌球社王牌。打法「均衡」：攻守平均，沒有明顯的弱點。',
    skin: FAIR,
    hair: { light: '#cff5ec', base: '#a3e3d6', shade: '#6fbfb1', back: '#57a698', line: '#3c8c82', gloss: 'rgba(255,255,255,0.55)', cap: { top: -88.6, w: 14, yb: -64 } },
    eye: { iris: '#f2a541', irisDark: '#94480f', irisLight: '#ffe7a6', lash: '#3d2626', tilt: 0.2 },
    brow: '#4a8d84', mouth: 'smile', spark: '#ffd84d',
    arm: { color: FAIR.base2, joint: '#f3cbbb', hand: FAIR.base, handR: 2.3, width: 4.4, shoulderX: 19 },
    legs: { type: 'skirt', light: '#6370b0', main: '#44508a', shade: '#2e3664', line: '#232a4f', sock: '#ffffff', shoe: '#8fe0d2', shoeDark: '#4fb3a4' },
    bangs: [[-4, -85, 11.8, -67.6, 5.6, 2.4], [-4.6, -85, 7.2, -66.6, 5.2, 1.8], [-5.2, -84.6, 2.6, -67.6, 5, 1.2], [-6, -84, -2, -68.8, 4.6, 0.6],
      [-7, -83, -6.2, -69.4, 4.4, -0.2], [-8.2, -82, -10, -68.4, 4.2, -0.8], [-9.6, -80.4, -12.8, -64.6, 3.8, -1.2], [4, -84, 13.8, -63.4, 4.4, 2.2]],
    locks: [[11.2, -78, 15.2, -52, 3.8, 1.4], [-11.2, -78, -15.2, -52, 3.8, -1.4]],
    back(c, st, P) {
      const H = P.hair, s = wiggle(st, 900, 0.5);
      backHair(c, () => {
        c.beginPath(); c.moveTo(0, -89.2);
        c.bezierCurveTo(12.6, -89.2, 18, -80, 17, -67); c.bezierCurveTo(16.6, -57, 17, -49.5, 20 + s, -44);
        c.quadraticCurveTo(17.2, -43.4, 14.8, -46.4); c.lineTo(-14.8, -46.4);
        c.quadraticCurveTo(-17.2, -43.4, -20 + s, -44); c.bezierCurveTo(-17, -49.5, -16.6, -57, -17, -67);
        c.bezierCurveTo(-18, -80, -12.6, -89.2, 0, -89.2); c.closePath();
      }, H);
      for (const e of [-1, 1]) { c.beginPath(); c.moveTo(e * 9, -86); c.quadraticCurveTo(e * 17, -74, e * 17.4 + s, -48); line(c, 'rgba(40,110,100,0.3)', 0.35); }
    },
    front(c) {
      c.save(); c.translate(-9.6, -79); c.rotate(-0.25);
      star5(c, 0, 0, 2.5, 1.1); fill(c, vg(c, -2.5, 2.5, '#fff3a6', '#ffc93a')); line(c, '#d39a1c', 0.4);
      c.restore();
    },
    outfit(c, st, P) {
      const O = { light: '#ffffff', main: '#f3f5fb', shade: '#cad1e6', line: '#97a0bd' }, T = '#6fcfc0';
      cloth(c, () => bodyPath(c, 20), O, 20);
      sideStripes(c, 20, T);
      folds(c, 20, 'rgba(120,130,170,0.35)');
      shortSleeves(c, O, 20, T);
      poly(c, [[-3.6, -43.6], [0, -39], [3.6, -43.6]]); fill(c, P.skin.base2);
      for (const e of [-1, 1]) { poly(c, [[e * 3.6, -44.2], [e * 8.6, -42], [e * 2.4, -37.4], [0, -39]]); fill(c, vg(c, -44, -37, '#9be3d7', '#5fc2b2')); line(c, '#3c8c82', 0.4); }
      c.beginPath(); c.moveTo(0, -39); c.lineTo(0, -32); line(c, O.line, 0.4);
      ell(c, 0.7, -35, 0.5, 0.5); fill(c, '#c9cfe0');
      text(c, 'R-11', 8.4, -30, 3.6, 800, '#3fae9f');
    },
  });

  // ---------- 2. 櫻・傲嬌雙馬尾 ----------
  const sakura = person({
    id: 'sakura', name: '櫻', title: '櫻・傲嬌雙馬尾', style: 'drop',
    desc: '粉紅雙馬尾、嘴硬心軟的傲嬌學妹。打法「愛放短」：常把球輕輕放在網前，逼你往前衝。',
    skin: FAIR, shy: true,
    hair: { light: '#ffdcec', base: '#ffb6d3', shade: '#ec8ab3', back: '#d771a0', line: '#b8507f', gloss: 'rgba(255,255,255,0.55)', cap: { top: -88.6, w: 14, yb: -64 } },
    eye: { iris: '#8f9cf5', irisDark: '#30348f', irisLight: '#d9e0ff', lash: '#4a2440', tilt: 0.9 },
    brow: '#b8507f', mouth: 'pout', spark: '#ffd84d',
    arm: { color: FAIR.base2, joint: '#f3cbbb', hand: FAIR.base, handR: 2.2, width: 4.2, shoulderX: 18.6 },
    legs: { type: 'skirt', light: '#ffc4dc', main: '#f7a6c6', shade: '#d57aa0', line: '#a8507a', sock: '#ffffff', shoe: '#ffffff', shoeDark: '#f2b8cf' },
    bangs: [[0, -85, 0.4, -67.2, 4.8, 0.2], [-3, -85, -4, -67.8, 4.8, -0.4], [3, -85, 4.4, -67.6, 4.8, 0.5], [-5.8, -84, -8.4, -68.2, 4.6, -0.8],
      [5.8, -84, 8.8, -68, 4.6, 0.8], [-8.6, -82, -12.2, -65.4, 4.2, -1.2], [8.6, -82, 12.4, -65.6, 4.2, 1.2]],
    locks: [[11, -78, 13.8, -54, 3.6, 1], [-11, -78, -13.8, -54, 3.6, -1]],
    back(c, st, P) {
      const H = P.hair, sw = wiggle(st, 650, 1.6) + (st.mood === 'happy' ? wiggle(st, 120, 1.2) : 0);
      backHair(c, () => { c.beginPath(); c.moveTo(-16.5, -64); c.bezierCurveTo(-18.5, -90, 18.5, -90, 16.5, -64); c.lineTo(15.8, -52); c.quadraticCurveTo(0, -47.5, -15.8, -52); c.closePath(); }, H);
      for (const e of [-1, 1]) {
        const X = (x, k) => e * x + sw * k;
        const tail = () => {
          c.beginPath(); c.moveTo(X(12.6, 0), -81);
          c.bezierCurveTo(X(26, 0.1), -85, X(33, 0.4), -62, X(30, 0.7), -38);
          c.bezierCurveTo(X(28.6, 0.85), -26, X(26.6, 0.95), -16, X(22, 1), -9);
          c.bezierCurveTo(X(23.6, 0.9), -22, X(23, 0.6), -44, X(20.6, 0.35), -58);
          c.bezierCurveTo(X(19, 0.2), -66, X(17.4, 0.1), -72, X(14.4, 0), -75.4); c.closePath();
        };
        tail(); fill(c, g3(c, X(14, 0), -85, X(30, 0.8), -9, H.light, H.base, H.shade)); tail(); line(c, H.line, 0.4);
        for (const [a, b] of [[17, 25.4], [21, 28.6]]) { c.beginPath(); c.moveTo(X(a, 0.05), -79); c.bezierCurveTo(X(b, 0.3), -66, X(b + 0.6, 0.7), -40, X(b - 2, 0.95), -16); line(c, 'rgba(150,40,90,0.3)', 0.35); }
      }
    },
    front(c) { for (const e of [-1, 1]) bow(c, e * 12.6, -81.6, 0.75, '#ffffff', '#f06a9e'); },
    outfit(c, st, P) {
      const O = { light: '#ffffff', main: '#fbf8fd', shade: '#ddd2ea', line: '#a691b8' }, K = { light: '#ffd2e5', main: '#ffb6d3', shade: '#ea8ab2', line: '#b8507f' };
      cloth(c, () => bodyPath(c, 19.6), O, 19.6);
      folds(c, 19.6, 'rgba(150,120,170,0.35)');
      shortSleeves(c, K, 19.6, '#ffffff');
      vNeck(c, P.skin, '#f07aa8', 5.4);
      text(c, '11', 0, -25, 8.6, 800, '#f07aa8');
      c.beginPath(); c.moveTo(-14.2, 3.4); c.lineTo(14.2, 3.4); line(c, '#ffb6d3', 1.2);
    },
  });

  // ---------- 3. 焰・熱血王牌 ----------
  const blaze = person({
    id: 'blaze', name: '焰', title: '焰・熱血王牌', style: 'smash',
    desc: '珊瑚紅刺蝟頭、笑起來露出虎牙的熱血少年。打法「愛扣殺」：球一彈高就全力扣殺，失誤也比較多。',
    skin: FAIR, blush: 0.18,
    hair: { light: '#ffcaae', base: '#ff9c72', shade: '#ea6a45', back: '#cc5034', line: '#a33a26', gloss: 'rgba(255,240,225,0.5)', cap: { top: -88, w: 14, yb: -64 } },
    eye: { iris: '#ffc23f', irisDark: '#a8420e', irisLight: '#fff2a8', lash: '#3a1a14', tilt: 1.3, h: 3.1, focusOpen: 0.68 },
    brow: '#a33a26', browW: 1.1, mouth: 'fang', spark: '#ffb02e',
    arm: { color: FAIR.base2, joint: '#f3cbbb', hand: FAIR.base, handR: 2.6, width: 5, shoulderX: 21 },
    legs: { type: 'shorts', light: '#5a5c72', main: '#43455a', shade: '#2c2d3b', line: '#1d1e2a', stripe: '#ff8a63', sock: '#ffffff', shoe: '#ffa27f', shoeDark: '#e0603a' },
    bangs: [[-2, -82, -6, -91.4, 4, 0], [2.6, -82, 5.6, -92, 4, 0], [-9.4, -82, -14.2, -68.6, 4, -0.6], [9.4, -82, 14.4, -69, 4, 0.6],
      [-6.6, -84, -10.4, -67, 4.6, -1], [6.6, -84, 10.8, -67.2, 4.6, 1], [-3.6, -85, -5.4, -68, 5, -0.6], [3.6, -85, 6, -68.4, 5, 0.6], [0, -85, 0.8, -67.4, 5, 0]],
    locks: [[11.6, -74, 13.8, -60, 3.2, 0.6], [-11.6, -74, -13.8, -60, 3.2, -0.6]],
    back(c, st, P) {
      const H = P.hair;
      backHair(c, () => poly(c, [[-14, -56], [-20.5, -62], [-17.6, -67], [-22.4, -74], [-16.6, -77], [-19.6, -86], [-10.6, -84], [-7.4, -93.6], [-0.8, -88.6],
        [6.6, -93.6], [10, -85.6], [19.4, -87.6], [17, -78], [22.6, -74], [18, -67], [21, -61], [14, -56]]), H);
    },
    outfit(c, st, P) {
      const O = { light: '#62657c', main: '#4a4c60', shade: '#2f3040', line: '#1b1c28' }, A = '#ff8a63';
      cloth(c, () => bodyPath(c, 22), O, 22);
      // 下襬的火焰條紋
      c.save(); bodyPath(c, 22); c.clip();
      c.beginPath(); c.moveTo(-18, 6); c.lineTo(-18, -4);
      for (let i = 0; i <= 8; i++) c.lineTo(-18 + i * 4.5, i % 2 ? -10.5 : -4);
      c.lineTo(18, 6); c.closePath(); fill(c, vg(c, -11, 5, '#ffc06a', '#ff6a3c'));
      c.restore();
      folds(c, 22, 'rgba(0,0,0,0.3)');
      shortSleeves(c, O, 22, A);
      vNeck(c, P.skin, A, 5);
      text(c, '11', 0, -26, 9, 800, A);
    },
  });

  // ---------- 4. 喵喵・貓耳帽T學妹 ----------
  const neko = person({
    id: 'neko', name: '喵喵', title: '喵喵・貓耳帽T學妹', style: 'trick',
    desc: '戴著橘色貓耳帽T、說話尾巴會加「喵」的學妹。打法「變化多端」：一下放短、一下打大角度，讓你猜不透。',
    skin: FAIR, hearts: true,
    hair: { light: '#fff6e2', base: '#ffe4b8', shade: '#efc086', line: '#c48a52', cap: { top: -85.5, w: 13, yb: -64 } },
    hood: { light: '#ffcf9c', main: '#ffad62', shade: '#e9843a', line: '#b5612a' },
    eye: { iris: '#62d08a', irisDark: '#17663c', irisLight: '#d8ffb6', lash: '#4a2a1e', tilt: 0.6, h: 3.8, slit: true },
    brow: '#c48a52', mouth: 'cat',
    arm: { color: '#ffad62', joint: '#e9843a', hand: FAIR.base, handR: 2.5, width: 5.2, shoulderX: 19.4 },
    legs: { type: 'shorts', light: '#76668c', main: '#5b4b6e', shade: '#3f3350', line: '#2c2338', sock: '#ffffff', shoe: '#ffb38a', shoeDark: '#ee7f4c' },
    bangs: [[-8.6, -80, -11.8, -64, 3.6, -1], [8.6, -80, 12, -64.2, 3.6, 1], [-5.8, -82, -8.2, -67.4, 4, -0.8], [5.8, -82, 8.4, -67.6, 4, 0.8],
      [-3, -83, -4, -68, 4.2, -0.4], [3, -83, 4.4, -68.2, 4.2, 0.4], [0, -83, 0.3, -67.6, 4.4, 0]],
    locks: [[10.6, -76, 13.4, -54, 3.4, 1], [-10.6, -76, -13.4, -54, 3.4, -1]],
    back(c, st, P) {
      // 帽T上的尾巴：開心時猛搖，失分時垂下來
      const D = P.hood, a = st.mood === 'happy' ? wiggle(st, 140, 0.35) : wiggle(st, 520, 0.2), P0 = [13, -4];
      const raw = st.mood === 'sad' ? [[25, 2], [36, 8], [43, 4]] : [[28, -2], [40, -28], [30, -46]];
      const ctrl = raw.map(([x, y]) => {
        const dx = x - P0[0], dy = y - P0[1];
        return [P0[0] + dx * Math.cos(a) - dy * Math.sin(a), P0[1] + dx * Math.sin(a) + dy * Math.cos(a)];
      });
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, u = 1 - t, b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
        pts.push([b0 * P0[0] + b1 * ctrl[0][0] + b2 * ctrl[1][0] + b3 * ctrl[2][0], b0 * P0[1] + b1 * ctrl[0][1] + b2 * ctrl[1][1] + b3 * ctrl[2][1]]);
      }
      const path = (from, to) => { c.beginPath(); c.moveTo(pts[from][0], pts[from][1]); for (let i = from + 1; i <= to; i++) c.lineTo(pts[i][0], pts[i][1]); };
      path(0, 24); line(c, D.line, 7); path(0, 24); line(c, D.main, 5.8);
      path(2, 24); line(c, 'rgba(255,210,160,0.6)', 2);
      path(19, 24); line(c, '#fff3df', 5.8);
      // 帽子後面和貓耳
      const droop = st.mood === 'sad' ? 0.5 : st.focus ? -0.1 : 0;
      for (const e of [-1, 1]) {
        c.save(); c.translate(e * 8.2, -84.6); c.rotate(e * droop);
        const ear = () => poly(c, [[-e * 3.4, -0.6], [e * 2.6, -8.8], [e * 6.2, 3]]);
        ear(); fill(c, g3(c, 0, -9, 0, 3, D.light, D.main, D.shade)); ear(); line(c, D.line, 0.4);
        poly(c, [[-e * 1.4, 0.2], [e * 2.2, -5.8], [e * 4.2, 2]]); fill(c, vg(c, -6, 2, '#ffd6e0', '#ffb0c4'));
        c.restore();
      }
      const hood = () => { c.beginPath(); c.moveTo(-17.8, -48); c.bezierCurveTo(-22.4, -74, -14, -89, 0, -89); c.bezierCurveTo(14, -89, 22.4, -74, 17.8, -48); c.closePath(); };
      hood(); fill(c, g3(c, -18, -89, 18, -48, D.light, D.main, D.shade)); hood(); line(c, D.line, 0.45);
    },
    face(c) {
      for (const e of [-1, 1]) for (const k of [-1, 1]) { c.beginPath(); c.moveTo(e * 9.4, -58.4 + k * 1.1); c.lineTo(e * 11.6, -58.9 + k * 1.6); line(c, '#e2a07e', 0.35); }
    },
    front(c, st, P) {
      const D = P.hood, rim = () => { c.beginPath(); c.moveTo(-16.4, -48); c.bezierCurveTo(-20, -74, -11, -87.6, 0, -87.6); c.bezierCurveTo(11, -87.6, 20, -74, 16.4, -48); };
      rim(); line(c, D.line, 4.4); rim(); line(c, vg(c, -88, -48, D.light, D.main), 3.4);
    },
    outfit(c, st, P) {
      const O = P.hood;
      cloth(c, () => bodyPath(c, 20.4), O, 20.4);
      folds(c, 20.4, 'rgba(160,80,30,0.35)');
      pocket(c, O);
      rr(c, -14.8, 1.8, 29.6, 3.2, 1.2); fill(c, O.shade);
      c.beginPath(); c.moveTo(-5.2, -43.4); c.quadraticCurveTo(0, -39.2, 5.2, -43.4); line(c, O.line, 0.5);
      // 胸口的肉球
      ell(c, -7.4, -27.6, 2.1, 1.8); fill(c, '#fff3df');
      for (const [x, y] of [[-9.6, -30.4], [-7.4, -31.4], [-5.2, -30.4]]) { ell(c, x, y, 0.8, 1); fill(c, '#fff3df'); }
      for (const e of [-1, 1]) {
        c.beginPath(); c.moveTo(e * 2.6, -42.4); c.quadraticCurveTo(e * 3.2, -37.4, e * 2.8, -32.6); line(c, '#fff3df', 0.7);
        ell(c, e * 2.8, -31.8, 0.6, 1); fill(c, '#fff3df');
      }
    },
  });

  // ---------- 5. 影・紅圍巾少年 ----------
  const kage = person({
    id: 'kage', name: '影', title: '影・紅圍巾少年', style: 'angle',
    desc: '深藍色頭髮、穿淺灰運動外套、圍著紅色長圍巾的沉默少年。打法「愛打大角度」：專打兩邊底角，讓你左右奔跑。',
    skin: FAIR, blush: 0.16,
    hair: { light: '#8695d0', base: '#5a669e', shade: '#3e487b', back: '#313a66', line: '#222a4e', gloss: 'rgba(210,222,255,0.45)', cap: { top: -88.6, w: 14, yb: -64 } },
    eye: { iris: '#a8e8f2', irisDark: '#2b7490', irisLight: '#effcff', lash: '#1d2240', tilt: 0.9, h: 3.1 },
    brow: '#2a3258', mouth: 'flat', spark: '#a6f6ff',
    arm: { color: '#e6e9f3', joint: '#c3cadc', hand: FAIR.base, handR: 2.5, width: 5, shoulderX: 20.6 },
    legs: { type: 'shorts', light: '#454d82', main: '#2c3260', shade: '#1c2142', line: '#12152e', stripe: '#ef4452', sock: '#2c3260', sockShade: '#1c2142', shoe: '#ff6470', shoeDark: '#c8283a' },
    bangs: [[9, -82, 14.2, -62, 3.6, 1.4], [6, -84, 12.8, -66.6, 4.2, 1.6], [2, -85, 9.6, -67.6, 4.6, 1.2], [0, -85, 4.8, -66.6, 4.6, 0.6],
      [-8.4, -82, -12.6, -64.2, 4.4, -1.4], [-6, -84, -8.6, -62.4, 5, -1.2], [-4, -84.6, -4.4, -64.6, 4.8, -0.8], [-2, -85, 0.2, -67.4, 4.6, 0]],
    locks: [[-10.8, -76, -13.6, -58, 3.4, -0.8], [10.8, -76, 13.4, -60, 3.2, 0.8]],
    back(c, st, P) {
      // 紅圍巾的兩條長布尾往右飄
      const amp = st.reduced ? 0 : st.mood === 'happy' ? 1.5 : 1, sad = st.mood === 'sad';
      for (const j of [0, 1]) {
        const len = j ? 42 : 54, w0 = 5.4, w1 = 3, bx = 6.5, by = -46 + j * 2.2, n = 14, pts = [];
        for (let i = 0; i <= n; i++) {
          const s = i / n;
          let y = by - s * (sad ? -10 : 7) + Math.sin(st.t / 210 - s * 4.2 - j * 1.3) * (1.2 + s * 5) * amp;
          if (sad) y += s * s * 16;
          pts.push([bx + s * len, y]);
        }
        const top = [], bot = [];
        for (let i = 0; i <= n; i++) {
          const p = pts[i], q = pts[Math.min(n, i + 1)], o = pts[Math.max(0, i - 1)];
          const dx = q[0] - o[0], dy = q[1] - o[1], L = Math.hypot(dx, dy) || 1, w = (w0 + ((w1 - w0) * i) / n) / 2;
          top.push([p[0] + (dy / L) * w, p[1] - (dx / L) * w]); bot.push([p[0] - (dy / L) * w, p[1] + (dx / L) * w]);
        }
        const path = () => { c.beginPath(); c.moveTo(top[0][0], top[0][1]); for (const p of top) c.lineTo(p[0], p[1]); for (let i = n; i >= 0; i--) c.lineTo(bot[i][0], bot[i][1]); c.closePath(); };
        path(); fill(c, hg(c, bx, bx + len, j ? '#e8414f' : '#ff5a66', '#a51a2a')); path(); line(c, '#7a1020', 0.4);
      }
      backHair(c, () => {
        c.beginPath(); c.moveTo(-15.6, -64); c.bezierCurveTo(-18, -84, -11, -89, 0, -89); c.bezierCurveTo(11, -89, 18, -84, 15.6, -64);
        c.lineTo(14.2, -54); c.lineTo(12, -57.6); c.lineTo(10, -50.4); c.lineTo(-10, -50.4); c.lineTo(-12, -57.6); c.lineTo(-14.2, -54); c.closePath();
      }, P.hair);
    },
    outfit(c, st, P) {
      const O = { light: '#ffffff', main: '#eceff7', shade: '#c0c7da', line: '#858ea8' }, N = '#2f3870';
      cloth(c, () => bodyPath(c, 21.6), O, 21.6);
      folds(c, 21.6, 'rgba(110,120,160,0.4)');
      // 肩膀的深藍色線條、拉鍊
      for (const e of [-1, 1]) { c.beginPath(); c.moveTo(e * 6.4, -43.2); c.quadraticCurveTo(e * 15, -42.4, e * 21, -38); line(c, N, 1.3); }
      c.beginPath(); c.moveTo(0, -40); c.lineTo(0, 4.6); line(c, N, 0.7);
      rr(c, -0.8, -35, 1.6, 2.6, 0.5); fill(c, '#8a93b0');
      for (const e of [-1, 1]) { c.beginPath(); c.moveTo(e * 4.4, -10); c.lineTo(e * 9.6, -12); line(c, O.line, 0.5); }
      // 圍巾繞在脖子上，右邊打結
      const R = (y0, y1) => vg(c, y0, y1, '#ff6470', '#c8283a');
      const wrap = () => { c.beginPath(); c.moveTo(-7.4, -49); c.quadraticCurveTo(0, -46.2, 7.4, -49); c.lineTo(8.2, -43.4); c.quadraticCurveTo(0, -39.6, -8.2, -43.4); c.closePath(); };
      wrap(); fill(c, R(-49, -40)); wrap(); line(c, '#7a1020', 0.4);
      const end = () => poly(c, [[5.8, -42], [9, -42.4], [10.2, -30.6], [7.2, -31.8]]);
      end(); fill(c, R(-42, -30)); end(); line(c, '#7a1020', 0.4);
      ell(c, 7.2, -42.8, 2.8, 2.4); fill(c, R(-45, -40)); line(c, '#7a1020', 0.4);
    },
  });

  // ---------- 6. 靜・圓框眼鏡學姊 ----------
  function glasses(c, st) {
    const col = '#6d5a98';
    for (const e of [-1, 1]) {
      const x = e * 5.9, y = -64.6, lens = () => ell(c, x, y, 5.2, 4.4);
      lens(); fill(c, 'rgba(225,235,255,0.14)');
      if (st.focus && st.mood === 'idle') {
        // 認真起來時鏡片反光
        c.save(); lens(); c.clip(); poly(c, [[x - 5.6, y - 1], [x - 1, y - 5.6], [x + 2.6, y - 5.6], [x - 5.6, y + 2.6]]); fill(c, 'rgba(255,255,255,0.85)'); c.restore();
      } else { c.beginPath(); c.moveTo(x - 3.2, y - 0.9); c.lineTo(x - 1.2, y - 2.9); line(c, 'rgba(255,255,255,0.8)', 0.5); }
      lens(); line(c, col, 0.6);
      c.beginPath(); c.moveTo(e * 11.1, -65.4); c.lineTo(e * 12.8, -66.4); line(c, col, 0.55);
    }
    c.beginPath(); c.moveTo(-0.7, -65.4); c.quadraticCurveTo(0, -66.2, 0.7, -65.4); line(c, col, 0.55);
  }
  const shizuka = person({
    id: 'shizuka', name: '靜', title: '靜・圓框眼鏡學姊', style: 'steady',
    desc: '戴圓框眼鏡、薰衣草色長辮子的冷靜學姊。打法「穩定不失誤」：每一球都穩穩回到桌面深處，很少失誤。',
    skin: FAIR,
    hair: { light: '#efe8fe', base: '#cfc0f3', shade: '#a490de', back: '#8c7ac8', line: '#6d5aa8', gloss: 'rgba(255,255,255,0.55)', cap: { top: -88.8, w: 14, yb: -64 } },
    eye: { iris: '#a384ec', irisDark: '#432c88', irisLight: '#ede5ff', lash: '#3b2a55', tilt: -0.6, h: 3.4 },
    brow: '#7a68b0', mouth: 'smile', spark: '#fff0a0',
    arm: { color: '#cbbff1', joint: '#ab9de0', hand: FAIR.base, handR: 2.2, width: 4.4, shoulderX: 18.6 },
    legs: { type: 'skirt', light: '#8a87c4', main: '#6f6cab', shade: '#4f4c86', line: '#3a3866', sock: '#ffffff', shoe: '#c2b2ee', shoeDark: '#9581d6' },
    bangs: [[-6, -83, -13, -62, 4.4, -2], [6, -83, 13.2, -62.2, 4.4, 2], [-2.4, -84.6, -10.4, -66, 5, -2.6], [2.4, -84.6, 10.6, -66.2, 5, 2.6],
      [-0.6, -85.4, -6.4, -68.8, 5.4, -2.6], [0.6, -85.4, 6.6, -69, 5.4, 2.6]],
    locks: [[-11.4, -76, -14.6, -46, 3.8, -1.4]],
    back(c, st, P) {
      backHair(c, () => { c.beginPath(); c.moveTo(-16.4, -64); c.bezierCurveTo(-18.5, -90, 18.5, -90, 16.4, -64); c.lineTo(14.4, -52); c.quadraticCurveTo(0, -49, -14.4, -52); c.closePath(); }, P.hair);
    },
    front(c, st, P) {
      const H = P.hair, sw = wiggle(st, 1100, 0.4), g = g3(c, 0, -60, 0, -18, H.light, H.base, H.shade);
      // 辮子：從右耳後面繞過肩膀垂到胸前
      for (let i = 0; i < 8; i++) {
        const k = i / 7, seg = () => ell(c, 12.8 - k * 3.2 + sw * k, -58 + i * 5.2, 2.9 - k * 0.5, 2.7, i % 2 ? 0.5 : -0.5);
        seg(); fill(c, g); seg(); line(c, H.line, 0.35);
      }
      const ex = 9.6 + sw, ey = -18.6;
      const tuft = () => { c.beginPath(); c.moveTo(ex - 1.9, ey + 0.5); c.quadraticCurveTo(ex - 2.6, ey + 5, ex - 0.5, ey + 7.4); c.quadraticCurveTo(ex + 0.3, ey + 4.4, ex + 1, ey + 6.9); c.quadraticCurveTo(ex + 2.4, ey + 3.4, ex + 1.9, ey + 0.5); c.closePath(); };
      tuft(); fill(c, g); tuft(); line(c, H.line, 0.35);
      bow(c, ex, ey, 0.5, '#ffffff', '#9a86d6');
      glasses(c, st);
    },
    outfit(c, st, P) {
      const O = { light: '#ffffff', main: '#f8f6fe', shade: '#d6cfee', line: '#8c80b8' };
      cloth(c, () => bodyPath(c, 19.6), O, 19.6);
      // 肩膀的薰衣草色拼接
      c.save(); bodyPath(c, 19.6); c.clip();
      c.beginPath(); c.moveTo(-21, -44); c.lineTo(21, -44); c.lineTo(21, -33); c.quadraticCurveTo(10, -31, 5, -36); c.lineTo(-5, -36); c.quadraticCurveTo(-10, -31, -21, -33); c.closePath();
      fill(c, g3(c, -20, -44, 20, -32, '#e2daf9', '#cbbff1', '#a798dc'));
      c.restore();
      bodyPath(c, 19.6); line(c, O.line, 0.45);
      folds(c, 19.6, 'rgba(120,100,170,0.3)');
      const col = () => { c.beginPath(); c.moveTo(-4.8, -46); c.lineTo(4.8, -46); c.lineTo(5.4, -42.2); c.quadraticCurveTo(0, -40.6, -5.4, -42.2); c.closePath(); };
      col(); fill(c, vg(c, -46, -40, '#ffffff', '#dcd6f0')); col(); line(c, O.line, 0.4);
      c.beginPath(); c.moveTo(0, -41.4); c.lineTo(0, -30); line(c, O.line, 0.55);
      rr(c, -0.8, -32, 1.6, 2.6, 0.5); fill(c, '#9a86d6');
      text(c, 'R-11', -7.8, -27.4, 3.4, 800, '#8c76d0');
    },
  });

  // ---------- 7. 颯・短髮運動少女 ----------
  const kaze = person({
    id: 'kaze', name: '颯', title: '颯・短髮運動少女', style: 'speed',
    desc: '天藍色短髮、臉上貼著OK繃的運動少女。打法「快攻」：節奏超快、球又平又急，但失誤也多一點。',
    skin: TAN,
    hair: { light: '#d3eefd', base: '#a2d5f7', shade: '#6aaee3', back: '#5596d0', line: '#3a78b0', gloss: 'rgba(255,255,255,0.55)', cap: { top: -88.6, w: 14, yb: -66 } },
    eye: { iris: '#b8e04c', irisDark: '#457d12', irisLight: '#f4ffc6', lash: '#2b3445', h: 3.7 },
    brow: '#3a78b0', mouth: 'grin', spark: '#ffe14d',
    arm: { color: TAN.base2, joint: '#e8b89e', hand: TAN.base, handR: 2.3, width: 4.4, shoulderX: 19 },
    legs: { type: 'shorts', light: '#4f83cc', main: '#3466b0', shade: '#224a88', line: '#173462', stripe: '#ffd96a', sock: '#ffffff', shoe: '#ffe17a', shoeDark: '#f0b43a' },
    bangs: [[-9, -81, -13.2, -66.6, 4, -1.4], [9, -81, 13.2, -67, 4, 1.4], [-6, -83.6, -9.6, -70.4, 4.4, -1.2], [6, -83.6, 9.4, -71, 4.4, 1.2],
      [-3, -85, -5.4, -71.8, 4.6, -1], [3, -85, 4.6, -72.4, 4.6, 0.8], [0, -85, -0.8, -71.2, 4.6, -0.6]],
    locks: [[11.2, -75, 13.4, -61, 3.2, 1], [-11.2, -75, -13.4, -61, 3.2, -1]],
    back(c, st, P) {
      backHair(c, () => {
        c.beginPath(); c.moveTo(-15.6, -66); c.bezierCurveTo(-18, -84, -11, -89, 0, -89); c.bezierCurveTo(11, -89, 18, -84, 15.6, -66);
        c.lineTo(14.6, -58); c.lineTo(12.6, -60.6); c.lineTo(11, -54); c.lineTo(-11, -54); c.lineTo(-12.6, -60.6); c.lineTo(-14.6, -58); c.closePath();
      }, P.hair);
    },
    face(c) {
      c.save(); c.translate(9.6, -55.6); c.rotate(-0.5);
      rr(c, -2.4, -0.8, 4.8, 1.6, 0.7); fill(c, '#ffdcb8'); line(c, '#c99a74', 0.3);
      rr(c, -0.7, -0.7, 1.4, 1.4, 0.3); fill(c, '#f5c9a0');
      c.restore();
    },
    front(c) {
      for (const a of [-0.5, 0.5]) { c.save(); c.translate(9.4, -79.4); c.rotate(a); c.beginPath(); c.moveTo(-2.4, 0); c.lineTo(2.4, 0); line(c, '#ffd23f', 0.9); c.restore(); }
    },
    outfit(c, st, P) {
      const O = { light: '#fff0a8', main: '#ffd96a', shade: '#eaae38', line: '#b5822a' }, B = '#4aa3e8';
      cloth(c, () => bodyPath(c, 20), O, 20);
      sideStripes(c, 20, B);
      folds(c, 20, 'rgba(170,120,30,0.35)');
      shortSleeves(c, O, 20, B);
      c.beginPath(); c.moveTo(-4.6, -43.5); c.quadraticCurveTo(0, -40, 4.6, -43.5); line(c, B, 1.3);
      text(c, '11', 0, -26, 9, 800, B);
    },
  });

  // ---------- 8. 眠・愛睏守備少年 ----------
  const nemu = person({
    id: 'nemu', name: '眠', title: '眠・愛睏守備少年', style: 'lob',
    desc: '焦糖色亂翹頭、脖子掛著耳機的愛睏少年。打法「高吊守備」：把球又高又慢地吊回來，很少失誤，很難打穿。',
    skin: FAIR, blush: 0.22,
    hair: { light: '#f4d8b2', base: '#dfb383', shade: '#bd8858', back: '#a07245', line: '#80573a', gloss: 'rgba(255,245,230,0.5)', cap: { top: -89, w: 14.4, yb: -64 } },
    hoodie: { light: '#f7f3ec', main: '#e6dfd2', shade: '#c4b9a6', line: '#8f8572' },
    eye: { iris: '#66cab8', irisDark: '#226a5d', irisLight: '#d8fff6', lash: '#3b2a20', tilt: -0.4, h: 3.5, open: 0.55, focusOpen: 0.92 },
    brow: '#80573a', mouth: 'sleepy', spark: '#bff3e6',
    arm: { color: '#e6dfd2', joint: '#c4b9a6', hand: FAIR.base, handR: 2.6, width: 5.8, shoulderX: 21.4 },
    legs: { type: 'shorts', light: '#7a889c', main: '#5f6d80', shade: '#445063', line: '#2e3644', sock: '#ffffff', shoe: '#b8ece0', shoeDark: '#7cc9b8' },
    bangs: [[-10, -80.6, -14.6, -62, 4.6, -2], [10, -80.6, 14.8, -62.4, 4.6, 2], [-7, -83.4, -9.6, -66.4, 5.2, -1.4], [7, -83.4, 10.6, -66.8, 5.2, 1.6],
      [-3.6, -85, -4.4, -67.2, 5.6, -0.6], [3.6, -85, 5.4, -67.6, 5.6, 1], [0, -85.4, 0.6, -68, 5.6, 0.8]],
    locks: [[-13, -70, -18.6, -64.4, 3, -1.2], [13, -74, 18.4, -70, 3, 1.2]],
    back(c, st, P) {
      const O = P.hoodie;
      const hood = () => { c.beginPath(); c.moveTo(-19.5, -38); c.bezierCurveTo(-21, -48, -9, -50, 0, -50); c.bezierCurveTo(9, -50, 21, -48, 19.5, -38); c.closePath(); };
      hood(); fill(c, vg(c, -50, -38, O.main, O.shade)); hood(); line(c, O.line, 0.4);
      backHair(c, () => {
        c.beginPath(); c.moveTo(-16.2, -66); c.bezierCurveTo(-19, -86, -11, -89.4, 0, -89.4); c.bezierCurveTo(11, -89.4, 19, -86, 16.2, -66);
        c.quadraticCurveTo(18.2, -59, 15, -54); c.quadraticCurveTo(13.2, -57, 11.6, -51.8); c.quadraticCurveTo(0, -49.8, -11.6, -51.8);
        c.quadraticCurveTo(-13.2, -57, -15, -54); c.quadraticCurveTo(-18.2, -59, -16.2, -66); c.closePath();
      }, P.hair);
    },
    front(c, st) {
      if (st.mood !== 'idle' || st.focus || st.serving) return;
      for (let i = 0; i < 2; i++) {
        const p = st.reduced ? 0.3 + i * 0.4 : (st.t / 1800 + i * 0.5) % 1;
        c.save(); c.globalAlpha = Math.sin(p * Math.PI); text(c, 'z', 16 + p * 4, -80 - p * 8, 3.6 + p * 2.6, 800, '#8fb8d8'); c.restore();
      }
    },
    outfit(c, st, P) {
      const O = P.hoodie;
      cloth(c, () => bodyPath(c, 22.4), O, 22.4);
      folds(c, 22.4, 'rgba(120,105,80,0.35)');
      pocket(c, O);
      rr(c, -16.6, 1.8, 33.2, 3.2, 1.2); fill(c, O.shade);
      c.beginPath(); c.moveTo(-5.2, -43.4); c.quadraticCurveTo(0, -39.2, 5.2, -43.4); line(c, O.line, 0.5);
      for (const e of [-1, 1]) {
        c.beginPath(); c.moveTo(e * 2.6, -41.6); c.quadraticCurveTo(e * 3.2, -35, e * 3, -28.8); line(c, '#7fcfbf', 0.7);
        ell(c, e * 3, -28, 0.6, 1); fill(c, '#7fcfbf');
      }
      // 掛在脖子上的耳機
      const band = () => { c.beginPath(); c.moveTo(-8, -46); c.quadraticCurveTo(0, -39.6, 8, -46); };
      band(); line(c, '#3f8f80', 2); band(); line(c, '#a8e6d8', 1.2);
      for (const e of [-1, 1]) {
        const cup = () => ell(c, e * 8.4, -45.4, 2.8, 3.5, e * 0.2);
        cup(); fill(c, g3(c, e * 6, -49, e * 11, -42, '#d6f6ee', '#a8e6d8', '#6fbfae')); cup(); line(c, '#3f8f80', 0.4);
        ell(c, e * 8.4, -45.4, 1.3, 1.8, e * 0.2); fill(c, '#5aa898');
      }
    },
  });

  // ---------- 共用：底座、手臂、整體繪製順序 ----------
  // 沒有 legs 的造型（例如機器人）站在底座上
  function pedestal(c) {
    ell(c, 0, 76, 34, 7); fill(c, 'rgba(0,0,0,0.4)');
    c.fillStyle = '#5d667f'; c.fillRect(-6, 12, 12, 64);
    rr(c, -22, 66, 44, 12, 5); fill(c, '#2b3047');
  }
  function arm(c, skin, s, hand, withPaddle) {
    const a = skin.arm, sx = s * (a.shoulderX || 27), sy = -36;
    const h = hand || (withPaddle ? [s * ((a.shoulderX || 27) + 4), -16] : [s * ((a.shoulderX || 27) + 6), -2]);
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(h[0], h[1]); line(c, a.color, a.width || 6.5);
    if (withPaddle) {
      c.beginPath(); c.moveTo(h[0], h[1] + 1); c.lineTo(h[0] + s * 1.4, h[1] - 6); line(c, '#d9a066', 2.8);
      ell(c, h[0] + s * 2.8, h[1] - 13.5, 7.8, 7.1, s * 0.25); fill(c, '#17171c'); line(c, '#e5383b', 1.6);
    }
    if (a.hand) { ell(c, h[0], h[1], a.handR || 3.2, a.handR || 3.2); fill(c, a.hand); }
  }
  // 畫整個角色（不含擊球的那隻手，那隻手在遊戲裡用 3D 位置另外畫）
  // opt.bust = true：選單縮圖用，只看得到上半身，另一隻手拿著小球拍
  function draw(c, skin, st, opt) {
    opt = opt || {};
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    if (skin.legs) skin.legs(c, st); else if (!opt.bust) pedestal(c);
    c.translate(0, -st.bob);
    if (skin.back) skin.back(c, st);
    arm(c, skin, st.freeSide, st.freeHand, false);
    if (opt.bust) arm(c, skin, -st.freeSide, null, true);
    skin.torso(c, st);
    skin.head(c, st);
    c.restore();
  }

  const LIST = [classic, sakura, blaze, neko, kage, shizuka, kaze, nemu];
  const byId = {};
  for (const s of LIST) byId[s.id] = s;
  const API = { list: LIST, byId, draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.R11Skins = API;
})(this);
