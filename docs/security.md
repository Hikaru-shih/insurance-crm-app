# 開發環境安全與資料處理

更新：2026-09-22。此版本供本機假資料驗證，尚未完成正式託管、HTTPS、備份還原與正式個資上線驗收。

* 密碼以隨機 salt＋Node scrypt 儲存，比對使用 timingSafeEqual；登入錯誤不區分帳號不存在或密碼錯誤。
* Token 使用 32-byte 隨機值，伺服器僅存 SHA-256 雜湊、有效期與 user_id，登出會刪除；不把密碼或 token 寫入日志。
* Web token 置於 sessionStorage，關分頁後移除；原生 App 暫存記憶體，重啟需登入。後續正式版本需規劃 HttpOnly cookie／原生安全儲存與更新機制。
* Backend 預設只聽 127.0.0.1；CORS 僅接受明確允許的來源，不能取代每次 API 的身分與資料授權檢查。
* 登入／註冊每來源位址每分鐘最多 20 次，請求內容上限 1 MiB。此為本機防護，正式部署需持久化、分散式限流。
* ALLOW_REGISTRATION 預設關閉；`npm run dev` 為方便本機驗收而預設開啟，註冊只能成為一般使用者。正式邀請／帳號管理流程另行完成。
* `.data/`（資料庫、seed 憑證）、`.env*`、依賴與建置產物不提交；`.env.example` 只含非機密範例。
* 讀取錯誤不覆寫原資料；儲存成功後才更新 UI；revision 衝突要求重載。
* Node SQLite／密碼 API 參考：[SQLite](https://nodejs.org/api/sqlite.html)、[Crypto](https://nodejs.org/api/crypto.html)。目前使用 Node 24，node:sqlite 的穩定性及升級需在正式發布前再評估。

尚待：正式環境與開發資料庫實體隔離、HTTPS、備份還原演練、稽核保留政策、帳號找回、部署監控、上游依賴 audit 問題追蹤。不得用本機驗收通過替代上述檢查。
