import { existsSync } from 'node:fs';
import { createBackup, restoreBackup, verifyBackup } from '../server/backup';
if(existsSync('.env'))process.loadEnvFile('.env');
async function main(){
  if(process.env.DATABASE_URL || process.env.NODE_ENV==='production')throw new Error('此指令僅備份本機 SQLite；PostgreSQL 請使用雲端備份或 pg_dump / pg_restore。');
  const [action,source,target]=process.argv.slice(2);
  if(action==='backup'){
    const destination=source??`.data/backups/qianmai-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`;
    console.log(await createBackup(process.env.DATABASE_PATH??'.data/development.sqlite',destination));
    console.log(`備份完成：${destination}（請一併保留 .json 校驗檔）`);
  }else if(action==='verify'&&source){console.log(verifyBackup(source));}
  else if(action==='restore'&&source&&target){console.log(restoreBackup(source,target));console.log(`已還原至 ${target}。停用服務後將 DATABASE_PATH 改為此路徑，再重新啟動；所有帳號需重新登入。`);}
  else throw new Error('用法：db:backup -- [新備份路徑] / db:verify -- 備份路徑 / db:restore -- 備份路徑 全新資料庫路徑');
}
main().catch(e=>{console.error(e instanceof Error?e.message:'備份操作失敗');process.exitCode=1;});
