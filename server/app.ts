import { syncRecordScores } from './recordScores';
import { isDate } from '../src/domain/contacts';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { openDatabase } from './database';
import { digest, hashPassword, verifyPassword } from './security';
import { emptyWorkspace, parseWorkspace, Workspace } from '../src/domain/workspace';

type User = { id: string; email: string; role: 'user' | 'admin'; active: number; password_hash: string };
class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
function fail(status: number, message: string): never { throw new ApiError(status, message); }
export function createApi(options: { database: string; allowRegistration?: boolean; origins?: string[] }) {
  const db = openDatabase(options.database);
  const origins = options.origins ?? ['http://localhost:8081', 'http://127.0.0.1:8081'];
  const attempts = new Map<string, { count: number; reset: number }>();
  const audit = (actor: string, action: string, target: string) => db.prepare('INSERT INTO audit_log VALUES(?,?,?,?,?)').run(randomUUID(), actor, action, target, new Date().toISOString());
  const transaction = <T>(work: () => T): T => { db.exec('BEGIN IMMEDIATE'); try { const result = work(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const publicUser = (user: User) => ({ id: user.id, email: user.email, role: user.role });
  async function createUser(email: string, password: string, role: 'user' | 'admin' = 'user') {
    email = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 12 || password.length > 128) fail(400, '請輸入有效 Email，密碼需 12–128 個字元。');
    const passwordHash = await hashPassword(password);
    const id = randomUUID();
    try { transaction(() => {
      db.prepare('INSERT INTO users(id,email,password_hash,role,created_at) VALUES(?,?,?,?,?)').run(id, email, passwordHash, role, new Date().toISOString());
      db.prepare('INSERT INTO workspaces VALUES(?,?,?,?)').run(id, 0, JSON.stringify(emptyWorkspace()), new Date().toISOString());
      audit(id, 'account.created', id);
    }); } catch (e) { if (String(e).includes('UNIQUE')) fail(409, '帳號已存在，請登入。'); throw e; }
    return publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id) as User);
  }
  async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
    if (!req.headers['content-type']?.startsWith('application/json')) fail(415, '請使用 JSON');
    let size = 0; const chunks: Buffer[] = [];
    for await (const chunk of req) { size += chunk.length; if (size > 1024 * 1024) fail(413, '資料超過大小限制'); chunks.push(chunk); }
    try { const value = JSON.parse(Buffer.concat(chunks).toString()); if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'JSON 格式錯誤'); return value; } catch { fail(400, 'JSON 格式錯誤'); }
  }
  function authenticated(req: IncomingMessage) {
    const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) fail(401, '請先登入');
    const user = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').get(digest(token), Date.now()) as User | undefined;
    if (!user) fail(401, '登入已失效，請重新登入');
    return { user, token };
  }
  function access(user: User, owner: string, write: boolean) {
    if (user.id === owner || user.role === 'admin') return;
    if (!write && db.prepare('SELECT 1 FROM grants WHERE owner_id=? AND viewer_id=?').get(owner, user.id)) return;
    fail(403, '沒有權限存取這份資料');
  }
  function rateLimit(req: IncomingMessage) {
    const now = Date.now();
    for (const [key, item] of attempts) if (item.reset < now) attempts.delete(key);
    const key = req.socket.remoteAddress ?? 'unknown';
    const item = attempts.get(key) ?? { count: 0, reset: now + 60000 };
    item.count++; attempts.set(key, item);
    if (item.count > 20) fail(429, '嘗試次數過多，請稍後再試');
  }
  const json = (res: ServerResponse, status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
  const server = createServer(async (req, res) => {
    try {
      const origin = req.headers.origin;
      if (origin && !origins.includes(origin)) fail(403, '不允許的來源');
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      if (path === '/api/health' && req.method === 'GET') { json(res, 200, { ok: true, schema: 3 }); return; }
      if (['/api/auth/register', '/api/auth/login'].includes(path) && req.method === 'POST') {
        rateLimit(req); const input = await body(req);
        if (typeof input.email !== 'string' || typeof input.password !== 'string' || input.password.length > 128 || input.email.length > 254) fail(400, '帳號或密碼格式錯誤');
        if (path.endsWith('register')) {
          if (!options.allowRegistration) fail(403, '目前不開放自行註冊，請聯絡管理員');
          json(res, 201, await createUser(input.email, input.password)); return;
        }
        const user = db.prepare('SELECT * FROM users WHERE email=?').get(input.email.trim().toLowerCase()) as User | undefined;
        const dummy = '00000000000000000000000000000000:' + '00'.repeat(64);
        const valid = await verifyPassword(input.password, user?.password_hash ?? dummy);
        if (!user || !user.active || !valid) fail(401, '帳號或密碼不正確');
        const token = randomBytes(32).toString('hex');
        db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
        db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), user.id, Date.now() + 8 * 60 * 60 * 1000);
        audit(user.id, 'login', user.id); json(res, 200, { token, user: publicUser(user) }); return;
      }
      const { user, token } = authenticated(req);
      if (path === '/api/auth/me' && req.method === 'GET') { json(res, 200, publicUser(user)); return; }
      if (path === '/api/auth/logout' && req.method === 'POST') { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token)); audit(user.id, 'logout', user.id); json(res, 200, { ok: true }); return; }
      const workspaceMatch = path.match(/^\/api\/workspaces\/([^/]+)$/);
      if (workspaceMatch && ['GET', 'PUT'].includes(req.method ?? '')) {
        const owner = workspaceMatch[1]; access(user, owner, req.method === 'PUT');
        const row = db.prepare('SELECT * FROM workspaces WHERE owner_id=?').get(owner) as { data: string; revision: number } | undefined;
        if (!row) fail(404, '找不到資料');
        if (req.method === 'GET') { if (user.id !== owner && user.role === 'admin') audit(user.id, 'admin.workspace.read', owner); json(res, 200, { ...JSON.parse(row.data), revision: row.revision }); return; }
        const input = await body(req);
        let next: Workspace;
        try { next = parseWorkspace(input); } catch (e) { fail(400, e instanceof Error ? e.message : '資料無效'); }
        if (input.version !== 2) fail(400, '請使用新版資料格式');
        transaction(() => {
          if (user.role === 'admin' && user.id !== owner) {
            const current = db.prepare('SELECT data FROM workspaces WHERE owner_id=?').get(owner) as { data: string };
            const existing = parseWorkspace(JSON.parse(current.data));
            const beforeIds = existing.contacts.map(c => c.id).sort().join(',');
            if (beforeIds !== next.contacts.map(c => c.id).sort().join(',')) fail(403, '管理員目前只可修改，不能代新增或刪除聯絡人');
          }
          const prior = db.prepare('SELECT data FROM workspaces WHERE owner_id=?').get(owner) as {data:string};
          try { syncRecordScores(db, owner, parseWorkspace(JSON.parse(prior.data)), next); } catch (e) { fail(400, e instanceof Error ? e.message : '紀錄計分失敗'); }
          const revision = next.revision + 1;
          const data = { ...next, revision };
          const result = db.prepare('UPDATE workspaces SET data=?,revision=?,updated_at=? WHERE owner_id=? AND revision=?').run(JSON.stringify(data), revision, new Date().toISOString(), owner, next.revision);
          if (!result.changes) fail(409, '資料已在其他畫面更新，請重新載入後再編輯');
          audit(user.id, user.id === owner ? 'workspace.updated' : 'admin.workspace.updated', owner);
          next = data;
        });
        json(res, 200, next); return;
      }
      if (path === '/api/grants' && req.method === 'GET') {
        json(res, 200, db.prepare('SELECT g.*,u.email AS viewer_email FROM grants g JOIN users u ON u.id=g.viewer_id WHERE g.owner_id=?').all(user.id)); return;
      }
      if (path === '/api/grants' && req.method === 'POST') {
        const input = await body(req);
        if (typeof input.email !== 'string') fail(400, '請填寫授權對象 Email');
        const viewer = db.prepare('SELECT id FROM users WHERE email=? AND active=1').get(input.email.trim().toLowerCase()) as { id: string } | undefined;
        if (!viewer || viewer.id === user.id) fail(400, '授權對象不存在或為自己');
        transaction(() => { db.prepare('INSERT OR IGNORE INTO grants VALUES(?,?,?)').run(user.id, viewer.id, new Date().toISOString()); audit(user.id, 'grant.created', viewer.id); });
        json(res, 201, { ok: true }); return;
      }
      const revoke = path.match(/^\/api\/grants\/([^/]+)$/);
      if (revoke && req.method === 'DELETE') {
        transaction(() => { db.prepare('DELETE FROM grants WHERE owner_id=? AND viewer_id=?').run(user.id, revoke[1]); audit(user.id, 'grant.revoked', revoke[1]); });
        json(res, 200, { ok: true }); return;
      }
      if (path === '/api/report-settings' && req.method === 'GET') {
        json(res,200,db.prepare('SELECT period FROM report_settings WHERE id=1').get()); return;
      }
      if (path === '/api/admin/report-settings' && req.method === 'PUT') {
        if (user.role !== 'admin') fail(403,'需要管理員權限');
        const input = await body(req);
        if (input.period !== 'week' && input.period !== 'month') fail(400,'請選擇週報或月報');
        const period = input.period;
        transaction(() => { db.prepare('UPDATE report_settings SET period=? WHERE id=1').run(period); audit(user.id,'report.period.updated',period); });
        json(res,200,{period}); return;
      }
      if (path === '/api/scores' && req.method === 'GET') {
        json(res, 200, db.prepare('SELECT * FROM score_entries WHERE owner_id=? ORDER BY date DESC,id').all(user.id)); return;
      }
      if (path === '/api/scores' && req.method === 'POST') {
        const input = await body(req);
        if (typeof input.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(input.id) || typeof input.date !== 'string' || !isDate(input.date) || typeof input.code !== 'string' || typeof input.note !== 'string' || input.note.length > 2000) fail(400, '請填寫有效的日期、項目與備註');
        transaction(() => {
          const existing = db.prepare('SELECT * FROM score_entries WHERE owner_id=? AND id=?').get(user.id,input.id as string) as any;
          if (existing) { if (existing.date !== input.date || existing.code !== input.code || existing.note !== input.note) fail(409,'此行動已登記，請重新載入'); return; }
          const rule = db.prepare('SELECT * FROM kpi_rules WHERE code=?').get(input.code as string) as { label: string; points: number } | undefined;
          if (!rule) fail(400,'計分項目不存在');
          db.prepare('INSERT INTO score_entries(owner_id,id,date,code,label,points,note) VALUES(?,?,?,?,?,?,?)').run(user.id,input.id as string,input.date as string,input.code as string,rule.label,rule.points,input.note as string);
          audit(user.id,'score.created',input.id as string);
        });
        json(res,200,{ok:true}); return;
      }
      const scoreMatch = path.match(/^\/api\/scores\/([^/]+)$/);
      if (scoreMatch && req.method === 'DELETE') {
        transaction(() => {
          const result = db.prepare('UPDATE score_entries SET revoked=1 WHERE owner_id=? AND id=?').run(user.id,scoreMatch[1]);
          if (!result.changes) fail(404,'找不到計分紀錄');
          audit(user.id,'score.revoked',scoreMatch[1]);
        });
        json(res,200,{ok:true}); return;
      }
      if (path === '/api/admin/kpi-rules' && req.method === 'PUT') {
        if (user.role !== 'admin') fail(403,'需要管理員權限');
        const input = await body(req);
        if (typeof input.code !== 'string' || !Number.isInteger(input.points) || (input.points as number) < 0 || (input.points as number) > 10000) fail(400,'分數須為 0–10000 的整數');
        transaction(() => {
          const result = db.prepare('UPDATE kpi_rules SET points=? WHERE code=?').run(input.points as number,input.code as string);
          if (!result.changes) fail(404,'計分項目不存在');
          audit(user.id,'kpi.updated',input.code as string);
        });
        json(res,200,{ok:true}); return;
      }
      if (path === '/api/kpi-rules' && req.method === 'GET') { json(res, 200, db.prepare('SELECT * FROM kpi_rules ORDER BY points,code').all()); return; }
      if (path.startsWith('/api/admin/')) {
        if (user.role !== 'admin') fail(403, '需要管理員權限');
        if (path === '/api/admin/users' && req.method === 'GET') { json(res, 200, db.prepare('SELECT id,email,role,active,created_at FROM users ORDER BY created_at DESC').all()); return; }
        if (path === '/api/admin/audit' && req.method === 'GET') { json(res, 200, db.prepare('SELECT id,actor_id,action,target_id,created_at FROM audit_log ORDER BY created_at DESC LIMIT 100').all()); return; }
      }
      fail(404, '找不到此功能');
    } catch (error) {
      if (error instanceof ApiError) json(res, error.status, { error: error.message });
      else { console.error('API request failed:', error instanceof Error ? error.name : 'unknown'); json(res, 500, { error: '伺服器處理失敗，請稍後重試' }); }
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  return { server, db, createUser, close: () => new Promise<void>((resolve, reject) => { server.close(error => { db.close(); if (error) reject(error); else resolve(); }); server.closeIdleConnections(); }) };
}
