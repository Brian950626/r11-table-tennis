---
name: new-skin
description: 新增一個 R-11 機器人造型到 skins.js，畫出所有表情並跑測試。使用者想要新造型、新角色外觀或新皮膚時使用。
argument-hint: [造型的主題或描述]
---

幫 R-11 新增一個造型：$ARGUMENTS

1. 先讀 `skins.js` 最上面的說明，再看 `classic`（最簡單）和 `sakura`（表情最完整）兩個造型，照同樣的結構寫。
2. 依照主題設計一個原創造型。不要畫現有的動漫角色、吉祥物或品牌圖案；如果主題本身就是某個現有角色，先跟使用者說明，並提議一個原創的替代設計。
3. 新的造型物件需要：
   - `id`：英文小寫，不能和 `LIST` 裡已有的重複
   - `name`：選單上的短名字（1～3 個字）
   - `title`、`desc`：繁體中文，`desc` 寫一句話
   - `arm`：`color`、`joint`、`width`、`shoulderX`；要畫手掌就加 `hand`、`handR`
   - `pedestal`：底座的 `pole`、`base` 顏色
   - `torso(c, st)`、`head(c, st)`；身體後面的東西（頭髮、尾巴、披風）寫在 `back(c, st)`
4. 每種狀態都要畫得出來，而且看得出差別：平常、`st.blink` 眨眼、`st.focus` 專注（眼睛跟著 `st.look` 左右看）、`st.mood === 'happy'` 剛得分、`st.mood === 'sad'` 剛失分、`st.serving` 發球中。
5. 會晃動的部分用檔案裡的 `wiggle()`，它在 `st.reduced` 時會自動停止。
6. 把新造型加進檔案最下面的 `LIST`。
7. 跑 `npm test`，`skins.test.js` 全部通過才算完成。超出高度限制時，把頭頂的東西往下移或縮小。
8. 告訴使用者怎麼預覽：用瀏覽器打開 `index.html`，在「機器人造型」選新造型；比賽中按暫停也能切換。
