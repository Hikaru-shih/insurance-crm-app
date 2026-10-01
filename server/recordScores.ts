import { DatabaseSync } from 'node:sqlite';
import { Workspace } from '../src/domain/workspace';

// Called inside the workspace save transaction: records and points commit together.
export function syncRecordScores(db: DatabaseSync, owner: string, before: Workspace, after: Workspace) {
  const flatten = (workspace: Workspace) => new Map(workspace.contacts.flatMap(contact => (contact.records ?? []).map(record => [
    `record:${contact.id}:${record.id}`, record,
  ] as const)));
  const old = flatten(before), next = flatten(after);
  for (const [id, record] of next) {
    const previous = old.get(id);
    if (!record.scoreCode) {
      db.prepare('UPDATE score_entries SET revoked=1 WHERE owner_id=? AND id=?').run(owner,id);
      continue;
    }
    const rule = db.prepare('SELECT label,points FROM kpi_rules WHERE code=?').get(record.scoreCode) as {label:string;points:number} | undefined;
    if (!rule) throw new Error('計分項目不存在，請重新讀取計分規則');
    const existing = db.prepare('SELECT code FROM score_entries WHERE owner_id=? AND id=?').get(owner,id);
    if (!existing) {
      db.prepare('INSERT INTO score_entries(owner_id,id,date,code,label,points,note) VALUES(?,?,?,?,?,?,?)').run(owner,id,record.date,record.scoreCode,rule.label,rule.points,record.content);
    } else if (existing.code !== record.scoreCode || !previous?.scoreCode) {
      db.prepare('UPDATE score_entries SET date=?,code=?,label=?,points=?,note=?,revoked=0 WHERE owner_id=? AND id=?').run(record.date,record.scoreCode,rule.label,rule.points,record.content,owner,id);
    } else {
      db.prepare('UPDATE score_entries SET date=?,note=? WHERE owner_id=? AND id=?').run(record.date,record.content,owner,id);
    }
  }
  for (const id of old.keys()) if (!next.has(id)) db.prepare('UPDATE score_entries SET revoked=1 WHERE owner_id=? AND id=?').run(owner,id);
}
