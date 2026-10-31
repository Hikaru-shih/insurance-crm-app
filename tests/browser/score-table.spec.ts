import { test, expect } from '@playwright/test';
import { emptyWorkspace } from '../../src/domain/workspace';
import { reportRange } from '../../src/domain/reporting';

test('score matrix counts actions, excludes revocations and sums historical points on desktop and mobile', async ({ page }) => {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  const range = reportRange(today, 'week')!;
  const rules = [{code:'new_contact',label:'新增名單',points:1},{code:'contact',label:'聯繫',points:1},{code:'touch',label:'接觸',points:5}];
  const entries = [
    {...rules[0],id:'new',date:range.start,note:'新增測試',revoked:0},
    {...rules[2],id:'touch',date:range.start,note:'歷史分數',points:3,revoked:0},
    {...rules[2],id:'revoked',date:range.start,note:'已撤銷測試',revoked:1},
  ];
  await page.addInitScript(() => sessionStorage.setItem('qianmai.session.v1',JSON.stringify({token:'a'.repeat(64),user:{id:'score-test',email:'score@example.test',role:'user'}})));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === '/api/kpi-rules' ? rules : path === '/api/scores' ? entries : path === '/api/scores/rank' ? {period:'week',range,total:1,periodRank:1,totalRank:1} : path === '/api/workspaces/score-test' ? emptyWorkspace() : [];
    await route.fulfill({json:data,headers:{'access-control-allow-origin':'*'}});
  });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button',{name:/計分卡/}).first().click();
  await expect(page.getByText('每日項目計分表',{exact:true})).toBeVisible();
  await expect(page.getByLabel(`${range.start} 新增名單 1 次`,{exact:true})).toBeVisible();
  await expect(page.getByLabel(`${range.start} 接觸 1 次`,{exact:true})).toBeVisible();
  await expect(page.getByLabel(`${range.start} 總計 4 分`,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:`查看 ${range.start} 計分明細`,exact:true}).click();
  await expect(page.getByLabel('計分日期（YYYY-MM-DD）',{exact:true})).toHaveValue(range.start);
  await page.screenshot({path:'test-results/score-table-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/score-table-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'本月',exact:true}).click();
  await page.getByRole('button',{name:'下一段日期',exact:true}).click();
  const month = reportRange(today, 'month')!;
  const pages = Math.ceil(Number(month.end.slice(-2)) / 7);
  await expect(page.getByText(`2 / ${pages}`,{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
