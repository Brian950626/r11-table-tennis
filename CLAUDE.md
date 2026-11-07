# R-11 桌球對決

瀏覽器桌球遊戲：玩家對打機器人 R-11，一局 11 分。純 HTML／CSS／JavaScript，沒有建置步驟、沒有 npm 套件，用瀏覽器直接打開 `index.html` 就能玩，GitHub Pages 也是直接放這些檔案。

## 指令

- `npm test`：跑全部測試（需要 Node.js 18 以上，不用 `npm install`）
- 單獨跑：`node rules.test.js`、`node selfplay.test.js`、`node skins.test.js`、`node records.test.js`
- 看畫面：用瀏覽器打開 `index.html`，不需要伺服器

## 檔案分工

| 檔案 | 負責 |
| --- | --- |
| `engine.js` | 球的物理、比賽規則、機器人 AI。**不能碰 DOM**，Node 測試會直接 `require` 它 |
| `records.js` | 成績紀錄、統計、排行榜和 `localStorage` 讀寫（掛在 `window.R11Records`）。**不能碰 DOM**，`records.test.js` 會直接 `require` 它 |
| `skins.js` | 機器人造型（經典、櫻、焰鋼、喵喵、影），只負責畫機器人 |
| `index.html` | 畫面繪製、觸控／滑鼠／鍵盤操控、音效、選單、計分板；CSS 和主程式都在這個檔案裡 |
| `*.test.js` | 規則、自動對打、造型、成績紀錄四組測試 |
| `.github/workflows/test.yml` | push 到 `main` 和每個 Pull Request 都會自動跑 `npm test` |

## 座標

- `engine.js` 用公尺：y 朝上（桌面 = 0），z 朝玩家為正，x 朝玩家右手為正。桌面半寬 `HX = 0.7625`、半長 `HZ = 1.37`，網高 `NET_H = 0.1525`。
- `skins.js` 用公分：y 朝下，原點在機器人中心線的桌面高度。頭中心約在 y = -64，任何東西都不能畫到 y = -104 以上（會被計分板擋到，`skins.test.js` 會檢查）。

## 規定

- 不要加框架、建置工具或 npm 套件；真的需要，先開 Issue 討論。
- 不要用 `<script type="module">` 或 `import`：用 `file://` 打開 `index.html` 時瀏覽器會擋 ES module。照現在的寫法，每個 .js 包成立即執行的函式，在瀏覽器掛到 `window`（`PingPong`、`R11Skins`），在 Node 用 `module.exports`。
- 畫面上的文字一律用繁體中文（台灣用語）。
- `localStorage` 的讀寫都要包在 `try/catch` 裡，有些瀏覽器會擋。
- 新動畫要尊重 `prefers-reduced-motion`（`index.html` 的 `reduced`、`skins.js` 的 `st.reduced`）：開啟時停止晃動或改成簡化版。
- 手機優先：改畫面後要確認 390px 寬的直向手機和桌機都正常，拖曳操控仍然順。
- 遊戲規則要符合正式桌球：11 分且領先 2 分才贏；每 2 分換發，10:10 後每分換；發球要先彈自己這邊；發球擦網後落在對面要重發。
- 改難度（`engine.js` 的 `DIFFS`）後，「難度越高 R-11 得分越多」必須仍然成立，`selfplay.test.js` 會檢查。
- 機器人造型必須是原創設計，不要畫現有的動漫角色、吉祥物或品牌圖案，這個遊戲會公開在網路上。
- 改完任何程式都要跑 `npm test`，全部通過才算完成。

## Git 流程

- 不直接在 `main` 上改：每件事開一個新分支（例如 `git switch -c add-backspin`），一個 Pull Request 只做一件事。
- commit 訊息用中文簡短寫做了什麼。
- 只有使用者說要推上去時才 `git push`。發 Pull Request 前可以用 `/pr-ready` 檢查並寫好說明。
- 合併前至少要有另一個人在手機或電腦上實際玩過。
