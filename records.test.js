// 成績紀錄測試：勝率、連勝、排行榜排序、破紀錄判斷、暱稱過濾，
// 以及 localStorage 被擋或資料壞掉時都不會出錯。
// 執行：node records.test.js
const R = require('./records.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  通過  ' : '  失敗  ') + msg); if (!cond) fails++; };
const noThrow = (fn) => { try { fn(); return true; } catch (e) { console.log('    ' + e); return false; } };
const DIFFS = ['easy', 'normal', 'hard'];

// 造一局：win 決定誰拿 11 分，lose 是輸的那邊的分數
let clock = Date.UTC(2026, 10, 1);
function game(diff, win, lose, more) {
  clock += 60000;
  return Object.assign({ at: clock, diff, skin: 'classic', name: '小明', p: win ? 11 : lose, r: win ? lose : 11, secs: 300, rally: 8 }, more);
}

// 假的 localStorage
function memStorage() {
  const m = new Map();
  return {
    map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
const brokenStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('SecurityError'); },
  removeItem() { throw new Error('SecurityError'); },
};

console.log('暱稱過濾');
ok(R.cleanName('  小明  ') === '小明', '前後空白去掉');
ok(R.cleanName('小\n明\t同  學') === '小 明 同 學', '換行、Tab、連續空白變成一個空白');
ok(R.cleanName('A​B‍C‮dcba') === 'ABCdcba', '零寬字元和文字方向控制字元去掉');
ok(R.cleanName('\u0000\u0007bell\u001B[31m') === 'bell[31m', '控制字元去掉');
ok(R.cleanName('ㅤㅤ') === '', '只有韓文填充字（看不見的名字）→ 空字串');
ok(R.cleanName('⠀ ᅟ') === '', '點字空白、填充字 → 空字串');
ok(Array.from(R.cleanName('一二三四五六七八九十甲乙丙丁')).length === 12, '中文最多 12 個字');
ok(R.cleanName('😀😀😀😀😀😀😀😀😀😀😀😀😀😀') === '😀'.repeat(12), '表情符號一個算一個字，不會切成半個');
const zalgo = R.cleanName('x́̂̃̄̅̆a');
ok(zalgo === 'x́̂a', '疊很多層的變音符號只留兩層');
ok(R.cleanName('́̂abc') === 'abc', '開頭的變音符號去掉');
ok(R.cleanName('<b>R-11</b>') === '<b>R-11</b>', '一般符號保留（畫面用 textContent 顯示，不會變成 HTML）');
ok(R.cleanName(null) === '' && R.cleanName(42) === '' && R.cleanName({}) === '' && R.cleanName(undefined) === '', '不是字串 → 空字串');
ok(R.cleanName('x'.repeat(100000)).length === 12, '超長字串不會卡住');

console.log('比分檢查');
ok(R.isFinalScore(11, 0) && R.isFinalScore(9, 11) && R.isFinalScore(12, 10) && R.isFinalScore(15, 17), '正常的終局比分');
ok(!R.isFinalScore(11, 10) && !R.isFinalScore(10, 8) && !R.isFinalScore(12, 9) && !R.isFinalScore(13, 10) && !R.isFinalScore(11, 11), '沒打完或不可能的比分');

console.log('單局紀錄');
const g1 = R.sanitizeGame(game('normal', true, 7, { secs: 312.6, name: ' 阿​華 ' }));
ok(g1 && g1.win === true && g1.p === 11 && g1.r === 7 && g1.secs === 313 && g1.name === '阿華' && g1.mode === 'cpu', '正常的一局會整理好（秒數四捨五入、暱稱過濾、預設模式）');
ok(R.sanitizeGame(game('normal', true, 7, { win: false })).win === true, '勝負照比分算，不信存進來的 win');
ok(R.sanitizeGame(game('normal', true, 7, { secs: -5, rally: 'x' })).secs === null, '比賽時間不對 → 當作不知道');
ok(R.sanitizeGame(game('normal', true, 7, { rally: 2.5 })).rally === null, '來回拍數不是整數 → 當作不知道');
ok(R.sanitizeGame(game('normal', true, 7, { skin: '<img onerror=1>' })).skin === '', '奇怪的造型 id → 空字串');
ok(R.sanitizeGame(game('normal', true, 7, { p: 11, r: 10 })) === null, '11:10 不是打完的比分 → 丟掉');
ok(R.sanitizeGame(game('', true, 7)) === null, '沒有難度 → 丟掉');
ok(R.sanitizeGame(game('normal', true, 7, { at: NaN })) === null && R.sanitizeGame(game('normal', true, 7, { at: 1e20 })) === null, '日期不對 → 丟掉');
ok(R.sanitizeGame(game('normal', true, 7, { p: '11' })) === null, '分數是字串 → 丟掉');
ok([null, 1, 'x', [], true].every((x) => R.sanitizeGame(x) === null), '不是物件 → 丟掉');

console.log('讀取壞掉的資料');
for (const raw of [null, undefined, '', '{', 'null', '42', '"x"', '{"games":"x"}', '{"games":{}}', '[1,2,3]', '{"__proto__":{"games":[1]}}']) {
  let st;
  const fine = noThrow(() => { st = R.parse(raw); });
  ok(fine && st && Array.isArray(st.games) && st.games.length === 0, `parse(${JSON.stringify(raw)}) → 空紀錄`);
}
const mixed = JSON.stringify({ v: 1, games: [game('easy', true, 3), null, 7, { p: 'a' }, game('hard', false, 5), game('normal', true, 11, { p: 13 })] });
ok(R.parse(mixed).games.length === 3, '一部分壞掉：好的留下、壞的丟掉');
ok(R.parse(JSON.stringify([game('easy', true, 3)])).games.length === 1, '舊格式（直接是陣列）也讀得到');
ok(R.parse(JSON.stringify({ v: 99, games: [game('easy', true, 3)] })).games.length === 1, '版本號不認得也盡量讀');
const many = { games: [] };
for (let i = 0; i < R.MAX_GAMES + 30; i++) many.games.push(game('easy', i % 2 === 0, 4));
const parsedMany = R.parse(JSON.stringify(many));
ok(parsedMany.games.length === R.MAX_GAMES && parsedMany.games[0].at === many.games[30].at, `最多保留最近 ${R.MAX_GAMES} 局（丟掉最舊的）`);
ok(R.parse(R.serialize({ games: [game('easy', true, 3)] })).games.length === 1, 'serialize 存的東西讀得回來');

console.log('加一局');
const s0 = R.parse(null), s1 = R.addGame(s0, game('easy', true, 3));
ok(s0.games.length === 0 && s1.games.length === 1, '回傳新資料，不改原本的');
ok(R.addGame(s1, { p: 5, r: 3 }).games.length === 1, '不合格的一局不會加進去');
ok(R.addGame(null, game('easy', true, 3)).games.length === 1, '原本資料是 null 也能加');

console.log('勝率和連勝');
let list = [
  game('easy', true, 3), game('easy', true, 5), game('easy', false, 8),
  game('normal', true, 9), game('normal', true, 10, { p: 12 }), game('normal', true, 2), game('hard', false, 4),
];
let S = R.summarize(list, DIFFS);
ok(S.played === 7 && S.won === 5 && S.lost === 2, '總共 7 局 5 勝 2 敗');
ok(Math.abs(S.rate - 5 / 7) < 1e-9 && R.formatRate(S.rate) === '71%', '總勝率 71%');
ok(S.byDiff.easy.played === 3 && S.byDiff.easy.won === 2 && R.formatRate(S.byDiff.easy.rate) === '67%', '簡單 2 勝 1 敗 67%');
ok(S.byDiff.normal.rate === 1 && S.byDiff.hard.rate === 0, '普通 100%、困難 0%');
ok(S.streak.current === 0 && S.streak.best === 3, '最後輸了 → 目前連勝 0，最高連勝 3');
list.push(game('hard', true, 6));
S = R.summarize(list, DIFFS);
ok(S.streak.current === 1 && S.streak.best === 3, '再贏一局 → 目前連勝 1');
S = R.summarize([], DIFFS);
ok(S.played === 0 && S.rate === null && S.streak.current === 0 && S.streak.best === 0 && S.bestWin === null && R.formatRate(S.rate) === '—', '沒有紀錄：勝率顯示「—」、連勝 0');
ok(S.byDiff.easy && S.byDiff.easy.played === 0 && S.byDiff.easy.top.length === 0 && S.byDiff.easy.longestRally === null, '沒有紀錄的難度也有空的統計');
ok(noThrow(() => R.summarize('壞掉', null)) && noThrow(() => R.summarize([null, {}, 3])), '亂丟東西給 summarize 不會出錯');
S = R.summarize([game('easy', true, 3), game('expert', true, 3)], DIFFS);
ok(S.byDiff.expert && S.byDiff.expert.won === 1, '不認得的難度（以後新增的）也會統計');
S = R.summarize([game('easy', true, 3), game('easy', true, 3, { mode: 'duo' })], DIFFS);
ok(S.played === 1, '其他模式（例如之後的雙人對戰）不算進對 R-11 的戰績');

console.log('排行榜');
list = [
  game('normal', true, 6, { secs: 400 }),
  game('normal', true, 2, { secs: 500, name: '阿華' }),
  game('normal', true, 2, { secs: 450, name: '小美' }),
  game('normal', true, 2, { secs: 450, name: '後來的' }),
  game('normal', false, 9, { rally: 30 }),
  game('normal', true, 9, { secs: 200, rally: 12 }),
  game('normal', true, 7, { secs: null }),
  game('normal', true, 7, { secs: 380 }),
  game('hard', true, 2, { secs: 600, name: '高手' }),
  game('easy', true, 0, { secs: 100, name: '新手' }),
];
S = R.summarize(list, DIFFS);
const top = S.byDiff.normal.top;
ok(top.length === R.TOP_N, `每個難度最多列 ${R.TOP_N} 名`);
ok(top[0].name === '小美' && top[1].name === '後來的' && top[2].name === '阿華', '分差一樣：贏得快的在前，再一樣就先做到的在前');
ok(top[3].r === 4 || (top[3].r === 6 && top[3].p - top[3].r === 5), '第 4 名是分差第二大的');
ok(top.every((g) => g.win), '排行榜只放勝利');
ok(top[3].secs === 400 && top[4].secs === 380, '分差 5 和 4 的照順序排');
ok(S.byDiff.normal.longestRally.rally === 30, '最長來回也算輸掉的那局');
ok(S.byDiff.normal.fastestWin.secs === 200, '最快勝利 200 秒');
ok(S.bestWin.name === '新手', '最大比分差的勝利：11:0 勝過 11:2');
S = R.summarize([game('easy', true, 2, { name: '簡單' }), game('hard', true, 2, { name: '困難' }), game('normal', true, 2, { name: '普通' })], DIFFS);
ok(S.bestWin.name === '困難', '分差一樣時，難度高的算最大分差勝利');
ok(S.recent.length === 3 && S.recent[0].name === '普通', '最近比賽：最新的在最前面');

console.log('破紀錄判斷');
let A = R.achievements([], game('hard', true, 4));
ok(A.firstWin && !A.bestMargin && A.streak === 1 && !A.bestStreak, '第一次贏這個難度');
const prev = [game('hard', true, 4, { rally: 10 }), game('hard', false, 7, { rally: 15 })];
A = R.achievements(prev, game('hard', true, 2, { rally: 16 }));
ok(!A.firstWin && A.bestMargin && A.longestRally, '分差和來回都破紀錄');
A = R.achievements(prev, game('hard', true, 4, { rally: 15 }));
ok(!A.bestMargin && !A.longestRally, '只追平不算破紀錄');
A = R.achievements([game('easy', true, 3), game('easy', true, 3), game('easy', false, 3), game('easy', true, 3), game('easy', true, 3)], game('easy', true, 5));
ok(A.streak === 3 && A.bestStreak, '連勝 3 場、超過之前的最高 2 場');
A = R.achievements([game('easy', true, 3)], game('easy', false, 3));
ok(A.streak === 0 && !A.bestStreak && !A.firstWin, '輸了：連勝歸零');
ok(noThrow(() => R.achievements('壞掉', null)) && R.achievements(null, { p: 3 }).streak === 0, '資料壞掉時不會出錯');

console.log('格式');
ok(R.formatDuration(0) === '0:00' && R.formatDuration(65) === '1:05' && R.formatDuration(3725) === '62:05', '比賽時間 m:ss');
ok(R.formatDuration(null) === '—' && R.formatDuration(NaN) === '—' && R.formatDuration(-1) === '—', '沒有比賽時間顯示「—」');
const local = new Date(2026, 10, 7, 9, 5).getTime();
ok(R.formatDate(local) === '2026/11/07' && R.formatShort(local) === '11/07 09:05', '日期 2026/11/07、11/07 09:05');
ok(R.formatDate(NaN) === '—' && R.formatShort('x') === '—', '日期不對顯示「—」');

console.log('localStorage');
const mem = memStorage(), store = R.createStore(mem);
ok(store.usable(), '可以存的時候 usable() 是 true');
ok(mem.map.size === 0, '檢查能不能存之後不會留下垃圾');
let res = store.record({ diff: 'normal', skin: 'neko', name: '小明', p: 11, r: 6, secs: 280, rally: 9 }, Date.UTC(2026, 10, 7));
ok(res.saved && res.game.win && res.prev.length === 0, '記一局');
res = store.record({ diff: 'normal', skin: 'neko', p: 7, r: 11, secs: 300, rally: 4 }, Date.UTC(2026, 10, 7, 1));
ok(res.saved && res.prev.length === 1 && store.load().games.length === 2, '再記一局，讀得回來兩局');
ok(store.load().games[0].skin === 'neko', '造型存的是 id');
ok(!store.record({ diff: 'normal', p: 5, r: 3 }).saved && store.load().games.length === 2, '沒打完的比分不記');
const other = R.createStore(mem);
other.record({ diff: 'easy', p: 11, r: 0 }, Date.UTC(2026, 10, 7, 2));
res = store.record({ diff: 'hard', p: 11, r: 9 }, Date.UTC(2026, 10, 7, 3));
ok(res.state.games.length === 4, '另一個分頁記的不會被蓋掉（每次都重新讀）');
ok(store.setName('  阿‮華  ') === '阿華' && store.getName() === '阿華' && mem.getItem(R.NAME_KEY) === '阿華', '暱稱過濾後存起來');
mem.setItem(R.NAME_KEY, '\u0000壞​掉');
ok(store.getName() === '壞掉', '讀出來的暱稱也會再過濾');
store.setName('   ');
ok(mem.getItem(R.NAME_KEY) === null && store.getName() === '', '暱稱清空就刪掉');
ok(store.clear() && store.load().games.length === 0, '清除紀錄');
mem.setItem(R.KEY, '{"games": [壞掉的 JSON');
ok(noThrow(() => store.load()) && store.load().games.length === 0, '存的資料壞掉 → 當作沒有紀錄');
res = store.record({ diff: 'easy', p: 11, r: 1 }, Date.UTC(2026, 10, 8));
ok(res.saved && store.load().games.length === 1, '資料壞掉之後還是能繼續記');

const blocked = R.createStore(brokenStorage);
let all = noThrow(() => {
  ok(!blocked.usable(), '被擋的時候 usable() 是 false');
  ok(blocked.load().games.length === 0, '被擋：讀到空紀錄');
  const r2 = blocked.record({ diff: 'easy', p: 11, r: 1 });
  ok(!r2.saved && r2.game && r2.game.win, '被擋：這局照樣算出結果，只是沒存');
  ok(!blocked.clear(), '被擋：清除回傳 false');
  ok(blocked.setName('小明') === '小明' && blocked.getName() === '', '被擋：暱稱存不了也不會出錯');
});
ok(all, '被擋的 localStorage 全程不會丟錯');
const none = R.createStore(null);
all = noThrow(() => { none.load(); none.record({ diff: 'easy', p: 11, r: 1 }); none.clear(); none.setName('x'); none.getName(); });
ok(all && !none.usable(), '完全沒有 localStorage 也不會出錯');
const full = memStorage();
full.setItem = () => { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; };
ok(R.createStore(full).record({ diff: 'easy', p: 11, r: 1 }).saved === false, '空間滿了：回傳沒存，不會丟錯');
const trap = {};
Object.defineProperty(trap, 'localStorage', { get() { throw new Error('SecurityError'); } });
ok(R.storageOf(trap) === null && R.storageOf(null) === null, '讀 window.localStorage 就丟錯的瀏覽器 → 當作沒有');

console.log(fails ? `\n${fails} 項失敗` : '\n全部通過');
process.exit(fails ? 1 : 0);
