# classnest：agent 工作規則

班級經營常駐網站。規格與切片：`docs/plans/2026-11-24-classnest.md`；帳本：Master issue #1，每一刀一張子任務。

## 架構

- `src/worker/`：Cloudflare Worker。`index.ts` 只做路由、Google 登入驗證與跨站檢查；`classroom.ts` 是全站唯一的 Durable Object（一套部署一個班級），資料都在它內建的 SQLite，所有權限與內容檢查都在這裡。
- `src/web/`：Preact 前端，`vite build` 輸出到 `dist/`，由 Worker 靜態資源送出。
- `src/shared/`：前後端共用型別與上限值。

## 規則

- 一律用 pnpm。寫 code 先寫會失敗的測試（`test/`，跑在 Cloudflare 的 Workers 測試環境），確認紅燈再實作。
- 只存顯示名、原班、導師稱呼、組別等必要資料；不加生日、身分證、障礙類別、家長電話等欄位。
- 權限檢查一律在伺服器端。前端擋不算數。
- 部署專屬的值（Google 用戶端 ID、第一位老師信箱、Cloudflare 憑證）不寫進 repo；在 GitHub 的 repo variables／secrets 設定，由 CI 部署時注入。
- 不用付費功能；所有東西要在 Cloudflare 免費方案內。
- 沒有任何免驗證或開發用的登入入口；`/api/auth/` 底下只有 `google` 與 `logout`（有測試擋）。
- 前端互動元件先查 Modern Web Guidance 的現行寫法（原生 `<dialog>`、`:user-invalid` 等）。
