// R-11 對手造型（皮膚）：動漫風格的原創角色
// 每個造型都用 Canvas 畫在「本地座標」上：單位是公分、y 朝下，
// 原點在角色中心線、桌面高度（世界座標 y = 0）。
// 參考位置：頭中心約 y = -64，胸口約 y = -25，地面 y = +76。
// 頭頂最高畫到 y = -100 左右，再高會被畫面上方的計分板擋到（不能高過 -104）。
//
// 畫風：乾淨的細線條、兩階賽璐璐陰影（底色加一種影子色，不用漸層）、偏淡的粉彩色、
// 有高光的大眼睛、開心時臉頰泛紅。角色都是原創，不要畫現有作品的角色、髮型組合、制服或標誌。
//
// 新增造型：照下面任何一個 person({...}) 抄一份，改 id、名稱、顏色、頭髮和衣服的畫法，
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
    fill(c, 'rgba(150,215,255,0.95)'); line(c, '#ffffff', 0.5);
  }
  function bow(c, x, y, s, col, edge) {
    for (const e of [-1, 1]) {
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + e * 3.6 * s, y - 3.4 * s, x + e * 4.6 * s, y - 0.4 * s);
      c.quadraticCurveTo(x + e * 3.6 * s, y + 2.8 * s, x, y); c.closePath(); fill(c, col); line(c, edge, 0.5);
      poly(c, [[x, y], [x + e * 2.2 * s, y + 4.6 * s], [x + e * 0.4 * s, y + 4 * s]]); fill(c, col); line(c, edge, 0.4);
    }
    ell(c, x, y, 1.2 * s, 1.2 * s); fill(c, edge);
  }
  const wiggle = (st, period, amp, phase) => (st.reduced ? 0 : Math.sin(st.t / period + (phase || 0)) * amp);

  // 兩階賽璐璐上色：整塊先塗影子色，再把往左上偏移的同一個形狀塗底色，
  // 右下緣就留下一條硬邊的影子，最後描細線。path() 每次都要自己 beginPath。
  function cel(c, path, base, shade, ln, lw, dx, dy) {
    path(); fill(c, shade);
    c.save(); path(); c.clip(); c.translate(dx === undefined ? -1 : dx, dy === undefined ? -1.8 : dy); path(); fill(c, base); c.restore();
    if (ln) { path(); line(c, ln, lw || 0.6); }
  }

  // ---------- 角色共用的畫法 ----------
  const FAIR = { base: '#fff1e8', shade: '#f6cfbf', line: '#c98b7c', lip: '#a64b58' };
  const TAN = { base: '#fde0c8', shade: '#efbb9c', line: '#b97a5f', lip: '#9c4a3f' };

  function facePath(c) {
    c.beginPath(); c.moveTo(-16.6, -80); c.lineTo(-16.8, -64);
    c.bezierCurveTo(-16.6, -56.5, -12.2, -50.4, -6.4, -47.2); c.quadraticCurveTo(0, -44.6, 6.4, -47.2);
    c.bezierCurveTo(12.2, -50.4, 16.6, -56.5, 16.8, -64); c.lineTo(16.6, -80);
    c.bezierCurveTo(16, -92, -16, -92, -16.6, -80); c.closePath();
  }
  // 瀏海：頭頂圓弧加一排髮尖。tips 由右往左、尖和凹交錯，第一點和最後一點是左右兩側的下緣；
  // lean 讓髮尖往旁邊彎。round 為 true 時每一段都往下鼓成圓圓的一撮（蓬鬆髮）。
  function bangs(c, top, tips, lean, round) {
    const n = tips.length - 1, [rx, ry] = tips[0], [lx, ly] = tips[n];
    c.beginPath(); c.moveTo(lx, ly);
    c.bezierCurveTo(lx - 3, ly - 26, -14, top, 0, top);
    c.bezierCurveTo(14, top, rx + 3, ry - 26, rx, ry);
    for (let i = 1; i <= n; i++) {
      const [px, py] = tips[i - 1], [x, y] = tips[i];
      if (round) c.quadraticCurveTo((px + x) / 2, Math.max(py, y) + round, x, y);
      else c.quadraticCurveTo((px + x) / 2 + (lean || 0), (py + y) / 2 - 0.8, x, y);
    }
    c.closePath();
  }
  // 頭髮上的光環
  function shine(c, H) {
    c.strokeStyle = H.hi; c.lineWidth = 1.3;
    for (const [a0, a1] of [[1.18, 1.34], [1.42, 1.58], [1.66, 1.82]]) { c.beginPath(); c.ellipse(0, H.ringY || -85, 14.5, 7.5, 0, Math.PI * a0, Math.PI * a1); c.stroke(); }
  }

  // 大眼睛：平常、眨眼、專注（眼皮壓低、跟著球看）、開心（^ ^）、難過（含淚）、發球（往上看球）
  function eye(c, st, cx, cy, e, E) {
    const m = st.mood, lw = E.lw || 1.5, w = E.w || 5.3, h = E.h || 6.4;
    c.strokeStyle = E.lash; c.lineCap = 'round';
    if (m === 'happy') {
      c.lineWidth = lw; c.beginPath(); c.moveTo(cx - w * 0.95, cy + 1.2); c.quadraticCurveTo(cx, cy - 5.6, cx + w * 0.95, cy + 1.2); c.stroke();
      return;
    }
    if (st.blink && m !== 'sad') {
      c.lineWidth = lw * 0.9; c.beginPath(); c.moveTo(cx - w, cy - 0.4); c.quadraticCurveTo(cx, cy + 2.8, cx + w, cy - 0.4); c.stroke();
      c.lineWidth = lw * 0.5; c.beginPath(); c.moveTo(cx + e * w * 0.9, cy - 0.1); c.lineTo(cx + e * (w + 1.4), cy - 1.3); c.stroke();
      return;
    }
    const sad = m === 'sad', focus = st.focus && !sad, serve = st.serving && !sad && !focus;
    const open = sad ? 0.82 : focus ? E.focusOpen || 0.74 : E.open || 1;
    const t = (E.tilt || 0) - (sad ? 2.4 : 0), ht = h * open;
    const xi = cx - e * w, xo = cx + e * w, yi = cy + t * 0.4, yo = cy - t * 0.6;
    const top = () => { c.moveTo(xi, yi); c.bezierCurveTo(xi + e * w * 0.12, yi - ht * 1.33, xo - e * w * 0.3, yo - ht * 1.38, xo, yo); };
    const shape = () => { c.beginPath(); top(); c.bezierCurveTo(xo - e * w * 0.05, yo + h * 0.8, xi + e * w * 0.2, yi + h * 0.86, xi, yi); c.closePath(); };
    const sd = st.freeHand ? Math.sign(st.freeHand[0]) || 1 : st.freeSide || 1;
    const lx = serve ? sd * 1.3 : st.look * (E.lookK || 0.34), dy = serve ? -h * 0.3 : sad ? h * 0.16 : 0;
    const ir = w * 0.74, irh = h * 0.84, ix = cx + lx, iy = cy + h * 0.16 + dy;
    c.save(); shape(); fill(c, '#ffffff'); c.clip();
    ell(c, ix, iy, ir, irh); fill(c, E.iris);
    ell(c, ix, iy - irh * 0.66, ir * 1.3, irh * 0.62); fill(c, E.irisDark);
    ell(c, ix, iy + irh * 0.62, ir * 0.6, irh * 0.24); fill(c, E.irisLight);
    ell(c, ix, iy + irh * 0.06, ir * (E.slit && focus ? 0.17 : 0.42), irh * 0.5); fill(c, E.pupil || '#1e1730');
    ell(c, ix, iy, ir, irh); line(c, 'rgba(30,20,50,0.5)', 0.4);
    ell(c, ix - ir * 0.38, iy - irh * 0.36, ir * 0.36, irh * 0.27); fill(c, '#ffffff');
    ell(c, ix + ir * 0.42, iy + irh * 0.3, ir * 0.16, ir * 0.16); fill(c, '#ffffff');
    ell(c, cx, Math.min(yi, yo) - ht * 0.98, w * 1.5, h * 0.5); fill(c, 'rgba(70,50,110,0.2)');
    if (sad) { ell(c, cx, cy + h * 0.6, w * 1.2, h * 0.3); fill(c, 'rgba(150,210,255,0.7)'); }
    c.restore();
    c.strokeStyle = E.lash; c.lineWidth = lw; c.beginPath(); top(); c.stroke();
    c.lineWidth = lw * 0.6; c.beginPath(); c.moveTo(xo - e * 0.5, yo - 0.3); c.lineTo(xo + e * 1.5, yo - 1.5); c.stroke();
    c.lineWidth = 0.5; c.beginPath(); c.moveTo(xo - e * 0.3, yo + 1.4); c.quadraticCurveTo(xo - e * 1.2, yo + h * 0.5, xo - e * 2.8, cy + h * 0.6); c.stroke();
    if (sad) {
      const p = st.reduced ? 0.4 : ((st.t + (e > 0 ? 500 : 0)) / 1000) % 1;
      c.save(); c.globalAlpha = 1 - p * 0.8; sweat(c, xo - e * 1.6, cy + h * 0.9 + p * 7, 0.42); c.restore();
    }
  }
  function brows(c, st, P) {
    const m = st.mood, focus = st.focus && m === 'idle', B = P.browY || -69.6;
    for (const e of [-1, 1]) {
      let yi = B, yo = B - 0.5, k = -1;
      if (m === 'happy') { yi -= 1.6; yo -= 1.4; k = -1.6; }
      else if (m === 'sad') { yi -= 1.8; yo += 1.6; k = -0.3; }
      else if (focus) { yi += 1.8; yo -= 0.9; k = 0.2; }
      else if (st.serving) { yi += 0.8; yo -= 0.3; }
      const xi = e * 3.4, xo = e * 11.6;
      c.beginPath(); c.moveTo(xi, yi); c.quadraticCurveTo((xi + xo) / 2, (yi + yo) / 2 + k, xo, yo); line(c, P.brow, P.browW || 1.1);
    }
  }
  // 嘴巴；P.mouth 決定平常的樣子：smile、pout（嘟嘴）、fang（虎牙）、cat（ω）、flat、grin、sleepy
  function mouth(c, st, P) {
    const T = P.mouth || 'smile', m = st.mood, y = -51, ln = P.skin.lip, dark = '#8c3443';
    c.lineCap = 'round';
    if (m === 'happy') {
      const w = T === 'flat' ? 2.2 : 3.2, d = T === 'flat' ? 2.8 : 4.2;
      const path = T === 'cat'
        ? () => { c.beginPath(); c.moveTo(-3, y - 0.6); c.quadraticCurveTo(-1.5, y + 0.6, 0, y - 0.4); c.quadraticCurveTo(1.5, y + 0.6, 3, y - 0.6); c.quadraticCurveTo(2.2, y + 3.6, 0, y + 3.8); c.quadraticCurveTo(-2.2, y + 3.6, -3, y - 0.6); c.closePath(); }
        : () => { c.beginPath(); c.moveTo(-w, y - 0.6); c.quadraticCurveTo(0, y + 0.1, w, y - 0.6); c.quadraticCurveTo(w * 0.85, y + d, 0, y + d); c.quadraticCurveTo(-w * 0.85, y + d, -w, y - 0.6); c.closePath(); };
      path(); fill(c, dark);
      c.save(); path(); c.clip();
      ell(c, 0, y + d * 0.85, w * 0.55, d * 0.3); fill(c, '#ff8d9c');
      if (T === 'grin') { c.fillStyle = '#ffffff'; c.fillRect(-w, y - 1, w * 2, 1.4); }
      c.restore();
      path(); line(c, ln, 0.5);
      if (T === 'fang') { poly(c, [[1, y - 0.4], [2.4, y - 0.5], [1.7, y + 1.1]]); fill(c, '#ffffff'); }
      return;
    }
    if (m === 'sad') {
      c.beginPath(); c.moveTo(-2.4, y + 0.8); c.quadraticCurveTo(-1.2, y - 0.4, 0, y + 0.6); c.quadraticCurveTo(1.2, y + 1.6, 2.4, y + 0.4); line(c, ln, 0.7);
      return;
    }
    if (st.serving) { ell(c, 0, y + 0.4, 1, 1.25); fill(c, dark); return; }
    if (st.focus) {
      if (T === 'fang' || T === 'grin') { rr(c, -2.4, y - 0.6, 4.8, 1.8, 0.8); fill(c, '#ffffff'); line(c, ln, 0.5); c.beginPath(); c.moveTo(-2.2, y + 0.3); c.lineTo(2.2, y + 0.3); line(c, ln, 0.35); }
      else { c.beginPath(); c.moveTo(-1.9, y + 0.5); c.lineTo(1.9, y + 0.2); line(c, ln, 0.75); }
      return;
    }
    c.beginPath();
    if (T === 'cat') { c.arc(-1.4, y - 0.4, 1.4, 0.1, Math.PI - 0.1); c.moveTo(2.8, y - 0.4); c.arc(1.4, y - 0.4, 1.4, 0.1, Math.PI - 0.1); }
    else if (T === 'pout') { c.moveTo(-0.8, y + 0.8); c.lineTo(0.9, y - 0.3); c.lineTo(2.6, y + 0.8); }
    else if (T === 'flat') { c.moveTo(-1.5, y + 0.3); c.lineTo(1.5, y + 0.3); }
    else if (T === 'fang') { c.moveTo(-2.6, y - 0.6); c.quadraticCurveTo(0, y + 1.6, 3, y - 1.2); }
    else if (T === 'grin') { c.moveTo(-3, y - 1); c.quadraticCurveTo(0, y + 2, 3, y - 1); }
    else if (T === 'sleepy') { c.arc(0, y - 0.8, 1.3, Math.PI * 0.2, Math.PI * 0.8); }
    else c.arc(0, y - 1.4, 2.2, Math.PI * 0.18, Math.PI * 0.82);
    line(c, ln, 0.75);
    if (T === 'fang') { poly(c, [[0.8, y + 0.2], [2, y - 0.2], [1.5, y + 1.3]]); fill(c, '#ffffff'); line(c, ln, 0.3); }
  }
  // 腮紅：開心或害羞時更紅，還會加上斜線
  function blush(c, st, P) {
    const m = st.mood, a = m === 'happy' ? 0.55 : m === 'sad' ? 0.1 : P.blush || 0.24;
    for (const e of [-1, 1]) {
      ell(c, e * 10.6, -53.4, 3.4, 1.5); fill(c, `rgba(255,120,140,${a})`);
      if (m === 'happy' || (P.shy && m === 'idle')) {
        for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(e * 10.6 + k * 1.6 - 0.6, -52.6); c.lineTo(e * 10.6 + k * 1.6 + 0.6, -54.2); line(c, 'rgba(230,80,110,0.6)', 0.4); }
      }
    }
  }
  // 得分時的閃光（或愛心），失分時的陰影線和汗滴
  function effects(c, st, P) {
    if (st.mood === 'happy') {
      const p = st.reduced ? 1 : 0.8 + 0.25 * Math.sin(st.t / 150);
      if (P.hearts) { heart(c, 25, -88, p); fill(c, '#ff6f9f'); heart(c, 31, -79, 0.55 * p); fill(c, '#ff9fbf'); }
      else { c.fillStyle = P.spark || '#ffd84d'; star(c, 26, -88, 3.4 * p); c.fill(); star(c, 31, -79, 2 * p); c.fill(); star(c, -27, -84, 2.2 * p); c.fill(); }
    } else if (st.mood === 'sad') {
      c.save(); c.strokeStyle = 'rgba(95,105,190,0.6)'; c.lineWidth = 0.7;
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k * 3.2, -88 + Math.abs(k) * 1.2); c.lineTo(k * 3.2, -78 + Math.abs(k) * 0.8); c.stroke(); }
      c.restore();
      sweat(c, 22, -76, 1);
    }
  }
  function drawHead(c, st, P) {
    const S = P.skin, H = P.hair;
    for (const e of [-1, 1]) { ell(c, e * 16.7, -61, 2.3, 3.6); fill(c, S.base); line(c, S.line, 0.5); ell(c, e * 16.9, -61, 1, 1.9); fill(c, S.shade); }
    cel(c, () => facePath(c), S.base, S.shade, S.line, 0.6, -1.4, -0.4);
    // 瀏海落在額頭上的影子；失分時額頭發青
    c.save(); facePath(c); c.clip();
    if (st.mood === 'sad') { c.fillStyle = 'rgba(110,120,210,0.22)'; c.fillRect(-18, -92, 36, 22); }
    c.translate(0.6, 2.4); P.bangs(c, st); fill(c, S.shade);
    c.restore();
    for (const e of [-1, 1]) eye(c, st, e * 7.6, -59.2, e, P.eye);
    blush(c, st, P);
    c.beginPath(); c.moveTo(0.5, -55.8); c.lineTo(-0.2, -54.6); line(c, S.line, 0.55);
    mouth(c, st, P);
    if (P.face) P.face(c, st, P);
    cel(c, () => P.bangs(c, st), H.base, H.shade, H.line, 0.6);
    if (P.locks) cel(c, () => P.locks(c, st), H.base, H.shade, H.line, 0.6, -1, -1);
    if (H.hi) shine(c, H);
    brows(c, st, P);
    if (P.front) P.front(c, st, P);
    effects(c, st, P);
  }

  // 身體：脖子、上衣輪廓、短袖
  function neck(c, S) {
    const p = () => rr(c, -4.2, -52, 8.4, 10.5, 2);
    p(); fill(c, S.base);
    c.save(); p(); c.clip(); ell(c, 0, -48.6, 6.4, 3.6); fill(c, S.shade); c.restore();
  }
  function bodyPath(c, w) {
    c.beginPath(); c.moveTo(-5, -43.6); c.lineTo(5, -43.6);
    c.bezierCurveTo(10 * w, -43.2, 14.6 * w, -42.2, 16.8 * w, -39); c.bezierCurveTo(18.4 * w, -36.4, 17 * w, -27, 15.2 * w, -18);
    c.lineTo(14.8 * w, 5); c.lineTo(-14.8 * w, 5); c.lineTo(-15.2 * w, -18);
    c.bezierCurveTo(-17 * w, -27, -18.4 * w, -36.4, -16.8 * w, -39); c.bezierCurveTo(-14.6 * w, -42.2, -10 * w, -43.2, -5, -43.6);
    c.closePath();
  }
  function shortSleeves(c, O, w, cuff) {
    for (const e of [-1, 1]) {
      cel(c, () => {
        c.beginPath(); c.moveTo(e * 12.5 * w, -42.6); c.quadraticCurveTo(e * 19.6 * w, -42.6, e * 21.6 * w, -35); c.lineTo(e * 22.8 * w, -28.4);
        c.quadraticCurveTo(e * 19.6 * w, -27, e * 16.4 * w, -27.2); c.lineTo(e * 15.4 * w, -36); c.closePath();
      }, O.main, O.shade, O.line, 0.5, -0.8, -1.2);
      if (cuff) { c.beginPath(); c.moveTo(e * 22.5 * w, -29.6); c.quadraticCurveTo(e * 19.5 * w, -28.3, e * 16.5 * w, -28.5); line(c, cuff, 1.4); }
    }
  }
  function vNeck(c, S, trim, depth) {
    poly(c, [[-4.6, -43.7], [0, -43.7 + depth], [4.6, -43.7]]); fill(c, S.base);
    c.beginPath(); c.moveTo(-5.4, -43.4); c.lineTo(0, -43.4 + depth + 0.6); c.lineTo(5.4, -43.4); line(c, trim, 1.5);
  }
  function pocket(c, O) {
    cel(c, () => { c.beginPath(); c.moveTo(-9, -15); c.lineTo(9, -15); c.lineTo(12, -2.5); c.lineTo(-12, -2.5); c.closePath(); }, O.main, O.shade, O.line, 0.5, -1.2, -0.8);
  }
  // 下半身：短褲或裙子、腿、襪子、球鞋（站在地面 y = 76）
  function drawLegs(c, st, P) {
    const L = P.legs, S = P.skin;
    ell(c, 0, 76, 22, 4.4); fill(c, 'rgba(0,0,0,0.35)');
    for (const e of [-1, 1]) {
      const x = e * 6.4;
      cel(c, () => { c.beginPath(); c.moveTo(x - 3.7, 8); c.lineTo(x + 3.7, 8); c.lineTo(x + 2.9, 60); c.lineTo(x - 2.9, 60); c.closePath(); }, S.base, S.shade, S.line, 0.5, -1.2, 0);
      cel(c, () => rr(c, x - 3.1, 54, 6.2, 14, 1.6), L.sock, '#dfe3ee', '#9aa2b8', 0.4, -1, 0);
      cel(c, () => rr(c, x - 4.2, 66.5, 8.4, 9.2, 3.8), L.shoe, L.shoeShade || 'rgba(0,0,0,0.25)', '#3a3550', 0.5, -1.2, -0.6);
      c.beginPath(); c.moveTo(x - 3.8, 74); c.lineTo(x + 3.8, 74); line(c, '#ffffff', 1.1);
    }
    if (L.type === 'skirt') {
      cel(c, () => poly(c, [[-14.9, -2], [14.9, -2], [19.4, 16.5], [-19.4, 16.5]]), L.main, L.shade, L.line, 0.6, -2.2, 0);
      for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(k * 4.1, 0.5); c.lineTo(k * 5.4, 16.5); line(c, L.shade, 0.6); }
    } else {
      cel(c, () => poly(c, [[-14.9, -2], [14.9, -2], [16.6, 15], [1.8, 15], [0, 10], [-1.8, 15], [-16.6, 15]]), L.main, L.shade, L.line, 0.6, -2.2, 0);
      if (L.stripe) for (const e of [-1, 1]) { c.beginPath(); c.moveTo(e * 15.2, 0); c.lineTo(e * 16.3, 14.2); line(c, L.stripe, 1.3); }
    }
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
    hair: { base: '#a3e3d6', shade: '#74c6b8', back: '#5fb0a3', line: '#3c8c82', hi: 'rgba(240,255,251,0.9)' },
    eye: { iris: '#f2a541', irisDark: '#b8611f', irisLight: '#ffe08f', lash: '#3d2b2b' },
    brow: '#3c8c82', mouth: 'smile', spark: '#ffd84d',
    arm: { color: FAIR.base, joint: FAIR.shade, hand: FAIR.base, handR: 2.6, width: 4.6, shoulderX: 17.5 },
    legs: { type: 'skirt', main: '#44508a', shade: '#323c6c', line: '#232a4f', sock: '#ffffff', shoe: '#6fd0c1' },
    back(c, st, P) {
      const H = P.hair, s = wiggle(st, 900, 0.6);
      cel(c, () => {
        c.beginPath(); c.moveTo(0, -98);
        c.bezierCurveTo(16, -98, 23.5, -86, 22.6, -68); c.bezierCurveTo(22, -56, 22.4, -46, 25.6 + s, -37.5);
        c.quadraticCurveTo(22.4, -37.2, 19.6, -40.6); c.lineTo(-19.6, -40.6);
        c.quadraticCurveTo(-22.4, -37.2, -25.6 + s, -37.5); c.bezierCurveTo(-22.4, -46, -22, -56, -22.6, -68);
        c.bezierCurveTo(-23.5, -86, -16, -98, 0, -98); c.closePath();
      }, H.shade, H.back, H.line);
    },
    bangs(c) {
      bangs(c, -98.5, [[20.6, -60], [17.4, -73.6], [14.8, -64.4], [11.6, -74.4], [8.4, -66], [5, -75.4], [1.4, -67.4], [-2.2, -76.2],
        [-5.8, -69.4], [-9, -77], [-12.4, -71.2], [-15.4, -77.4], [-18.2, -69.6], [-20.6, -60]], 1);
    },
    locks(c) {
      c.beginPath();
      for (const e of [-1, 1]) {
        c.moveTo(e * 15.6, -82); c.bezierCurveTo(e * 21.8, -72, e * 21.6, -58, e * 20.2, -47.5);
        c.quadraticCurveTo(e * 19.2, -50.5, e * 17.4, -53); c.bezierCurveTo(e * 17, -61, e * 16.2, -70, e * 13.8, -76); c.closePath();
      }
    },
    front(c) {
      c.save(); c.translate(-13.4, -80.6); c.rotate(-0.25);
      star5(c, 0, 0, 3.4, 1.5); fill(c, '#ffd84d'); line(c, '#d39a1c', 0.5);
      c.restore();
    },
    outfit(c, st, P) {
      const O = { main: '#fbfcff', shade: '#d6dcef', line: '#8a94b3' }, T = '#6fcfc0';
      cel(c, () => bodyPath(c, 1), O.main, O.shade, O.line, 0.6, -2.6, -1);
      for (const e of [-1, 1]) { poly(c, [[e * 15.6, -26], [e * 14.8, 4.4], [e * 12.6, 4.4], [e * 13, -26]]); fill(c, T); }
      shortSleeves(c, O, 1, T);
      poly(c, [[-4.4, -43.7], [0, -38.6], [4.4, -43.7]]); fill(c, P.skin.base);
      for (const e of [-1, 1]) { poly(c, [[e * 4.4, -44.4], [e * 10.4, -41.6], [e * 3, -36.4], [0, -38.6]]); fill(c, T); line(c, '#3c8c82', 0.5); }
      c.beginPath(); c.moveTo(0, -38.6); c.lineTo(0, -31); line(c, O.line, 0.5);
      ell(c, 0.9, -34, 0.6, 0.6); fill(c, '#c9cfe0');
      text(c, 'R-11', 8.6, -29.5, 4.2, 800, '#3fae9f');
    },
  });

  // ---------- 2. 櫻・傲嬌雙馬尾 ----------
  const sakura = person({
    id: 'sakura', name: '櫻', title: '櫻・傲嬌雙馬尾', style: 'drop',
    desc: '粉紅雙馬尾、嘴硬心軟的傲嬌學妹。打法「愛放短」：常把球輕輕放在網前，逼你往前衝。',
    skin: FAIR, shy: true,
    hair: { base: '#ffb6d3', shade: '#f28fb8', back: '#e078a7', line: '#b8507f', hi: 'rgba(255,244,250,0.9)' },
    eye: { iris: '#8a96f2', irisDark: '#3f43a8', irisLight: '#d2dbff', lash: '#4a2440', tilt: 1.4 },
    brow: '#b8507f', mouth: 'pout', spark: '#ffd84d',
    arm: { color: FAIR.base, joint: FAIR.shade, hand: FAIR.base, handR: 2.5, width: 4.4, shoulderX: 17 },
    legs: { type: 'skirt', main: '#f7a6c6', shade: '#dc80a6', line: '#a8507a', sock: '#ffffff', shoe: '#ffffff', shoeShade: '#f2b8cf' },
    back(c, st, P) {
      const H = P.hair, sw = wiggle(st, 650, 2.2) + (st.mood === 'happy' ? wiggle(st, 120, 1.6) : 0);
      cel(c, () => { c.beginPath(); c.moveTo(-23, -72); c.bezierCurveTo(-26, -96, 26, -96, 23, -72); c.lineTo(22, -50); c.quadraticCurveTo(0, -45, -22, -50); c.closePath(); }, H.shade, H.back, H.line);
      for (const e of [-1, 1]) {
        const X = (x, k) => e * x + sw * k;
        cel(c, () => {
          c.beginPath(); c.moveTo(X(18, 0), -86);
          c.bezierCurveTo(X(36, 0.1), -90, X(45, 0.4), -62, X(40, 0.7), -36);
          c.bezierCurveTo(X(38, 0.85), -24, X(35, 0.95), -14, X(29, 1), -8);
          c.bezierCurveTo(X(31, 0.9), -22, X(30, 0.6), -44, X(27, 0.35), -58);
          c.bezierCurveTo(X(25, 0.2), -66, X(23, 0.1), -72, X(20, 0), -76); c.closePath();
        }, H.base, H.shade, H.line, 0.6, -e * 1.4, -1);
        c.beginPath(); c.moveTo(X(24, 0.05), -80); c.bezierCurveTo(X(37, 0.3), -66, X(37, 0.7), -40, X(32, 0.95), -16); line(c, H.shade, 0.7);
      }
    },
    bangs(c) {
      bangs(c, -98, [[22.4, -61], [19.5, -70.5], [16.5, -64.8], [12.8, -72.5], [9.2, -66], [5.4, -73.2], [1.2, -66.6], [-3, -73.4],
        [-7.2, -66], [-11, -72.6], [-14.8, -65], [-18.6, -70.6], [-22.4, -61]]);
    },
    locks(c) {
      c.beginPath();
      for (const e of [-1, 1]) {
        c.moveTo(e * 17.5, -78); c.bezierCurveTo(e * 22.5, -68, e * 22, -57, e * 20, -46.5);
        c.bezierCurveTo(e * 19, -51, e * 17.8, -57, e * 16.6, -62); c.bezierCurveTo(e * 16, -68, e * 15.5, -72, e * 15, -75); c.closePath();
      }
    },
    front(c) { for (const e of [-1, 1]) bow(c, e * 19.4, -86.4, 1, '#ffffff', '#f06a9e'); },
    outfit(c, st, P) {
      const O = { main: '#ffffff', shade: '#e6def0', line: '#a691b8' }, K = { main: '#ffb6d3', shade: '#f28fb8', line: '#b8507f' };
      cel(c, () => bodyPath(c, 0.96), O.main, O.shade, O.line, 0.6, -2.6, -1);
      shortSleeves(c, K, 0.96, '#ffffff');
      vNeck(c, P.skin, '#f07aa8', 7);
      text(c, '11', 0, -23, 10, 800, '#f07aa8');
      c.beginPath(); c.moveTo(-14.4, 3.2); c.lineTo(14.4, 3.2); line(c, '#ffb6d3', 1.4);
    },
  });

  // ---------- 3. 焰・熱血王牌 ----------
  const blaze = person({
    id: 'blaze', name: '焰', title: '焰・熱血王牌', style: 'smash',
    desc: '珊瑚紅刺蝟頭、笑起來露出虎牙的熱血少年。打法「愛扣殺」：球一彈高就全力扣殺，失誤也比較多。',
    skin: FAIR,
    hair: { base: '#ff9c72', shade: '#f2714c', back: '#d9583a', line: '#a33a26', hi: 'rgba(255,226,200,0.85)' },
    eye: { iris: '#ffc23f', irisDark: '#d0601c', irisLight: '#fff2a8', lash: '#3a1a14', tilt: 2, h: 5.6, lw: 1.7 },
    brow: '#a33a26', browW: 1.6, mouth: 'fang', spark: '#ffb02e', blush: 0.14,
    arm: { color: FAIR.base, joint: FAIR.shade, hand: FAIR.base, handR: 2.9, width: 5.2, shoulderX: 18.6 },
    legs: { type: 'shorts', main: '#43455a', shade: '#323344', line: '#1d1e2a', stripe: '#ff8a63', sock: '#ffffff', shoe: '#ff8a63' },
    back(c, st, P) {
      const H = P.hair;
      cel(c, () => poly(c, [[-20, -56], [-27.5, -64], [-24, -71], [-30, -80], [-22.5, -84], [-25.5, -95], [-14, -92], [-9.5, -100.5], [-1, -94.5],
        [8.5, -100.5], [13, -92.5], [25, -95.5], [22.5, -84.5], [30, -80], [24.4, -71], [28, -63.5], [20, -56]]), H.shade, H.back, H.line);
    },
    bangs(c) {
      bangs(c, -97.5, [[21, -60], [19.2, -70], [16.8, -62.6], [13.4, -72.6], [10.2, -64.2], [6.4, -74], [2.8, -65.4], [-1.2, -74.6],
        [-5, -66], [-8.8, -73.6], [-12.6, -64.6], [-16, -72], [-18.8, -63], [-21, -60]]);
    },
    locks(c) {
      c.beginPath();
      for (const e of [-1, 1]) { c.moveTo(e * 16.2, -77); c.lineTo(e * 20.4, -66); c.lineTo(e * 18.8, -56.5); c.lineTo(e * 16.8, -61); c.closePath(); }
    },
    outfit(c, st, P) {
      const O = { main: '#4a4c60', shade: '#36374a', line: '#202130' }, A = '#ff8a63';
      cel(c, () => bodyPath(c, 1.08), O.main, O.shade, O.line, 0.6, -2.6, -1);
      // 下襬的火焰條紋
      c.save(); bodyPath(c, 1.08); c.clip();
      c.beginPath(); c.moveTo(-17, 6); c.lineTo(-17, -4);
      for (let i = 0; i <= 8; i++) c.lineTo(-17 + i * 4.25, i % 2 ? -10.5 : -4);
      c.lineTo(17, 6); c.closePath(); fill(c, A);
      c.restore();
      shortSleeves(c, O, 1.08, A);
      vNeck(c, P.skin, A, 6);
      text(c, '11', 0, -25, 10, 800, A);
    },
  });

  // ---------- 4. 喵喵・貓耳帽T學妹 ----------
  const neko = person({
    id: 'neko', name: '喵喵', title: '喵喵・貓耳帽T學妹', style: 'trick',
    desc: '戴著橘色貓耳帽T、說話尾巴會加「喵」的學妹。打法「變化多端」：一下放短、一下打大角度，讓你猜不透。',
    skin: FAIR, hearts: true,
    hair: { base: '#ffe4b8', shade: '#f5c68c', line: '#c48a52' },
    hood: { main: '#ffad62', shade: '#f08a3c', line: '#b5612a' },
    eye: { iris: '#62d08a', irisDark: '#1f7a4a', irisLight: '#d6ffb4', lash: '#4a2a1e', tilt: 0.8, h: 6.8, slit: true },
    brow: '#c48a52', mouth: 'cat',
    arm: { color: '#ffad62', joint: '#f08a3c', hand: FAIR.base, handR: 2.8, width: 5.4, shoulderX: 17.5 },
    legs: { type: 'shorts', main: '#5b4b6e', shade: '#463a56', line: '#2c2338', sock: '#ffffff', shoe: '#ff9a5c' },
    back(c, st, P) {
      // 帽T上的尾巴：開心時猛搖，失分時垂下來
      const a = st.mood === 'happy' ? wiggle(st, 140, 0.35) : wiggle(st, 520, 0.2), P0 = [14, -4];
      const raw = st.mood === 'sad' ? [[27, 2], [38, 8], [45, 4]] : [[30, -2], [42, -28], [32, -46]];
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
      path(0, 24); line(c, P.hood.line, 7.6); path(0, 24); line(c, P.hood.main, 6.4);
      path(19, 24); line(c, '#fff3df', 6.4);
      // 帽子後面和貓耳
      const D = P.hood, droop = st.mood === 'sad' ? 0.5 : st.focus ? -0.1 : 0;
      for (const e of [-1, 1]) {
        c.save(); c.translate(e * 11, -91); c.rotate(e * droop);
        cel(c, () => poly(c, [[-e * 4.5, -1], [e * 3.2, -9.6], [e * 7.6, 4]]), D.main, D.shade, D.line, 0.5, -0.8, -1);
        poly(c, [[-e * 2, 0], [e * 2.8, -6.4], [e * 5.2, 2.4]]); fill(c, '#ffc4d2');
        c.restore();
      }
      cel(c, () => { c.beginPath(); c.moveTo(-23.5, -48); c.bezierCurveTo(-29, -80, -18, -96.5, 0, -96.5); c.bezierCurveTo(18, -96.5, 29, -80, 23.5, -48); c.closePath(); }, D.main, D.shade, D.line);
    },
    bangs(c) {
      bangs(c, -94, [[18.6, -61], [16.6, -70.6], [13.6, -64.2], [10.2, -72], [6.8, -65.4], [3, -73], [-0.8, -66.2], [-4.6, -73],
        [-8, -65.6], [-11.4, -72], [-14.4, -64.2], [-16.8, -70.6], [-18.6, -61]]);
    },
    locks(c) {
      c.beginPath();
      for (const e of [-1, 1]) {
        c.moveTo(e * 15.4, -80); c.bezierCurveTo(e * 20.6, -70, e * 20.4, -58, e * 19, -49);
        c.quadraticCurveTo(e * 18, -52, e * 16.6, -54.5); c.bezierCurveTo(e * 16.4, -62, e * 15.8, -70, e * 13.6, -76); c.closePath();
      }
    },
    face(c) {
      for (const e of [-1, 1]) for (const k of [-1, 1]) { c.beginPath(); c.moveTo(e * 13.2, -55.8 + k * 1.4); c.lineTo(e * 16, -56.4 + k * 2); line(c, '#e2a07e', 0.45); }
    },
    front(c, st, P) {
      const D = P.hood, rim = () => { c.beginPath(); c.moveTo(-21.6, -47); c.bezierCurveTo(-26.4, -80, -14, -95, 0, -95); c.bezierCurveTo(14, -95, 26.4, -80, 21.6, -47); };
      rim(); line(c, D.line, 5.4); rim(); line(c, D.main, 4.2);
    },
    outfit(c, st, P) {
      const O = P.hood;
      cel(c, () => bodyPath(c, 1), O.main, O.shade, O.line, 0.6, -2.6, -1);
      pocket(c, O);
      rr(c, -14.6, 1.6, 29.2, 3.4, 1.2); fill(c, O.shade);
      c.beginPath(); c.moveTo(-6, -43.5); c.quadraticCurveTo(0, -38.8, 6, -43.5); line(c, O.line, 0.6);
      // 胸口的肉球
      ell(c, -7.8, -27, 2.4, 2); fill(c, '#fff3df');
      for (const [x, y] of [[-10.4, -30.2], [-7.8, -31.4], [-5.2, -30.2]]) { ell(c, x, y, 0.9, 1.1); fill(c, '#fff3df'); }
      for (const e of [-1, 1]) {
        c.beginPath(); c.moveTo(e * 3, -42.5); c.quadraticCurveTo(e * 3.8, -37, e * 3.2, -31.8); line(c, '#fff3df', 0.8);
        ell(c, e * 3.2, -31, 0.7, 1.1); fill(c, '#fff3df');
      }
    },
  });

  // ---------- 5. 影・沉默的紅圍巾少年 ----------
  const kage = person({
    id: 'kage', name: '影', title: '影・紅圍巾少年', style: 'angle',
    desc: '深藍色頭髮、圍著紅色長圍巾的沉默少年。打法「愛打大角度」：專打兩邊底角，讓你左右奔跑。',
    skin: FAIR, blush: 0.12,
    hair: { base: '#5a669e', shade: '#414c80', back: '#343d6a', line: '#252c50', hi: 'rgba(205,218,255,0.55)' },
    eye: { iris: '#a8e8f2', irisDark: '#3f8aa6', irisLight: '#effcff', lash: '#1d2240', tilt: 1.2, h: 5.6 },
    brow: '#252c50', mouth: 'flat', spark: '#a6f6ff',
    arm: { color: '#3a447a', joint: '#2a325c', hand: FAIR.base, handR: 2.8, width: 5.2, shoulderX: 18.4 },
    legs: { type: 'shorts', main: '#2c3260', shade: '#20254a', line: '#12152e', stripe: '#ef4452', sock: '#20254a', shoe: '#ef4452' },
    back(c, st, P) {
      // 紅圍巾的兩條長布尾往右飄
      const amp = st.reduced ? 0 : st.mood === 'happy' ? 1.5 : 1, sad = st.mood === 'sad';
      for (const j of [0, 1]) {
        const len = j ? 44 : 58, w0 = 6.2, w1 = 3.4, bx = 9, by = -44 + j * 2.4, n = 14, pts = [];
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
        cel(c, path, j ? '#e03a48' : '#ef4452', '#b8202f', '#7a1020', 0.5, 0, -1.2);
      }
      const H = P.hair;
      cel(c, () => {
        c.beginPath(); c.moveTo(-21.5, -62); c.bezierCurveTo(-25, -88, -14, -98, 0, -98); c.bezierCurveTo(14, -98, 25, -88, 21.5, -62);
        c.lineTo(19.4, -50.5); c.lineTo(16.4, -55); c.lineTo(13.6, -47); c.lineTo(-13.6, -47); c.lineTo(-16.4, -55); c.lineTo(-19.4, -50.5); c.closePath();
      }, H.shade, H.back, H.line);
    },
    bangs(c) {
      bangs(c, -98, [[21, -60], [18.8, -69], [16.4, -62.6], [12.8, -71.6], [9.8, -64.4], [6, -73], [2.6, -64.6], [-1, -71.6],
        [-4.4, -63.8], [-7.6, -70.4], [-11.6, -60.6], [-14, -67], [-16.8, -58], [-19.4, -64.6], [-21, -60]], -0.6);
    },
    locks(c) {
      c.beginPath();
      for (const e of [-1, 1]) { c.moveTo(e * 15.8, -78); c.quadraticCurveTo(e * 21, -68, e * 19.8, -55); c.lineTo(e * 17.6, -59); c.quadraticCurveTo(e * 17, -68, e * 14, -74); c.closePath(); }
    },
    outfit(c, st, P) {
      const O = { main: '#3a447a', shade: '#2a325c', line: '#161b38' }, R = { main: '#ef4452', shade: '#b8202f', line: '#7a1020' };
      cel(c, () => bodyPath(c, 1.06), O.main, O.shade, O.line, 0.6, -2.6, -1);
      for (const e of [-1, 1]) { c.beginPath(); c.moveTo(e * 7, -43.2); c.quadraticCurveTo(e * 14, -42, e * 17.6, -37.4); line(c, '#e9ecff', 0.9); }
      c.beginPath(); c.moveTo(0, -40); c.lineTo(0, 4.6); line(c, '#1c2244', 0.8);
      rr(c, -0.9, -34, 1.8, 3, 0.6); fill(c, '#c9cfe6');
      for (const e of [-1, 1]) { c.beginPath(); c.moveTo(e * 5, -10); c.lineTo(e * 10.5, -12); line(c, O.line, 0.6); }
      // 圍巾繞在脖子上，右邊打結
      cel(c, () => { c.beginPath(); c.moveTo(-8.6, -47); c.quadraticCurveTo(0, -44, 8.6, -47); c.lineTo(9.4, -41.6); c.quadraticCurveTo(0, -37.6, -9.4, -41.6); c.closePath(); }, R.main, R.shade, R.line, 0.5, -1.2, -0.8);
      cel(c, () => poly(c, [[7.2, -40], [10.8, -40.4], [12.2, -28.4], [8.6, -29.6]]), R.main, R.shade, R.line, 0.5, -1, 0);
      cel(c, () => ell(c, 8.6, -41, 3.2, 2.8), R.main, R.shade, R.line, 0.5, -0.8, -0.8);
    },
  });

  // ---------- 6. 靜・圓框眼鏡學姊 ----------
  function glasses(c, st) {
    const col = '#6d5a98';
    for (const e of [-1, 1]) {
      const x = e * 7.6, y = -59.4, lens = () => ell(c, x, y, 6.2, 5.6);
      lens(); fill(c, 'rgba(225,235,255,0.14)');
      if (st.focus && st.mood === 'idle') {
        // 認真起來時鏡片反光
        c.save(); lens(); c.clip(); poly(c, [[x - 7, y - 1.2], [x - 1.2, y - 7], [x + 3.2, y - 7], [x - 7, y + 3.2]]); fill(c, 'rgba(255,255,255,0.85)'); c.restore();
      } else { c.beginPath(); c.moveTo(x - 4.2, y - 1.2); c.lineTo(x - 1.6, y - 3.8); line(c, 'rgba(255,255,255,0.8)', 0.7); }
      lens(); line(c, col, 0.8);
      c.beginPath(); c.moveTo(e * 13.8, -60.6); c.lineTo(e * 16.6, -62); line(c, col, 0.7);
    }
    c.beginPath(); c.moveTo(-1.4, -60.6); c.quadraticCurveTo(0, -61.8, 1.4, -60.6); line(c, col, 0.7);
  }
  const shizuka = person({
    id: 'shizuka', name: '靜', title: '靜・圓框眼鏡學姊', style: 'steady',
    desc: '戴圓框眼鏡、薰衣草色長辮子的冷靜學姊。打法「穩定不失誤」：每一球都穩穩回到桌面深處，很少失誤。',
    skin: FAIR,
    hair: { base: '#cfc0f3', shade: '#ab98e2', back: '#9583cf', line: '#6d5aa8', hi: 'rgba(248,244,255,0.9)' },
    eye: { iris: '#a384ec', irisDark: '#5a3fa0', irisLight: '#e8deff', lash: '#3b2a55', tilt: -1, h: 6.2 },
    brow: '#6d5aa8', mouth: 'smile', spark: '#fff0a0',
    arm: { color: '#cbbff1', joint: '#ab9de0', hand: FAIR.base, handR: 2.5, width: 4.6, shoulderX: 17 },
    legs: { type: 'skirt', main: '#6f6cab', shade: '#56538c', line: '#3a3866', sock: '#ffffff', shoe: '#ab98e2' },
    back(c, st, P) {
      const H = P.hair;
      cel(c, () => { c.beginPath(); c.moveTo(-22, -60); c.bezierCurveTo(-25, -88, -14, -98.5, 0, -98.5); c.bezierCurveTo(14, -98.5, 25, -88, 22, -60); c.lineTo(19, -49); c.quadraticCurveTo(0, -45, -19, -49); c.closePath(); }, H.shade, H.back, H.line);
    },
    bangs(c) {
      bangs(c, -98.5, [[21, -58], [19.4, -66.4], [16.8, -61], [13.4, -69.6], [9.6, -71.6], [5.2, -74.2], [1, -78.4], [-1.8, -74.8],
        [-5.6, -72.6], [-9.6, -70], [-13.2, -62.6], [-16.4, -67.6], [-19.4, -60], [-21, -58]]);
    },
    locks(c) {
      c.beginPath();
      for (const e of [-1, 1]) {
        c.moveTo(e * 15, -80); c.bezierCurveTo(e * 21, -70, e * 21.6, -56, e * 20.4, -43);
        c.quadraticCurveTo(e * 19.2, -46, e * 17.6, -48.6); c.bezierCurveTo(e * 17.2, -58, e * 16.4, -70, e * 13.4, -76); c.closePath();
      }
    },
    front(c, st, P) {
      const H = P.hair, sw = wiggle(st, 1100, 0.5);
      // 辮子：從右耳後面繞過肩膀垂到胸前
      for (let i = 0; i < 8; i++) {
        const k = i / 7;
        cel(c, () => ell(c, 17.2 - k * 4.4 + sw * k, -53 + i * 5.2, 3.6 - k * 0.7, 3.3, i % 2 ? 0.5 : -0.5), H.base, H.shade, H.line, 0.5, -0.8, -1);
      }
      const ex = 12.8 + sw, ey = -14;
      cel(c, () => { c.beginPath(); c.moveTo(ex - 2.4, ey + 0.6); c.quadraticCurveTo(ex - 3.2, ey + 6, ex - 0.6, ey + 9); c.quadraticCurveTo(ex + 0.4, ey + 5.4, ex + 1.2, ey + 8.4); c.quadraticCurveTo(ex + 3, ey + 4, ex + 2.4, ey + 0.6); c.closePath(); }, H.base, H.shade, H.line, 0.5);
      bow(c, ex, ey, 0.6, '#ffffff', '#9a86d6');
      glasses(c, st);
    },
    outfit(c, st, P) {
      const O = { main: '#fbfaff', shade: '#dcd6f0', line: '#8c80b8' }, Y = { main: '#cbbff1', shade: '#ab9de0' };
      cel(c, () => bodyPath(c, 0.96), O.main, O.shade, null, 0, -2.6, -1);
      c.save(); bodyPath(c, 0.96); c.clip();
      cel(c, () => { c.beginPath(); c.moveTo(-20, -44); c.lineTo(20, -44); c.lineTo(20, -33); c.quadraticCurveTo(10, -31, 5.5, -36); c.lineTo(-5.5, -36); c.quadraticCurveTo(-10, -31, -20, -33); c.closePath(); }, Y.main, Y.shade, null, 0, -2, -1);
      c.restore();
      bodyPath(c, 0.96); line(c, O.line, 0.6);
      cel(c, () => { c.beginPath(); c.moveTo(-5.6, -45.6); c.lineTo(5.6, -45.6); c.lineTo(6.2, -41.6); c.quadraticCurveTo(0, -40, -6.2, -41.6); c.closePath(); }, O.main, O.shade, O.line, 0.5, -1, 0);
      c.beginPath(); c.moveTo(0, -41); c.lineTo(0, -29); line(c, O.line, 0.7);
      rr(c, -0.9, -31, 1.8, 3, 0.6); fill(c, '#9a86d6');
      text(c, 'R-11', -8.4, -27, 3.8, 800, '#8c76d0');
    },
  });

  // ---------- 7. 颯・短髮運動少女 ----------
  const kaze = person({
    id: 'kaze', name: '颯', title: '颯・短髮運動少女', style: 'speed',
    desc: '天藍色短髮、臉上貼著OK繃的運動少女。打法「快攻」：節奏超快、球又平又急，但失誤也多一點。',
    skin: TAN,
    hair: { base: '#a2d5f7', shade: '#72b6e8', back: '#5a9fd8', line: '#3a78b0', hi: 'rgba(240,250,255,0.9)' },
    eye: { iris: '#b8e04c', irisDark: '#5f9a1f', irisLight: '#f2ffc0', lash: '#2b3445', h: 6.6 },
    brow: '#3a78b0', mouth: 'grin', spark: '#ffe14d',
    arm: { color: TAN.base, joint: TAN.shade, hand: TAN.base, handR: 2.6, width: 4.6, shoulderX: 17.5 },
    legs: { type: 'shorts', main: '#3466b0', shade: '#264f8c', line: '#173462', stripe: '#ffd96a', sock: '#ffffff', shoe: '#ffd96a' },
    back(c, st, P) {
      const H = P.hair;
      cel(c, () => {
        c.beginPath(); c.moveTo(-21, -62); c.bezierCurveTo(-25, -88, -14, -98, 0, -98); c.bezierCurveTo(14, -98, 25, -88, 21, -62);
        c.lineTo(19.6, -54); c.lineTo(17, -57); c.lineTo(15, -50); c.lineTo(-15, -50); c.lineTo(-17, -57); c.lineTo(-19.6, -54); c.closePath();
      }, H.shade, H.back, H.line);
    },
    bangs(c) {
      bangs(c, -98, [[21, -62], [19.6, -71], [17, -66], [14, -75], [10.6, -68.6], [7.4, -77], [4, -70.4], [0.4, -78],
        [-3.2, -71.6], [-6.6, -78.4], [-10, -71], [-13.2, -77.6], [-16.4, -69], [-18.8, -74.6], [-21, -62]], -1);
    },
    locks(c) {
      c.beginPath();
      for (const e of [-1, 1]) { c.moveTo(e * 15.8, -77); c.quadraticCurveTo(e * 20.8, -68, e * 19.6, -57); c.lineTo(e * 17.6, -60); c.quadraticCurveTo(e * 17, -68, e * 14.2, -72); c.closePath(); }
    },
    face(c) {
      c.save(); c.translate(12.2, -50.6); c.rotate(-0.5);
      rr(c, -3, -1, 6, 2, 0.9); fill(c, '#ffdcb8'); line(c, '#c99a74', 0.35);
      rr(c, -0.9, -0.9, 1.8, 1.8, 0.4); fill(c, '#f5c9a0');
      c.restore();
    },
    front(c) {
      for (const a of [-0.5, 0.5]) { c.save(); c.translate(12.8, -81.5); c.rotate(a); c.beginPath(); c.moveTo(-3, 0); c.lineTo(3, 0); line(c, '#ffd23f', 1.1); c.restore(); }
    },
    outfit(c, st, P) {
      const O = { main: '#ffd96a', shade: '#f0b840', line: '#b5822a' }, B = '#4aa3e8';
      cel(c, () => bodyPath(c, 1), O.main, O.shade, O.line, 0.6, -2.6, -1);
      for (const e of [-1, 1]) { poly(c, [[e * 15.6, -26], [e * 14.8, 4.4], [e * 12.6, 4.4], [e * 13, -26]]); fill(c, B); }
      shortSleeves(c, O, 1, B);
      c.beginPath(); c.moveTo(-5.4, -43.6); c.quadraticCurveTo(0, -39.4, 5.4, -43.6); line(c, B, 1.6);
      text(c, '11', 0, -25, 10, 800, B);
    },
  });

  // ---------- 8. 眠・愛睏守備少年 ----------
  const nemu = person({
    id: 'nemu', name: '眠', title: '眠・愛睏守備少年', style: 'lob',
    desc: '焦糖色亂翹頭、脖子掛著耳機的愛睏少年。打法「高吊守備」：把球又高又慢地吊回來，很少失誤，很難打穿。',
    skin: FAIR, blush: 0.18,
    hair: { base: '#dfb383', shade: '#c38f5e', back: '#a87a4e', line: '#80573a', hi: 'rgba(255,240,220,0.8)' },
    hoodie: { main: '#e6dfd2', shade: '#cbc1b0', line: '#8f8572' },
    eye: { iris: '#66cab8', irisDark: '#2f8576', irisLight: '#d8fff6', lash: '#3b2a20', tilt: -0.6, h: 6.2, open: 0.56, focusOpen: 0.92 },
    brow: '#80573a', mouth: 'sleepy', spark: '#bff3e6',
    arm: { color: '#e6dfd2', joint: '#cbc1b0', hand: FAIR.base, handR: 2.8, width: 6, shoulderX: 19 },
    legs: { type: 'shorts', main: '#5f6d80', shade: '#4a5668', line: '#2e3644', sock: '#ffffff', shoe: '#9fe0d2' },
    back(c, st, P) {
      const H = P.hair, O = P.hoodie;
      cel(c, () => { c.beginPath(); c.moveTo(-17.5, -38); c.bezierCurveTo(-19.5, -49, -9, -50.5, 0, -50.5); c.bezierCurveTo(9, -50.5, 19.5, -49, 17.5, -38); c.closePath(); }, O.main, O.shade, O.line);
      cel(c, () => {
        c.beginPath(); c.moveTo(-22, -64); c.bezierCurveTo(-26, -88, -14, -99, 0, -99); c.bezierCurveTo(14, -99, 26, -88, 22, -64);
        c.quadraticCurveTo(24.5, -56, 20.4, -50); c.quadraticCurveTo(18, -54, 15.6, -47.6); c.quadraticCurveTo(0, -45, -15.6, -47.6);
        c.quadraticCurveTo(-18, -54, -20.4, -50); c.quadraticCurveTo(-24.5, -56, -22, -64); c.closePath();
      }, H.shade, H.back, H.line);
    },
    bangs(c) {
      bangs(c, -98.5, [[21.6, -60], [18.6, -70], [14.6, -72.6], [10.2, -73.6], [5.6, -74.6], [1, -74.2], [-3.6, -74.8], [-8.2, -73.6],
        [-12.6, -72.4], [-16.8, -70.2], [-19.8, -66], [-21.6, -60]], 0, 6.5);
    },
    locks(c) {
      c.beginPath();
      for (const e of [-1, 1]) { c.moveTo(e * 15.6, -80); c.quadraticCurveTo(e * 22.4, -70, e * 20.4, -54); c.quadraticCurveTo(e * 19, -57, e * 17.4, -56); c.quadraticCurveTo(e * 17.6, -66, e * 13.8, -75); c.closePath(); }
      // 睡亂往外翹的髮尾
      c.moveTo(-20.4, -66); c.quadraticCurveTo(-25.6, -66, -26.6, -60.6); c.quadraticCurveTo(-23, -62.4, -20.6, -60); c.closePath();
      c.moveTo(20.4, -71); c.quadraticCurveTo(25.4, -72.6, 26.8, -67.2); c.quadraticCurveTo(23, -68.4, 20.6, -65.4); c.closePath();
    },
    front(c, st) {
      if (st.mood !== 'idle' || st.focus || st.serving) return;
      for (let i = 0; i < 2; i++) {
        const p = st.reduced ? 0.3 + i * 0.4 : (st.t / 1800 + i * 0.5) % 1;
        c.save(); c.globalAlpha = Math.sin(p * Math.PI); text(c, 'z', 21 + p * 5, -82 - p * 10, 4 + p * 3, 800, '#8fb8d8'); c.restore();
      }
    },
    outfit(c, st, P) {
      const O = P.hoodie;
      cel(c, () => bodyPath(c, 1.1), O.main, O.shade, O.line, 0.6, -2.6, -1);
      pocket(c, O);
      rr(c, -16, 1.6, 32, 3.4, 1.2); fill(c, O.shade);
      c.beginPath(); c.moveTo(-6, -43.5); c.quadraticCurveTo(0, -38.8, 6, -43.5); line(c, O.line, 0.6);
      for (const e of [-1, 1]) {
        c.beginPath(); c.moveTo(e * 3, -41.5); c.quadraticCurveTo(e * 3.6, -35, e * 3.4, -28.6); line(c, '#7fcfbf', 0.8);
        ell(c, e * 3.4, -27.8, 0.7, 1.1); fill(c, '#7fcfbf');
      }
      // 掛在脖子上的耳機
      c.beginPath(); c.moveTo(-9.6, -44); c.quadraticCurveTo(0, -36.6, 9.6, -44); line(c, '#3f8f80', 2.4);
      c.beginPath(); c.moveTo(-9.6, -44); c.quadraticCurveTo(0, -36.6, 9.6, -44); line(c, '#a8e6d8', 1.4);
      for (const e of [-1, 1]) { cel(c, () => ell(c, e * 10.2, -43.4, 3.4, 4.2, e * 0.2), '#a8e6d8', '#7cc9b8', '#3f8f80', 0.5, -0.8, -0.8); ell(c, e * 10.2, -43.4, 1.6, 2.2, e * 0.2); fill(c, '#5aa898'); }
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
