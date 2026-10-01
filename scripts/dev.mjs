import { spawn } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const root = process.cwd();
const api = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { stdio: 'inherit', env: { ...process.env, ALLOW_REGISTRATION: process.env.ALLOW_REGISTRATION ?? '1' } });
const web = spawn(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'start', '--host', 'localhost', '--port', '8081', '--max-workers', '2'], { stdio: 'inherit', env: { ...process.env, EXPO_NO_TELEMETRY: '1' } });
let stopping = false;
function stop() { if (stopping) return; stopping = true; api.kill(); web.kill(); }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
for (const child of [api, web]) { child.on('error', error => { console.error(error.message); process.exitCode = 1; stop(); }); child.on('exit', code => { if (!stopping) { process.exitCode = code || 0; stop(); } }); }
