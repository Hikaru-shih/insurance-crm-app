import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, parseWorkspace } from '../src/domain/workspace';
import { DEFAULT_GRADES, addInterval, createGrade, emptyContact, validateContact } from '../src/domain/contacts';

test('only name is required; whitespace name and incomplete dates are rejected', () => {
  assert.ok(validateContact(emptyContact()));
  assert.equal(validateContact({ ...emptyContact(), name: '測試客戶' }), null);
  assert.ok(validateContact({ ...emptyContact(), name: '   ' }));
  assert.ok(validateContact({ ...emptyContact(), name: '甲', importantDates: [{ id: '1', label: '生日', date: '2026-02-30' }] }));
  assert.equal(validateContact({ ...emptyContact(), name: '甲', importantDates: [{ id: '1', label: '生日', date: '2028-02-29' }] }), null);
});
test('default day intervals and configurable calendar month boundaries', () => {
  assert.deepEqual(DEFAULT_GRADES.map(g => g.amount), [30,60,90,120]);
  assert.ok(DEFAULT_GRADES.every(g => g.unit === 'day' && !g.fixed));
  assert.equal(addInterval('2026-09-10', DEFAULT_GRADES[0]), '2026-10-10');
  assert.equal(addInterval('2026-01-31', createGrade('A',1,'month',[])), '2026-02-28');
  const legacy = [{code:'A',amount:1,unit:'week',fixed:true},{code:'B',amount:1,unit:'month',fixed:true},{code:'C',amount:3,unit:'month',fixed:true}];
  assert.deepEqual(parseWorkspace({...emptyWorkspace(),grades:legacy}).grades, DEFAULT_GRADES);
  const adjusted = DEFAULT_GRADES.map(g => g.code === 'A' ? {...g,amount:45} : g);
  assert.deepEqual(parseWorkspace({...emptyWorkspace(),grades:adjusted}).grades,adjusted);
});
test('custom grade creation cannot override defaults or existing letters', () => {
  assert.throws(() => createGrade('A', 9, 'day', DEFAULT_GRADES));
  const custom = createGrade('e', 2, 'week', DEFAULT_GRADES);
  assert.equal(custom.code, 'E');
  const vip = createGrade(' vip客戶 ', 2, 'week', DEFAULT_GRADES);
  assert.equal(vip.code, 'VIP客戶');
  assert.equal(parseWorkspace({ ...emptyWorkspace(), grades: [...DEFAULT_GRADES, vip] }).grades.at(-1)?.code, 'VIP客戶');
  assert.throws(() => createGrade('vip客戶', 1, 'day', [...DEFAULT_GRADES, vip]));
  assert.equal(createGrade('AA1', 1, 'month', DEFAULT_GRADES).code, 'AA1');
  assert.throws(() => createGrade('   ', 1, 'day', DEFAULT_GRADES));
  assert.throws(() => createGrade('X'.repeat(21), 1, 'day', DEFAULT_GRADES));
  assert.throws(() => createGrade('E', 3, 'day', [...DEFAULT_GRADES, custom]));
  assert.throws(() => createGrade('E', 0, 'day', DEFAULT_GRADES));
  assert.throws(() => createGrade('E', 1.5, 'month', DEFAULT_GRADES));
});
