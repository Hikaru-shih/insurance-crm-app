# 實作架構與啟動方式

更新：2026-09-22｜版本：0.2 本機前後端

## 技術與分層

Expo SDK 57＋React Native＋TypeScript 共用 PC／手機介面；Node.js 24 HTTP API＋SQLite 提供登入、權限及持久化。版本鎖定於 package-lock.json。

```text
App.tsx / src/features    登入、聯絡人、月曆、分級、管理後台骨架
src/ui                   共用元件與色彩
src/domain               型別、驗證、分級、日期與資料遷移
src/state                畫面狀態及保存協調
src/data/api.ts          API client、工作階段、伺服器 repository
src/data/repository.ts   舊版本機資料匯入介面
server/app.ts            API、驗證、權限、交易、衝突處理
server/security.ts       密碼雜湊與 token 摘要
server/database.ts       SQLite 開啟及 migration
server/migrations        版本化 SQL
server/seed.ts           本機假帳號
scripts/dev.mjs          同時啟動 API 與 App
```

API 檢查 token 後，按 owner_id 與 grants 決定存取；管理員修改留 audit。前端登入後以 API repository 取代匿名本機儲存。儲存成功才更新 UI；revision 不符回 409，不偷偷覆寫。

目前 workspace 以單一使用者 JSON 聚合保存；未來行程及積分拆表與建立相關約束。詳見 database.md、permissions.md、security.md。此為可本機驗收的後端，不等於已完成正式雲端部署。

## 已完成與後續

* 已完成：登入／登出、新版聯絡人、群組標籤搜尋、生日、自訂分級、後端存取隔離、唯讀授權／撤銷 API、管理員修改 API 與帳號／紀錄頁。
* 月曆可切月、選日期，行程寫入尚未實作；未定行程與計分卡仍為入口。
* 暱稱／手機／Email／舊重要日期隱藏但資料保留；由本人主動將舊本機資料匯入全新帳號。
* 尚待：聯絡人封存、群組管理、行程／聯絡紀錄／積分、完整分享 UI、後台管理表單、正式部署與手機實機驗證。

## 啟動

目前電腦已有專案內 Node 24 LTS。PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

開啟 http://localhost:8081，API 在 http://localhost:3001。首次可建立測試帳號。Ctrl+C 關閉兩個服務。其他電腦先安裝 Node.js 24 LTS，再 `npm ci`、`npm run dev`。

管理員測試帳號：`powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Task db:seed`，從忽略目錄 `.data/dev-accounts.txt` 取得憑證。不可提交此檔案。

`.env.example` 可複製為 `.env` 作為設定起點；環境變數優先於檔案。dev 在未設定時允許註冊，範例檔預設關閉，測試需自行設 ALLOW_REGISTRATION=1。EXPO_PUBLIC_API_URL 是公開的 API 位址，不可放秘密。Android 同網路連線詳見 release.md。

## 檢查

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Task typecheck
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Task test
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Task test:browser
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Task build:web
```

瀏覽器測試自動啟動隔離 API 3002／App 8082，使用 `.data/browser-test.sqlite` 與獨立假帳號，不使用正常開發資料庫。需要 Chrome。CI 已定義 typecheck／API 核心測試／Web 匯出，尚未推送執行。

## 平台狀態與依賴

Web、Android 與 iOS JS/Hermes 匯出已成功；原生二進位建置及實機尚未驗收。iOS 需要確認設備、簽章及 Mac／雲端建置途徑。

9/10 npm audit 曾回報 10 個 moderate 項目，源自 Expo 工具鏈 xcode → uuid；未執行會降級 SDK 的 audit fix --force。正式原生發布前仍需追蹤上游修正。現有密碼與工作階段使用 Node crypto，App ID 使用 expo-crypto。

參考：[Expo 專案](https://docs.expo.dev/get-started/create-a-project/)、[TypeScript](https://docs.expo.dev/guides/typescript/)、[Node SQLite](https://nodejs.org/api/sqlite.html)。
