import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database';
import { syncRecordScores } from '../server/recordScores';
import { emptyWorkspace } from '../src/domain/workspace';
import { emptyContact } from '../src/domain/contacts';
test('saved contact records count once, retain snapshots, move dates and revoke on deletion', async () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO users(id,email,password_hash,role,active,created_at) VALUES(?,?,?,?,?,?)').run('u','test@example.com','hash','user',1,'2026-09-27');
    const empty = emptyWorkspace();
    const next = {...empty, contacts:[{...emptyContact(),id:'c',name:'測試',createdAt:'2026-09-27',updatedAt:'2026-09-27', records:[{id:'r',date:'2026-09-27',content:'已聯絡',scoreCode:'contact'}]}]};
    await syncRecordScores(db,'u',empty,next);
    await syncRecordScores(db,'u',next,next);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM score_entries').get()!.n,1);
    db.exec("UPDATE kpi_rules SET points=99 WHERE code='contact'");
    const edited = structuredClone(next); edited.contacts[0].records[0].date='2026-09-26';
    await syncRecordScores(db,'u',next,edited);
    const row=db.prepare('SELECT * FROM score_entries').get()!;
    assert.equal(row.points,1); assert.equal(row.date,'2026-09-26');
    const changed=structuredClone(edited); changed.contacts[0].records[0].scoreCode='card';
    await syncRecordScores(db,'u',edited,changed);
    assert.equal(db.prepare('SELECT points FROM score_entries').get()!.points,40);
    await syncRecordScores(db,'u',changed,empty);
    assert.equal(db.prepare('SELECT revoked FROM score_entries').get()!.revoked,1);
  } finally {db.close();}
});

test('new contacts never score without an explicit record', async () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO users(id,email,password_hash,role,active,created_at) VALUES(?,?,?,?,?,?)').run('u','test@example.com','hash','user',1,'2026-09-27');
    const empty = emptyWorkspace();
    const next = {...empty, contacts:[{...emptyContact(),id:'c',name:'測試',createdAt:'2026-09-27',updatedAt:'2026-09-27'}]};
    db.exec("UPDATE kpi_rules SET points=99 WHERE code='contact'");
    await syncRecordScores(db,'u',empty,next);
    await syncRecordScores(db,'u',empty,next);
    await syncRecordScores(db,'u',next,next);
    await syncRecordScores(db,'u',next,empty);
    await syncRecordScores(db,'u',empty,next);
    const row = db.prepare('SELECT COUNT(*) AS n,SUM(points) AS points FROM score_entries').get()!;
    assert.equal(row.n,0); assert.equal(row.points,null);
    db.exec('BEGIN');
    await syncRecordScores(db,'u',next,{...next,contacts:[...next.contacts,{...next.contacts[0],id:'failed'}]});
    db.exec('ROLLBACK');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM score_entries').get()!.n,0);
  } finally {db.close();}
});
