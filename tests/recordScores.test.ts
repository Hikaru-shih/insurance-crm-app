import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database';
import { syncRecordScores } from '../server/recordScores';
import { emptyWorkspace } from '../src/domain/workspace';
import { emptyContact } from '../src/domain/contacts';
test('saved contact records count once, retain snapshots, move dates and revoke on deletion', () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run('u','test@example.com','hash','user',1,'2026-09-27');
    const empty = emptyWorkspace();
    const next = {...empty, contacts:[{...emptyContact(),id:'c',name:'測試',createdAt:'2026-09-27',updatedAt:'2026-09-27', records:[{id:'r',date:'2026-09-27',content:'已聯絡',scoreCode:'contact'}]}]};
    syncRecordScores(db,'u',empty,next);
    syncRecordScores(db,'u',next,next);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM score_entries').get()!.n,1);
    db.exec("UPDATE kpi_rules SET points=99 WHERE code='contact'");
    const edited = structuredClone(next); edited.contacts[0].records[0].date='2026-09-26';
    syncRecordScores(db,'u',next,edited);
    const row=db.prepare('SELECT * FROM score_entries').get()!;
    assert.equal(row.points,1); assert.equal(row.date,'2026-09-26');
    const changed=structuredClone(edited); changed.contacts[0].records[0].scoreCode='card';
    syncRecordScores(db,'u',edited,changed);
    assert.equal(db.prepare('SELECT points FROM score_entries').get()!.points,40);
    syncRecordScores(db,'u',changed,empty);
    assert.equal(db.prepare('SELECT revoked FROM score_entries').get()!.revoked,1);
  } finally {db.close();}
});
