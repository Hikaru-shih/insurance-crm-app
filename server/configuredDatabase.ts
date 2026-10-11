import { resolve } from 'node:path';
import { openPostgres } from './postgres';

/** Cloud starts with an empty PostgreSQL database; local SQLite is never imported. */
export async function configuredDatabase(env: NodeJS.ProcessEnv = process.env) {
  if (env.DATABASE_URL?.trim()) return { database: '', connection: await openPostgres(env.DATABASE_URL.trim()) };
  if (env.NODE_ENV === 'production') throw new Error('正式環境必須設定 DATABASE_URL（PostgreSQL）');
  return { database: resolve(env.DATABASE_PATH ?? '.data/development.sqlite') };
}
