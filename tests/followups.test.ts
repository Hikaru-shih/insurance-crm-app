import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creationDate, contactFollowups, pendingFollowups } from '../src/domain/followups';
import { DEFAULT_GRADES, emptyContact } from '../src/domain/contacts';

test('creation-based schedules use Taiwan dates, grade intervals and stable IDs', () => {
  const contact = { ...emptyContact(), id: '1', name: '測試', grade: 'A', createdAt: '2026-01-30T16:30:00Z', updatedAt: '2026-02-05T00:00:00Z' };
  assert.equal(creationDate(contact.createdAt), '2026-01-31');
  assert.equal(contactFollowups([contact], DEFAULT_GRADES)[0].date, '2026-02-07');
  assert.equal(contactFollowups([{ ...contact, grade: 'B' }], DEFAULT_GRADES)[0].date, '2026-02-28');
  assert.equal(contactFollowups([{ ...contact, grade: 'C' }], DEFAULT_GRADES)[0].date, '2026-04-30');
  assert.equal(contactFollowups([{ ...contact, updatedAt: '2027-01-01T00:00:00Z' }], DEFAULT_GRADES)[0].id, 'first-contact:1');
  assert.deepEqual(contactFollowups([{ ...contact, grade: '' }], DEFAULT_GRADES), []);
  assert.deepEqual(contactFollowups([{ ...contact, createdAt: 'invalid' }], DEFAULT_GRADES), []);
  assert.equal(contactFollowups([{ ...contact, grade: 'VIP' }], [{ code: 'VIP', amount: 2, unit: 'day', fixed: false }])[0].date, '2026-02-02');
});

test('pending calendar excludes future and completed followups', () => {
  const contact = { ...emptyContact(), id: 'pending', name: '測試', grade: 'A', createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z' };
  assert.equal(pendingFollowups([contact], DEFAULT_GRADES, '2026-09-26').length, 0);
  assert.equal(pendingFollowups([contact], DEFAULT_GRADES, '2026-09-27').length, 1);
  assert.equal(pendingFollowups([contact], DEFAULT_GRADES, '2026-09-30').length, 1);
  assert.equal(pendingFollowups([{ ...contact, followupCompleted: true }], DEFAULT_GRADES, '2026-09-30').length, 0);
});