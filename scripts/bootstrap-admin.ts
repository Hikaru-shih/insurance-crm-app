import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createApi } from '../server/app';
import { configuredDatabase } from '../server/configuredDatabase';
if (existsSync('.env')) process.loadEnvFile('.env');
async function main() {
  const { BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_NAME: name } = process.env;
  if (!email || !name?.trim()) throw new Error('Missing administrator environment variables');
  const app = createApi(await configuredDatabase());
  try {
    await app.createUser(email, randomBytes(32).toString('hex'), 'admin', name);
    console.log('管理員已建立，初始隨機密碼不提供登入。請在 App 選擇忘記密碼，透過本人信箱驗證碼設定密碼並啟用。');
  } finally { await app.db.close(); }
}
main().catch(() => { console.error('建立失敗：請確認管理員環境變數、資料庫連線，以及帳號是否已存在；既有帳號不會覆寫。'); process.exitCode = 1; });
