# 開發驗證與發布準備

2026-09-22：目前只啟動本機服務，沒有部署、申請帳號、付費或送審。

## PC

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

同時啟動 API（3001）與 App（8081）。開 http://localhost:8081，可建立測試帳號、登入後新增聯絡人。此命令僅開發模式預設允許註冊。

管理後台測試：執行 `powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Task db:seed`，本機 `.data/dev-accounts.txt` 內有隨機產生的 admin@example.test 等測試憑證。管理員登入後顯示「管理後台」。請勿把此檔案提交或公開。

## Android 手機（使用者已有設備，尚未實機驗收）

1. PC 與 Android 使用同一可信任 Wi-Fi；手機安裝與 SDK 57 相容的 Expo Go。若版本不相容，需另建對應開發 APK，不能假設掃碼一定可用。
2. 停止已執行的開發服務。在第一個 PowerShell 視窗開 API：

```powershell
$env:API_HOST = '0.0.0.0'
$env:ALLOW_REGISTRATION = '1'
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Task api
```

3. 在第二個 PowerShell 視窗填入 PC 的區域網路 IPv4（不是手機上的 localhost），再啟動 Expo：

```powershell
$env:EXPO_PUBLIC_API_URL = 'http://你的PC區網IP:3001'
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Task start
```

4. 以 Expo Go 掃終端 QR code。若 Windows 防火牆阻擋，只在可信任私人網路允許必要連線；本次未自動更改防火牆。
5. 驗證註冊／登入、只填姓名新增、補 IG／群組／生日、重開 App 再登入可讀回、登出後看不到前帳號資料。原生 token 暫存記憶體，重開需登入是目前預期行為。

此方式只供假資料本機測試，API 使用 HTTP，不應跨公網開放。結束測試停止 API；下一次普通 PC 啟動回到預設 127.0.0.1。

## iOS 與正式發布待辦

* Android／iOS Hermes 匯出只證明原生 JS 可打包，不等同 APK／IPA 已建置或安裝成功。
* iOS 實機、Apple 開發者帳號、Mac／雲端建置途徑、正式 bundle ID 與簽章尚未確認。
* Google Play 帳號、正式 application ID、Keystore、隱私文件與商店素材尚未就緒。
* 正式託管、HTTPS、Secrets、備份還原、邀請／帳號找回完成後才能進入多人正式試用。
