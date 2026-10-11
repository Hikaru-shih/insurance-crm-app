import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyEvent, saveEvent, pendingScheduleEvents } from '../src/domain/events';
import { emptyWorkspace, parseWorkspace } from '../src/domain/workspace';

test('events persist independently, keep original dates and reschedule history', () => {
  const first = { ...emptyEvent('a', '2026-10-03'), title: '拜訪', time: '09:30' };
  let events = saveEvent([], first);
  events = saveEvent(events, { ...first, date: null });
  events = saveEvent(events, { ...events[0], date: '2026-10-10' });
  assert.equal(events[0].originalDate, '2026-10-03');
  assert.deepEqual(events[0].history.map(h => [h.from, h.to]), [['2026-10-03', null], [null, '2026-10-10']]);
  assert.deepEqual(parseWorkspace(JSON.parse(JSON.stringify({ ...emptyWorkspace(), events }))).events, events);
  const { events: _, ...legacy } = emptyWorkspace();
  assert.deepEqual(parseWorkspace(legacy).events, []);
});
test('pending includes undated and due events but excludes completed and future events', () => {
  const events = [null, '2026-10-02', '2026-10-03', '2026-10-04'].map((date, i) => ({ ...emptyEvent(String(i), date), title: '行程' }));
  assert.equal(pendingScheduleEvents(events, '2026-10-03').length, 3);
  events[0].completed = true;
  assert.equal(pendingScheduleEvents(events, '2026-10-03').length, 2);
  events[0].completed = false;
  assert.equal(pendingScheduleEvents(events, '2026-10-03').length, 3);
});
test('workspace rejects malformed events and duplicate identifiers', () => {
  const event = { ...emptyEvent('a', null), title: '合法' };
  for (const patch of [{ title: '' }, { date: '2026-02-30' }, { time: '24:00' }, { color: 'bad' }, { completed: 'true' }, { history: [null] }]) {
    assert.throws(() => parseWorkspace({ ...emptyWorkspace(), events: [{ ...event, ...patch }] }));
  }
  assert.throws(() => parseWorkspace({ ...emptyWorkspace(), events: [event, event] }));
});
