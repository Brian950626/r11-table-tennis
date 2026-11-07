---
name: new-skin
description: 新增一個 R-11 對手造型（動漫風原創角色）到 skins.js，畫出所有表情、指定打法並跑測試。使用者想要新造型、新角色外觀或新皮膚時使用。
argument-hint: [造型的主題或描述]
---

幫 R-11 新增一個造型：$ARGUMENTS

1. 先讀 `skins.js` 最上面的說明，再看 `classic`（最簡單）和 `sakura`（有雙馬尾和髮飾）兩個造型，照同樣的 `person({...})` 結構寫。
2. 依照主題設計一個原創角色，畫風跟其他造型一致：細線條、兩階賽璐璐陰影（用 `cel()`，不用漸層）、偏淡的粉彩色、有高光的大眼睛。不要畫現有的動漫角色、髮型組合、制服、吉祥物或品牌圖案；如果主題本身就是某個現有角色，先跟使用者說明，並提議一個原創的替代設計。
3. `person({...})` 需要：
   - `id`：英文小寫，不能和 `LIST` 裡已有的重複
   - `name`：選單上的短名字（1～3 個字）
   - `title`、`desc`：繁體中文；`desc` 先一句外觀，再寫「打法「名稱」：……」
   - `style`：打法，選 `engine.js` 裡 `STYLES` 的一個；要新的打法就加進 `STYLES`
   - `skin`（`FAIR` 或 `TAN`）、`hair`、`eye`、`brow`、`mouth`：顏色和眼型、嘴型
   - `arm`：`color`、`joint`、`hand`、`handR`、`width`、`shoulderX`（短袖用膚色，長袖用袖子的顏色）
   - `legs`：短褲（`shorts`）或裙子（`skirt`）、襪子、鞋子的顏色
   - `bangs(c, st)` 瀏海、`outfit(c, st, P)` 衣服；需要的話加 `locks` 側髮、`back` 身體後面的東西（後髮、馬尾、尾巴、圍巾）、`face` 臉上的東西、`front` 眼鏡或髮飾
4. 眼睛、眉毛、嘴巴、腮紅、得分和失分的特效都由共用的畫法處理，確認每種狀態都看得出差別：平常、`st.blink` 眨眼、`st.focus` 專注（眼睛跟著 `st.look` 左右看）、`st.mood === 'happy'` 剛得分、`st.mood === 'sad'` 剛失分、`st.serving` 發球中。
5. 會晃動的部分用檔案裡的 `wiggle()`，它在 `st.reduced` 時會自動停止。
6. 把新造型加進檔案最下面的 `LIST`。
7. 跑 `npm test`：`skins.test.js` 檢查高度和說明，`selfplay.test.js` 檢查這個打法也是「難度越高 R-11 得分越多」，全部通過才算完成。超出高度限制時，把頭頂的東西往下移或縮小。
8. 告訴使用者怎麼預覽：用瀏覽器打開 `index.html`，在「機器人造型」選新造型；比賽中按暫停也能切換。
