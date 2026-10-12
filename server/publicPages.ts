const operator = '施品光';
const email = 'qianmai1011@gmail.com';
export function publicPage(path: string): string | undefined {
  const pages: Record<string, string> = {
    '/privacy': `<h1>錢脈隱私權政策</h1><p>更新日期：2026-10-12。營運者：${operator}。</p>
<h2>收集的資料與用途</h2><p>我們儲存註冊姓名、電子信箱、密碼雜湊、驗證與登入資訊，以提供帳號驗證及安全管理。您輸入的聯絡人資料、重要日期、行程、聯繫紀錄、分級、計分及授權設定，用於提供客戶管理、提醒與工作報表。請只輸入您有權處理的資料，避免填入不必要的敏感資料。</p>
<h2>資料存放與分享</h2><p>資料透過 HTTPS 傳輸，存放於 Render 雲端服務，目前部署於新加坡。驗證郵件透過 Google Gmail 寄送。管理員可依管理權限查看帳號及工作資料，被授權者可查看您授權的資料。匯出的報表由匯出者負責保管；請確認接收者有權取得資料。</p>
<h2>保存與刪除</h2><p>帳號使用期間保留提供服務所需資料。您可以在 App「帳號安全」發起永久刪除，刪除帳號、所屬聯絡人、行程、紀錄、計分、授權及登入資料。已匯出或由其他人另行保存的副本不會自動刪除。雲端供應商既有備份可能依其備份週期保留，不會作為正常服務資料使用。</p>
<h2>您的權利與聯絡方式</h2><p>您可以在 App 查看、更正資料或撤銷分享授權。若需協助存取、更正或刪除資料，請聯絡 <a href="mailto:${email}">${email}</a>。我們可能要求驗證帳號持有人身分。本服務不以資料銷售或跨 App 廣告追蹤為目的。</p>
<h2>政策變更</h2><p>政策變更將更新此頁日期；涉及資料用途的重要變更將另行告知。</p>`,
    '/support': `<h1>錢脈使用支援</h1><p>營運者：${operator}</p><p>客服信箱：<a href="mailto:${email}">${email}</a></p><p>請提供 App 版本、手機型號與問題描述。請勿寄送密碼、驗證碼或完整客戶資料。</p><h2>登入與密碼</h2><p>可在登入畫面透過信箱驗證碼重設密碼。驗證信未收到時，請檢查垃圾郵件。</p><h2>刪除帳號</h2><p>登入 App → 三條線選單 → 帳號安全 → 永久刪除帳號。輸入目前密碼與確認文字後即可刪除；此操作無法復原。無法登入時可先重設密碼，或聯絡客服協助。</p>`
  };
  if (!pages[path]) return;
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>錢脈｜${path === '/privacy' ? '隱私權政策' : '使用支援'}</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.85;color:#203b35}h2{margin-top:32px}a{color:#235c48}</style></head><body>${pages[path]}<hr><nav><a href="/privacy">隱私權政策</a> · <a href="/support">使用支援</a></nav></body></html>`;
}
