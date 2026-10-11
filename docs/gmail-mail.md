# Gmail 寄送驗證碼（不購買網域）

本方案由委託人控制的 Gmail 帳號寄信，使用 Google 應用程式密碼，不需要 Resend 或自有網域。可以使用現有 Gmail；建議另外準備專供 App 寄信的 Gmail，以方便交接與管理。管理員登入信箱和寄件信箱可以不同。

## 設定步驟

1. 登入要用來寄信的 Google 帳號，在「安全性」開啟兩步驟驗證。
2. 開啟 https://myaccount.google.com/apppasswords ，建立名為「錢脈寄信」的應用程式密碼。
3. 將產生的 16 字元應用程式密碼直接填入 Render 秘密環境變數；不是 Gmail 平常登入的密碼。不要傳給開發者、貼到聊天或提交 Git。
4. Render API 設定如下，移除先前的 Resend 相關設定：

| KEY | VALUE |
| --- | --- |
| MAIL_MODE | `gmail` |
| GMAIL_USER | 寄信的完整 Gmail 地址 |
| GMAIL_APP_PASSWORD | Google 產生的 16 字元應用程式密碼（空格可省略） |

不用設定 MAIL_FROM、RESEND_API_KEY 或 PUBLIC_APP_URL。程式將寄件人固定為「錢脈」及 GMAIL_USER，透過 smtp.gmail.com:465 使用 TLS；不接受任意寄件地址。

## 服務條件與驗收

- 需要可以產生應用程式密碼的 Google 帳號；進階保護、機構帳號等設定可能使此選項不可用。若看不到選項，先依 Google 說明確認，不用提供帳號密碼給開發者。
- Render 免費 Web Service 封鎖 SMTP 25／465／587；本方案使用目前選擇的付費 API 主機。資料庫是否付費不影響這項限制。
- Gmail 有寄信額度與防濫用限制，適合先做少量使用驗收，不能保證大量寄信。改 Google 主密碼後，應用程式密碼會被撤銷，需重新產生並更新 Render。
- 部署後須實測收信、垃圾郵件、重寄、驗證及改密碼；目前僅完成模擬 SMTP 的程式測試，未登入 Gmail，也未寄出真實信件。

[Google 應用程式密碼](https://support.google.com/accounts/answer/185833?hl=zh-Hant) · [Gmail 寄信額度](https://support.google.com/mail/answer/22839?hl=en) · [Render 免費方案限制](https://render.com/docs/free)
