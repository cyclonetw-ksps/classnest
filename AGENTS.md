# classnest：agent 工作規則

班級經營常駐網站。規格與切片：`docs/plans/2026-11-24-classnest.md`；帳本：Master issue #1，每一刀一張子任務。

## 架構

- `src/worker/`：Cloudflare Worker。`index.ts` 只做路由、Google 登入驗證與跨站檢查；`classroom.ts` 是全站唯一的 Durable Object（一套部署一個班級），資料都在它內建的 SQLite，所有權限與內容檢查都在這裡。
- `src/worker/boards.ts`：公布欄（面板、便條）、分享頁與 agent 金鑰，資料在同一個 Durable Object；`src/worker/mcp.ts` 是 agent 的 MCP 入口（`/api/mcp`，Streamable HTTP、只回 JSON，金鑰用 `Authorization: Bearer`）。agent 能用的工具只有組別名稱、面板與便條（白名單在 `BoardStore.agentTool`），以及讀課表、寫每週內容（`get_timetable`、`get_week`、`set_week_plan`，在 `ClassroomDO.agentCall`）；換課、停課、改節次與固定課表只給老師。要開放其他資料給 agent 時另開切片，補工具與測試。
- `src/worker/schedule.ts`：課表（節次、固定週課表、每週各節的內容、作業、要帶的東西、換課與停課），資料在同一個 Durable Object；週以週一的 `YYYY-MM-DD` 代表，日期計算在 `src/shared/week.ts`。
- 分享頁是 `/s/<分享代碼>`，資料來自 `POST /api/public/<代碼>`：只回分享的面板與組別名稱，不回任何學生資料，也不回是誰貼的（有測試擋）。
- `src/web/`：Preact 前端，`vite build` 輸出到 `dist/`，由 Worker 靜態資源送出。
- `src/shared/`：前後端共用型別與上限值。

## 規則

- 一律用 pnpm。寫 code 先寫會失敗的測試（`test/`，跑在 Cloudflare 的 Workers 測試環境），確認紅燈再實作。
- 只存顯示名、原班、導師稱呼、組別等必要資料；不加生日、身分證、障礙類別、家長電話等欄位。
- 權限檢查一律在伺服器端。前端擋不算數。
- 部署專屬的值（Google 用戶端 ID、第一位老師信箱、Cloudflare 憑證）不寫進 repo；在 GitHub 的 repo variables／secrets 設定，由 CI 部署時注入；本機開發用 `.dev.vars`（範本是 `.dev.vars.example`）。`pnpm test` 第一步跑 `scripts/check-private.mjs`，擋真的信箱、workers.dev 網址、Google 用戶端 ID 與 Cloudflare 帳號 ID；範例一律用 `example.com`、`.test` 網域與 `<你的子網域>`。
- 自架流程寫在 `docs/self-hosting.md`；改到部署、設定名稱或登入流程時要同步更新。
- 不用付費功能；所有東西要在 Cloudflare 免費方案內。
- 沒有任何免驗證或開發用的登入入口；`/api/auth/` 底下只有 `google` 與 `logout`（有測試擋）。
- 前端互動元件先查 Modern Web Guidance 的現行寫法（原生 `<dialog>`、`:user-invalid` 等）。
