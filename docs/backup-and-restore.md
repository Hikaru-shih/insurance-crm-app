> 以下指令僅適用本機 SQLite。正式 PostgreSQL 使用平台備份或 pg_dump／pg_restore；雲端還原演練尚待完成，見 [App 雲端部署](render-app.md)。

# 備份與還原

備份包含所有帳號、密碼雜湊、聯絡人與紀錄、自由行程、分數、分級、授權、週月設定及稽核。使用 SQLite 線上備份介面取得一致快照，包含尚在 WAL 的已提交資料。它不是瀏覽器「匯入舊資料」。

## 本機操作

在專案目錄以 Node.js 24 執行；若只有專案附的 Node，可先在 PowerShell 設定：

```powershell
$env:PATH = "$PWD\.tools\node-v24.21.0-win-x64;$env:PATH"
npm.cmd run db:backup
```

來源使用 `.env` 的 `DATABASE_PATH`，預設 `.data/development.sqlite`。未指定目的檔時存至 `.data/backups/`，使用時間命名。也可指定新檔名：

```powershell
npm.cmd run db:backup -- .data/backups/manual.sqlite
npm.cmd run db:verify -- .data/backups/manual.sqlite
npm.cmd run db:restore -- .data/backups/manual.sqlite .data/restored.sqlite
```

每份備份必須保留 `.sqlite` 與 `.sqlite.json` 兩個檔案。驗證包含 SHA-256、SQLite integrity/foreign-key 檢查及 workspace 格式。校驗碼用來偵測毀損，不是數位簽章。備份未加密，含私人資料與密碼雜湊，請放於受控磁碟／加密儲存空間，不可提交 Git 或放到公開網頁目錄。另保留異機副本與相應 `.env`／寄信設定，程式備份不包含這些部署機密。

還原只接受全新目的路徑，不覆盖現有檔案；自動清除登入 session 與驗證／重設 token，使用者需重新登入、未完成的郵件連結需重新申請。還原成功後：

1. 停止 API 與前端服務。
2. 保留原資料庫，將 `.env` 的 `DATABASE_PATH` 改為還原檔路徑。
3. 重啟服務；migration 會補到目前版本。
4. 登入並核對聯絡人、紀錄、分數與授權。若要退回，停機後將路徑改回原檔；不可只覆蓋運作中的 SQLite 主檔或丟棄 WAL。

## 排程與容器

可用 Windows 工作排程器或主機排程每天執行 `npm run db:backup`，固定工作目錄與資料庫環境變數。保留天數與異機儲存位置由部署者設定；目前工具不自動刪除舊備份。

容器範例（檔案保留於 database volume）：

```sh
docker compose exec api node --import tsx scripts/backup.ts backup /data/backups/daily.sqlite
docker compose exec api node --import tsx scripts/backup.ts verify /data/backups/daily.sqlite
docker compose cp api:/data/backups/daily.sqlite ./daily.sqlite
docker compose cp api:/data/backups/daily.sqlite.json ./daily.sqlite.json
```

每日請使用不同檔名。還原以新 volume 或新路徑演練，再停機切換 `DATABASE_PATH`；不要刪除原 volume。異機複製完成才算具備主機故障的備援。

## 2026-10-05 演練

實際備份 `.data/backups/qianmai-2026-10-05-before-release.sqlite`，還原至 `.data/restore-drill-2026-10-05.sqlite`，5 帳號、5 workspace、2 授權、1 計分、49 稽核、6 KPI、1 報表設定一致。原開發資料庫保持原路徑。另有自動測試覆蓋 WAL 快照、損毀偵測、禁止覆蓋與登入失效。

參考：[Node SQLite backup](https://nodejs.org/api/sqlite.html#sqlitebackupsourceDb-path-options)。
