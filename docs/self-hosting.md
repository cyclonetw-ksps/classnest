# 自架 classnest：給老師的安裝說明

這份說明帶你用自己的 GitHub、Cloudflare 與 Google 帳號，架一套自己班級的 classnest。全部用免費方案，不用寫程式，大約 40 分鐘。

- 一套網站服務一個班。同校幾位老師可以共用同一套，各班要各架一套。
- 程式裡沒有任何人的私人設定。你的網址、信箱與金鑰只放在你自己的帳號裡。
- 文中的按鈕名稱是 2026 年 11 月查證的版本。平台改版時位置可能會變，找不到時用頁面上的搜尋功能。

## 你需要準備

| 帳號 | 用途 | 費用 |
| --- | --- | --- |
| GitHub | 放程式、自動部署 | 免費 |
| Cloudflare | 網站本身與資料 | 免費方案 |
| Google（任何 Gmail 或學校的 Google 帳號） | 老師用 Google 登入 | 免費 |

過程中會拿到 4 個值，最後要填進 GitHub。先開一個記事本暫存，填完就刪掉：

1. Cloudflare 的帳號 ID
2. Cloudflare 的 API token（只會顯示一次）
3. Google 登入的用戶端 ID
4. 第一位老師的 Google 信箱（通常就是你自己）

## 第 1 步：把程式複製到你的 GitHub

1. 登入 GitHub，打開 classnest 的 repo 頁面，按右上角的 **Fork**，再按 **Create fork**。
2. 到你自己那份 repo 的 **Actions** 分頁。fork 出來的 repo 預設不會執行自動部署，畫面上會有一顆啟用 workflow 的按鈕，按下去。

## 第 2 步：Cloudflare

### 2-1 註冊並確認子網域

1. 到 <https://dash.cloudflare.com> 註冊或登入。
2. 左側選單點 **Workers & Pages**。
3. 確認頁面上有 **Your subdomain**（你的子網域），例如 `abc-school`。如果還沒有，照畫面指示建立一個。
   - 你的網站網址會是 `https://classnest.<你的子網域>.workers.dev`，先記下來，第 3 步要用。
   - 想改子網域，按 **Your subdomain** 旁的 **Change**。

### 2-2 複製帳號 ID

在 **Workers & Pages** 頁的 **Account Details** 區塊，按 **Account ID** 旁的複製鈕，貼到記事本。

### 2-3 建立 API token

API token 是讓 GitHub 替你部署的鑰匙。

1. 打開 <https://dash.cloudflare.com/?to=/:account/api-tokens>（或 **Manage account** → **Account API tokens**）。
2. 按 **Create Token**。
3. 在 **Permission policies** 打開 **Custom** 下拉選單，選 **Edit Cloudflare Workers**。
4. token 名稱可以改成 `classnest 部署`；範圍只選你自己的帳號。
5. 按 **Continue to summary**，再按 **Create Token**。
6. 畫面上的 token **只會出現這一次**，馬上複製到記事本。

## 第 3 步：Google 登入的用戶端 ID

老師用 Google 帳號登入，需要向 Google 申請一個「用戶端 ID」。它是公開值，不是密碼。

1. 到 <https://console.cloud.google.com>，建立一個新專案（名稱例如 `classnest`）。
2. 在搜尋列輸入 **Google Auth Platform** 並打開。第一次使用會看到 **Get started**，依序填：
   - **App Information**：應用程式名稱（例如「三年級資源班」）、支援信箱（你的信箱）。
   - **Audience**：選 **External**（外部）。**不要選 Personal**，選了只有你自己能登入，而且之後不能改。
   - **Contact Information**：你的信箱。
3. 左側點 **Clients** → **Create client**：
   - **Application type**：選 **Web application**（網頁應用程式）。
   - **Authorized JavaScript origins**（已授權的 JavaScript 來源）：按 **Add URI**，填第 2 步的網址 `https://classnest.<你的子網域>.workers.dev`（把 `<你的子網域>` 換成你的子網域）。只填到網域為止，結尾不要加 `/`。
   - **Authorized redirect URIs**：不用填。
4. 按 **Create**，把 **Client ID**（以 `.apps.googleusercontent.com` 結尾的那一串）複製到記事本。不需要 Client secret。

發布狀態維持 **Testing** 就好。只用 Google 登入時，老師不需要被加進測試使用者名單，也不會七天後失效。設定改完可能要等幾分鐘到幾小時才生效。

## 第 4 步：把設定填進 GitHub

到你那份 repo 的 **Settings** → 左側 **Secrets and variables** → **Actions**。

在 **Secrets** 分頁按 **New repository secret**，新增三個：

| 名稱（照抄） | 填什麼 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 第 2-3 步的 API token |
| `CLOUDFLARE_ACCOUNT_ID` | 第 2-2 步的帳號 ID |
| `FIRST_TEACHER_EMAIL` | 第一位老師的 Google 信箱 |

在 **Variables** 分頁按 **New repository variable**，新增一個：

| 名稱（照抄） | 填什麼 |
| --- | --- |
| `GOOGLE_CLIENT_ID` | 第 3 步的用戶端 ID |

填完就可以刪掉記事本裡的值。之後要換 token，回到這裡更新即可。

## 第 5 步：第一次部署

1. 到 repo 的 **Actions** 分頁，左側點 **CI**。
2. 按 **Run workflow**，**Branch** 選 `main`，再按一次 **Run workflow**。
3. 等它跑完（約 1 到 2 分鐘），出現綠色勾勾就是成功了。

之後只要 `main` 有更新，就會自動測試並部署，不用再手動按。

## 第 6 步：第一次登入、邀請老師

1. 打開你的網址，按頁面上的 Google 登入按鈕，用 `FIRST_TEACHER_EMAIL` 那個帳號登入。
2. 到「設定」：
   - 改網站標題（例如「三年級資源班」）。
   - 在「老師」輸入同事的 Google 信箱並按「邀請老師」。同事用自己的 Google 帳號登入後，看到的是同一份名單，權限相同。
3. 依序設定組別、加分理由、學生，就可以開始上課加分。課表在「課表」分頁，投影用「大螢幕」分頁。

沒被邀請的 Google 帳號登入時，會看到「這個 Google 帳號不在老師名單內」，看不到任何資料。

## 更新到新版

classnest 有新版時：

1. 到你那份 repo 的首頁，在檔案列表上方按 **Sync fork** → **Update branch**。
2. GitHub 會自動測試並部署，網站幾分鐘後就是新版，資料不會不見。

如果畫面說有衝突，通常是你改過程式。沒改過程式的話不會發生。

## 免費方案夠不夠用

一個班通常遠低於 Cloudflare 免費方案的額度：

| 項目 | 免費額度 |
| --- | --- |
| 網站請求 | 每天 100,000 次 |
| 資料庫（Durable Objects，SQLite）請求 | 每天 100,000 次 |
| 資料庫讀取／寫入 | 每天 500 萬列／10 萬列 |
| 資料儲存 | 整個帳號 5 GB |

- 每天的額度在台灣時間早上 8 點（UTC 午夜）重新計算。
- 萬一超過，當天剩下的時間網站會出錯（Cloudflare 錯誤代碼 1027），隔天自動恢復，不會被收費。

## 資料放在哪裡

- 所有資料都在你自己的 Cloudflare 帳號裡（同一個 Durable Object 的 SQLite），別人看不到。
- 學生資料只有顯示名、原班、導師稱呼與組別，不存生日、身分證、障礙類別或家長電話。
- 目前沒有匯出或備份功能。刪掉 Cloudflare 上的 `classnest` Worker，資料就跟著刪除，無法復原。

## 常見問題

**登入頁寫「這個網站還沒設定 Google 登入（GOOGLE_CLIENT_ID）」**
GitHub 的 Variables 分頁還沒有 `GOOGLE_CLIENT_ID`，或名稱拼錯（要放在 Variables，不是 Secrets）。補上後重新部署一次（第 5 步）。

**登入按鈕出不來，或出現 `origin_mismatch`**
Google 用戶端的「已授權的 JavaScript 來源」和你的網址不一樣。檢查有沒有 `https://`、子網域拼字、結尾有沒有多一個 `/`。改完可能要等一陣子才生效。

**同事按 Google 登入時，被 Google 擋下（例如「存取遭拒」或「這個應用程式未經驗證」）**
依 Google 的說明，只用 Sign in with Google 登入的應用程式在 Testing 狀態下，不需要把使用者加進測試名單（[來源](https://support.google.com/cloud/answer/15549945)）。萬一還是被擋，擇一處理：到 Google Auth Platform → **Audience**，按 **Publish app** 發布成 In production（只用登入需要的基本資料，不需要 Google 審核）；或在同一頁的 Test users 加入他的信箱。

**用 Google 登入後說「不在老師名單內」**
你登入的帳號不是 `FIRST_TEACHER_EMAIL`，或還沒被邀請。先確認 GitHub secret 的信箱，改了之後要重新部署一次（第 5 步）。

**部署失敗，記錄裡有 Authentication error 或 token 相關字樣**
`CLOUDFLARE_API_TOKEN` 或 `CLOUDFLARE_ACCOUNT_ID` 填錯，或 token 沒有選 **Edit Cloudflare Workers**。重新建立 token 並更新 secret，再執行一次第 5 步。

**想換網址（例如改 Worker 名稱或綁自己的網域）**
網址改了之後，記得到 Google 用戶端把新網址加進「已授權的 JavaScript 來源」。改 Worker 名稱會變成一個新的網站，舊網站的資料不會跟過去。

## 進階：在自己的電腦上開發

只有要改程式時才需要。需要 Node.js 與 pnpm。

```bash
pnpm install
cp .dev.vars.example .dev.vars   # 填你自己的 GOOGLE_CLIENT_ID 與 FIRST_TEACHER_EMAIL
pnpm dev                          # 打開 http://localhost:8787
pnpm test                         # 送出前一定要全過
```

- Google 用戶端的「已授權的 JavaScript 來源」要另外加 `http://localhost` 與 `http://localhost:8787` 兩個。
- 如果本機的登入按鈕出錯，Google 建議在 http 的本機測試時，網頁的 Referrer-Policy 用 `no-referrer-when-downgrade`。正式網址是 https，不受影響。
- `.dev.vars` 不會進 git。`pnpm test` 第一步會檢查程式與設定裡有沒有真的信箱、workers.dev 網址、Google 用戶端 ID 或 Cloudflare 帳號 ID，有就失敗。部署專屬的值一律放在 GitHub secrets／variables 或 `.dev.vars`。

## 參考的官方文件

- Cloudflare：[workers.dev 子網域](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)、[用 GitHub Actions 部署](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)、[帳號層級 API token](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/)、[找帳號 ID](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/)、[Workers 額度](https://developers.cloudflare.com/workers/platform/limits/)、[Durable Objects 價格與額度](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- Google：[取得 Sign in with Google 用戶端 ID](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)、[Google Auth Platform 開始使用](https://support.google.com/cloud/answer/15544987)、[目標對象與測試狀態](https://support.google.com/cloud/answer/15549945)、[建立用戶端](https://support.google.com/cloud/answer/15549257)
- GitHub：[Fork 的 workflow 預設不執行](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)、[新增 secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)、[新增 variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables)、[手動執行 workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)、[Sync fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/syncing-a-fork)
