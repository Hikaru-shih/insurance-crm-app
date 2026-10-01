# 資料庫規格

更新：2026-09-22。開發環境採 Node.js 24＋SQLite，檔案預設 `.data/development.sqlite`。SQL migration 在 `server/migrations/001.sql`，啟動時以 `PRAGMA user_version` 在交易中套用；重啟不重建資料。正式託管服務尚未部署。

## 已建立的資料表

| 表 | 主鍵／關聯 | 用途 |
| --- | --- | --- |
| users | id；email 唯一 | 帳號、scrypt 密碼雜湊、user/admin、啟用狀態 |
| sessions | token_hash；user_id → users | 8 小時工作階段，只存 token 雜湊 |
| workspaces | owner_id → users；revision | 該使用者的聯絡人及自訂等級 JSON、版本與更新時間 |
| grants | owner_id＋viewer_id → users | 本人授予另一使用者的唯讀權限，禁止授權自己 |
| audit_log | id；actor_id → users | 登入登出、資料修改、管理員查閱／修改、授權／撤銷事件 |
| kpi_rules | code | 聯繫 1、接觸 5、活動 5、看店 8、深度面談 10、上卡 40 |

所有 SQL 值使用綁定參數。修改 workspace 使用 revision 比對與交易；版本不同回 409，要求重新讀取，避免覆寫另一分頁的修改。一般使用者永遠不能藉傳入 ownerId、role 更改歸屬或升權。

## 聯絡人 v2

目前使用 workspace JSON 儲存聚合資料，方便現階段完整驗證讀寫；後續依資料量及行程查詢需求拆表，透過 migration 遷移。

* 顯示欄位：姓名（必填）、性別、IG、群組（多個標籤）、備註、生日（完整 YYYY-MM-DD，選填）。
* 業務欄位：grade；系統欄位：id、createdAt、updatedAt。
* 舊欄位 nickname／phone／email／importantDates 僅為保留資料，從新版表單隱藏，不再供搜尋或新填寫。
* v1 解析為 v2，補空的新欄位，保留原始日期紀錄，不擅自把名稱為「生日」的紀錄搬到生日欄位。
* 舊瀏覽器資料不自動送到某個登入帳號；本人明確按匯入後才上傳，僅限全新空白 workspace。原本機資料不刪除。

## 後續模組邏輯模型（尚未建立資料表）

| 模組 | 預計主要欄位與關聯 |
| --- | --- |
| 行程 | id、owner_id、contact_id 可空、title、color、scheduled_date/time 可空、original_date、status、completed_at、revision |
| 行程歷史 | event_id、舊／新日期、動作、actor_id、時間 |
| 聯絡紀錄 | id、owner_id、contact_id、event_id 可空、實際聯絡日期、方式、內容、下一步 |
| 積分流水 | id、owner_id、event_id、行動代碼、完成當時分數、實際完成日期、撤銷狀態；同一有效事件只能計一次 |
| 目標 | owner_id 或全體預設、每日目標、有效日期 |

下一階段新增上述表時，須讓 owner_id 與關聯客戶／行程的擁有者一致，禁止跨帳號關聯；目前這些模組尚未提供寫入 API。

開發 seed：`npm run db:seed` 建立管理員與 A／B 測試帳號，密碼隨機產生並寫入被 Git 忽略的 `.data/dev-accounts.txt`；重跑不重設既有密碼。
