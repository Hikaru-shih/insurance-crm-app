import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApi } from '../server/app';

test('admin account lifecycle validates roles, revokes sessions and preserves workspaces', async () => {
  const app = createApi({database: ':memory:'});
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${(app.server.address() as {port:number}).port}`;
  const password = 'Testing-password-2026!';
  const request = async (path:string, token?:string, method='GET', body?:unknown) => {
    const response = await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token ? {Authorization:`Bearer ${token}`} : {})},...(body ? {body:JSON.stringify(body)} : {})});
    return {status:response.status,data:await response.json()};
  };
  try {
    const admin = await app.createUser('admin@example.test',password,'admin');
    const owner = await app.createUser('user@example.test',password);
    const login=async(email:string)=>(await request('/api/auth/login',undefined,'POST',{email,password})).data.token;
    const at=await login(admin.email), ut=await login(owner.email);
    const input={name:'測試帳號',email:'new@example.test',password:'Eight123',role:'user'};
    assert.equal((await request('/api/admin/users',at,'POST',{...input,password:'Seven12'})).status,400);
    assert.equal((await request('/api/admin/users',ut,'POST',input)).status,403);
    assert.equal((await request('/api/admin/users',at,'POST',{...input,role:'root'})).status,400);
    const created=await request('/api/admin/users',at,'POST',input);
    assert.equal(created.status,201); assert.equal(created.data.password_hash,undefined);
    assert.equal((await request('/api/admin/users',at,'POST',input)).status,409);
    const target='/api/admin/users/'+owner.id;
    assert.equal((await request(target,ut,'PUT',{name:'偷改',role:'admin',active:true})).status,403);
    assert.equal((await request(target,at,'PUT',{name:'',role:'user',active:true})).status,400);
    assert.equal((await request('/api/admin/users/'+admin.id,at,'PUT',{name:'老闆',role:'user',active:true})).status,400);
    assert.equal((await request('/api/admin/users/'+admin.id,at,'PUT',{name:'老闆',role:'admin',active:false})).status,400);
    assert.equal((await request(target,at,'PUT',{name:'補填姓名',role:'user',active:false})).status,200);
    assert.equal((await request('/api/auth/me',ut)).status,401);
    assert.equal((await request('/api/auth/login',undefined,'POST',{email:owner.email,password})).status,401);
    assert.equal((await request('/api/workspaces/'+owner.id,at)).status,200);
    await request(target,at,'PUT',{name:'補填姓名',role:'admin',active:true});
    const promoted=await login(owner.email);
    assert.equal((await request('/api/admin/users',promoted)).status,200);
    await request(target,at,'PUT',{name:'補填姓名',role:'user',active:true});
    assert.equal((await request('/api/admin/users',promoted)).status,401);
    const normal=await login(owner.email);
    assert.equal((await request('/api/admin/users',normal)).status,403);
    const audit=(await request('/api/admin/audit',at)).data;
    assert.ok(audit.some((r:any)=>r.actor_id===admin.id && r.action==='admin.account.created' && r.target_id===created.data.id));
    assert.ok(audit.some((r:any)=>r.action==='admin.account.updated' && r.target_id===owner.id));
  } finally {await app.close();}
});
