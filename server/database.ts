import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (row.user_version > 3) throw new Error('Database version is newer than this server');
  if (row.user_version === 0) {
    db.exec('BEGIN IMMEDIATE');
    try { db.exec(readFileSync(new URL('./migrations/001.sql', import.meta.url), 'utf8')); db.exec('PRAGMA user_version=1; COMMIT;'); }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  if (row.user_version < 2) {
    db.exec('BEGIN IMMEDIATE');
    try { db.exec(readFileSync(new URL('./migrations/002.sql', import.meta.url), 'utf8')); db.exec('PRAGMA user_version=2; COMMIT;'); }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  if (row.user_version < 3) {
    db.exec('BEGIN IMMEDIATE');
    try { db.exec(readFileSync(new URL('./migrations/003.sql', import.meta.url), 'utf8')); db.exec('PRAGMA user_version=3; COMMIT;'); }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return db;
}
