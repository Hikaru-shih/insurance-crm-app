import { existsSync } from 'node:fs';
import { createApi } from './app';
import { createMailer } from './mail';
import { configuredDatabase } from './configuredDatabase';
if (existsSync('.env')) process.loadEnvFile('.env');
async function main() {
  const host = process.env.API_HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API port');
  const mailer = createMailer();
  const configuration = await configuredDatabase();
  const app = createApi({ ...configuration, recoveryCodesOnly: true, allowRegistration: process.env.ALLOW_REGISTRATION === '1', origins: process.env.ALLOWED_ORIGINS?.split(','), mailer, requireVerifiedEmail: process.env.NODE_ENV === 'production' || process.env.REQUIRE_VERIFIED_EMAIL === '1' });
  app.server.on('error', () => {
    console.error('API 無法啟動，請檢查連接埠設定。');
    void Promise.resolve(app.db.close()).catch(() => {});
    process.exitCode = 1;
  });
  app.server.listen(port, host, () => console.log(`Qianmai API http://${host}:${port} (${configuration.connection ? 'PostgreSQL' : 'SQLite'}; registration ${process.env.ALLOW_REGISTRATION === '1' ? 'enabled' : 'disabled'})`));
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void app.close().then(() => process.exit(0), () => process.exit(1));
  });
}
main().catch(() => { console.error('API 啟動失敗：請檢查資料庫連線、遷移及寄信設定。連線密碼不會輸出至日誌。'); process.exitCode = 1; });
