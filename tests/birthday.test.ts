import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyContact, validateContact, birthdayMonthDay } from '../src/domain/contacts';
import { emptyWorkspace, parseWorkspace } from '../src/domain/workspace';

test('birthdays accept month/day, including leap day, and reject impossible dates', () => {
  for (const birthday of ['', '02-29', '12-31', '05-20']) assert.equal(validateContact({...emptyContact(), name:'客戶', birthday}), null);
  for (const birthday of ['02-30', '04-31', '13-01', '00-10', '2001-02-29']) assert.ok(validateContact({...emptyContact(), name:'客戶', birthday}));
});
test('legacy birthdays normalize to month/day without changing other dates', () => {
  const contact = {...emptyContact(), id:'c', name:'客戶', birthday:'1995-05-20', createdAt:'2026-10-31', updatedAt:'2026-10-31', nextContactDate:'2026-11-30'};
  const result = parseWorkspace({...emptyWorkspace(), contacts:[contact]}).contacts[0];
  assert.equal(result.birthday, '05-20');
  assert.equal(result.nextContactDate, contact.nextContactDate);
  assert.equal(contact.birthday, '1995-05-20');
  assert.equal(birthdayMonthDay('2000-02-29'), '02-29');
});
