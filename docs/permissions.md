# 權限與 API 契約

更新：2026-09-22。以下已在 Backend 實作並以兩個一般帳號及管理員測試。

| 操作 | 未登入 | 本人 | 未被授權的其他人 | 被授權者 | 管理員 |
| --- | --- | --- | --- | --- | --- |
| 讀取 workspace | 401 | 允許 | 403 | 唯讀 | 允許並留查閱紀錄 |
| 修改 workspace | 401 | 允許 | 403 | 403 | 允許並留修改紀錄 |
| 代新增／刪除別人的聯絡人 | 401 | — | 403 | 403 | 403（本版只開放修改） |
| 授權／撤銷自己的資料 | 401 | 允許並留紀錄 | 不能代操作 | 不能轉授權原擁有者資料 | 僅能操作自己的分享 |
| 後台帳號與 audit 清單 | 401 | 一般帳號 403 | 403 | 403 | 允許 |

授權以擁有者的整份 workspace 為單位；後續模組加入前擴充權限範圍及測試。每次請求查資料庫中的授權，撤銷後下一次讀取立即拒絕；目前尚無分享 UI，未將前端同步清除的完整體驗算成完成。

## API

| Method／路徑 | 功能 |
| --- | --- |
| GET /api/health | 本機健康狀態 |
| POST /api/auth/register | 開發設定允許時註冊一般帳號，email／password；忽略傳入 role |
| POST /api/auth/login | email／password → token、user |
| GET /api/auth/me | 目前使用者 |
| POST /api/auth/logout | 撤銷目前 token |
| GET /api/workspaces/:ownerId | 經權限檢查的資料讀取 |
| PUT /api/workspaces/:ownerId | v2 workspace＋revision；返回已保存的新 revision |
| GET /api/grants | 本人的授權清單 |
| POST /api/grants | email 指定唯讀對象 |
| DELETE /api/grants/:viewerId | 撤銷授權 |
| GET /api/kpi-rules | 讀取最新六項分數 |
| GET /api/admin/users | 管理員帳號清單，無密碼雜湊 |
| GET /api/admin/audit | 管理員最近 100 筆操作紀錄 |

除健康檢查與登入／註冊外，請求必須使用 `Authorization: Bearer <token>`。400 為驗證失敗、401 登入失效、403 無權限、409 版本衝突、413 資料過大、429 嘗試頻率過高。錯誤回 `{ error: string }`。

登入 8 小時失效；帳號停用後 token 即使未到期仍拒絕。Admin 角色僅由 seed／受控伺服器程序建立，沒有一般帳號升權 API。
