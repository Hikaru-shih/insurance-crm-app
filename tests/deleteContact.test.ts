import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removeContact } from '../src/domain/deleteContact';
import { emptyWorkspace, parseWorkspace } from '../src/domain/workspace';
import { emptyContact } from '../src/domain/contacts';
import { emptyEvent } from '../src/domain/events';
test('contact deletion removes linked schedules, preserves unrelated data and survives roundtrip',()=>{
  const contact={...emptyContact(),id:'a',name:'A',createdAt:'2026-10-26',updatedAt:'2026-10-26'};
  const state={...emptyWorkspace(),contacts:[contact,{...contact,id:'b',name:'B'}],events:[{...emptyEvent('linked','2026-10-27'),title:'linked',contactId:'a'},{...emptyEvent('other','2026-10-27'),title:'other',contactId:'b'}]};
  const after=parseWorkspace(removeContact(state,'a'));
  assert.deepEqual(after.contacts.map(c=>c.id),['b']);
  assert.deepEqual(after.events.map(e=>e.id),['other']);
  assert.equal(state.contacts.length,2);
  assert.deepEqual(removeContact(after,'a'),after);
});
