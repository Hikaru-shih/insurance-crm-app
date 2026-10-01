import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApi } from '../server/app';
test('scores use server rules, isolate owners, retry safely, revoke and preserve historical points', async () => {
  const app = createApi({ database: ':memory:', allowRegistration: true });
  app.server.listen(0,'127.0.0.1'); await once(app.server,'listening');
  const base = `http://127.0.0.1:${(app.server.address() as {port:number}).port}`;
  const ua = await app.createUser('score-a@test.com','test-password-123');
  const ub = await app.createUser('score-b@test.com','test-password-123');
  const uadmin = await app.createUser('score-admin@test.com','test-password-123','admin');
  const call = async (path: string, token: string, method = 'GET', body?: unknown) => {
    const response = await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)} : {})});
    return {status:response.status, data:await response.json()};
  };
  const a = (await call('/api/auth/login','','POST',{email:ua.email,password:'test-password-123'})).data;
  const b = (await call('/api/auth/login','','POST',{email:ub.email,password:'test-password-123'})).data;
  const admin = (await call('/api/auth/login','','POST',{email:uadmin.email,password:'test-password-123'})).data;
  try {
    assert.equal((await call('/api/admin/report-settings',a.token,'PUT',{period:'month'})).status,403);
    assert.equal((await call('/api/admin/report-settings',admin.token,'PUT',{period:'day'})).status,400);
    assert.equal((await call('/api/admin/report-settings',admin.token,'PUT',{period:'month'})).status,200);
    assert.equal((await call('/api/report-settings',b.token)).data.period,'month');
    const entry = {id:'test-one',date:'2026-09-26',code:'contact',note:'完成聯繫',points:999};
    assert.equal((await call('/api/scores',a.token,'POST',entry)).status,200);
    await call('/api/scores',a.token,'POST',entry);
    let rows = (await call('/api/scores',a.token)).data;
    assert.equal(rows.length,1); assert.equal(rows[0].points,1);
    assert.deepEqual((await call('/api/scores',b.token)).data,[]);
    assert.equal((await call('/api/scores/test-one',b.token,'DELETE')).status,404);
    assert.equal((await call('/api/admin/kpi-rules',a.token,'PUT',{code:'contact',points:9})).status,403);
    assert.equal((await call('/api/admin/kpi-rules',admin.token,'PUT',{code:'contact',points:9})).status,200);
    await call('/api/scores',a.token,'POST',{...entry,id:'test-two'});
    rows = (await call('/api/scores',a.token)).data;
    assert.deepEqual(rows.map((r: any)=>r.points).sort((x:number,y:number)=>x-y),[1,9]);
    assert.equal((await call('/api/scores',a.token,'POST',{...entry,date:'2026-02-30'})).status,400);
    await call('/api/scores/test-one',a.token,'DELETE');
    await call('/api/scores',a.token,'POST',entry);
    rows = (await call('/api/scores',a.token)).data;
    assert.equal(rows.filter((r:any)=>!r.revoked).reduce((sum:number,r:any)=>sum+r.points,0),9);
  } finally { await app.close(); }
});
