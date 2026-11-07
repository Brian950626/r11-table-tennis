// R-11 機器人造型（皮膚）
// 每個造型都用 Canvas 畫在「機器人本地座標」上：單位是公分、y 朝下，
// 原點在機器人中心線、桌面高度（世界座標 y = 0）。
// 參考位置：頭中心約 y = -64，胸口約 y = -25，底座地面 y = +76。
// 頭頂最高畫到 y = -100 左右，再高會被畫面上方的計分板擋到。
//
// 新增造型：複製下面任何一個造型物件，改 id、名稱、顏色和 torso／head 的畫法，
// 再把它加進最下面的 LIST。st 參數裡有表情狀態：
//   st.mood   'idle' 平常、'happy' 剛得分、'sad' 剛失分
//   st.focus  球正朝機器人飛過來（專注）
//   st.blink  正在眨眼
//   st.look   眼睛跟著球左右看的偏移（公分，約 -3.5 ~ 3.5）
//   st.serving 機器人正在發球
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
  // 給右半邊的輪廓點（由上往下），自動補上左半邊
  function sym(half) {
    const out = half.slice();
    for (let i = half.length - 1; i >= 0; i--) if (half[i][0] !== 0) out.push([-half[i][0], half[i][1]]);
    return out;
  }
  function vg(c, y0, y1, a, b) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function hg(c, x0, x1, a, b) { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function fill(c, style) { c.fillStyle = style; c.fill(); }
  function line(c, style, w) { c.strokeStyle = style; c.lineWidth = w; c.stroke(); }
  function glow(c, st, color, cm) { c.shadowColor = color; c.shadowBlur = Math.max(0, cm * st.k); }
  function text(c, str, x, y, size, weight, color) {
    c.save(); c.translate(x, y); c.scale(size / 20, size / 20);
    c.font = `${weight} 20px "Saira Condensed", "Arial Narrow", sans-serif`;
    c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(str, 0, 0);
    c.restore();
  }
  function star(c, x, y, r) {
    c.beginPath(); c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.closePath();
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
  const wiggle = (st, period, amp, phase) => (st.reduced ? 0 : Math.sin(st.t / period + (phase || 0)) * amp);

  // 動漫風大眼睛（櫻、喵喵共用）
  function animeEye(c, st, cx, cy, e, o) {
    const lw = o.lashW || 1.6;
    c.strokeStyle = o.lash; c.lineCap = 'round';
    if (st.mood === 'happy') { c.lineWidth = lw; c.beginPath(); c.arc(cx, cy + o.h * 0.45, o.w * 0.85, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); return; }
    if (st.mood === 'sad') {
      c.lineWidth = lw; c.beginPath();
      c.moveTo(cx + e * o.w * 0.6, cy - o.h * 0.5); c.lineTo(cx - e * o.w * 0.45, cy); c.lineTo(cx + e * o.w * 0.6, cy + o.h * 0.5); c.stroke(); return;
    }
    if (st.blink) { c.lineWidth = lw * 0.9; c.beginPath(); c.arc(cx, cy - o.h * 0.35, o.w, Math.PI * 0.2, Math.PI * 0.8); c.stroke(); return; }
    const h = st.focus ? o.h * 0.74 : o.h, y = st.focus ? cy + o.h * 0.18 : cy;
    c.save();
    ell(c, cx, y, o.w, h); fill(c, '#ffffff'); c.clip();
    const ix = cx + st.look * (o.lookK || 0.35), iy = y + h * 0.1, ir = o.w * 0.84, irh = o.h * 0.86;
    ell(c, ix, iy, ir, irh); fill(c, vg(c, iy - irh, iy + irh, o.irisTop, o.irisBot));
    c.lineWidth = 0.5; c.strokeStyle = 'rgba(20,25,60,0.55)'; c.stroke();
    if (o.slit && st.focus) ell(c, ix, iy, ir * 0.2, irh * 0.78);
    else ell(c, ix, iy + irh * 0.08, ir * 0.5, irh * 0.52);
    fill(c, o.pupil || '#15183a');
    ell(c, cx, y - h * 0.98, o.w * 1.2, h * 0.45); fill(c, 'rgba(40,20,60,0.24)');
    ell(c, ix - ir * 0.36, iy - irh * 0.4, ir * 0.36, irh * 0.3); fill(c, '#ffffff');
    ell(c, ix + ir * 0.42, iy + irh * 0.38, ir * 0.17, ir * 0.17); fill(c, 'rgba(255,255,255,0.9)');
    c.restore();
    c.lineWidth = lw; c.beginPath(); c.ellipse(cx, y, o.w * 1.06, h * 1.04, 0, Math.PI * 1.06, Math.PI * 1.94); c.stroke();
    if (o.flick) { c.lineWidth = lw * 0.8; c.beginPath(); c.moveTo(cx + e * o.w * 0.98, y - h * 0.42); c.lineTo(cx + e * o.w * 1.34, y - h * 0.82); c.stroke(); }
    c.save(); c.globalAlpha = 0.5; c.lineWidth = 0.5; c.beginPath(); c.ellipse(cx, y, o.w * 0.9, h, 0, Math.PI * 0.3, Math.PI * 0.7); c.stroke(); c.restore();
  }

  // ---------- 1. 經典 R-11 ----------
  const classic = {
    id: 'classic', name: '經典', title: '經典 R-11', desc: '白色外殼、藍綠色螢幕眼睛，最原本的 R-11。',
    arm: { color: '#c7cfdd', joint: '#8e98ae', width: 6.5, shoulderX: 27 },
    pedestal: { pole: '#5d667f', base: '#2b3047' },
    torso(c) {
      rr(c, -24, -44, 48, 54, 10); fill(c, hg(c, -24, 24, '#f4f6fb', '#b9c2d6')); line(c, 'rgba(40,50,80,0.5)', 0.8);
      rr(c, -15, -30, 30, 15, 3); fill(c, '#101a2c');
      text(c, 'R-11', 0, -22.5, 10, 800, '#3ee6cf');
    },
    head(c, st) {
      c.fillStyle = '#7e889f'; c.fillRect(-5, -50, 10, 7);
      for (const e of [-1, 1]) { ell(c, e * 21, -64, 3.5, 7); fill(c, '#9aa4bb'); }
      rr(c, -21, -79.5, 42, 31, 10); fill(c, hg(c, -21, 21, '#f7f9fd', '#c2cadb')); line(c, 'rgba(40,50,80,0.5)', 0.8);
      rr(c, -16.5, -73.5, 33, 19, 6); fill(c, '#0b1424');
      c.save(); glow(c, st, 'rgba(62,230,207,0.8)', 5);
      c.strokeStyle = c.fillStyle = '#3ee6cf'; c.lineWidth = 2;
      for (const e of [-1, 1]) {
        const ox = e * 7.5, oy = -64;
        if (st.mood === 'happy') { c.beginPath(); c.arc(ox, oy + 2, 3.2, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
        else if (st.mood === 'sad') { c.beginPath(); c.moveTo(ox - e * 3, oy - 2.5); c.lineTo(ox + e * 2, oy); c.lineTo(ox - e * 3, oy + 2.5); c.stroke(); }
        else { const eh = st.blink ? 1.2 : st.focus ? 3.2 : 7; rr(c, ox - 2.6 + st.look, oy - eh / 2, 5.2, eh, 2); c.fill(); }
      }
      c.restore();
      c.beginPath(); c.moveTo(0, -79); c.lineTo(0, -90); line(c, '#8a94ab', 1.2);
      ell(c, 0, -90, 2.5, 2.5);
      fill(c, st.serving ? '#ffb627' : Math.floor(st.t / 600) % 2 === 0 ? '#3ee6cf' : '#1d6f66');
    },
  };

  // ---------- 2. 櫻・機娘 ----------
  const sakura = {
    id: 'sakura', name: '櫻', title: '櫻・機娘', desc: '粉色雙馬尾、耳機型耳朵的動漫風機器人少女。',
    arm: { color: '#f1f0f8', joint: '#ff7ab4', hand: '#ffe9dc', handR: 2.8, width: 5, shoulderX: 21 },
    pedestal: { pole: '#b9bdd6', base: '#6d5a86' },
    back(c, st) {
      const sw = wiggle(st, 650, 2.2) + (st.mood === 'happy' ? wiggle(st, 120, 1.6) : 0);
      c.beginPath(); c.moveTo(-24, -74); c.bezierCurveTo(-27, -96, 27, -96, 24, -74);
      c.lineTo(23, -50); c.quadraticCurveTo(0, -44, -23, -50); c.closePath();
      fill(c, vg(c, -94, -46, '#e0609c', '#b83f78'));
      for (const e of [-1, 1]) {
        const X = (x, w) => e * x + sw * w;
        c.beginPath(); c.moveTo(X(18, 0), -86);
        c.bezierCurveTo(X(36, 0.1), -90, X(45, 0.4), -62, X(40, 0.7), -36);
        c.bezierCurveTo(X(38, 0.85), -24, X(35, 0.95), -14, X(29, 1), -8);
        c.bezierCurveTo(X(31, 0.9), -22, X(30, 0.6), -44, X(27, 0.35), -58);
        c.bezierCurveTo(X(25, 0.2), -66, X(23, 0.1), -72, X(20, 0), -76);
        c.closePath();
        fill(c, vg(c, -90, -10, '#ffa6cf', '#d94f8c')); line(c, 'rgba(150,40,90,0.35)', 0.6);
        c.beginPath(); c.moveTo(X(24, 0.05), -80); c.bezierCurveTo(X(37, 0.3), -66, X(37, 0.7), -40, X(32, 0.95), -16); line(c, 'rgba(150,40,90,0.4)', 0.7);
        c.beginPath(); c.moveTo(X(30, 0.1), -79); c.bezierCurveTo(X(41, 0.35), -62, X(39, 0.7), -36, X(36, 0.9), -24); line(c, 'rgba(255,225,238,0.55)', 0.8);
      }
    },
    torso(c) {
      for (const e of [-1, 1]) { ell(c, e * 20, -38, 4.6, 4.6); fill(c, '#c3c6dc'); }
      c.beginPath(); c.moveTo(-15, -44); c.lineTo(15, -44); c.bezierCurveTo(20, -43.5, 21, -39, 20.5, -32);
      c.lineTo(18, 0); c.quadraticCurveTo(17.5, 7, 11, 7); c.lineTo(-11, 7); c.quadraticCurveTo(-17.5, 7, -18, 0);
      c.lineTo(-20.5, -32); c.bezierCurveTo(-21, -39, -20, -43.5, -15, -44); c.closePath();
      fill(c, hg(c, -21, 21, '#ffffff', '#d9dcef')); line(c, 'rgba(110,80,140,0.35)', 0.7);
      for (const e of [-1, 1]) { poly(c, [[e * 20.3, -31], [e * 18, 0], [e * 14.5, 0], [e * 16, -31]]); fill(c, '#ff8cc0'); }
      poly(c, [[-18, -1], [18, -1], [22, 9], [-22, 9]]); fill(c, vg(c, -1, 9, '#ff6fae', '#e0478c'));
      for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(k * 5, -1); c.lineTo(k * 6.1, 9); line(c, 'rgba(150,30,80,0.35)', 0.5); }
      rr(c, -18.5, -3.5, 37, 3.5, 1.5); fill(c, '#ffd1e6');
      c.beginPath(); c.moveTo(-10, -44); c.lineTo(0, -33); c.lineTo(10, -44); line(c, '#ff5fa2', 1.6);
      rr(c, 6.5, -31, 10, 5, 1.6); fill(c, '#2d3350');
      text(c, 'R-11', 11.5, -28.4, 3.8, 700, '#ffd1e6');
      for (const e of [-1, 1]) {
        ell(c, e * 4.4, -41, 4.2, 2.7, e * 0.35); fill(c, '#ff5fa2');
        ell(c, e * 4.4, -41, 2, 1.1, e * 0.35); fill(c, '#d93a80');
        poly(c, [[e * 1, -40], [e * 4, -32.5], [e * 1.5, -33.5]]); fill(c, '#ff5fa2');
      }
      ell(c, 0, -41, 1.9, 2.1); fill(c, '#e0478c');
    },
    head(c, st) {
      const hair = (y0, y1) => vg(c, y0, y1, '#ffb8d8', '#ee6fa8');
      rr(c, -3.6, -50, 7.2, 7, 2); fill(c, '#f2cdbd');
      rr(c, -5.5, -45.5, 11, 2.6, 1.3); fill(c, '#c9cce0');
      // 臉
      c.beginPath(); c.moveTo(-19.5, -76); c.lineTo(-19.5, -63);
      c.bezierCurveTo(-19.5, -54, -9, -46.5, 0, -46); c.bezierCurveTo(9, -46.5, 19.5, -54, 19.5, -63);
      c.lineTo(19.5, -76); c.closePath();
      fill(c, vg(c, -76, -46, '#fff3ea', '#ffe1d2'));
      // 瀏海
      c.beginPath(); c.moveTo(-23, -62);
      c.bezierCurveTo(-26, -84, -14, -96, 0, -96); c.bezierCurveTo(14, -96, 26, -84, 23, -62);
      const tips = [[19.5, -70.5], [16.5, -64.5], [12.8, -72.5], [9.2, -65.8], [5.4, -73.2], [1.2, -66.4], [-3, -73.4],
        [-7.2, -65.8], [-11, -72.6], [-14.8, -64.8], [-18.6, -70.6], [-23, -62]];
      let px = 23, py = -62;
      for (const [x, y] of tips) { c.quadraticCurveTo((px + x) / 2 + (x - px) * 0.12, (py + y) / 2 - 0.6, x, y); px = x; py = y; }
      c.closePath(); fill(c, hair(-96, -64)); line(c, 'rgba(150,40,90,0.35)', 0.6);
      c.strokeStyle = 'rgba(255,244,250,0.8)'; c.lineWidth = 1.6;
      for (const [a0, a1] of [[1.2, 1.36], [1.42, 1.58], [1.64, 1.8]]) { c.beginPath(); c.ellipse(0, -79, 16, 9, 0, Math.PI * a0, Math.PI * a1); c.stroke(); }
      // 眼睛、眉毛
      for (const e of [-1, 1]) animeEye(c, st, e * 8.6, -59.5, e, { w: 5.3, h: 6.5, irisTop: '#2a3d93', irisBot: '#4fd6ec', lash: '#3a1f3d', flick: true });
      if (st.focus && st.mood === 'idle') for (const e of [-1, 1]) { c.beginPath(); c.moveTo(e * 4, -68.2); c.lineTo(e * 12.5, -70.6); line(c, '#b8407c', 1.3); }
      // 腮紅
      const ba = st.mood === 'happy' ? 0.6 : 0.34;
      for (const e of [-1, 1]) {
        ell(c, e * 12, -52.5, 3.8, 1.9); fill(c, `rgba(255,110,150,${ba})`);
        for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(e * 12 + k * 1.7 - 0.7, -51.6); c.lineTo(e * 12 + k * 1.7 + 0.7, -53.4); line(c, 'rgba(225,70,115,0.55)', 0.45); }
      }
      // 嘴巴
      if (st.mood === 'happy') {
        c.beginPath(); c.moveTo(-2.8, -51.8); c.quadraticCurveTo(0, -51.2, 2.8, -51.8); c.quadraticCurveTo(2.2, -47.4, 0, -47.3); c.quadraticCurveTo(-2.2, -47.4, -2.8, -51.8); c.closePath();
        fill(c, '#a83a4c'); ell(c, 0, -48.4, 1.5, 0.9); fill(c, '#ff8aa0');
      } else if (st.mood === 'sad') {
        c.beginPath(); c.moveTo(-2.4, -49.8); c.quadraticCurveTo(-1.2, -51, 0, -49.8); c.quadraticCurveTo(1.2, -48.6, 2.4, -49.8); line(c, '#a04456', 0.8);
      } else if (st.focus) {
        c.beginPath(); c.moveTo(-1.5, -50.2); c.lineTo(1.5, -50.2); line(c, '#a04456', 0.8);
      } else {
        c.beginPath(); c.arc(0, -51.4, 1.9, Math.PI * 0.15, Math.PI * 0.85); line(c, '#a04456', 0.8);
      }
      // 側髮
      for (const e of [-1, 1]) {
        c.beginPath(); c.moveTo(e * 17.5, -78); c.bezierCurveTo(e * 22.5, -68, e * 22, -57, e * 20, -46.5);
        c.bezierCurveTo(e * 19, -51, e * 17.8, -57, e * 16.6, -62); c.bezierCurveTo(e * 16, -68, e * 15.5, -72, e * 15, -75); c.closePath();
        fill(c, hair(-78, -46));
      }
      // 耳機型耳朵
      for (const e of [-1, 1]) {
        c.beginPath(); c.moveTo(e * 24.5, -68); c.lineTo(e * 28.5, -77); line(c, '#f3f1fa', 1.3);
        ell(c, e * 28.8, -77.6, 1.4, 1.4); fill(c, '#ff5fa2');
        ell(c, e * 22.5, -63, 6, 6); fill(c, hg(c, e * 16.5, e * 28.5, '#ffffff', '#d9dcef')); line(c, '#ff5fa2', 1.5);
        ell(c, e * 22.5, -63, 3.2, 3.2); fill(c, '#2d3350');
        c.save(); glow(c, st, st.serving ? 'rgba(255,182,39,0.9)' : 'rgba(62,230,207,0.9)', 3);
        ell(c, e * 22.5, -63, 1.4, 1.4); fill(c, st.serving ? '#ffb627' : '#3ee6cf'); c.restore();
      }
      for (const e of [-1, 1]) { ell(c, e * 19, -86, 2.6, 2.6); fill(c, '#ff5fa2'); ell(c, e * 19 - 0.8, -86.8, 0.8, 0.8); fill(c, '#ffe3ef'); }
      // 呆毛
      const b = wiggle(st, 300, 1.4);
      c.beginPath(); c.moveTo(-1.5, -94.5); c.bezierCurveTo(-2.5, -100, 5 + b, -101.5, 7 + b, -97);
      c.bezierCurveTo(4 + b, -99, 0.5, -98, 1.8, -94.8); c.closePath(); fill(c, '#ee6fa8');
      if (st.mood === 'happy') { const p = st.reduced ? 1 : 0.8 + 0.25 * Math.sin(st.t / 150); c.fillStyle = '#ffd84d'; star(c, 28, -90, 3.4 * p); c.fill(); star(c, 32, -82, 1.9 * p); c.fill(); }
      if (st.mood === 'sad') sweat(c, 26, -79, 1);
    },
  };

  // ---------- 3. 焰鋼・熱血機甲 ----------
  function flame(c, x, B, h, w) {
    c.beginPath(); c.moveTo(x - 7 * w, B);
    c.quadraticCurveTo(x - 9 * w, B - h * 0.55, x - 5.5 * w, B - h * 0.68);
    c.quadraticCurveTo(x - 4.6 * w, B - h * 0.45, x - 2.8 * w, B - h * 0.42);
    c.quadraticCurveTo(x - 3.4 * w, B - h * 0.8, x, B - h);
    c.quadraticCurveTo(x + 3.2 * w, B - h * 0.78, x + 2.8 * w, B - h * 0.42);
    c.quadraticCurveTo(x + 4.8 * w, B - h * 0.5, x + 6 * w, B - h * 0.74);
    c.quadraticCurveTo(x + 9.2 * w, B - h * 0.4, x + 7 * w, B);
    c.closePath();
  }
  const blaze = {
    id: 'blaze', name: '焰鋼', title: '焰鋼・熱血機甲', desc: '火焰頭冠、胸口發光核心的熱血動畫機甲。',
    arm: { color: '#3b4252', joint: '#ff6a2a', hand: '#262b36', handR: 3.8, width: 7.5, shoulderX: 27 },
    pedestal: { pole: '#3b4252', base: '#1c2029' },
    back(c, st) {
      for (const e of [-1, 1]) {
        c.save(); c.translate(e * 22.5, -50); c.rotate(e * 0.12);
        rr(c, -4, -16, 8, 22, 2); fill(c, hg(c, -4, 4, '#4f576d', '#22262f')); line(c, '#14171d', 0.7);
        rr(c, -5, -18, 10, 4, 1.5); fill(c, '#ff6a2a'); line(c, '#14171d', 0.5);
        if (st.mood === 'happy') { ell(c, 0, -20.5 - wiggle(st, 60, 0.8), 2.6, 3.2); fill(c, 'rgba(255,200,80,0.85)'); }
        c.restore();
      }
    },
    torso(c, st) {
      rr(c, -14, -8, 28, 15, 3); fill(c, '#2a2f3a');
      poly(c, [[-25, -44], [25, -44], [27, -38], [22, -13], [14, -5], [-14, -5], [-22, -13], [-27, -38]]);
      fill(c, vg(c, -44, -5, '#4f576d', '#262b36')); line(c, '#14171d', 0.8);
      c.beginPath(); c.moveTo(-22.5, -42.3); c.lineTo(22.5, -42.3); line(c, 'rgba(255,255,255,0.18)', 1);
      c.beginPath(); c.moveTo(-10, -12); c.lineTo(10, -12); c.moveTo(-8, -8.5); c.lineTo(8, -8.5); line(c, '#14171d', 0.7);
      for (const e of [-1, 1]) { rr(c, e * 13 - 4, -33, 8, 1.8, 0.9); fill(c, '#ffc93f'); }
      const sad = st.mood === 'sad', pulse = st.reduced ? 1 : 1 + 0.07 * Math.sin(st.t / 170);
      c.save(); glow(c, st, sad ? 'rgba(255,120,40,0.3)' : 'rgba(255,120,40,0.85)', st.mood === 'happy' ? 8 : 6);
      const g = c.createRadialGradient(0, -27, 0.5, 0, -27, 6.4 * pulse);
      g.addColorStop(0, sad ? '#d9a27a' : '#fff6cf'); g.addColorStop(0.45, sad ? '#b5612f' : '#ff9a3d'); g.addColorStop(1, '#a8340f');
      ell(c, 0, -27, 6.4 * pulse, 6.4 * pulse); fill(c, g); c.restore();
      ell(c, 0, -27, 7.2, 7.2); line(c, '#ffc93f', 1.2);
      text(c, 'R-11', 0, -16.5, 4.8, 800, '#ffc93f');
      for (const e of [-1, 1]) {
        c.save(); c.translate(e * 27.5, -40); c.rotate(e * 0.2);
        poly(c, [[-9, -6], [9, -6], [11.5, 6.5], [-11.5, 6.5]]); fill(c, vg(c, -6, 6.5, '#ff8040', '#c8441a')); line(c, '#ffc93f', 1.1);
        rr(c, -7.5, -1.2, 15, 2.2, 1); fill(c, 'rgba(255,201,63,0.9)');
        c.restore();
      }
    },
    head(c, st) {
      rr(c, -5.5, -51, 11, 8, 2); fill(c, '#2a2f3a');
      for (const e of [-1, 1]) { poly(c, [[e * 17, -73], [e * 28, -85], [e * 23.5, -66]]); fill(c, vg(c, -85, -66, '#ffc93f', '#ff6a2a')); line(c, '#14171d', 0.6); }
      poly(c, sym([[0, -87], [11, -86], [18, -79], [19.5, -68], [18, -57], [13, -50], [6, -46.5], [0, -46.5]]));
      fill(c, vg(c, -87, -46, '#5a6379', '#272c37')); line(c, '#14171d', 1);
      poly(c, [[-11.5, -84.5], [11.5, -84.5], [9, -78.5], [-9, -78.5]]); fill(c, vg(c, -84.5, -78.5, '#ffe07a', '#e8a21e'));
      const fl = (st.reduced ? 1 : 1 + 0.07 * Math.sin(st.t / 85)) * (st.mood === 'happy' ? 1.2 : st.mood === 'sad' ? 0.7 : 1);
      flame(c, 0, -84, 12 * fl, 1); fill(c, vg(c, -84 - 12 * fl, -84, '#ffe36a', '#ff4f1a'));
      flame(c, 0, -84, 7 * fl, 0.6); fill(c, 'rgba(255,248,200,0.85)');
      // 眼睛
      const lx = st.look * 0.25;
      for (const e of [-1, 1]) { poly(c, [[e * 2.2, -66.2], [e * 15.6, -69.6], [e * 16.4, -61.6], [e * 3.2, -59.2]]); fill(c, '#0d0f14'); }
      c.save();
      if (st.mood === 'sad') {
        for (const e of [-1, 1]) { poly(c, [[e * 3.6 + lx, -62.6], [e * 14 + lx, -61.4], [e * 14.4 + lx, -60], [e * 4 + lx, -60.8]]); fill(c, '#8a4b1c'); }
      } else if (st.mood === 'happy') {
        glow(c, st, 'rgba(255,170,40,0.95)', 5);
        for (const e of [-1, 1]) { c.beginPath(); c.moveTo(e * 4 + lx, -61); c.lineTo(e * 9.5 + lx, -66.4); c.lineTo(e * 14.6 + lx, -62.6); line(c, '#fff3a0', 1.6); }
      } else if (st.blink) {
        for (const e of [-1, 1]) { poly(c, [[e * 3.6, -63], [e * 14.6, -64.4], [e * 14.6, -63.4], [e * 3.6, -62.2]]); fill(c, '#ffe066'); }
      } else {
        const f = st.focus;
        glow(c, st, 'rgba(255,170,40,0.95)', f ? 7 : 4.5);
        for (const e of [-1, 1]) {
          poly(c, f ? [[e * 3.4 + lx, -64.2], [e * 14.4 + lx, -67], [e * 14.9 + lx, -64.2], [e * 4.2 + lx, -62.4]]
            : [[e * 3.2 + lx, -64.6], [e * 14 + lx, -67.8], [e * 14.8 + lx, -62.8], [e * 4.2 + lx, -61]]);
          fill(c, f ? '#fffbe0' : '#ffe45c');
        }
      }
      c.restore();
      poly(c, sym([[0, -60.5], [8.5, -59], [7.2, -51], [3, -48.2], [0, -48.2]])); fill(c, vg(c, -60.5, -48, '#727c92', '#414859'));
      for (const y of [-55.6, -53.4, -51.2]) { c.beginPath(); c.moveTo(-3.6, y); c.lineTo(3.6, y); line(c, '#1c2029', 0.7); }
      for (const e of [-1, 1]) { poly(c, [[e * 11.8, -57.5], [e * 16.6, -59.5], [e * 15.6, -56.8], [e * 11.4, -54.8]]); fill(c, '#ff6a2a'); }
      if (st.mood === 'happy') {
        const L = 3.2 + wiggle(st, 120, 1.4);
        for (const [x, y, a] of [[-22, -86, -2.4], [23, -89, -0.8], [27, -75, -0.2]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); line(c, '#ffc93f', 1.2); }
      }
      if (st.mood === 'sad') {
        for (let i = 0; i < 3; i++) {
          const p = st.reduced ? 0.3 + i * 0.25 : (st.t / 1100 + i / 3) % 1;
          ell(c, 5 + i * 3 + Math.sin(p * 6) * 1.5, -88 - p * 9, 2 + p * 2.5, 2 + p * 2.5); fill(c, `rgba(165,170,185,${((1 - p) * 0.55).toFixed(3)})`);
        }
      }
    },
  };

  // ---------- 4. 喵喵・貓咪機器人 ----------
  const neko = {
    id: 'neko', name: '喵喵', title: '喵喵・貓咪機器人', desc: '橘色虎斑貓耳、發光鬍鬚，開心時會猛搖尾巴。',
    arm: { color: '#f39a3e', joint: '#e07d26', hand: '#fff4e3', handR: 3.9, width: 7, shoulderX: 21 },
    pedestal: { pole: '#7a6352', base: '#3a2f2a' },
    back(c, st) {
      const a = st.mood === 'happy' ? wiggle(st, 140, 0.35) : wiggle(st, 520, 0.2);
      const P0 = [15, -4];
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
      path(0, 24); line(c, '#f39a3e', 6.5);
      path(20, 24); line(c, '#fff4e3', 6.5);
      c.lineCap = 'butt';
      for (const i of [7, 11, 15]) {
        const p = pts[i], q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, nx = (-dy / L) * 3.1, ny = (dx / L) * 3.1;
        c.beginPath(); c.moveTo(p[0] + nx, p[1] + ny); c.lineTo(p[0] - nx, p[1] - ny); line(c, '#d96d1c', 2.2);
      }
      c.lineCap = 'round';
    },
    torso(c) {
      for (const e of [-1, 1]) { ell(c, e * 19, -36, 5, 5); fill(c, '#f39a3e'); }
      rr(c, -20, -44, 40, 52, 17); fill(c, vg(c, -44, 8, '#ffb15c', '#ee8a2e')); line(c, 'rgba(150,70,20,0.35)', 0.7);
      c.beginPath(); c.moveTo(-12, -42); c.bezierCurveTo(-13, -24, -7, -9, 0, -5); c.bezierCurveTo(7, -9, 13, -24, 12, -42); c.closePath(); fill(c, '#fff4e3');
      for (const e of [-1, 1]) for (let k = 0; k < 3; k++) {
        c.beginPath(); c.moveTo(e * 19.6, -30 + k * 8); c.quadraticCurveTo(e * 17, -29 + k * 8, e * 14.8, -26.5 + k * 8); line(c, '#d96d1c', 2);
      }
      rr(c, -14, -46, 28, 4.6, 2.3); fill(c, '#2ec4b6');
      c.beginPath(); c.moveTo(0, -41.8); c.lineTo(0, -43); line(c, '#c9ced9', 0.8);
      ell(c, 0, -38.6, 3.6, 3.6); fill(c, '#ffffff'); line(c, '#cfd4e2', 0.5);
      ell(c, -1.1, -39.8, 1, 0.8); fill(c, 'rgba(255,255,255,0.9)');
    },
    head(c, st) {
      const droop = st.mood === 'sad' ? 0.6 : st.focus ? -0.1 : 0;
      for (const e of [-1, 1]) {
        c.save(); c.translate(e * 13.5, -80); c.scale(e, 1); c.rotate(droop);
        poly(c, [[-8, 3], [4.5, -15], [9.5, 2.5]]); fill(c, vg(c, -15, 3, '#ffbd6b', '#f2902f')); line(c, 'rgba(150,70,20,0.45)', 0.6);
        poly(c, [[-4.2, 1.2], [3.8, -10.2], [6.6, 1]]); fill(c, '#ffb3c6');
        c.restore();
      }
      ell(c, 0, -67, 24.5, 20.5); fill(c, vg(c, -88, -47, '#ffbf70', '#f08f30')); line(c, 'rgba(150,70,20,0.4)', 0.6);
      for (const e of [-1, 1]) { poly(c, [[e * 23.6, -63], [e * 27.6, -60.5], [e * 23.4, -57.5]]); fill(c, '#f08f30'); }
      c.fillStyle = '#d96d1c';
      poly(c, [[-1.7, -87.4], [1.7, -87.4], [0, -80]]); c.fill();
      poly(c, [[-9, -85.6], [-5.6, -86.8], [-6.6, -80.4]]); c.fill();
      poly(c, [[9, -85.6], [5.6, -86.8], [6.6, -80.4]]); c.fill();
      ell(c, 0, -56.5, 15.5, 9.5); fill(c, '#fff4e3');
      for (const e of [-1, 1]) animeEye(c, st, e * 9.6, -66, e, { w: 5.4, h: 5.8, irisTop: '#1f7a4a', irisBot: '#9df07f', lash: '#4a2a1e', slit: true, lookK: 0.3, lashW: 1.4 });
      for (const e of [-1, 1]) { ell(c, e * 15.5, -58.5, 3, 1.6); fill(c, `rgba(255,110,140,${st.mood === 'happy' ? 0.6 : 0.36})`); }
      poly(c, [[-1.7, -60.2], [1.7, -60.2], [0, -58.3]]); fill(c, '#ff7f9f');
      c.strokeStyle = '#7a3b2e'; c.lineWidth = 0.8;
      if (st.mood === 'sad') { c.beginPath(); c.arc(0, -54.4, 2.2, Math.PI * 1.2, Math.PI * 1.8); c.stroke(); }
      else {
        c.beginPath(); c.moveTo(0, -58.3); c.lineTo(0, -57.4); c.stroke();
        c.beginPath(); c.arc(-1.75, -57.4, 1.75, 0, Math.PI); c.moveTo(3.5, -57.4); c.arc(1.75, -57.4, 1.75, 0, Math.PI); c.stroke();
        if (st.mood === 'happy') {
          c.beginPath(); c.moveTo(-2.3, -56); c.quadraticCurveTo(0, -51.8, 2.3, -56); c.closePath(); fill(c, '#a8463c');
          ell(c, 0, -54, 1.2, 0.8); fill(c, '#ff8fa3');
        }
      }
      c.save(); glow(c, st, 'rgba(110,230,255,0.9)', 2.5);
      for (const e of [-1, 1]) for (const k of [-1, 0, 1]) { c.beginPath(); c.moveTo(e * 10.5, -57 + k * 1.7); c.lineTo(e * 27, -59 + k * 3.6); line(c, '#8af0ff', 0.7); }
      c.restore();
      if (st.mood === 'happy') { const p = st.reduced ? 1 : 0.85 + 0.2 * Math.sin(st.t / 140); heart(c, 25, -88, p); fill(c, '#ff6f9f'); heart(c, 31, -80, 0.55 * p); fill(c, '#ff9fbf'); }
      if (st.mood === 'sad') sweat(c, 26, -77, 1);
    },
  };

  // ---------- 5. 影・忍者機 ----------
  const kage = {
    id: 'kage', name: '影', title: '影・忍者機', desc: '深藍頭巾、紅色長圍巾隨風飄動的忍者風機器人。',
    arm: { color: '#2b3160', joint: '#4b5592', hand: '#14182e', handR: 3.3, width: 6.2, shoulderX: 23 },
    pedestal: { pole: '#2b3160', base: '#14182e' },
    back(c, st) {
      const amp = st.reduced ? 0 : st.mood === 'happy' ? 1.5 : 1, sad = st.mood === 'sad';
      // 頭巾在腦後打結，兩條短布尾往左飄
      for (const j of [0, 1]) {
        const w = Math.sin(st.t / 180 - j * 0.9) * 2.2 * amp, droop = sad ? 9 : 0;
        c.beginPath(); c.moveTo(-15, -80 + j * 3);
        c.quadraticCurveTo(-24, -84 + j * 4 + w * 0.5 + droop * 0.4, -32 - j * 3, -80 + j * 6 + w + droop);
        c.lineTo(-30.5 - j * 3, -76.5 + j * 6 + w + droop);
        c.quadraticCurveTo(-23, -78 + j * 4 + w * 0.4 + droop * 0.4, -15, -76 + j * 3);
        c.closePath(); fill(c, j ? '#262d5a' : '#323a70');
      }
      for (const j of [0, 1]) {
        const len = j ? 44 : 58, w0 = 6.2, w1 = 3.4, bx = 9, by = -45 + j * 2.4, n = 14, pts = [];
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
        c.beginPath(); c.moveTo(top[0][0], top[0][1]);
        for (const p of top) c.lineTo(p[0], p[1]);
        for (let i = n; i >= 0; i--) c.lineTo(bot[i][0], bot[i][1]);
        c.closePath(); fill(c, hg(c, bx, bx + len, j ? '#c62a3a' : '#ef4452', '#9e1626'));
      }
    },
    torso(c) {
      poly(c, sym([[0, -44], [22, -44], [24.5, -36], [20.5, -8], [13, 1], [0, 2]])); fill(c, vg(c, -44, 2, '#3a4374', '#1a1e38')); line(c, '#0e1124', 0.8);
      c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -9); line(c, 'rgba(0,0,0,0.3)', 0.7);
      c.lineCap = 'butt';
      c.beginPath(); c.moveTo(-19, -41); c.lineTo(14, -2); line(c, '#6b5240', 4.4);
      c.setLineDash([1.2, 1.2]); c.beginPath(); c.moveTo(-19, -41); c.lineTo(14, -2); line(c, 'rgba(255,220,170,0.45)', 0.4); c.setLineDash([]);
      c.lineCap = 'round';
      ell(c, -4.2, -23.5, 4.2, 4.2); fill(c, vg(c, -27.7, -19.3, '#e3e8f5', '#9aa3bd')); line(c, '#59607a', 0.5);
      ell(c, -4.8, -24.4, 1.9, 2.1, -0.5); fill(c, '#1a1e38');
      c.beginPath(); c.moveTo(-3.8, -22.6); c.lineTo(-2.7, -21); line(c, '#1a1e38', 0.9);
      rr(c, -20.5, -8.5, 41, 4, 1); fill(c, '#14182e');
      rr(c, -2.6, -9, 5.2, 5, 1); fill(c, '#9aa3bd');
      for (const e of [-1, 1]) {
        c.save(); c.translate(e * 22, -40.5); c.rotate(e * 0.28);
        rr(c, -7.5, -4.6, 15, 9.2, 4); fill(c, vg(c, -4.6, 4.6, '#56609e', '#262c52')); line(c, '#0e1124', 0.6);
        c.restore();
      }
    },
    head(c, st) {
      rr(c, -13, -49.5, 26, 7.5, 3.6); fill(c, vg(c, -49.5, -42, '#ff5a64', '#c22436'));
      c.beginPath(); c.moveTo(-10, -46.5); c.quadraticCurveTo(0, -44.5, 10, -46.5); line(c, 'rgba(120,10,25,0.45)', 0.6);
      ell(c, 10.5, -45.5, 3.6, 3.1); fill(c, '#b21e2f');
      c.beginPath(); c.moveTo(0, -89.5);
      c.bezierCurveTo(13, -89.5, 21.5, -81, 21.5, -67); c.bezierCurveTo(21.5, -56, 15, -48.5, 0, -47.5);
      c.bezierCurveTo(-15, -48.5, -21.5, -56, -21.5, -67); c.bezierCurveTo(-21.5, -81, -13, -89.5, 0, -89.5); c.closePath();
      fill(c, vg(c, -89.5, -47.5, '#3d4682', '#191d38')); line(c, '#0c0f22', 0.9);
      c.beginPath(); c.arc(0, -67, 19.5, Math.PI * 1.15, Math.PI * 1.45); line(c, 'rgba(255,255,255,0.14)', 1.4);
      rr(c, -20.4, -80.5, 40.8, 4.2, 2); fill(c, '#262d5a');
      rr(c, -16.5, -72, 33, 11.5, 5.2); fill(c, '#06070f'); line(c, 'rgba(120,230,255,0.25)', 0.5);
      c.beginPath(); c.moveTo(-11, -55); c.quadraticCurveTo(0, -51.5, 11, -55); line(c, 'rgba(0,0,0,0.35)', 0.8);
      c.beginPath(); c.moveTo(-6.5, -51.2); c.quadraticCurveTo(0, -49.6, 6.5, -51.2); line(c, 'rgba(0,0,0,0.3)', 0.7);
      const lx = st.look * 0.3;
      c.save(); glow(c, st, 'rgba(120,230,255,0.95)', st.focus ? 6 : 4);
      c.fillStyle = c.strokeStyle = st.focus ? '#e9fdff' : '#a6f6ff';
      for (const e of [-1, 1]) {
        const cx = e * 7.4 + lx, cy = -66.2;
        if (st.mood === 'happy') { c.lineWidth = 1.3; c.beginPath(); c.arc(cx, cy + 2, 3.2, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
        else if (st.mood === 'sad') { c.lineWidth = 1.1; c.beginPath(); c.moveTo(cx - e * 2.8, cy - 0.2); c.lineTo(cx + e * 3, cy + 1.2); c.stroke(); }
        else if (st.blink) { c.lineWidth = 0.9; c.beginPath(); c.moveTo(cx - 3.4, cy + 0.4); c.lineTo(cx + 3.4, cy + 0.4); c.stroke(); }
        else {
          const h = st.focus ? 2.1 : 3.3;
          c.beginPath(); c.moveTo(cx - 3.9, cy + 0.3); c.quadraticCurveTo(cx, cy - h, cx + 3.9, cy + 0.3); c.quadraticCurveTo(cx, cy + h * 0.65, cx - 3.9, cy + 0.3); c.fill();
        }
      }
      c.restore();
      if (st.mood === 'sad') sweat(c, 24.5, -75, 1);
      if (st.mood === 'happy') { const p = st.reduced ? 1 : 0.8 + 0.25 * Math.sin(st.t / 150); c.fillStyle = '#a6f6ff'; star(c, 26, -88, 3 * p); c.fill(); }
    },
  };

  // ---------- 共用：底座、手臂、整體繪製順序 ----------
  function pedestal(c, skin) {
    const p = skin.pedestal || classic.pedestal;
    ell(c, 0, 76, 34, 7); fill(c, 'rgba(0,0,0,0.4)');
    c.fillStyle = p.pole; c.fillRect(-6, 12, 12, 64);
    rr(c, -22, 66, 44, 12, 5); fill(c, p.base);
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
  // 畫整隻機器人（不含擊球的那隻手，那隻手在遊戲裡用 3D 位置另外畫）
  // opt.bust = true：選單縮圖用，只畫上半身，另一隻手拿著小球拍
  function draw(c, skin, st, opt) {
    opt = opt || {};
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    if (!opt.bust) pedestal(c, skin);
    c.translate(0, -st.bob);
    if (skin.back) skin.back(c, st);
    arm(c, skin, st.freeSide, st.freeHand, false);
    if (opt.bust) arm(c, skin, -st.freeSide, null, true);
    skin.torso(c, st);
    skin.head(c, st);
    c.restore();
  }

  const LIST = [classic, sakura, blaze, neko, kage];
  const byId = {};
  for (const s of LIST) byId[s.id] = s;
  const API = { list: LIST, byId, draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.R11Skins = API;
})(this);
