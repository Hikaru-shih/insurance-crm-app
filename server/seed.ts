import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApi } from './app';
async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const app = createApi({ database: resolve(process.env.DATABASE_PATH ?? '.data/development.sqlite') });
  const accounts: string[] = [];
  for (const [email, role] of [['admin@example.test', 'admin'], ['a@example.test', 'user'], ['b@example.test', 'user']] as const) {
    if (app.db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) continue;
    const password = randomBytes(18).toString('base64url');
    await app.createUser(email, password, role);
    accounts.push(`${email}  ${password}`);
  }
  if (accounts.length) { writeFileSync('.data/dev-accounts.txt', accounts.join('\n') + '\n', { flag: 'a' }); console.log('Development accounts created. Credentials: .data/dev-accounts.txt (ignored by Git).'); }
  else console.log('Development accounts already exist; no passwords changed.');
  app.db.close();
}
void main();
