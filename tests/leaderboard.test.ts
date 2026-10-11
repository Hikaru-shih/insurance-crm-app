import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApi } from '../server/app';
import { creationDate } from '../src/domain/followups';
import { reportRange } from '../src/domain/reporting';

test('leaderboard is admin-only, includes zero scores, sums valid historical points and follows reporting period',async()=>{
  const app=createApi({database:':memory:'});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const base=`http://127.0.0.1:${(app.server.address() as {port:number}).port}`;
  const password='Leaderboard-test-password';
  const call=async(path:string,token='',method='GET',body?:unknown)=>{
    const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};
  };
  try {
    const admin=await app.createUser('boss@test.com',password,'admin','老闆');
    const a=await app.createUser('a@test.com',password,'user','陳小明');
    const b=await app.createUser('b@test.com',password,'user','林小明');
    const zero=await app.createUser('zero@test.com',password,'user','零分員工');
    const at=(await call('/api/auth/login','','POST',{email:admin.email,password})).data.token;
    const ut=(await call('/api/auth/login','','POST',{email:a.email,password})).data.token;
    const today=creationDate(new Date().toISOString())!;
    const insert=app.db.prepare('INSERT INTO score_entries(owner_id,id,date,code,label,points,note,revoked) VALUES(?,?,?,?,?,?,?,?)');
    insert.run(a.id,'a1',today,'contact','聯繫',10,'',0);
    insert.run(a.id,'a2',today,'contact','聯繫',99,'',1);
    insert.run(a.id,'old','2000-01-01','contact','聯繫',7,'',0);
    insert.run(b.id,'b1',today,'contact','聯繫',10,'',0);
    insert.run(admin.id,'boss',today,'contact','聯繫',999,'',0);
    app.db.prepare('UPDATE users SET active=0 WHERE id=?').run(b.id);
    assert.equal((await call('/api/admin/leaderboard')).status,401);
    assert.equal((await call('/api/admin/leaderboard',ut)).status,403);
    const personal=await call('/api/scores/rank?date='+today,ut);
    assert.equal(personal.status,200);assert.equal(personal.data.total,3);
    assert.equal(personal.data.periodRank,1);assert.equal(personal.data.totalRank,1);
    assert.deepEqual(Object.keys(personal.data).sort(),['period','periodRank','range','total','totalRank']);
    assert.equal((await call('/api/scores/rank?ownerId='+b.id,ut)).data.totalRank,1);
    assert.equal((await call('/api/scores/rank',at)).data.periodRank,null);
    assert.equal((await call('/api/scores/rank?date=invalid',ut)).status,400);
    assert.equal((await call('/api/scores/rank')).status,401);
    for(const period of ['week','month'] as const){
      app.db.prepare('UPDATE report_settings SET period=? WHERE id=1').run(period);
      const result=await call('/api/admin/leaderboard',at);
      assert.equal(result.status,200);assert.equal(result.data.period,period);
      assert.deepEqual(result.data.range,reportRange(today,period));
      const rows=result.data.rows;
      assert.equal(rows.length,3);assert.equal(rows[0].periodPoints,10);
      assert.equal(rows.find((r:any)=>r.id===a.id).totalPoints,17);
      assert.equal(rows.find((r:any)=>r.id===b.id).active,0);
      assert.equal(rows.find((r:any)=>r.id===zero.id).totalPoints,0);
      assert.equal(rows[0].password_hash,undefined);
      const row=rows.find((r:any)=>r.id===a.id);
      assert.equal(row.items.find((i:any)=>i.code==='contact').periodPoints,10);
      assert.equal(row.items.reduce((sum:number,i:any)=>sum+i.totalPoints,0),row.totalPoints);
    }
    const historic=(await call('/api/admin/leaderboard?period=month&date=2000-01-15',at)).data;
    const custom=(await call('/api/admin/leaderboard?period=custom&start=2000-01-01&end=2000-01-01',at)).data;
    assert.equal(custom.period,'custom');
    assert.equal(custom.rows.find((r:any)=>r.id===a.id).periodPoints,7);
    assert.equal(custom.rows.find((r:any)=>r.id===a.id).items[0].periodPoints,7);
    const all=(await call('/api/admin/leaderboard?period=all',at)).data;
    assert.equal(all.rows.find((r:any)=>r.id===a.id).periodPoints,17);
    assert.equal(all.rows.find((r:any)=>r.id===a.id).items[0].periodPoints,17);
    const ownCustom=(await call('/api/scores/rank?period=custom&start=2000-01-01&end=2000-01-01',ut)).data;
    assert.equal(ownCustom.periodRank,1);assert.deepEqual(ownCustom.range,{start:'2000-01-01',end:'2000-01-01'});
    for(const path of ['/api/admin/leaderboard','/api/scores/rank']){
      assert.equal((await call(path+'?period=custom&start=2026-02-30&end=2026-03-01',at)).status,400);
      assert.equal((await call(path+'?period=custom&start=2026-10-10&end=2026-10-09',at)).status,400);
      assert.equal((await call(path+'?period=custom',at)).status,400);
    }
    assert.deepEqual(historic.range,{start:'2000-01-01',end:'2000-01-31'});
    assert.equal(historic.rows.find((r:any)=>r.id===a.id).periodPoints,7);
    assert.equal((await call('/api/admin/leaderboard?date=2026-02-30',at)).status,400);
    assert.equal((await call('/api/admin/leaderboard?period=year',at)).status,400);
  } finally {await app.close();}
});
