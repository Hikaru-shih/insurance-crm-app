import type { DatabaseSync } from 'node:sqlite';
import { publicPage } from './publicPages';
import { sqliteAsync, AsyncDatabase } from './asyncDatabase';
import { queryRange } from '../src/domain/dateRange';
import { syncRecordScores } from './recordScores';
import { reportRange } from '../src/domain/reporting';
import { creationDate } from '../src/domain/followups';
import type { Mailer } from './mail';
import { isDate } from '../src/domain/contacts';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes, randomUUID, randomInt } from 'node:crypto';
import { openDatabase } from './database';
import { digest, hashPassword, verifyPassword } from './security';
import { emptyWorkspace, parseWorkspace, Workspace } from '../src/domain/workspace';
type User = {
    name: string;
    id: string;
    email: string;
    role: 'user' | 'admin';
    active: number;
    password_hash: string;
    email_verified_at: string | null;
};
class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
function fail(status: number, message: string): never { throw new ApiError(status, message); }
export function createApi<T extends AsyncDatabase | undefined = undefined>(options: {
    database: string;
    connection?: T;
    allowRegistration?: boolean;
    origins?: string[];
    mailer?: Mailer;
    requireVerifiedEmail?: boolean;
    recoveryCodesOnly?: boolean;
}) {
    const rawDb = options.connection ? undefined : openDatabase(options.database);
    const db = options.connection ?? sqliteAsync(rawDb!);
    const origins = options.origins ?? ['http://localhost:8081', 'http://127.0.0.1:8081'];
    const attempts = new Map<string, {
        count: number;
        reset: number;
    }>();
    const audit = async (actor: string, action: string, target: string) => (await db.prepare('INSERT INTO audit_log VALUES(?,?,?,?,?)').run(randomUUID(), actor, action, target, new Date().toISOString()));
    const transaction = <T>(work: () => Promise<T>): Promise<T> => db.transaction(work);
    const publicUser = (user: User) => ({ id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: !!user.email_verified_at });
    async function createUser(email: string, password: string, role: 'user' | 'admin' = 'user', name = '', actor?: string) {
        email = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 128)
            fail(400, '請輸入有效 Email，密碼需 8–128 個字元。');
        const passwordHash = await hashPassword(password);
        const id = randomUUID();
        try {
            (await transaction(async () => {
                if (actor && !(await db.prepare("SELECT id FROM users WHERE id=? AND active=1 AND role='admin'").get(actor)))
                    fail(403, '需要管理員權限');
                (await db.prepare('INSERT INTO users(id,email,password_hash,role,created_at,name) VALUES(?,?,?,?,?,?)').run(id, email, passwordHash, role, new Date().toISOString(), name.trim()));
                (await db.prepare('INSERT INTO workspaces VALUES(?,?,?,?)').run(id, 0, JSON.stringify(emptyWorkspace()), new Date().toISOString()));
                (await audit(id, 'account.created', id));
                if (actor)
                    (await audit(actor, 'admin.account.created', id));
            }));
        }
        catch (e) {
            if ((String(e).includes('UNIQUE') || (e as {
                code?: string;
            }).code === '23505'))
                fail(409, '帳號已存在，請登入。');
            throw e;
        }
        return publicUser((await db.prepare('SELECT * FROM users WHERE id=?').get(id)) as User);
    }
    async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
        if (!req.headers['content-type']?.startsWith('application/json'))
            fail(415, '請使用 JSON');
        let size = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            size += chunk.length;
            if (size > 1024 * 1024)
                fail(413, '資料超過大小限制');
            chunks.push(chunk);
        }
        try {
            const value = JSON.parse(Buffer.concat(chunks).toString());
            if (!value || typeof value !== 'object' || Array.isArray(value))
                fail(400, 'JSON 格式錯誤');
            return value;
        }
        catch {
            fail(400, 'JSON 格式錯誤');
        }
    }
    async function authenticated(req: IncomingMessage) {
        const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
        if (!token)
            fail(401, '請先登入');
        const user = (await db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').get(digest(token), Date.now())) as User | undefined;
        if (!user)
            fail(401, '登入已失效，請重新登入');
        if (options.requireVerifiedEmail && !user.email_verified_at)
            fail(401, '請先驗證信箱並重新登入');
        return { user, token };
    }
    async function access(user: User, owner: string, write: boolean) {
        if (user.id === owner || user.role === 'admin')
            return;
        if (!write && (await db.prepare('SELECT 1 FROM grants g JOIN users u ON u.id=g.owner_id WHERE g.owner_id=? AND g.viewer_id=? AND u.active=1').get(owner, user.id)))
            return;
        fail(403, '沒有權限存取這份資料');
    }
    function rateLimit(req: IncomingMessage, email?: unknown) {
        const now = Date.now();
        for (const [key, item] of attempts)
            if (item.reset < now)
                attempts.delete(key);
        const ip = 'ip:' + (req.socket.remoteAddress ?? 'unknown');
        const keys: [string, number][] = [[ip, 200]];
        if (typeof email === 'string') keys.push(['account:' + digest(email.trim().toLowerCase()), 20]);
        for (const [key, limit] of keys) {
            const item = attempts.get(key) ?? { count: 0, reset: now + 60000 };
            item.count++;
            attempts.set(key, item);
            if (item.count > limit) fail(429, '嘗試次數過多，請稍後再試');
        }
    }
    const json = (res: ServerResponse, status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    const server = createServer(async (req, res) => {
        try {
            const origin = req.headers.origin;
            if (origin && !origins.includes(origin))
                fail(403, '不允許的來源');
            if (origin) {
                res.setHeader('Access-Control-Allow-Origin', origin);
                res.setHeader('Vary', 'Origin');
            }
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }
            const path = new URL(req.url ?? '/', 'http://localhost').pathname;
            const page = req.method === 'GET' ? publicPage(path) : undefined;
            if (page) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
                res.end(page);
                return;
            }
            if (path === '/api/health' && req.method === 'GET') {
                await db.prepare('SELECT 1 FROM report_settings WHERE id=1').get();
                json(res, 200, { ok: true, schema: db.kind === 'postgres' ? 2 : 6, database: db.kind });
                return;
            }
            if (['/api/auth/request-verification', '/api/auth/forgot-password'].includes(path) && req.method === 'POST') {
                const input = await body(req);
                rateLimit(req, input.email);
                if (typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
                    fail(400, '請輸入有效 Email');
                if (!options.mailer)
                    fail(503, '寄信服務尚未設定');
                const purpose = path.endsWith('forgot-password') ? 'reset' : 'verify';
                const account = (await db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(input.email.trim().toLowerCase())) as User | undefined;
                if (account && (purpose === 'reset' || !account.email_verified_at)) {
                    const recent = (await db.prepare('SELECT 1 FROM account_tokens WHERE user_id=? AND purpose=? AND created_at>?').get(account.id, purpose, Date.now() - 60000));
                    if (!recent) {
                        const isCode = options.recoveryCodesOnly || input.delivery === 'code';
                        const secret = isCode ? randomInt(0, 100000000).toString().padStart(8, '0') : randomBytes(32).toString('hex');
                        const secretHash = digest(isCode ? `${account.email}:${purpose}:${secret}` : secret);
                        const issued = await transaction(async () => {
                            if (await db.prepare('SELECT 1 FROM account_tokens WHERE user_id=? AND purpose=? AND created_at>?').get(account.id, purpose, Date.now()-60000)) return false;
                            await db.prepare('DELETE FROM account_tokens WHERE user_id=? AND purpose=?').run(account.id, purpose);
                            await db.prepare('INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at,created_at) VALUES(?,?,?,?,?)').run(secretHash, account.id, purpose, Date.now() + (isCode ? 600000 : purpose === 'verify' ? 86400000 : 1800000), Date.now());
                            return true;
                        });
                        if (issued) {
                        try {
                            await options.mailer({ to: account.email, purpose, token: secret, format: isCode ? 'code' : 'link' });
                            (await audit(account.id, `email.${purpose}.requested`, account.id));
                        }
                        catch {
                            (await db.prepare('DELETE FROM account_tokens WHERE token_hash=?').run(secretHash));
                            fail(503, '寄信服務暫時無法使用，請稍後重試');
                        }
                    }
                }
                }
                json(res, 200, { ok: true, message: '若帳號符合條件，將寄出信件；請查看信箱或垃圾郵件，重寄請間隔至少一分鐘。' });
                return;
            }
            if (['/api/auth/verify-email', '/api/auth/reset-password'].includes(path) && req.method === 'POST') {
                const input = await body(req), purpose = path.endsWith('reset-password') ? 'reset' : 'verify';
                rateLimit(req, input.email);
                const isCode = typeof input.code === 'string';
                if (isCode ? (!/^\d{8}$/.test(input.code as string) || typeof input.email !== 'string' || input.email.length > 254) : (typeof input.token !== 'string' || !/^[a-f0-9]{64}$/.test(input.token)))
                    fail(400, '驗證資料無效或已失效，請重新申請');
                if (purpose === 'reset' && (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128))
                    fail(400, '密碼需 8–128 個字元');
                const key = digest(isCode ? `${(input.email as string).trim().toLowerCase()}:${purpose}:${input.code}` : input.token as string);
                if (isCode) {
                    const accepted = await transaction(async () => {
                        const row = await db.prepare('SELECT t.token_hash,t.attempts FROM account_tokens t JOIN users u ON u.id=t.user_id WHERE u.email=? AND u.active=1 AND t.purpose=? AND t.expires_at>?').get((input.email as string).trim().toLowerCase(),purpose,Date.now());
                        if (!row) return false;
                        if (row.attempts >= 5) return false;
                        await db.prepare('UPDATE account_tokens SET attempts=attempts+1 WHERE token_hash=?').run(row.token_hash);
                        return row.token_hash === key;
                    });
                    if (!accepted) fail(400, '驗證碼錯誤、已過期或嘗試次數過多，請重新申請');
                }
                const valid = async () => (await db.prepare('SELECT t.user_id FROM account_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.purpose=? AND t.expires_at>? AND u.active=1').get(key, purpose, Date.now())) as {
                    user_id: string;
                } | undefined;
                if (!(await valid()))
                    fail(400, '驗證資料無效或已失效，請重新申請');
                const passwordHash = purpose === 'reset' ? await hashPassword(input.password as string) : null;
                (await transaction(async () => {
                    const tokenRow = (await valid());
                    if (!tokenRow)
                        fail(400, '驗證資料無效或已失效，請重新申請');
                    (await db.prepare('UPDATE users SET email_verified_at=? WHERE id=?').run(new Date().toISOString(), tokenRow.user_id));
                    if (passwordHash) {
                        (await db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash, tokenRow.user_id));
                        (await db.prepare('DELETE FROM sessions WHERE user_id=?').run(tokenRow.user_id));
                        (await db.prepare('DELETE FROM account_tokens WHERE user_id=?').run(tokenRow.user_id));
                    }
                    else
                        (await db.prepare('DELETE FROM account_tokens WHERE user_id=? AND purpose=?').run(tokenRow.user_id, purpose));
                    (await audit(tokenRow.user_id, purpose === 'reset' ? 'password.reset' : 'email.verified', tokenRow.user_id));
                }));
                json(res, 200, { ok: true });
                return;
            }
            if (['/api/auth/register', '/api/auth/login'].includes(path) && req.method === 'POST') {
                const input = await body(req);
                rateLimit(req, input.email);
                if (typeof input.email !== 'string' || typeof input.password !== 'string' || input.password.length > 128 || input.email.length > 254)
                    fail(400, '帳號或密碼格式錯誤');
                if (path.endsWith('register')) {
                    if (!options.allowRegistration)
                        fail(403, '目前不開放自行註冊，請聯絡管理員');
                    if (typeof input.name !== 'string' || !input.name.trim() || [...input.name.trim()].length > 80)
                        fail(400, '姓名請填寫 1–80 個字元。');
                    json(res, 201, await createUser(input.email, input.password, 'user', input.name));
                    return;
                }
                const user = (await db.prepare('SELECT * FROM users WHERE email=?').get(input.email.trim().toLowerCase())) as User | undefined;
                const dummy = '00000000000000000000000000000000:' + '00'.repeat(64);
                const valid = await verifyPassword(input.password, user?.password_hash ?? dummy);
                if (!user || !user.active || !valid)
                    fail(401, '帳號或密碼不正確');
                if (options.requireVerifiedEmail && !user.email_verified_at)
                    fail(403, '請先驗證信箱，可從登入頁申請或重寄驗證信');
                const token = randomBytes(32).toString('hex');
                await transaction(async () => {
                    const current = await db.prepare('SELECT password_hash,active,email_verified_at FROM users WHERE id=?').get(user.id);
                    if (!current || !current.active || current.password_hash !== user.password_hash || (options.requireVerifiedEmail && !current.email_verified_at)) fail(401, '登入資訊已更新，請重新登入');
                    await db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
                    await db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), user.id, Date.now() + 8 * 60 * 60 * 1000);
                    await audit(user.id, 'login', user.id);
                });
                json(res, 200, { token, user: publicUser(user) });
                return;
            }
            const { user, token } = (await authenticated(req));
            if (path === '/api/auth/account' && req.method === 'DELETE') {
                const input = await body(req);
                rateLimit(req, user.email);
                if (input.confirmation !== '永久刪除' || typeof input.password !== 'string' || input.password.length > 128)
                    fail(400, '請輸入目前密碼及「永久刪除」確認文字');
                if (!await verifyPassword(input.password, user.password_hash)) fail(400, '密碼不正確');
                await transaction(async () => {
                    const current = await db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id);
                    if (!current || current.password_hash !== user.password_hash) fail(401, '帳號資訊已更新，請重新登入');
                    await db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
                    await db.prepare('DELETE FROM account_tokens WHERE user_id=?').run(user.id);
                    await db.prepare('DELETE FROM grants WHERE owner_id=? OR viewer_id=?').run(user.id, user.id);
                    await db.prepare('DELETE FROM score_entries WHERE owner_id=?').run(user.id);
                    await db.prepare('DELETE FROM workspaces WHERE owner_id=?').run(user.id);
                    await db.prepare('DELETE FROM audit_log WHERE actor_id=? OR target_id=?').run(user.id, user.id);
                    await db.prepare('DELETE FROM users WHERE id=?').run(user.id);
                });
                json(res, 200, { ok: true });
                return;
            }
            if (path === '/api/scores/rank' && req.method === 'GET') {
                const selection = queryRange(new URL(req.url!, 'http://localhost').searchParams, ((await db.prepare('SELECT period FROM report_settings WHERE id=1').get()) as {
                    period: 'week' | 'month';
                }).period, creationDate(new Date().toISOString())!);
                if (!selection)
                    fail(400, '請輸入有效的日期區間與週期');
                const { period, range } = selection;
                const rows = (await db.prepare(`SELECT u.id,COALESCE(SUM(s.points),0) AS "totalPoints",
          COALESCE(SUM(CASE WHEN s.date BETWEEN ? AND ? THEN s.points ELSE 0 END),0) AS "periodPoints"
          FROM users u LEFT JOIN score_entries s ON s.owner_id=u.id AND s.revoked=0
          WHERE u.role='user' GROUP BY u.id`).all(range.start, range.end)) as {
                    id: string;
                    periodPoints: number;
                    totalPoints: number;
                }[];
                const own = rows.find(row => row.id === user.id);
                json(res, 200, { period, range, total: rows.length, periodRank: own ? 1 + rows.filter(row => row.periodPoints > own.periodPoints).length : null, totalRank: own ? 1 + rows.filter(row => row.totalPoints > own.totalPoints).length : null });
                return;
            }
            if (path === '/api/auth/me' && req.method === 'GET') {
                json(res, 200, publicUser(user));
                return;
            }
            if (path === '/api/auth/logout' && req.method === 'POST') {
                (await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token)));
                (await audit(user.id, 'logout', user.id));
                json(res, 200, { ok: true });
                return;
            }
            const sharedScores = path.match(/^\/api\/workspaces\/([^/]+)\/scores$/);
            if (sharedScores && req.method === 'GET') {
                const owner = sharedScores[1];
                (await access(user, owner, false));
                if (!(await db.prepare('SELECT id FROM users WHERE id=?').get(owner)))
                    fail(404, '帳號不存在');
                if (user.id !== owner && user.role === 'admin')
                    (await audit(user.id, 'admin.scores.read', owner));
                json(res, 200, (await db.prepare('SELECT * FROM score_entries WHERE owner_id=? ORDER BY date DESC,id').all(owner)));
                return;
            }
            const workspaceMatch = path.match(/^\/api\/workspaces\/([^/]+)$/);
            if (workspaceMatch && ['GET', 'PUT'].includes(req.method ?? '')) {
                const owner = workspaceMatch[1];
                (await access(user, owner, req.method === 'PUT'));
                const row = (await db.prepare('SELECT * FROM workspaces WHERE owner_id=?').get(owner)) as {
                    data: string;
                    revision: number;
                } | undefined;
                if (!row)
                    fail(404, '找不到資料');
                if (req.method === 'GET') {
                    if (user.id !== owner && user.role === 'admin')
                        (await audit(user.id, 'admin.workspace.read', owner));
                    json(res, 200, { ...parseWorkspace(JSON.parse(row.data)), revision: row.revision });
                    return;
                }
                const input = await body(req);
                let next: Workspace;
                try {
                    next = parseWorkspace(input);
                }
                catch (e) {
                    fail(400, e instanceof Error ? e.message : '資料無效');
                }
                if (input.version !== 2)
                    fail(400, '請使用新版資料格式');
                (await transaction(async () => {
                    if (user.role === 'admin' && user.id !== owner) {
                        const current = (await db.prepare('SELECT data FROM workspaces WHERE owner_id=?').get(owner)) as {
                            data: string;
                        };
                        const existing = parseWorkspace(JSON.parse(current.data));
                        const beforeIds = existing.contacts.map(c => c.id).sort().join(',');
                        if (beforeIds !== next.contacts.map(c => c.id).sort().join(','))
                            fail(403, '管理員目前只可修改，不能代新增或刪除聯絡人');
                        if (JSON.stringify(existing.events.map(e => e.id).sort()) !== JSON.stringify(next.events.map(e => e.id).sort()))
                            fail(403, '管理員目前不能代新增或刪除行程');
                    }
                    const prior = (await db.prepare('SELECT data FROM workspaces WHERE owner_id=?').get(owner)) as {
                        data: string;
                    };
                    const previousContacts = parseWorkspace(JSON.parse(prior.data)).contacts;
                    for (const event of next.events) {
                        if (event.recordId && previousContacts.find(c => c.id === event.contactId)?.records?.some(r => r.id === event.recordId) && !next.contacts.find(c => c.id === event.contactId)?.records?.some(r => r.id === event.recordId))
                            event.completed = false;
                    }
                    for (const contact of next.contacts) {
                        const old = previousContacts.find(c => c.id === contact.id);
                        for (const record of contact.records ?? []) {
                            if (!old?.records?.some(r => r.id === record.id) && record.reviewGrade === undefined)
                                record.reviewGrade = '';
                            if (record.reviewGrade && old?.records?.find(r => r.id === record.id)?.reviewGrade !== record.reviewGrade && !next.grades.some(g => g.code === record.reviewGrade))
                                fail(400, '重新分級不存在');
                        }
                    }
                    try {
                        const before = parseWorkspace(JSON.parse(prior.data));
                        (await syncRecordScores(db, owner, before, next));

                    }
                    catch (e) {
                        fail(400, e instanceof Error ? e.message : '紀錄計分失敗');
                    }
                    const revision = next.revision + 1;
                    const data = { ...next, revision };
                    const result = (await db.prepare('UPDATE workspaces SET data=?,revision=?,updated_at=? WHERE owner_id=? AND revision=?').run(JSON.stringify(data), revision, new Date().toISOString(), owner, next.revision));
                    if (!result.changes)
                        fail(409, '資料已在其他畫面更新，請重新載入後再編輯');
                    (await audit(user.id, user.id === owner ? 'workspace.updated' : 'admin.workspace.updated', owner));
                    next = data;
                }));
                json(res, 200, next);
                return;
            }
            if (path === '/api/grants' && req.method === 'GET') {
                json(res, 200, (await db.prepare('SELECT g.*,u.email AS viewer_email,u.name AS viewer_name,u.active AS viewer_active FROM grants g JOIN users u ON u.id=g.viewer_id WHERE g.owner_id=?').all(user.id)));
                return;
            }
            if (path === '/api/shared-with-me' && req.method === 'GET') {
                json(res, 200, (await db.prepare('SELECT u.id,u.name,u.email FROM grants g JOIN users u ON u.id=g.owner_id WHERE g.viewer_id=? AND u.active=1 ORDER BY u.name,u.email').all(user.id)));
                return;
            }
            if (path === '/api/grants' && req.method === 'POST') {
                const input = await body(req);
                if (input.ownerId !== undefined && input.ownerId !== user.id)
                    fail(403, '只能授權自己的資料');
                if (typeof input.email !== 'string')
                    fail(400, '請填寫授權對象 Email');
                const viewer = (await db.prepare('SELECT id FROM users WHERE email=? AND active=1').get(input.email.trim().toLowerCase())) as {
                    id: string;
                } | undefined;
                if (!viewer || viewer.id === user.id)
                    fail(400, '授權對象不存在或為自己');
                (await transaction(async () => { (await db.prepare('INSERT INTO grants VALUES(?,?,?) ON CONFLICT DO NOTHING').run(user.id, viewer.id, new Date().toISOString())); (await audit(user.id, 'grant.created', viewer.id)); }));
                json(res, 201, { ok: true });
                return;
            }
            const revoke = path.match(/^\/api\/grants\/([^/]+)$/);
            if (revoke && req.method === 'DELETE') {
                (await transaction(async () => { (await db.prepare('DELETE FROM grants WHERE owner_id=? AND viewer_id=?').run(user.id, revoke[1])); (await audit(user.id, 'grant.revoked', revoke[1])); }));
                json(res, 200, { ok: true });
                return;
            }
            if (path === '/api/report-settings' && req.method === 'GET') {
                json(res, 200, (await db.prepare('SELECT period FROM report_settings WHERE id=1').get()));
                return;
            }
            if (path === '/api/admin/report-settings' && req.method === 'PUT') {
                if (user.role !== 'admin')
                    fail(403, '需要管理員權限');
                const input = await body(req);
                if (input.period !== 'week' && input.period !== 'month')
                    fail(400, '請選擇週報或月報');
                const period = input.period;
                (await transaction(async () => { (await db.prepare('UPDATE report_settings SET period=? WHERE id=1').run(period)); (await audit(user.id, 'report.period.updated', period)); }));
                json(res, 200, { period });
                return;
            }
            if (path === '/api/scores' && req.method === 'GET') {
                json(res, 200, (await db.prepare('SELECT * FROM score_entries WHERE owner_id=? ORDER BY date DESC,id').all(user.id)));
                return;
            }
            if (path === '/api/scores' && req.method === 'POST') {
                const input = await body(req);
                if (typeof input.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(input.id) || typeof input.date !== 'string' || !isDate(input.date) || typeof input.code !== 'string' || typeof input.note !== 'string' || input.note.length > 2000)
                    fail(400, '請填寫有效的日期、項目與備註');
                (await transaction(async () => {
                    const existing = (await db.prepare('SELECT * FROM score_entries WHERE owner_id=? AND id=?').get(user.id, input.id as string)) as any;
                    if (existing) {
                        if (existing.date !== input.date || existing.code !== input.code || existing.note !== input.note)
                            fail(409, '此行動已登記，請重新載入');
                        return;
                    }
                    const rule = (await db.prepare('SELECT * FROM kpi_rules WHERE code=?').get(input.code as string)) as {
                        label: string;
                        points: number;
                    } | undefined;
                    if (!rule)
                        fail(400, '計分項目不存在');
                    (await db.prepare('INSERT INTO score_entries(owner_id,id,date,code,label,points,note) VALUES(?,?,?,?,?,?,?)').run(user.id, input.id as string, input.date as string, input.code as string, rule.label, rule.points, input.note as string));
                    (await audit(user.id, 'score.created', input.id as string));
                }));
                json(res, 200, { ok: true });
                return;
            }
            const scoreMatch = path.match(/^\/api\/scores\/([^/]+)$/);
            if (scoreMatch && req.method === 'DELETE') {
                (await transaction(async () => {
                    const result = (await db.prepare('UPDATE score_entries SET revoked=1 WHERE owner_id=? AND id=?').run(user.id, scoreMatch[1]));
                    if (!result.changes)
                        fail(404, '找不到計分紀錄');
                    (await audit(user.id, 'score.revoked', scoreMatch[1]));
                }));
                json(res, 200, { ok: true });
                return;
            }
            if (path === '/api/admin/kpi-rules' && req.method === 'PUT') {
                if (user.role !== 'admin')
                    fail(403, '需要管理員權限');
                const input = await body(req);
                if (typeof input.code !== 'string' || !Number.isInteger(input.points) || (input.points as number) < 0 || (input.points as number) > 10000)
                    fail(400, '分數須為 0–10000 的整數');
                (await transaction(async () => {
                    const result = (await db.prepare('UPDATE kpi_rules SET points=? WHERE code=?').run(input.points as number, input.code as string));
                    if (!result.changes)
                        fail(404, '計分項目不存在');
                    (await audit(user.id, 'kpi.updated', input.code as string));
                }));
                json(res, 200, { ok: true });
                return;
            }
            if (path === '/api/kpi-rules' && req.method === 'GET') {
                json(res, 200, (await db.prepare('SELECT * FROM kpi_rules ORDER BY points,code').all()));
                return;
            }
            if (path.startsWith('/api/admin/')) {
                if (user.role !== 'admin')
                    fail(403, '需要管理員權限');
                if (path === '/api/admin/leaderboard' && req.method === 'GET') {
                    const params = new URL(req.url!, 'http://localhost').searchParams;
                    const selection = queryRange(params, ((await db.prepare('SELECT period FROM report_settings WHERE id=1').get()) as {
                        period: 'week' | 'month';
                    }).period, creationDate(new Date().toISOString())!);
                    if (!selection)
                        fail(400, '請輸入有效的日期區間與週期');
                    const { period, range } = selection;
                    const rows = (await db.prepare(`SELECT u.id,u.name,u.email,u.role,u.active,
            COALESCE(SUM(CASE WHEN s.date BETWEEN ? AND ? THEN s.points ELSE 0 END),0) AS "periodPoints",
            COALESCE(SUM(s.points),0) AS "totalPoints"
            FROM users u LEFT JOIN score_entries s ON s.owner_id=u.id AND s.revoked=0
            WHERE u.role='user' GROUP BY u.id ORDER BY "periodPoints" DESC,u.name,u.id`).all(range.start, range.end));
                    const rules = (await db.prepare('SELECT code,label FROM kpi_rules ORDER BY code').all()) as {
                        code: string;
                        label: string;
                    }[];
                    const items = (await db.prepare(`SELECT s.owner_id,s.code,MAX(s.label) AS label,
            SUM(CASE WHEN s.date BETWEEN ? AND ? THEN s.points ELSE 0 END) AS "periodPoints",
            SUM(s.points) AS "totalPoints" FROM score_entries s JOIN users u ON u.id=s.owner_id
            WHERE s.revoked=0 AND u.role='user' GROUP BY s.owner_id,s.code`).all(range.start, range.end)) as {
                        owner_id: string;
                        code: string;
                        label: string;
                        periodPoints: number;
                        totalPoints: number;
                    }[];
                    for (const item of items)
                        if (!rules.some(rule => rule.code === item.code))
                            rules.push({ code: item.code, label: item.label });
                    json(res, 200, { period, range, generatedAt: new Date().toISOString(), rules, rows: rows.map(row => ({ ...row, items: items.filter(item => item.owner_id === row.id).map(({ code, periodPoints, totalPoints }) => ({ code, periodPoints, totalPoints })) })) });
                    return;
                }
                if (path === '/api/admin/users' && req.method === 'POST') {
                    const input = await body(req);
                    if (typeof input.name !== 'string' || !input.name.trim() || [...input.name.trim()].length > 80 || typeof input.email !== 'string' || typeof input.password !== 'string' || !['user', 'admin'].includes(input.role as string))
                        fail(400, '請填寫姓名、Email、密碼及有效權限');
                    json(res, 201, await createUser(input.email, input.password, input.role as 'user' | 'admin', input.name, user.id));
                    return;
                }
                const accountUpdate = path.match(/^\/api\/admin\/users\/([^/]+)$/);
                if (accountUpdate && req.method === 'PUT') {
                    const input = await body(req);
                    if (typeof input.name !== 'string' || !input.name.trim() || [...input.name.trim()].length > 80 || !['user', 'admin'].includes(input.role as string) || typeof input.active !== 'boolean')
                        fail(400, '姓名需 1–80 字元，並設定有效權限與啟用狀態');
                    const target = accountUpdate[1];
                    (await transaction(async () => {
                        const old = (await db.prepare('SELECT * FROM users WHERE id=?').get(target)) as User | undefined;
                        if (!old)
                            fail(404, '帳號不存在');
                        if (target === user.id && (input.role !== old.role || !input.active))
                            fail(400, '不可停用自己或變更自己的管理權限');
                        (await db.prepare('UPDATE users SET name=?,role=?,active=? WHERE id=?').run((input.name as string).trim(), input.role as string, input.active ? 1 : 0, target));
                        if (!input.active || input.role !== old.role)
                            (await db.prepare('DELETE FROM sessions WHERE user_id=?').run(target));
                        if (!input.active)
                            (await db.prepare('DELETE FROM account_tokens WHERE user_id=?').run(target));
                        (await audit(user.id, 'admin.account.updated', target));
                    }));
                    const updated = (await db.prepare('SELECT * FROM users WHERE id=?').get(target)) as User;
                    json(res, 200, { ...publicUser(updated), active: updated.active });
                    return;
                }
                const accountScores = path.match(/^\/api\/admin\/users\/([^/]+)\/scores$/);
                if (accountScores && req.method === 'GET') {
                    if (!(await db.prepare('SELECT id FROM users WHERE id=?').get(accountScores[1])))
                        fail(404, '帳號不存在');
                    (await audit(user.id, 'admin.scores.read', accountScores[1]));
                    json(res, 200, (await db.prepare('SELECT * FROM score_entries WHERE owner_id=? ORDER BY date DESC,id').all(accountScores[1])));
                    return;
                }
                if (path === '/api/admin/users' && req.method === 'GET') {
                    json(res, 200, (await db.prepare('SELECT id,email,name,role,active,created_at FROM users ORDER BY created_at DESC').all()));
                    return;
                }
                if (path === '/api/admin/audit' && req.method === 'GET') {
                    json(res, 200, (await db.prepare('SELECT id,actor_id,action,target_id,created_at FROM audit_log ORDER BY created_at DESC LIMIT 100').all()));
                    return;
                }
            }
            fail(404, '找不到此功能');
        }
        catch (error) {
            if (error instanceof ApiError)
                json(res, error.status, { error: error.message });
            else {
                console.error('API request failed:', error instanceof Error ? error.name : 'unknown');
                json(res, 500, { error: '伺服器處理失敗，請稍後重試' });
            }
        }
    });
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    return { server, db: (rawDb ?? db) as T extends AsyncDatabase ? T : DatabaseSync, createUser, close: () => new Promise<void>((resolve, reject) => { server.close(async (error) => { try {
            await db.close();
            if (error)
                reject(error);
            else
                resolve();
        }
        catch (e) {
            reject(e);
        } }); server.closeIdleConnections(); }) };
}
