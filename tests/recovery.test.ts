import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApi} from '../server/app';
import {AccountMail,createMailer} from '../server/mail';
test('production requires real mail credentials but no website URL',()=>{
  assert.throws(()=>createMailer({NODE_ENV:'production',MAIL_MODE:'local',PUBLIC_APP_URL:'https://example.test'}));
  assert.throws(()=>createMailer({NODE_ENV:'production',MAIL_MODE:'resend'}));
  assert.doesNotThrow(()=>createMailer({NODE_ENV:'production',MAIL_MODE:'resend',MAIL_FROM:'app@example.test',RESEND_API_KEY:'test'}));
});
test('verification and password reset use expiring single-use tokens, revoke sessions and hide unknown emails',async()=>{
  const mails:AccountMail[]=[];
  const app=createApi({database:':memory:',requireVerifiedEmail:true,mailer:async mail=>{mails.push(mail);}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const base=`http://127.0.0.1:${(app.server.address() as {port:number}).port}`;
  const call=async(path:string,body:unknown,token?:string)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});return{status:r.status,data:await r.json()};};
  const password='Recovery-test-password!';
  try{
    const user=await app.createUser('recover@example.test',password);
    assert.equal((await call('/api/auth/login',{email:user.email,password})).status,403);
    const known=await call('/api/auth/request-verification',{email:user.email});
    const unknown=await call('/api/auth/request-verification',{email:'unknown@example.test'});assert.deepEqual(known,unknown);assert.equal(mails.length,1);
    await call('/api/auth/request-verification',{email:user.email});assert.equal(mails.length,1);
    const token=mails[0].token;assert.notEqual(app.db.prepare('SELECT token_hash FROM account_tokens').get()!.token_hash,token);
    assert.equal((await call('/api/auth/reset-password',{token,password})).status,400);
    assert.equal((await call('/api/auth/verify-email',{token})).status,200);
    assert.equal((await call('/api/auth/verify-email',{token})).status,400);
    const login=await call('/api/auth/login',{email:user.email,password});assert.equal(login.status,200);
    await call('/api/auth/forgot-password',{email:user.email});const reset=mails.at(-1)!.token;
    assert.equal((await call('/api/auth/reset-password',{token:reset,password:'Seven12'})).status,400);
    const newPassword='Eight123';
    assert.equal((await call('/api/auth/reset-password',{token:reset,password:newPassword})).status,200);
    assert.equal((await call('/api/auth/reset-password',{token:reset,password:newPassword})).status,400);
    assert.equal(app.db.prepare('SELECT count(*) n FROM sessions').get()!.n,0);
    assert.equal((await call('/api/auth/login',{email:user.email,password})).status,401);
    assert.equal((await call('/api/auth/login',{email:user.email,password:newPassword})).status,200);
    await call('/api/auth/forgot-password',{email:user.email});const expired=mails.at(-1)!.token;
    app.db.exec('UPDATE account_tokens SET expires_at=0');assert.equal((await call('/api/auth/reset-password',{token:expired,password})).status,400);
    app.db.exec('UPDATE account_tokens SET created_at=0');await call('/api/auth/forgot-password',{email:user.email});
    assert.notEqual(mails.at(-1)!.token,expired);
    assert.equal((await call('/api/auth/reset-password',{token:expired,password})).status,400);
  }finally{await app.close();}
});

async function codeFixture(run:(app:ReturnType<typeof createApi<undefined>>,call:(path:string,body:unknown)=>Promise<{status:number;data:any}>,mails:AccountMail[])=>Promise<void>){
  const mails:AccountMail[]=[];
  const app=createApi({database:':memory:',requireVerifiedEmail:true,recoveryCodesOnly:true,mailer:async mail=>{mails.push(mail);}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const base=`http://127.0.0.1:${(app.server.address() as {port:number}).port}`;
  const call=async(path:string,body:unknown)=>{const r=await fetch(base+'/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  try{await run(app,call,mails);}finally{await app.close();}
}

test('App codes bind email and purpose, throttle resend, expire and stop after five wrong guesses',async()=>{
  await codeFixture(async(app,call,mails)=>{
    const email='codes@example.test';await app.createUser(email,'Password123');
    await call('request-verification',{email});const code=mails[0].token;
    assert.match(code,/^\d{8}$/);assert.equal(mails[0].format,'code');
    const stored=app.db.prepare('SELECT * FROM account_tokens').get()!;
    assert.notEqual(stored.token_hash,code);assert.ok(Number(stored.expires_at)-Date.now()<=600000);
    await call('request-verification',{email});assert.equal(mails.length,1);
    assert.equal((await call('verify-email',{email:'other@example.test',code})).status,400);
    assert.equal((await call('reset-password',{email,code,password:'Newpass123'})).status,400);
    const wrong=code==='00000000'?'11111111':'00000000';
    for(let i=0;i<5;i++)assert.equal((await call('verify-email',{email,code:wrong})).status,400);
    assert.equal(app.db.prepare('SELECT attempts FROM account_tokens').get()!.attempts,5);
    assert.equal((await call('verify-email',{email,code})).status,400);
    app.db.exec('UPDATE account_tokens SET created_at=0');
    await call('request-verification',{email});const next=mails.at(-1)!.token;
    assert.equal(app.db.prepare('SELECT attempts FROM account_tokens').get()!.attempts,0);
    assert.equal((await call('verify-email',{email,code})).status,400);
    app.db.exec('UPDATE account_tokens SET expires_at=0');
    assert.equal((await call('verify-email',{email,code:next})).status,400);
  });
});

test('App code reset activates an unverified administrator, consumes once and revokes sessions',async()=>{
  await codeFixture(async(app,call,mails)=>{
    const email='activate@example.test';await app.createUser(email,'Unknown-initial-password','admin','Owner');
    assert.equal((await call('login',{email,password:'Unknown-initial-password'})).status,403);
    await call('forgot-password',{email});const code=mails.at(-1)!.token;
    const payload={email,code,password:'Owner-password123'};
    const results=await Promise.all([call('reset-password',payload),call('reset-password',payload)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
    const login=await call('login',{email,password:payload.password});assert.equal(login.status,200);assert.equal(login.data.user.role,'admin');
    await call('forgot-password',{email});const newCode=mails.at(-1)!.token;
    assert.equal((await call('reset-password',{email,code:newCode,password:'Latest-password123'})).status,200);
    assert.equal(app.db.prepare('SELECT count(*) n FROM sessions').get()!.n,0);
    assert.equal((await call('login',{email,password:payload.password})).status,401);
  });
});
