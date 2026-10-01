import { Contact, Grade, addInterval, isDate } from './contacts';
import { creationDate } from './followups';
export type TrackingChange = { id: string; kind: 'reschedule' | 'complete'; from: string | null; to: string | null; at: string; recordId?: string; undone?: boolean };
export function nextContactDate(contact: Contact, grades: readonly Grade[]): string | null {
  if (contact.nextContactDate !== undefined) return contact.nextContactDate;
  if (contact.followupCompleted) return null;
  const grade = grades.find(g => g.code === contact.grade), start = creationDate(contact.createdAt);
  return grade && start ? addInterval(start, grade) : null;
}
export function changeTracking(contact: Contact, grades: readonly Grade[], input: { id: string; kind: 'reschedule' | 'complete'; date: string; next: string | null; content?: string; scoreCode?: string }): Contact {
  if (contact.archived) throw new Error('請先恢復已封存的聯絡人。');
  if (!isDate(input.date) || (input.next !== null && !isDate(input.next))) throw new Error('請輸入有效日期。');
  if ((contact.trackingHistory ?? []).some(h => h.id === input.id)) return contact;
  if (input.kind === 'complete' && (!input.content?.trim() || (input.next && input.next <= input.date))) throw new Error('請填寫聯絡內容，下次日期須晚於完成日期。');
  const from = nextContactDate(contact, grades);
  return { ...contact, nextContactDate: input.next, followupCompleted: false,
    records: input.kind === 'complete' ? [...(contact.records ?? []), { id: input.id, date: input.date, content: input.content!.trim(), scoreCode: input.scoreCode ?? '' }] : contact.records,
    trackingHistory: [...(contact.trackingHistory ?? []), { id: input.id, kind: input.kind, from, to: input.next, at: input.date, ...(input.kind === 'complete' ? { recordId: input.id } : {}) }],
  };
}
export function undoTracking(contact: Contact): Contact {
  const history = contact.trackingHistory ?? [], last = [...history].reverse().find(h => !h.undone);
  if (!last) throw new Error('沒有可撤銷的安排。');
  return { ...contact, nextContactDate: last.from, followupCompleted: false,
    records: last.recordId ? (contact.records ?? []).filter(r => r.id !== last.recordId) : contact.records,
    trackingHistory: history.map(h => h.id === last.id ? { ...h, undone: true } : h),
  };
}
