import { Contact, DEFAULT_GRADES, createGrade, validateContact } from './contacts';
import type { Grade } from './contacts';
export type Workspace = { version: 2; revision: number; contacts: Contact[]; grades: Grade[] };
export const emptyWorkspace = (): Workspace => ({ version: 2, revision: 0, contacts: [], grades: DEFAULT_GRADES.map(g => ({ ...g })) });

// Retain removed v1 fields and dates without guessing their meaning.
export function parseWorkspace(value: unknown): Workspace {
  if (!value || typeof value !== 'object') throw new Error('資料格式不相容');
  const input = value as Record<string, unknown>;
  if (![1, 2].includes(input.version as number) || !Array.isArray(input.contacts) || !Array.isArray(input.grades) || input.contacts.length > 10000 || input.grades.length > 26) throw new Error('資料格式不相容');
  const grades = DEFAULT_GRADES.map(g => ({ ...g }));
  const seen = new Set<string>();
  for (const item of input.grades) {
    if (!item || typeof item.code !== 'string' || seen.has(item.code)) throw new Error('等級格式錯誤');
    seen.add(item.code);
    const fixed = DEFAULT_GRADES.find(g => g.code === item.code);
    if (fixed) {
      if (item.amount !== fixed.amount || item.unit !== fixed.unit) throw new Error('A、B、C 間隔不可修改');
    } else grades.push(createGrade(item.code, item.amount, item.unit, grades));
  }
  const ids = new Set<string>();
  const contacts = input.contacts.map(item => {
    if (!item || typeof item !== 'object') throw new Error('聯絡人格式錯誤');
    const text = (key: string, fallback?: string): string => {
      const v = item[key] ?? fallback;
      if (typeof v !== 'string' || v.length > 10000) throw new Error('聯絡人欄位格式錯誤');
      return v;
    };
    if (!Array.isArray(item.importantDates) || item.importantDates.length > 100 || !Array.isArray(item.groups ?? [])) throw new Error('日期或群組格式錯誤');
    const dateIds = new Set<string>();
    const contact: Contact = {
      id: text('id'), name: text('name'), nickname: text('nickname', ''), phone: text('phone', ''), email: text('email', ''),
      gender: text('gender', ''), instagram: text('instagram', ''), birthday: text('birthday', ''),
      groups: [...new Set<string>((item.groups ?? []).map((g: unknown) => { if (typeof g !== 'string' || !g.trim() || g.length > 80) throw new Error('群組格式錯誤'); return g.trim(); }))],
      grade: text('grade'), notes: text('notes'), createdAt: text('createdAt'), updatedAt: text('updatedAt'),
      ...(item.archived !== undefined ? { archived: item.archived } : {}),
      ...(item.nextContactDate !== undefined ? { nextContactDate: item.nextContactDate } : {}),
      ...(item.trackingHistory !== undefined ? { trackingHistory: item.trackingHistory } : {}),
      ...(item.followupCompleted !== undefined ? { followupCompleted: item.followupCompleted } : {}),
      ...(item.records !== undefined ? { records: item.records } : {}),
      importantDates: item.importantDates.map((d: Record<string, unknown>) => {
        if (!d || typeof d.id !== 'string' || !d.id || typeof d.label !== 'string' || typeof d.date !== 'string' || dateIds.has(d.id)) throw new Error('重要日期格式錯誤');
        dateIds.add(d.id); return { id: d.id, label: d.label, date: d.date };
      }),
    };
    if (!contact.id || ids.has(contact.id) || validateContact(contact) || (contact.grade && !grades.some(g => g.code === contact.grade))) throw new Error('聯絡人資料無效');
    ids.add(contact.id); return contact;
  });
  if (input.version === 2 && (!Number.isSafeInteger(input.revision) || (input.revision as number) < 0)) throw new Error('版本號無效');
  return { version: 2, revision: input.version === 1 ? 0 : input.revision as number, contacts, grades };
}
