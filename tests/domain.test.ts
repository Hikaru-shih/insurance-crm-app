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
test('fixed grade frequencies and calendar month boundaries', () => {
  assert.deepEqual(DEFAULT_GRADES.map(g => addInterval('2026-09-10', g)), ['2026-09-17', '2026-10-10', '2026-12-10']);
  assert.equal(addInterval('2026-01-31', DEFAULT_GRADES[1]), '2026-02-28');
  assert.equal(addInterval('2028-01-31', DEFAULT_GRADES[1]), '2028-02-29');
  assert.equal(addInterval('2026-11-30', DEFAULT_GRADES[2]), '2027-02-28');
});
test('custom grade creation cannot override defaults or existing letters', () => {
  assert.throws(() => createGrade('A', 9, 'day', DEFAULT_GRADES));
  const custom = createGrade('d', 2, 'week', DEFAULT_GRADES);
  assert.equal(custom.code, 'D');
  const vip = createGrade(' vip客戶 ', 2, 'week', DEFAULT_GRADES);
  assert.equal(vip.code, 'VIP客戶');
  assert.equal(parseWorkspace({ ...emptyWorkspace(), grades: [...DEFAULT_GRADES, vip] }).grades.at(-1)?.code, 'VIP客戶');
  assert.throws(() => createGrade('vip客戶', 1, 'day', [...DEFAULT_GRADES, vip]));
  assert.equal(createGrade('AA1', 1, 'month', DEFAULT_GRADES).code, 'AA1');
  assert.throws(() => createGrade('   ', 1, 'day', DEFAULT_GRADES));
  assert.throws(() => createGrade('X'.repeat(21), 1, 'day', DEFAULT_GRADES));
  assert.throws(() => createGrade('D', 3, 'day', [...DEFAULT_GRADES, custom]));
  assert.throws(() => createGrade('E', 0, 'day', DEFAULT_GRADES));
  assert.throws(() => createGrade('E', 1.5, 'month', DEFAULT_GRADES));
});
