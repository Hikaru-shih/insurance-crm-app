import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApi } from '../server/app';
test('public pages and password-confirmed account deletion isolate other accounts and revoke sessions', async () => {
  const app=createApi({database:':memory:'});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const base=`http://127.0.0.1:${(app.server.address() as {port:number}).port}`;
  const request=(path:string,method='GET',token?:string,body?:unknown)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  try {
    for(const path of ['/privacy','/support']) { const r=await request(path);assert.equal(r.status,200);assert.match(await r.text(),/施品光/); }
    const password='testing-password';
    const a=await app.createUser('delete@example.test',password);
    const b=await app.createUser('keep@example.test',password);
    const login=await (await request('/api/auth/login','POST',undefined,{email:a.email,password})).json();
    app.db.prepare('INSERT INTO grants VALUES(?,?,?)').run(a.id,b.id,new Date().toISOString());
    app.db.prepare('INSERT INTO grants VALUES(?,?,?)').run(b.id,a.id,new Date().toISOString());
    assert.equal((await request('/api/auth/account','DELETE',undefined,{password,confirmation:'永久刪除'})).status,401);
    assert.equal((await request('/api/auth/account','DELETE',login.token,{password:'wrong',confirmation:'永久刪除'})).status,400);
    assert.equal((await request('/api/auth/account','DELETE',login.token,{password,confirmation:'no'})).status,400);
    assert.ok(app.db.prepare('SELECT id FROM users WHERE id=?').get(a.id));
    assert.equal((await request('/api/auth/account','DELETE',login.token,{password,confirmation:'永久刪除'})).status,200);
    assert.equal((await request('/api/auth/me','GET',login.token)).status,401);
    for(const [table,column] of [['users','id'],['sessions','user_id'],['account_tokens','user_id'],['workspaces','owner_id'],['score_entries','owner_id'],['audit_log','actor_id']])assert.equal(app.db.prepare(`SELECT * FROM ${table} WHERE ${column}=?`).all(a.id).length,0);
    assert.equal(app.db.prepare('SELECT * FROM grants').all().length,0);
    assert.ok(app.db.prepare('SELECT id FROM users WHERE id=?').get(b.id));
    assert.ok(app.db.prepare('SELECT owner_id FROM workspaces WHERE owner_id=?').get(b.id));
  }finally{app.server.closeAllConnections();await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();}
});
