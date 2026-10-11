> 2026-10-11：App 已改用信箱驗證碼，正式環境不再需要 PUBLIC_APP_URL。最新操作以 [App 部署](render-app.md) 為準；以下連結式驗證與初始密碼說明均為歷史做法。

> 最新方向為 App 專用 API + PostgreSQL，請以 [Render App 部署](render-app.md) 為準。以下是較早的網頁寄信／Compose 參考，不代表要發布網頁產品或已完成 App 內驗證。Compose 現要求 DATABASE_URL，不再使用正式 SQLite volume。

# PC Web 部署與寄信

目前提供可建置的 Web 匯出與 Docker Compose／Caddy 設定；沒有替使用者申請主機、DNS 或寄信服務。現有電腦無 Docker，因此容器啟動、公開 HTTPS 與正式投遞仍需在部署主機驗證。Android／iOS 安裝包及實機測試仍暫緩。

## 本機驗證信與重設密碼

預設 `MAIL_MODE=local`，信件寫入 `.data/mail-outbox/*.json`，不對外寄送。登入頁 →「信箱驗證／忘記密碼」→輸入測試帳號 Email →申請驗證或密碼重設。開啟最新對應收件人的 JSON，複製 text 中的連結到瀏覽器；不要公開這些一次性連結。

驗證連結 24 小時、重設連結 30 分鐘有效；同用途重寄間隔至少一分鐘，新連結使舊連結失效。token 只以雜湊存入資料庫，成功使用後失效。重設會撤銷全部登入，且確認對目前信箱的控制權。正式環境要求驗證後才可登入；本機可設定 `REQUIRE_VERIFIED_EMAIL=1` 演練。建帳不自動寄信，使用者須從登入頁申請。尚無更換信箱、自動邀請或強制首次改密碼功能。

## 正式寄信設定

已提供 Resend HTTP 寄信轉接器；若選擇其他服務，可替換 `server/mail.ts` 的 Mailer 實作，不影響驗證流程。

- 設定已驗證的寄信網域與 `MAIL_FROM`。
- 設定 `RESEND_API_KEY` 於主機的秘密環境變數，不可放入 `EXPO_PUBLIC_*`。
- 設定 `MAIL_MODE=resend`、`PUBLIC_APP_URL=https://你的網域`、`NODE_ENV=production`。
- 正式環境若沒有寄信設定或 HTTPS URL 會拒絕啟動，不會悄悄退回本機信件匣。

參考：[Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email)。正式投遞、垃圾信分類、網域 DNS 設定需用實際服務驗證，目前沒有寄出真實信件。

## Docker Compose 部署範本

需要安裝 Docker Compose 的主機、一個指向該主機的網域，以及可連入的 TCP 80／443。在部署主機配置（不要提交含金鑰的檔案）：

```text
DOMAIN=你的網域
MAIL_FROM=錢脈 <no-reply@你的寄信網域>
RESEND_API_KEY=由主機安全設定
```

```sh
docker compose build
docker compose up -d
docker compose ps
```

Web 以相同網域 `/api` 呼叫 API；Caddy 處理 HTTPS 與靜態網站，API 不發布主機連接埠。SQLite 放於持久化 volume，API 以非 root 身分執行，預設禁止公開註冊。

首次建管理員，以環境變數 `BOOTSTRAP_ADMIN_EMAIL`、`BOOTSTRAP_ADMIN_NAME`、`BOOTSTRAP_ADMIN_PASSWORD` 傳入容器，再執行：

```sh
docker compose exec -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_ADMIN_NAME -e BOOTSTRAP_ADMIN_PASSWORD api node --import tsx scripts/bootstrap-admin.ts
```

腳本不回傳密碼，帳號存在時不覆蓋。管理員也需先在登入頁申請驗證信。初始化後移除暫存的初始密碼環境變數。若需重新設定密碼，使用忘記密碼流程。

上線前：先驗證備份可在另一份資料庫還原，再測試 HTTPS、登入、真實寄信、重設密碼、雙帳號隔離、授權撤銷與重啟後資料持久化。使用者驗收與正式服務費用／網域決定仍需由使用者完成。
