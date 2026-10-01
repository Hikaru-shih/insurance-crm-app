import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportRange } from '../src/domain/reporting';
test('report periods handle Sunday, cross-year weeks and leap months', () => {
  assert.deepEqual(reportRange('2026-09-27','week'),{start:'2026-09-21',end:'2026-09-27'});
  assert.deepEqual(reportRange('2026-09-28','week'),{start:'2026-09-28',end:'2026-10-04'});
  assert.deepEqual(reportRange('2026-01-01','week'),{start:'2025-12-29',end:'2026-01-04'});
  assert.deepEqual(reportRange('2028-02-20','month'),{start:'2028-02-01',end:'2028-02-29'});
  assert.equal(reportRange('2026-02-30','month'),null);
});
