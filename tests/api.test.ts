import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createApi } from '../server/app';
import { emptyContact } from '../src/domain/contacts';
import { emptyWorkspace, parseWorkspace } from '../src/domain/workspace';

test('v1 migration preserves removed fields and does not invent birthday', () => {
  const old = { ...emptyWorkspace(), version: 1, contacts: [{ ...emptyContact(), id: 'old', name: '舊客戶', phone: '0900000000', nickname: '甲', email: 'legacy@example.test', gender: undefined, instagram: undefined, groups: undefined, birthday: undefined, createdAt: '2026-09-10', updatedAt: '2026-09-10', importantDates: [{ id: 'd1', label: '生日', date: '2000-01-01' }] }] };
  const next = parseWorkspace(old);
  assert.equal(next.contacts[0].phone, '0900000000');
  assert.equal(next.contacts[0].importantDates[0].label, '生日');
  assert.equal(next.contacts[0].birthday, '');
  assert.deepEqual(next.contacts[0].groups, []);
  assert.equal(next.version, 2);
});

test('authenticated API isolation, grants, admin and durable data', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'qianmai-test-'));
  const database = join(directory, 'test.sqlite');
  let app = createApi({ database, allowRegistration: true });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  let base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  const request = async (path: string, token?: string, method = 'GET', body?: unknown) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json() };
  };
  const password = 'Test-only-long-password!';
  try {
    const a = await app.createUser('a@example.test', password);
    const b = await app.createUser('b@example.test', password);
    const admin = await app.createUser('admin@example.test', password, 'admin');
    const login = async (email: string) => (await request('/api/auth/login', undefined, 'POST', { email, password })).data.token as string;
    const at = await login(a.email), bt = await login(b.email), mt = await login(admin.email);
    const own = `/api/workspaces/${a.id}`;
    let saved = emptyWorkspace();
    await t.test('server owns roles and password hashes, not client fields', async () => {
      const result = await request('/api/auth/register', undefined, 'POST', { email: 'new@example.test', password, role: 'admin' });
      assert.equal(result.status, 201); assert.equal(result.data.role, 'user');
      assert.equal((await request('/api/auth/login', undefined, 'POST', { email: a.email, password: 'wrong' })).status, 401);
      const row = app.db.prepare('SELECT password_hash FROM users WHERE id=?').get(a.id)!;
      assert.notEqual(row.password_hash, password); assert.match(String(row.password_hash), /^[a-f0-9]+:[a-f0-9]+$/);
    });
    await t.test('no session and another account cannot read or write A', async () => {
      assert.equal((await request(own)).status, 401);
      assert.equal((await request(own, bt)).status, 403);
      assert.equal((await request(own, bt, 'PUT', emptyWorkspace())).status, 403);
      assert.equal((await request('/api/admin/users', bt)).status, 403);
    });
    await t.test('save latest contact fields and prevent stale overwrites', async () => {
      const draft = emptyWorkspace();
      draft.contacts.push({ ...emptyContact(), id: 'contact-a', name: '測試甲', instagram: '@test_a', gender: '女', groups: ['朋友'], birthday: '2000-05-20', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const result = await request(own, at, 'PUT', draft);
      assert.equal(result.status, 200); saved = result.data;
      assert.equal(saved.revision, 1); assert.equal(saved.contacts[0].instagram, '@test_a');
      assert.equal((await request(own, at, 'PUT', draft)).status, 409);
      const ownB = await request(`/api/workspaces/${b.id}`, bt); assert.equal(ownB.data.contacts.length, 0);
    });
    await t.test('direct API validates fields and protects fixed grades', async () => {
      const invalid = structuredClone(saved); invalid.grades[0].amount = 99;
      assert.equal((await request(own, at, 'PUT', invalid)).status, 400);
      const blank = structuredClone(saved); blank.contacts[0].name = '  ';
      assert.equal((await request(own, at, 'PUT', blank)).status, 400);
      const badBirthday = structuredClone(saved); badBirthday.contacts[0].birthday = '2000-02-30';
      assert.equal((await request(own, at, 'PUT', badBirthday)).status, 400);
    });
    await t.test('grant is readonly, cannot be transitive, revoke immediately blocks reads', async () => {
      assert.equal((await request('/api/grants', at, 'POST', { email: b.email })).status, 201);
      assert.equal((await request(own, bt)).status, 200);
      assert.equal((await request(own, bt, 'PUT', saved)).status, 403);
      await request('/api/grants', bt, 'POST', { email: 'new@example.test', ownerId: a.id });
      const nt = await login('new@example.test'); assert.equal((await request(own, nt)).status, 403);
      await request(`/api/grants/${b.id}`, at, 'DELETE');
      assert.equal((await request(own, bt)).status, 403);
      assert.equal((app.db.prepare("SELECT count(*) AS total FROM audit_log WHERE action='grant.revoked'").get()!).total, 1);
    });
    await t.test('admin can modify but not add or delete another owner contacts', async () => {
      const modified = structuredClone(saved); modified.contacts[0].notes = '管理員修改';
      const result = await request(own, mt, 'PUT', modified); assert.equal(result.status, 200); saved = result.data;
      const deleted = structuredClone(saved); deleted.contacts = [];
      assert.equal((await request(own, mt, 'PUT', deleted)).status, 403);
      const audit = await request('/api/admin/audit', mt); assert.ok(audit.data.some((r: { action: string }) => r.action === 'admin.workspace.updated'));
      assert.equal((await request('/api/kpi-rules', at)).data.length, 6);
    });
    await t.test('logout revokes token, expiration and inactive accounts cannot access', async () => {
      assert.equal((await request('/api/auth/logout', bt, 'POST')).status, 200);
      assert.equal((await request(`/api/workspaces/${b.id}`, bt)).status, 401);
      const expired = await login(b.email);
      app.db.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=?').run(b.id);
      assert.equal((await request('/api/auth/me', expired)).status, 401);
      const disabled = await login(b.email); app.db.prepare('UPDATE users SET active=0 WHERE id=?').run(b.id);
      assert.equal((await request('/api/auth/me', disabled)).status, 401);
    });
    await t.test('server restart preserves data and migration is repeatable', async () => {
      await app.close();
      app = createApi({ database, allowRegistration: false }); app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
      base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
      const result = await request(own, at); assert.equal(result.status, 200); assert.equal(result.data.contacts[0].notes, '管理員修改');
      assert.equal((await request('/api/auth/register', undefined, 'POST', { email: 'closed@example.test', password })).status, 403);
    });
  } finally {
    await app.close();
    const target = resolve(directory);
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('qianmai-test-')) throw new Error('Unsafe test cleanup path');
    rmSync(target, { recursive: true, force: true });
  }
});
