import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createApi } from './app';
if (existsSync('.env')) process.loadEnvFile('.env');
const host = process.env.API_HOST ?? '127.0.0.1';
const port = Number(process.env.API_PORT ?? 3001);
const app = createApi({ database: resolve(process.env.DATABASE_PATH ?? '.data/development.sqlite'), allowRegistration: process.env.ALLOW_REGISTRATION === '1', origins: process.env.ALLOWED_ORIGINS?.split(',') });
app.server.listen(port, host, () => console.log(`Qianmai API http://${host}:${port} (registration ${process.env.ALLOW_REGISTRATION === '1' ? 'enabled' : 'disabled'})`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void app.close().then(() => process.exit(0)); });
