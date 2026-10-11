# App 雲端部署：Render API + PostgreSQL

更新：2026-10-11。正式產品為 Android／iOS App，PC 網頁只供開發預覽。Render 的 Web Service 用來執行手機呼叫的 API，不需要另外發布網站。

## 目前已完成

- PostgreSQL 連線與自動 migration、本機 SQLite 相容、版本衝突與計分交易。
- App 內信箱驗證、忘記密碼，以及登入後從帳號安全更改密碼。
- 8 位數驗證碼：10 分鐘有效、最多 5 次嘗試、60 秒重寄間隔；新碼使舊碼失效。重設密碼會撤銷所有登入。正式寄信不需要網站連結。
- 管理員初始化使用不可知的隨機密碼；委託人透過自己的信箱驗證碼設定密碼後啟用。不沿用開發帳號，不匯入本機資料。
- 型別與本機 SQLite／內嵌 PostgreSQL 測試通過；PC 操作驗證及 Android／iOS JS 匯出完成。這不是 APK／IPA、遠端資料庫驗收或商店送審。

尚待外部設定：委託人 Render 資料庫／API、Gmail 寄信帳號及應用程式密碼、Expo／商店帳號、正式 App 識別碼。未建立付費服務、未寄出真實信件、未部署或送審。

## 1. 建立 Render PostgreSQL

用委託人的帳號進入 Dashboard → New → Postgres：

| 欄位 | 填寫 |
| --- | --- |
| Name | `qianmai-db` |
| Database / User | 留空讓平台產生即可 |
| Region | 自行選定，API 必須相同 |
| Version | 可沿用平台預設 |
| Plan | 由委託人確認畫面上的費用與限制後選擇 |

建立後等待 Available。Internal Database URL 是密碼，只放到 API 的秘密環境變數，不要提交 Git 或貼在聊天。正式資料庫從空白開始，不執行 `db:seed`。

[Render 建立與連線文件](https://render.com/docs/postgresql-creating-connecting)

## 2. 設定寄信服務（不購買網域）

依最新決定改用 Gmail SMTP，使用委託人控制的 Gmail 與 Google 應用程式密碼。先開啟兩步驟驗證，再產生應用程式密碼；在 Render 設定 MAIL_MODE=gmail、GMAIL_USER、GMAIL_APP_PASSWORD。不需要 Resend、MAIL_FROM 或自有網域。操作見 [Gmail 寄信設定](gmail-mail.md)。

此方式需使用允許 SMTP 的主機；Render 免費 Web Service 封鎖 SMTP，請使用目前選擇的付費 API 方案。帳號必須可產生應用程式密碼，且受 Gmail 寄信額度與安全限制。實際連線及郵件到達仍待驗收。

## 3. 建立 API

先將已測試程式提交並推送到委託人允許使用的儲存庫。Render → New → Web Service → 連接該儲存庫，使用 Node runtime：

| 欄位 | 設定 |
| --- | --- |
| Name | `qianmai-api` |
| Build Command | `npm ci --include=dev` |
| Start Command | `npm run api` |
| Health Check Path | `/api/health` |
| Region | 與 PostgreSQL 相同 |
| NODE_VERSION | `24.21.0` |
| NODE_ENV | `production` |
| DATABASE_URL | PostgreSQL 的 Internal Database URL |
| API_HOST | `0.0.0.0` |
| ALLOW_REGISTRATION | `0`，驗收後決定是否開放 |
| MAIL_MODE | `gmail` |
| GMAIL_USER | 用來寄信的完整 Gmail 地址 |
| GMAIL_APP_PASSWORD | Google 產生的應用程式密碼 |

Render 提供 PORT，程式會優先使用；啟動時自動執行 migration。正式環境必須使用 PostgreSQL。App 驗證碼不需要 `PUBLIC_APP_URL`，不用建 Static Site。不設定 DATABASE_PATH、不執行本機 seed。

部署完成後開 `https://你的API網址/api/health`，應看到 `ok: true`、`database: "postgres"`、`schema: 2`。此檢查會實際查詢資料庫，不只確認程序存在。

[Render Web Services](https://render.com/docs/web-services)

## 4. 建立委託人管理員

在 API 服務設定秘密環境變數 `BOOTSTRAP_ADMIN_EMAIL`（委託人提供的信箱）及 `BOOTSTRAP_ADMIN_NAME`（姓名），於服務 Shell 執行：

```sh
npm run admin:create
```

此指令不寄信，不輸出或要求初始密碼；帳號存在會拒絕，不覆蓋資料。執行完成後可移除兩個初始化環境變數。

委託人在 App 登入頁選「信箱驗證／忘記密碼」→ 輸入自己的信箱 →「寄送密碼重設信」→ 填入 8 位數驗證碼及新密碼 → 登入。成功重設同時完成信箱驗證，不必由開發者知道密碼。

若選用的 Render 方案沒有 Shell，先確認平台支援的管理命令執行方式，或在受信任的本機透過 External Database URL 執行相同指令；本機執行時須用正式 DATABASE_URL，不能誤建到 SQLite。不要公開連線字串。

## 5. App 設定與驗收

App 建置時設定 `EXPO_PUBLIC_API_URL=https://你的API網址`；手機只呼叫 API，不直接連資料庫。先做 Android／iOS 實機驗收，再設定商店的正式識別碼、簽章與安裝包。JS 匯出成功不代表已建置安裝包。

正式環境驗收項目：註冊策略、信件到達／重寄／過期、管理員啟用、兩帳號隔離、撤銷分享、計分與 PDF、重新部署後資料保留、手機真實操作。

## 備份

PostgreSQL 使用平台備份或 pg_dump／pg_restore，必須先還原至另一個空資料庫並驗證帳號與資料。正式雲端備份還原尚未演練。現有 db:backup／db:restore 只支援本機 SQLite，偵測到 DATABASE_URL 時會拒絕操作。不要把 SQLite 測試備份匯入正式庫。

舊 Docker Compose／Caddy 範本保留作參考，不是本次 App 部署路徑。
