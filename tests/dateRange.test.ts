import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectedRange,inRange,queryRange} from '../src/domain/dateRange';
test('date ranges include both boundaries and support same day, leap day, week and month',()=>{
 const range=selectedRange('custom','2026-10-10','2024-02-29','2024-03-01');
 assert.ok(inRange('2024-02-29',range));assert.ok(inRange('2024-03-01',range));assert.ok(!inRange('2024-03-02',range));
 assert.equal(selectedRange('custom','2026-10-10','2026-02-29','2026-03-01'),null);
 assert.equal(selectedRange('custom','2026-10-10','2026-03-02','2026-03-01'),null);
 assert.deepEqual(selectedRange('week','2026-10-10','',''),{start:'2026-10-05',end:'2026-10-11'});
 assert.deepEqual(selectedRange('month','2024-02-01','',''),{start:'2024-02-01',end:'2024-02-29'});
 assert.ok(inRange('2026-10-10',selectedRange('custom','2026-10-10','2026-10-10','2026-10-10')));
 assert.equal(queryRange(new URLSearchParams('period=year'),'week','2026-10-10'),null);
 const all=selectedRange('all','2026-10-10','','');
 assert.ok(inRange('2000-01-01',all));assert.ok(inRange('2099-12-31',all));
});
