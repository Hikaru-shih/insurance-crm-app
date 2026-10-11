import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankedRows,scoreReportHtml,ScoreBoard} from '../src/domain/leaderboard';
test('report escapes user text, preserves filtered ranks and uses matching period item totals',()=>{
  const board:ScoreBoard={period:'month',range:{start:'2026-10-01',end:'2026-10-31'},generatedAt:'2026-10-10T10:00:00Z',rules:[{code:'contact',label:'聯繫'}],rows:[
    {id:'1',name:'王小明<script>',email:'a&b@test.com',role:'user',periodPoints:2,totalPoints:9,items:[{code:'contact',periodPoints:2,totalPoints:9}]},
    {id:'2',name:'林小明',email:'b@test.com',role:'user',periodPoints:3,totalPoints:10,items:[{code:'contact',periodPoints:3,totalPoints:10}]}
  ]};
  assert.equal(rankedRows(board,'periodPoints','王')[0].rank,2);
  const html=scoreReportHtml(board,'periodPoints','王');
  assert.ok(html.includes('王小明&lt;script&gt;'));assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('a&amp;b@test.com'));assert.ok(html.includes('<strong>2</strong>'));
  assert.ok(!html.includes('<td>b@test.com</td>'));assert.ok(html.includes('2026-10-31'));
  assert.ok(scoreReportHtml(board,'totalPoints').includes('<strong>9</strong>'));
  const custom=scoreReportHtml({...board,period:'custom',range:{start:'2026-09-20',end:'2026-10-10'}},'periodPoints');
  assert.ok(custom.includes('自訂區間 2026-09-20 至 2026-10-10'));
  assert.ok(custom.includes('<strong>2</strong>'));assert.ok(!custom.includes('本表合計'));
  assert.ok(custom.includes('<h1>員工計分表</h1>'));assert.ok(!custom.includes('錢脈'));
  const all=scoreReportHtml({...board,period:'all'},'periodPoints');
  assert.ok(all.includes('所有累積'));assert.ok(!all.includes('2026-10-31'));
});
