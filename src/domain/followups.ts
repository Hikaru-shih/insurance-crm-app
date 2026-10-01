import { nextContactDate } from './tracking';
import { Contact, Grade, addInterval } from './contacts';

// A single business timezone keeps PC and phone schedules consistent.
export function creationDate(timestamp: string): string | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function contactFollowups(contacts: readonly Contact[], grades: readonly Grade[]) {
  return contacts.flatMap(contact => {
    if (contact.archived) return [];
    const date = nextContactDate(contact, grades);
    const grade = grades.find(g => g.code === contact.grade);
    if (!date) return [];
    return [{ contactId: contact.id, completed: false, id: `first-contact:${contact.id}`, date, title: `聯絡 ${contact.name}${grade ? `（${grade.code}）` : ''}` }];  });
}

export function pendingFollowups(contacts: readonly Contact[], grades: readonly Grade[], today: string) {
  return contactFollowups(contacts, grades).filter(event => !event.completed && event.date <= today);
}
