import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyContact } from '../src/domain/contacts';
import { emptyWorkspace, parseWorkspace } from '../src/domain/workspace';

test('contact records survive workspace roundtrip and reject invalid input', () => {
  const contact = { ...emptyContact(), id: 'c1', name: '客戶', createdAt: '2026-09-24T00:00:00Z', updatedAt: '2026-09-24T00:00:00Z' };
  const record = { id: 'r1', date: '2026-09-24', content: '電話聯繫，預計下週討論。' };
  const workspace = { ...emptyWorkspace(), contacts: [{ ...contact, records: [record] }] };
  assert.deepEqual(parseWorkspace(JSON.parse(JSON.stringify(workspace))).contacts[0].records, [record]);
  assert.doesNotThrow(() => parseWorkspace({ ...emptyWorkspace(), contacts: [contact] }));
  for (const records of [[{ ...record, content: ' ' }], [{ ...record, date: '2026-02-30' }], [record, record], 'bad', [null]]) {
    assert.throws(() => parseWorkspace({ ...workspace, contacts: [{ ...contact, records }] }));
  }
});
