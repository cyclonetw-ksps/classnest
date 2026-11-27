# classnest

給「分組上課」的班級用的常駐網站：學生名單與分組、積分與獎勵、公布欄、課表、聯絡簿、大螢幕計時與學生平板登入，之後會加上簽到與寵物養成。老師可以手動操作，也可以讓 AI agent 透過 MCP 寫公布欄、每週課程內容與聯絡簿草稿。

一套網站服務一個班，可以有幾位老師共用。程式跑在 Cloudflare Workers 免費方案上，資料存在 Cloudflare 的 Durable Object，不經過 GitHub。

規格與切片見 [docs/plans/2026-11-24-classnest.md](docs/plans/2026-11-24-classnest.md)。

## 目前功能

- 老師用 Google 帳號登入；第一位老師可以邀請其他老師，權限相同。
- 學生名單（只存顯示名、原班、導師稱呼、組別），一位學生可同時在多個組。
- 自訂加分理由與分數，一鍵替一位學生或整組加分，按錯可撤銷；每筆紀錄都記下是哪位老師加的。
- 分數門檻與獎勵：達到門檻自動解鎖，發完標記已發放。
- 網站標題在後台修改。
- 公布欄：自訂面板（一欄便條），貼文字、連結、回家作業，連結與作業可放大成 QR Code；面板可標組別、可設私人或分享。
- 分享頁：全班一個分享連結（`/s/<代碼>`），可加 4 位數通關碼、可換新連結；代課老師、學生、家長只看得到分享的面板與已發送的聯絡簿（最近 5 天），可依組切換，看不到學生名單、分數與個別加註。
- 大螢幕：投影用的視覺計時器，自訂 1 到 180 分鐘或倒數到指定時刻（例如下課 10:30），剩餘時間是會縮小的扇形加大字；可暫停、重來，時間到響提示音（可靜音，記在這台裝置），支援全螢幕。也可以「依課表自動倒數」：依節次與這週的課，自動倒數到下課或上課，下課時大字提醒下一節是哪一組、什麼科、要帶什麼，上下課時響提示音。不顯示任何學生資料。
- 聯絡簿：一天一組一則（作業、要帶的東西、備註），打開還沒寫的那一則時自動帶入當天課表這一組的作業與要帶的東西；可以對組裡個別學生加註（只有老師看得到）。存草稿只有老師看得到，按「發送」後家長從分享頁看得到；可一鍵複製「【11/25 國語 A 組】作業：…」文字貼到 LINE，也可以複製給個別學生（多一行他的加註）。
- 學生平板：老師用某台平板登入後，在「設定 → 學生平板」把它設成共用或個人學生平板（這台的老師帳號會登出）。學生打開 `/student`，點組別、點自己的名字，依序點 3 張圖卡（9 張裡選 3 張）登入，看自己的分數、下一個獎勵還差幾分、已解鎖的獎勵，以及所屬組最近一次已發送的聯絡簿與老師給自己的加註。圖卡密碼由老師在「學生」替每位學生產生，可以印出全班的（`/cards`）。共用平板每次登入 10 分鐘（90 秒沒動自動換人），個人平板一直記住，直到老師在設定裡登出那台。連錯 5 次暫停 5 分鐘。
- 課表：設定節次時間與固定週課表（週一到週五每節哪組上什麼科、預設要帶的東西）；每週在各節填教學內容、作業與要帶的東西，可複製上週（只填空格），可臨時換課或停課（只影響那一週）。
- agent 金鑰：在「設定」產生，只顯示一次；agent 用 MCP（`/api/mcp`，Streamable HTTP，標頭 `Authorization: Bearer <金鑰>`）讀組別名稱、讀寫面板與便條，讀節次、固定課表與某一週，並一次填好整週各節的內容、作業與要帶的東西（換課、停課、改課表只有老師能做）；讀某一天各組的聯絡簿並草擬（只會是草稿，老師按「發送」才生效，看不到個別加註）。停用後立刻失效。

### 讓 agent 寫公布欄

在「設定 → agent 金鑰」產生一把金鑰，對話框會給一行 Claude Code 設定指令，形如：

```bash
claude mcp add --transport http classnest https://<你的網站>/api/mcp --header "Authorization: Bearer <金鑰>"
```

其他 agent 選 Streamable HTTP 類型的 MCP 伺服器，填同樣的網址與標頭即可。

## 自架

照 [docs/self-hosting.md](docs/self-hosting.md) 一步一步做，全部用免費方案，不用寫程式。重點：

1. Fork 這個 repo，在 Actions 分頁啟用 workflow。
2. Cloudflare：確認 workers.dev 子網域，複製帳號 ID，用「Edit Cloudflare Workers」範本建立 API token。
3. Google Auth Platform：建立「網頁應用程式」用戶端，「已授權的 JavaScript 來源」填 `https://classnest.<你的子網域>.workers.dev`。
4. GitHub 的 Settings → Secrets and variables → Actions：
   - Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`FIRST_TEACHER_EMAIL`（第一位老師的 Google 信箱）
   - Variables：`GOOGLE_CLIENT_ID`
5. Actions → CI → Run workflow（選 `main`）。之後 `main` 有更新就自動部署。

程式與設定裡不放任何部署專屬的值；`pnpm test` 第一步會檢查。

## 開發

```bash
pnpm install
cp .dev.vars.example .dev.vars   # 本機開發用，填你自己的值；不會進 git
pnpm dev
pnpm test
```

授權：MIT。
