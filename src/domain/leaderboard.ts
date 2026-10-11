export type ScoreMode = 'periodPoints'|'totalPoints';
export type ScoreRow = {id:string;name?:string;email:string;role:'user'|'admin';active?:number;periodPoints:number;totalPoints:number;items:{code:string;periodPoints:number;totalPoints:number}[]};
export type ScoreBoard = {period:'week'|'month'|'custom'|'all';range:{start:string;end:string};generatedAt:string;rules:{code:string;label:string}[];rows:ScoreRow[]};
export function rankedRows(board:ScoreBoard,mode:ScoreMode,query='') {
  const sorted=[...board.rows].sort((a,b)=>b[mode]-a[mode] || (a.name??'').localeCompare(b.name??'') || a.id.localeCompare(b.id));
  let rank=0;
  return sorted.map((row,index)=>{if(index===0||row[mode]!==sorted[index-1][mode]) rank=index+1;return {...row,rank};}).filter(row=>(row.name??'').toLowerCase().includes(query.trim().toLowerCase()));
}
const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function scoreReportHtml(board:ScoreBoard,mode:ScoreMode,query='') {
  const rows=rankedRows(board,mode,query), rules=board.rules;
  const period=mode==='totalPoints'||board.period==='all'?'所有累積':`${board.period==='week'?'週報':board.period==='month'?'月報':'自訂區間'} ${board.range.start} 至 ${board.range.end}`;
  const header=['排名','姓名','帳號',mode==='totalPoints'||board.period==='all'?'累計分數':'期間累計分數',...rules.map(rule=>rule.label)];
  return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><title>員工計分表 ${escape(period)}</title><style>
  @page{size:A4 landscape;margin:14mm;@bottom-right{content:counter(page) " / " counter(pages);font-size:9px;color:#52606b}}*{box-sizing:border-box}body{font-family:"Microsoft JhengHei","PingFang TC","Noto Sans CJK TC",sans-serif;color:#18232b;font-size:10px;margin:0}h1{font-size:22px;margin:0 0 8px}p{margin:6px 0;color:#52606b;line-height:1.5}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:18px}th,td{border:1px solid #cbd1d6;padding:9px 6px;overflow-wrap:anywhere;text-align:right;vertical-align:top}th{background:#e9edf0;font-weight:700}th:nth-child(1),td:nth-child(1){width:5%;text-align:center}th:nth-child(2),td:nth-child(2){width:12%;text-align:left}th:nth-child(3),td:nth-child(3){width:23%;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}tbody tr:nth-child(even){background:#f6f7f8}.tools{margin:16px 0}button{padding:10px 18px;cursor:pointer}@media print{.tools{display:none}}
  </style></head><body><h1>員工計分表</h1><p>${escape(period)} · 單位：分</p><p>產生時間：${escape(new Date(board.generatedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}))}（台灣時間） · ${rows.length} 位員工${query.trim()?` · 姓名包含「${escape(query.trim())}」`:''}</p><p>包含停用員工；管理員不參與排名。同分並列，僅計有效紀錄。此報表為產生當下的資料快照。</p><div class="tools"><button onclick="window.print()">列印／另存 PDF</button><p>在列印目的地選擇「另存為 PDF」，建議使用 A4 橫向。</p></div><table><thead><tr>${header.map(label=>`<th>${escape(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><td>${row.rank}</td><td>${escape(row.name||'尚未填姓名')}${row.active===0?'（停用）':''}</td><td>${escape(row.email)}</td><td><strong>${row[mode]}</strong></td>${rules.map(rule=>`<td>${row.items.find(item=>item.code===rule.code)?.[mode]??0}</td>`).join('')}</tr>`).join('')}${!rows.length?`<tr><td colspan="${header.length}">沒有符合的員工</td></tr>`:''}</tbody></table></body></html>`;
}
