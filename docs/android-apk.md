# Android 測試 APK

已提供 eas.json 的 preview profile，連接 https://qianmai-api.onrender.com ，輸出可直接安裝的 APK，無須 Expo Go 或電腦持續開機。尚未執行雲端建置或手機驗收。

目前 Android package 為 com.qianmai.preview，僅供測試。正式商店識別碼與帳號歸屬須在上架前確認；不可將此設定當成已完成商店設定。測試版連到目前雲端資料庫，請先使用測試聯絡人。

在 Windows PowerShell 執行：

```powershell
cd D:\insurance-crm-app
# 此電腦若尚未把 Node 加入 PATH，可使用專案已有的版本：
$env:PATH = "$PWD\.tools\node-v24.21.0-win-x64;$env:PATH"
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest whoami
npx.cmd eas-cli@latest build --platform android --profile preview
```

沒有 Expo 帳號先到 https://expo.dev/signup 建立。登入密碼只輸入終端機；首次 npx 詢問安裝 eas-cli 可同意。首次建置若詢問建立／連結 EAS 專案，選擇自己的預期帳號與專案；若詢問產生 Android keystore，選擇由 EAS 產生。不要重新建立 React Native 專案，也不要執行 db:seed。

依終端提供的建置頁面查看狀態。成功後在 Android 手機開啟 APK 下載連結，下載安裝；依手機提示允許該瀏覽器安裝這個 APK。這是獨立測試 App，不是 Google Play 上架。若詢問要在 Android emulator 執行而你沒有模擬器，可選 No，改用手機下載。

本專案 .easignore 排除本機 .data、.env 與開發工具，請勿將資料庫或 Gmail 密碼加入 EAS 環境變數或 App。EXPO_PUBLIC_API_URL 是公開網址，可以包含在 App。若需要變更網址，修改 profile 後重新建置。

第一次使用：登入頁 → 信箱驗證／忘記密碼 → 輸入已建立的管理員信箱 → 寄送密碼重設信 → 回 App 填碼與新密碼 → 登入。管理員收信地址與 GMAIL_USER 寄件地址可以不同。正式 API 尚未開放自行註冊，這不是 App 故障。

驗收：管理員啟用、登入、新增聯絡人、紀錄與計分、日曆、PDF、關閉重開 App 後資料仍存在。若建置失敗，提供出錯階段及日誌（遮住憑證），不要把 JS 匯出成功當成 APK 已完成。

官方說明：https://docs.expo.dev/build-reference/apk/
