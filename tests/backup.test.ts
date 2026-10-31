import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../server/database';
import {createBackup,restoreBackup,verifyBackup} from '../server/backup';
import {emptyWorkspace} from '../src/domain/workspace';
test('live WAL backup restores account data and clears authentication without replacing any file',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'qianmai-backup-')),source=join(directory,'source.sqlite'),file=join(directory,'copy.sqlite'),target=join(directory,'restored.sqlite');
  const db=openDatabase(source);
  try {
    db.prepare("INSERT INTO users(id,email,password_hash,role,created_at,name) VALUES('u','backup@example.test','hash','admin','now','備份測試')").run();
    db.prepare('INSERT INTO workspaces VALUES(?,?,?,?)').run('u',0,JSON.stringify(emptyWorkspace()),'now');
    db.prepare("INSERT INTO sessions VALUES('session','u',9999999999999)").run();
    db.prepare("INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at,created_at) VALUES('token','u','reset',9999999999999,1)").run();
    db.prepare("INSERT INTO score_entries(owner_id,id,date,code,label,points,note) VALUES('u','score','2026-10-05','contact','聯繫',1,'備份積分')").run();
    const result=await createBackup(source,file);assert.equal(result.counts.users,1);assert.equal(result.counts.score_entries,1);
    db.prepare("UPDATE users SET name='備份後變更' WHERE id='u'").run();
    assert.equal(verifyBackup(file).version,7);restoreBackup(file,target);
    const restored=openDatabase(target);
    try {assert.equal(restored.prepare('SELECT name FROM users').get()!.name,'備份測試');assert.equal(restored.prepare('SELECT count(*) n FROM sessions').get()!.n,0);assert.equal(restored.prepare('SELECT count(*) n FROM account_tokens').get()!.n,0);assert.equal(restored.prepare('SELECT note FROM score_entries').get()!.note,'備份積分');}finally{restored.close();}
    assert.throws(()=>restoreBackup(file,source),/全新路徑/);
    await assert.rejects(createBackup(source,file),/已存在/);
    const bytes=readFileSync(file);bytes[200]^=1;writeFileSync(file,bytes);assert.throws(()=>verifyBackup(file),/校驗/);
    assert.equal(db.prepare('SELECT name FROM users').get()!.name,'備份後變更');
  }finally{db.close();}
});
