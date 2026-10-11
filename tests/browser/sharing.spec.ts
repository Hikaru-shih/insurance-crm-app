import { test, expect } from '@playwright/test';
import { emptyWorkspace } from '../../src/domain/workspace';
import { emptyContact } from '../../src/domain/contacts';
import { emptyEvent } from '../../src/domain/events';
test('two accounts share readonly data and revoke access', async ({browser,request,baseURL})=>{
  test.setTimeout(60000);
  const api=process.env.TEST_API_URL??'http://127.0.0.1:3002';
  const password='Sharing-browser-password!';
  const suffix=Date.now();
  const ownerEmail=`owner-${suffix}@example.test`, viewerEmail=`viewer-${suffix}@example.test`;
  for(const [email,name] of [[ownerEmail,'分享主人'],[viewerEmail,'分享對象']]) {
    const r=await request.post(api+'/api/auth/register',{data:{email,name,password}});expect(r.status()).toBe(201);
  }
  const login=await (await request.post(api+'/api/auth/login',{data:{email:ownerEmail,password}})).json();
  const workspace=emptyWorkspace();
  workspace.contacts=[{...emptyContact(),id:'shared-contact',name:'分享的客戶',notes:'分享備註',createdAt:'2026-10-04',updatedAt:'2026-10-04',records:[{id:'r',date:'2026-10-04',content:'分享聯絡紀錄'}]}];
  workspace.events=[{...emptyEvent('shared-event',null),title:'分享的行程',notes:'分享行程內容'}];
  expect((await request.put(api+'/api/workspaces/'+login.user.id,{headers:{Authorization:`Bearer ${login.token}`},data:workspace})).status()).toBe(200);
  const owner=await browser.newPage(),viewer=await browser.newPage();
  try {
    for(const [page,email] of [[owner,ownerEmail],[viewer,viewerEmail]] as const){
      await page.goto(baseURL!);await page.getByLabel('帳號 Email',{exact:true}).fill(email);await page.getByLabel('密碼',{exact:true}).fill(password);await page.getByRole('button',{name:'登入',exact:true}).click();await page.getByRole('button',{name:'開啟功能選單',exact:true}).click(); await page.getByRole('button',{name:'授權分享',exact:true}).click();
    }
    await owner.getByLabel('授權對象 Email',{exact:true}).fill(viewerEmail);
    await owner.getByRole('button',{name:'新增唯讀授權',exact:true}).click();
    await owner.getByRole('button',{name:'確認授權',exact:true}).click();
    await expect(owner.getByText('已新增唯讀授權',{exact:true})).toBeVisible();
    await viewer.getByRole('button',{name:'更新分享名單',exact:true}).click();
    await viewer.getByRole('button',{name:/查看分享：分享主人/}).click();
    await viewer.getByRole('button',{name:'分享的客戶 · 未分級',exact:true}).click();
    await expect(viewer.getByText('2026-10-04 · 分享聯絡紀錄',{exact:true})).toBeVisible();
    await expect(viewer.getByText('分享的行程',{exact:true})).toBeVisible();
    await expect(viewer.getByText('每日計分卡',{exact:true})).toBeVisible();
    await expect(viewer.getByRole('button',{name:'編輯此聯絡人',exact:true})).toHaveCount(0);
    await expect(viewer.getByRole('button',{name:/編輯行程：/})).toHaveCount(0);
    await expect(viewer.getByText('帳號設定',{exact:true})).toHaveCount(0);
    await owner.getByRole('button',{name:`撤銷 ${viewerEmail} 的授權`,exact:true}).click();
    await owner.getByRole('button',{name:'確認撤銷',exact:true}).click();
    await expect(owner.getByText('已撤銷授權',{exact:true})).toBeVisible();
    await expect(viewer.getByText('這份分享已撤銷或帳號已停用，無法繼續查看。',{exact:true})).toBeVisible({timeout:20000});
    await expect(viewer.getByText('分享的行程',{exact:true})).toHaveCount(0);
  } finally {await owner.close();await viewer.close();}
});
