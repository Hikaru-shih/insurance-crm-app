import {test,expect} from '@playwright/test';
import {emptyWorkspace} from '../../src/domain/workspace';
import {emptyContact} from '../../src/domain/contacts';
test('custom dates filter owner and shared records and scores without granting edit access',async({page,request})=>{
 const pick=async(label:string,date:string)=>{
  const trigger=page.getByRole('button',{name:new RegExp('^'+label+'：')});
  const current=(await trigger.innerText()).match(/(\d{4})-\d{2}-\d{2}/)![1];
  await trigger.click();await page.getByRole('button',{name:current+' 年',exact:true}).click();
  const [year,month]=date.split('-').map(Number);let decade=Math.floor(Number(current)/10)*10;
  while(decade>Math.floor(year/10)*10){await page.getByRole('button',{name:'前十年',exact:true}).click();decade-=10;}
  while(decade<Math.floor(year/10)*10){await page.getByRole('button',{name:'後十年',exact:true}).click();decade+=10;}
  await page.getByRole('button',{name:'選擇 '+year+' 年',exact:true}).click();await page.getByRole('button',{name:'選擇 '+month+' 月',exact:true}).click();
  if(label==='計分時段開始日期'&&date==='2000-01-01')await page.screenshot({path:'test-results/date-calendar.png'});
  await page.getByRole('button',{name:'選擇日期 '+date,exact:true}).click();
 };
 const base=process.env.TEST_API_URL!,password='Date-range-password!',stamp=Date.now();
 const owner=`range-${stamp}@example.test`,viewer=`viewer-range-${stamp}@example.test`;
 for(const email of [owner,viewer])expect((await request.post(base+'/api/auth/register',{data:{email,password,name:email===owner?'區間主人':'區間查看者'}})).status()).toBe(201);
 const login=await(await request.post(base+'/api/auth/login',{data:{email:owner,password}})).json();const headers={Authorization:`Bearer ${login.token}`};
 const workspace=emptyWorkspace();workspace.contacts=[{...emptyContact(),id:'date-contact',name:'區間客戶',createdAt:'2000-01-01',updatedAt:'2000-01-03',records:[{id:'first',date:'2000-01-01',content:'區間首日紀錄',scoreCode:'contact'},{id:'last',date:'2000-01-02',content:'區間末日紀錄',scoreCode:'contact'},{id:'outside',date:'2000-01-03',content:'區間外紀錄',scoreCode:'contact'}]}];
 expect((await request.put(base+'/api/workspaces/'+login.user.id,{headers,data:workspace})).status()).toBe(200);
 expect((await request.post(base+'/api/grants',{headers,data:{email:viewer}})).status()).toBe(201);
 for(const email of [owner,viewer]){
  await page.goto('/');await page.evaluate(()=>sessionStorage.clear());await page.reload();await page.getByLabel('帳號 Email',{exact:true}).fill(email);await page.getByLabel('密碼',{exact:true}).fill(password);await page.getByRole('button',{name:'登入',exact:true}).click();
  await expect(page.getByText('錢脈',{exact:true})).toBeVisible();await expect(page.getByText('我的一天',{exact:true})).toHaveCount(0);await expect(page.getByText(/開發環境：/)).toHaveCount(0);
  if(email===owner){await page.getByRole('button',{name:'◎ 聯絡人',exact:true}).click();await page.getByRole('button',{name:'查看 區間客戶',exact:true}).click();}
  else{await page.getByRole('button',{name:'開啟功能選單',exact:true}).click();await page.getByRole('button',{name:'授權分享',exact:true}).click();await page.getByRole('button',{name:/查看分享：區間主人/}).click();await page.getByRole('button',{name:'區間客戶 · 未分級',exact:true}).click();}
  const picker=page.getByText('紀錄時段',{exact:true}).locator('..');await picker.getByRole('button',{name:'自訂區間',exact:true}).click();
  await pick('紀錄時段開始日期','2000-01-01');await pick('紀錄時段結束日期','2000-01-02');
  await expect(page.getByText(/區間首日紀錄/)).toBeVisible();await expect(page.getByText(/區間末日紀錄/)).toBeVisible();await expect(page.getByText(/區間外紀錄/)).toHaveCount(0);
  if(email===owner)await page.getByRole('button',{name:'▥ 計分卡',exact:true}).click();else await expect(page.getByRole('button',{name:'編輯此聯絡人',exact:true})).toHaveCount(0);
  await page.getByText('計分時段',{exact:true}).locator('..').getByRole('button',{name:'自訂區間',exact:true}).click();
  await pick('計分時段開始日期','2000-01-01');await pick('計分時段結束日期','2000-01-02');
  await expect(page.getByText('2 筆有效行動',{exact:true})).toBeVisible();
  await pick('計分時段開始日期','2000-01-02');await expect(page.getByText('1 筆有效行動',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'所有累積',exact:true})).toHaveCount(0);
 }
});
