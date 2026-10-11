import { backup, DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, chmodSync, readFileSync, writeFileSync, unlinkSync, copyFileSync, constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parseWorkspace } from '../src/domain/workspace';

export function verifyDatabase(file: string) {
  const db = new DatabaseSync(file, {readOnly: true});
  try {
    const integrity = db.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('資料庫完整性檢查失敗');
    const version = Number(db.prepare('PRAGMA user_version').get()!.user_version);
    if (version < 4 || version > 6) throw new Error('不支援此備份版本');
    for (const row of db.prepare('SELECT data FROM workspaces').all()) parseWorkspace(JSON.parse(String(row.data)));
    const counts = Object.fromEntries(['users','workspaces','grants','score_entries','audit_log','kpi_rules','report_settings'].map(table => [table, Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n)]));
    return {version,counts};
  } finally {db.close();}
}
export async function createBackup(source: string, destination: string) {
  source=resolve(source);destination=resolve(destination);
  if(!existsSync(source))throw new Error('來源資料庫不存在');
  if(existsSync(destination) || existsSync(destination+'.json'))throw new Error('備份目的檔已存在，請使用新檔名');
  mkdirSync(dirname(destination),{recursive:true});
  const temp=destination+'.'+randomUUID()+'.tmp';
  const db=new DatabaseSync(source,{readOnly:true});
  try {
    await backup(db,temp);
    chmodSync(temp,0o600);
    const info=verifyDatabase(temp);
    const sha256=createHash('sha256').update(readFileSync(temp)).digest('hex');
    copyFileSync(temp,destination,constants.COPYFILE_EXCL);
    writeFileSync(destination+'.json',JSON.stringify({format:1,createdAt:new Date().toISOString(),sha256,...info},null,2),{flag:'wx',mode:0o600});
    return info;
  } finally {db.close();if(existsSync(temp))unlinkSync(temp);}
}
export function verifyBackup(file:string) {
  const metadata=JSON.parse(readFileSync(file+'.json','utf8'));
  if(metadata.format!==1 || metadata.sha256!==createHash('sha256').update(readFileSync(file)).digest('hex'))throw new Error('備份校驗失敗，請勿還原');
  return verifyDatabase(file);
}
// Restore into a NEW path only. Switching the running service is an explicit maintenance step.
export function restoreBackup(source:string,target:string) {
  source=resolve(source);target=resolve(target);
  verifyBackup(source);
  if([target,target+'-wal',target+'-shm'].some(existsSync))throw new Error('還原目的檔必須是全新路徑，不覆蓋現有資料');
  mkdirSync(dirname(target),{recursive:true});
  copyFileSync(source,target,constants.COPYFILE_EXCL);chmodSync(target,0o600);
  const db=new DatabaseSync(target);
  try {db.exec('DELETE FROM sessions;');if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='account_tokens'").get())db.exec('DELETE FROM account_tokens;');db.exec('PRAGMA wal_checkpoint(TRUNCATE);');}
  finally{db.close();}
  return verifyDatabase(target);
}
