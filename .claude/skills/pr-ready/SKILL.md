---
name: pr-ready
description: 發 Pull Request 前的檢查：跑測試、對照 CLAUDE.md 的規定看這次的改動，並寫好中文的 PR 標題和說明。
disable-model-invocation: true
---

準備發 Pull Request：

1. 用 `git status` 和 `git diff main...HEAD`（再加上還沒 commit 的改動）看這次改了什麼。如果現在在 `main` 分支上，先提醒使用者開一個新分支。
2. 跑 `npm test`。有失敗就先說明原因和修法，不要繼續寫 PR 說明。
3. 對照 `CLAUDE.md` 的規定檢查這次的改動，特別是：
   - `engine.js` 有沒有碰到 DOM
   - 有沒有用 `type="module"`、`import`，或新增 npm 套件
   - 新的畫面文字是不是繁體中文
   - `localStorage` 有沒有包 `try/catch`
   - 新動畫有沒有處理 `reduced`
   列出有問題的地方；都沒問題就直接說沒問題。
4. 寫出 PR 的標題和說明：

   **標題**：一句話說做了什麼

   **改了什麼**：條列
   **怎麼測的**：跑了哪些測試、在什麼裝置上實際玩過
   **截圖**：畫面有改的話，提醒使用者補上手機和電腦的截圖

5. 不要自己 push 或建立 Pull Request，除非使用者明確說要。
