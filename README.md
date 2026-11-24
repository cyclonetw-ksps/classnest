# classnest

給「分組上課」的班級用的常駐網站：學生名單與分組、積分與獎勵，之後會加上寵物養成、簽到、課表與倒數、作業與聯絡簿。老師可以手動操作，也可以讓 AI agent 透過 MCP 寫公布欄。

一套網站服務一個班，可以有幾位老師共用。程式跑在 Cloudflare Workers 免費方案上，資料存在 Cloudflare 的 Durable Object，不經過 GitHub。

規格與切片見 [docs/plans/2026-11-24-classnest.md](docs/plans/2026-11-24-classnest.md)。

## 目前功能

- 老師用 Google 帳號登入；第一位老師可以邀請其他老師，權限相同。
- 學生名單（只存顯示名、原班、導師稱呼、組別），一位學生可同時在多個組。
- 自訂加分理由與分數，一鍵替一位學生或整組加分，按錯可撤銷；每筆紀錄都記下是哪位老師加的。
- 分數門檻與獎勵：達到門檻自動解鎖，發完標記已發放。
- 網站標題在後台修改。
- 公布欄：自訂面板（一欄便條），貼文字、連結、回家作業，連結與作業可放大成 QR Code；面板可標組別、可設私人或分享。
- 分享頁：全班一個分享連結（`/s/<代碼>`），可加 4 位數通關碼、可換新連結；代課老師、學生、家長只看得到分享的面板，可依組切換，看不到學生名單與分數。
- agent 金鑰：在「設定」產生，只顯示一次；agent 用 MCP（`/api/mcp`，Streamable HTTP，標頭 `Authorization: Bearer <金鑰>`）讀組別名稱、讀寫面板與便條。停用後立刻失效。

### 讓 agent 寫公布欄

在「設定 → agent 金鑰」產生一把金鑰，對話框會給一行 Claude Code 設定指令，形如：

```bash
claude mcp add --transport http classnest https://<你的網站>/api/mcp --header "Authorization: Bearer <金鑰>"
```

其他 agent 選 Streamable HTTP 類型的 MCP 伺服器，填同樣的網址與標頭即可。

## 自架（簡要）

完整安裝說明之後補上。需要：

1. Cloudflare 帳號，以及一組「Edit Cloudflare Workers」範本建立的 API token。
2. Google Cloud 的 OAuth 用戶端 ID（網頁應用程式），「已授權的 JavaScript 來源」填你的網站網址。
3. 在 GitHub repo 的 Settings 設定：
   - Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`FIRST_TEACHER_EMAIL`（第一位老師的 Google 信箱）
   - Variables：`GOOGLE_CLIENT_ID`
4. 推到 `main` 後，GitHub Actions 會測試並部署到 `https://classnest.<你的子網域>.workers.dev`。

## 開發

```bash
pnpm install
pnpm test
```

授權：MIT。
