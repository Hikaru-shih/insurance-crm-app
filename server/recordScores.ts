import type { ScoreDatabase } from './asyncDatabase';
import { Workspace } from '../src/domain/workspace';
// Called inside the workspace save transaction: records and points commit together.
export async function syncRecordScores(db: ScoreDatabase, owner: string, before: Workspace, after: Workspace) {
    const flatten = (workspace: Workspace) => new Map(workspace.contacts.flatMap(contact => (contact.records ?? []).map(record => [
        `record:${contact.id}:${record.id}`, record,
    ] as const)));
    const old = flatten(before), next = flatten(after);
    for (const [id, record] of next) {
        const previous = old.get(id);
        if (!record.scoreCode) {
            (await db.prepare('UPDATE score_entries SET revoked=1 WHERE owner_id=? AND id=?').run(owner, id));
            continue;
        }
        const rule = (await db.prepare('SELECT label,points FROM kpi_rules WHERE code=?').get(record.scoreCode)) as {
            label: string;
            points: number;
        } | undefined;
        if (!rule)
            throw new Error('計分項目不存在，請重新讀取計分規則');
        const existing = (await db.prepare('SELECT code FROM score_entries WHERE owner_id=? AND id=?').get(owner, id));
        if (!existing) {
            (await db.prepare('INSERT INTO score_entries(owner_id,id,date,code,label,points,note) VALUES(?,?,?,?,?,?,?)').run(owner, id, record.date, record.scoreCode, rule.label, rule.points, record.content));
        }
        else if (existing.code !== record.scoreCode || !previous?.scoreCode) {
            (await db.prepare('UPDATE score_entries SET date=?,code=?,label=?,points=?,note=?,revoked=0 WHERE owner_id=? AND id=?').run(record.date, record.scoreCode, rule.label, rule.points, record.content, owner, id));
        }
        else {
            (await db.prepare('UPDATE score_entries SET date=?,note=? WHERE owner_id=? AND id=?').run(record.date, record.content, owner, id));
        }
    }
    for (const id of old.keys())
        if (!next.has(id))
            (await db.prepare('UPDATE score_entries SET revoked=1 WHERE owner_id=? AND id=?').run(owner, id));
}
// Stable IDs make retries and later edits idempotent; existing contacts are not backfilled.
export async function syncContactCreationScores(db: ScoreDatabase, owner: string, before: Workspace, after: Workspace) {
    const existing = new Set(before.contacts.map(contact => contact.id));
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    for (const contact of after.contacts) {
        if (existing.has(contact.id))
            continue;
        (await db.prepare('INSERT INTO score_entries(owner_id,id,date,code,label,points,note) VALUES(?,?,?,?,?,?,?) ON CONFLICT DO NOTHING')
            .run(owner, 'contact-created:' + contact.id, date, 'contact', '聯繫', 1, '新增聯絡人：' + contact.name));
    }
}
