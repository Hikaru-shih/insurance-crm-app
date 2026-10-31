import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyActivities } from '../src/domain/dailyActivity';
import { emptyContact } from '../src/domain/contacts';
import { emptyWorkspace } from '../src/domain/workspace';
import { openDatabase } from '../server/database';
import { syncRecordScores } from '../server/recordScores';
test('daily activity uses Taiwan creation date and record date, including blank records',()=>{
 const c={...emptyContact(),id:'c',name:'客戶',createdAt:'2026-10-26T17:00:00Z',updatedAt:'2026-10-27',records:[{id:'r',date:'2026-10-25',content:'',scoreCode:'new_contact'}]};
 const rows=dailyActivities([c]);assert.equal(rows[0].date,'2026-10-27');assert.equal(rows[1].date,'2026-10-25');assert.equal(rows[1].code,'new_contact');assert.equal(rows.length,2);
});
test('new contact points and contact points are separate and idempotent',async()=>{
 const db=openDatabase(':memory:');try{
 db.prepare('INSERT INTO users(id,email,password_hash,role,created_at) VALUES(?,?,?,?,?)').run('u','u@example.test','hash','user','2026-10-27');
 const before=emptyWorkspace(),after={...before,contacts:[{...emptyContact(),id:'c',name:'客戶',createdAt:'2026-10-27',updatedAt:'2026-10-27',records:[{id:'a',date:'2026-10-27',content:'',scoreCode:'new_contact'},{id:'b',date:'2026-10-27',content:'',scoreCode:'contact'}]}]};
 await syncRecordScores(db,'u',before,after);await syncRecordScores(db,'u',after,after);
 const rows=db.prepare('SELECT code,SUM(points) AS total FROM score_entries WHERE revoked=0 GROUP BY code ORDER BY code').all();
 assert.deepEqual(rows.map(r=>[r.code,r.total]),[['contact',1],['new_contact',1]]);
 }finally{db.close();}
});
