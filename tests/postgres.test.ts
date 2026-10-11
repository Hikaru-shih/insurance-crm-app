import { creationDate } from '../src/domain/followups';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { PGlite } from '@electric-sql/pglite';
import { migratePostgres, postgresAdapter, pgParameters } from '../server/postgres';
import { configuredDatabase } from '../server/configuredDatabase';
import { createApi } from '../server/app';
import { emptyWorkspace } from '../src/domain/workspace';
import { emptyContact } from '../src/domain/contacts';
import type { AccountMail } from '../server/mail';

test('PostgreSQL parameters preserve quoted literals; production requires a cloud database', async () => {
  assert.equal(pgParameters(`SELECT '?' AS "?", ? AS value, 'it''s?'`), `SELECT '?' AS "?", $1 AS value, 'it''s?'`);
  await assert.rejects(configuredDatabase({ NODE_ENV: 'production' }), /DATABASE_URL/);
});

test('PostgreSQL schema, API isolation, atomic scores, leaderboard and recovery', async () => {
  // PGlite executes real PostgreSQL SQL, but does not test TCP/TLS or a remote multi-process pool.
  const engine = new PGlite({ parsers: { 20: Number } });
  let tail = Promise.resolve();
  const db = postgresAdapter({
    async connect() {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; });
      await previous;
      return { release, async query(sql: string, values?: any[]) {
        const result = await engine.query(sql, values);
        return { rows: result.rows as Record<string, any>[], rowCount: result.affectedRows };
      } };
    }, end: () => engine.close(),
  });
  const mails: AccountMail[] = [];
  await migratePostgres(db);
  await migratePostgres(db);
  assert.equal((await db.prepare('SELECT count(*) n FROM users').get())!.n, 0);
  assert.equal((await db.prepare('SELECT count(*) n FROM kpi_rules').get())!.n, 6);
  const app = createApi({ database: '', connection: db, allowRegistration: true, recoveryCodesOnly: true, mailer: async mail => { mails.push(mail); } });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  const call = async (path: string, token = '', method = 'GET', body?: unknown) => {
    const result = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: result.status, data: await result.json() };
  };
  try {
    assert.equal((await call('/api/health')).data.database, 'postgres');
    const password = 'Postgres-test-password';
    const a = await app.createUser('a@example.test', password, 'user', '王小明');
    const b = await app.createUser('b@example.test', password, 'user', '李小明');
    const admin = await app.createUser('boss@example.test', password, 'admin', '老闆');
    await assert.rejects(app.createUser(a.email, password), /帳號已存在/);
    const login = async (email: string) => (await call('/api/auth/login', '', 'POST', { email, password })).data.token;
    const at = await login(a.email), bt = await login(b.email), mt = await login(admin.email);
    assert.equal(typeof at, 'string');
    assert.ok((await db.prepare('SELECT expires_at FROM sessions LIMIT 1').get())!.expires_at > Date.now());
    const own = `/api/workspaces/${a.id}`;
    assert.equal((await call(own, bt)).status, 403);
    const today = creationDate(new Date().toISOString())!;
    const draft = emptyWorkspace();
    draft.contacts.push({ ...emptyContact(), id: 'c', name: '客戶', createdAt: today, updatedAt: today, records: [{ id: 'r', date: today, content: '已聯繫', scoreCode: 'contact' }] });
    const saved = await call(own, at, 'PUT', draft);
    assert.equal(saved.status, 200);
    assert.equal((await call('/api/scores', at)).data.reduce((n: number, r: any) => n + r.points, 0), 2);
    const stale = structuredClone(draft);
    stale.contacts[0].records![0].scoreCode = 'card';
    assert.equal((await call(own, at, 'PUT', stale)).status, 409);
    assert.equal((await call('/api/scores', at)).data.reduce((n: number, r: any) => n + r.points, 0), 2);
    const competing = await Promise.all([call(own, at, 'PUT', saved.data), call(own, at, 'PUT', saved.data)]);
    assert.deepEqual(competing.map(r => r.status).sort(), [200, 409]);
    assert.equal((await call('/api/grants', at, 'POST', { email: b.email })).status, 201);
    assert.equal((await call('/api/grants', at, 'POST', { email: b.email })).status, 201);
    assert.equal((await call(own, bt)).status, 200);
    assert.equal((await call(own, bt, 'PUT', saved.data)).status, 403);
    await call(`/api/grants/${b.id}`, at, 'DELETE');
    assert.equal((await call(own, bt)).status, 403);
    const range = `?period=custom&start=${today}&end=${today}`;
    const ranked = await call('/api/admin/leaderboard' + range, mt);
    assert.equal(ranked.status, 200);
    assert.equal(ranked.data.rows.length, 2);
    assert.equal(ranked.data.rows[0].periodPoints, 2);
    assert.equal(ranked.data.rows[0].items[0].totalPoints, 2);
    assert.equal((await call('/api/admin/leaderboard', at)).status, 403);
    assert.equal((await call('/api/scores/rank' + range, at)).data.total, 2);
    const latest = (await call(own, at)).data;
    latest.contacts[0].records = [];
    assert.equal((await call(own, at, 'PUT', latest)).status, 200);
    assert.equal((await call('/api/admin/leaderboard' + range, mt)).data.rows[0].periodPoints, 1);
    await call('/api/auth/request-verification', '', 'POST', { email: a.email });
    const verification = mails.at(-1)!.token;
    assert.equal((await call('/api/auth/verify-email', '', 'POST', { email: a.email, code: verification })).status, 200);
    assert.equal((await call('/api/auth/verify-email', '', 'POST', { email: a.email, code: verification })).status, 400);
    await call('/api/auth/forgot-password', '', 'POST', { email: a.email });
    const reset = mails.at(-1)!.token;
    const resetBody = { email: a.email, code: reset, password: 'New-password123' };
    assert.equal((await call('/api/auth/reset-password', '', 'POST', resetBody)).status, 200);
    assert.equal((await call('/api/auth/reset-password', '', 'POST', resetBody)).status, 400);
    assert.equal((await call('/api/auth/me', at)).status, 401);
  } finally { await app.close(); }
});
