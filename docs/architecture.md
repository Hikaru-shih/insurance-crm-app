## 2026-10-11：App 驗證碼

正式入口統一寄送 8 位數驗證碼，不需要 PUBLIC_APP_URL。account_tokens 新增 attempts（SQLite 6／PostgreSQL 2），錯誤嘗試以交易寫入、重設及消耗 token 以交易保存；登入建立 session 前重查密碼雜湊，避免與改密碼競爭時發出舊密碼的新 session。寄信冷卻在交易內重查，避免並行重寄。來源與帳號均有限流；驗證碼失敗次數保存在資料庫，程序重啟不重設。正式部署仍待服務設定與驗收。

## 2026-10-10：PostgreSQL 更新

正式架構為 Android／iOS App → HTTPS API → PostgreSQL，PC 僅供預覽。server/postgres.ts 管理連線池與 migration，server/asyncDatabase.ts 統一非同步查詢。交易使用同一連線，PostgreSQL advisory transaction lock 序列化 API 寫入，保留版本衝突與紀錄／積分一起回復的行為；高流量時需再調整鎖定粒度。正式環境必須設定 DATABASE_URL，不匯入本機資料。App 驗證流程及 Render 驗收尚未完成，見 [部署步驟](render-app.md)。以下早期進度供歷史參考。

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


## 後台帳號管理（2026-10-04）

POST /api/admin/users 建立帳號，PUT /api/admin/users/:id 修改姓名、role 與 active。伺服器限制管理員，自我停用與降權禁止，停用／變更角色立即刪除該帳號 sessions，保留 workspace。變更写入 audit_log。後台編輯既有資料沿用 workspace PUT 的版本檢查及交易計分；KPI 表單沿用 /api/admin/kpi-rules。沒有新增 schema migration；更新後重啟 API 服務。


## 唯讀分享（2026-10-04）

GET /api/shared-with-me 列出本人收到的啟用帳號授權，GET /api/grants 列出本人授予的對象姓名與 Email。POST /api/grants 僅授權本人的資料；DELETE /api/grants/:viewerId 撤銷。GET /api/workspaces/:ownerId/scores 使用相同資料存取檢查；一般被授權者只有讀取權。分享詳情沿用 AccountDetails 的 readOnly 模式，隱藏管理及編輯功能，伺服器獨立驗證權限。SharingScreen 每 15 秒更新授權狀態，撤銷／停用移除已開啟詳情。無 schema 變更，需重啟 API 套用新路由。


## 2026-10-05 資料與帳號更新

Schema v5 新增 email_verified_at 與 account_tokens。正式環境強制 Email 驗證，開發可選；一次性驗證／重設連結以雜湊保存，重設撤銷全帳號 session。實際密碼重設依寄信服務控制權完成，非管理員代查密碼。MAIL_MODE=local 的信件只寫 .data/mail-outbox；正式模式要求 HTTPS 與 Resend 設定。部署與初始化參見 [deployment.md](deployment.md)，備份與新檔還原參見 [backup-and-restore.md](backup-and-restore.md)。
