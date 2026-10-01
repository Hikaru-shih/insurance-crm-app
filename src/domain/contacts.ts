import type { TrackingChange } from './tracking';
export type IntervalUnit = 'day' | 'week' | 'month';
export type Grade = { code: string; amount: number; unit: IntervalUnit; fixed: boolean };
export const DEFAULT_GRADES: readonly Grade[] = [
  { code: 'A', amount: 1, unit: 'week', fixed: true },
  { code: 'B', amount: 1, unit: 'month', fixed: true },
  { code: 'C', amount: 3, unit: 'month', fixed: true },
];
export type ImportantDate = { id: string; label: string; date: string };
export type ContactRecord = { id: string; date: string; content: string; scoreCode?: string };
export type Contact = {
  id: string; name: string; nickname: string; phone: string; email: string;
  gender: string; instagram: string; groups: string[]; birthday: string;
  grade: string; notes: string; importantDates: ImportantDate[];
  records?: ContactRecord[];
  followupCompleted?: boolean;
  archived?: boolean;
  nextContactDate?: string | null;
  trackingHistory?: TrackingChange[];
  createdAt: string; updatedAt: string;
};
export type ContactDraft = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;
export const emptyContact = (): ContactDraft => ({ name: '', nickname: '', phone: '', email: '', gender: '', instagram: '', groups: [], birthday: '', grade: '', notes: '', importantDates: [] });
export function validateContact(draft: ContactDraft): string | null {
  if (draft.archived !== undefined && typeof draft.archived !== 'boolean') return '封存狀態無效。';
  if (draft.nextContactDate !== undefined && draft.nextContactDate !== null && (typeof draft.nextContactDate !== 'string' || !isDate(draft.nextContactDate))) return '下次聯絡日期無效。';
  if (draft.trackingHistory !== undefined) {
    if (!Array.isArray(draft.trackingHistory) || draft.trackingHistory.length > 1000) return '追蹤歷史無效。';
    const ids = new Set<string>();
    for (const h of draft.trackingHistory) {
      if (!h || typeof h.id !== 'string' || !h.id || ids.has(h.id) || !['complete','reschedule'].includes(h.kind) || typeof h.at !== 'string' || !isDate(h.at) || (h.from !== null && (typeof h.from !== 'string' || !isDate(h.from))) || (h.to !== null && (typeof h.to !== 'string' || !isDate(h.to))) || (h.undone !== undefined && typeof h.undone !== 'boolean') || (h.recordId !== undefined && typeof h.recordId !== 'string')) return '追蹤歷史無效。';
      ids.add(h.id);
    }
  }
  if (draft.followupCompleted !== undefined && typeof draft.followupCompleted !== 'boolean') return '行程完成狀態無效。';
  if (draft.records !== undefined) {
    if (!Array.isArray(draft.records) || draft.records.length > 1000) return '聯絡紀錄格式錯誤或超過 1000 筆。';
    const ids = new Set<string>();
    for (const record of draft.records) {
      if (!record || typeof record.id !== 'string' || !record.id || record.id.length > 100 || ids.has(record.id)) return '聯絡紀錄識別碼無效。';
      ids.add(record.id);
      if (record.scoreCode !== undefined && (typeof record.scoreCode !== 'string' || record.scoreCode.length > 100)) return '計分項目無效。';
      if (typeof record.date !== 'string' || !isDate(record.date)) return '紀錄日期請使用有效的 YYYY-MM-DD 日期。';
      if (typeof record.content !== 'string' || !record.content.trim() || record.content.length > 5000) return '紀錄內容請填寫 1–5000 個字元。';
    }
  }
  if (!draft.name.trim()) return '請輸入姓名。';
  if (draft.birthday && !isDate(draft.birthday)) return '生日請使用有效的 YYYY-MM-DD 日期。';
  if (draft.birthday && draft.birthday > new Date().toISOString().slice(0, 10)) return '生日不能是未來日期。';
  for (const date of draft.importantDates) {
    if (!date.label.trim()) return '請填寫每筆重要日期的名稱，或移除不需要的項目。';
    if (!isDate(date.date)) return '重要日期請使用有效的 YYYY-MM-DD 日期。';
  }
  return null;
}
export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function addInterval(value: string, grade: Grade): string {
  if (!isDate(value) || !Number.isInteger(grade.amount) || grade.amount < 1) throw new Error('無效的日期或聯絡間隔');
  const date = new Date(value + 'T12:00:00Z');
  if (grade.unit === 'month') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + grade.amount);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  } else date.setUTCDate(date.getUTCDate() + grade.amount * (grade.unit === 'week' ? 7 : 1));
  return date.toISOString().slice(0, 10);
}
export function createGrade(code: string, amount: number, unit: IntervalUnit, existing: readonly Grade[]): Grade {
  const normalized = code.trim().toUpperCase();
  if (!normalized || [...normalized].length > 20 || /[\u0000-\u001f\u007f]/.test(normalized)) throw new Error('等級名稱請填寫 1–20 個字元。');
  if (DEFAULT_GRADES.some(g => g.code === normalized)) throw new Error('A、B、C 為固定等級，不能重複新增。');
  if (existing.some(g => g.code === normalized)) throw new Error('這個等級已經存在。');
  if (!Number.isInteger(amount) || amount < 1 || amount > 1200) throw new Error('間隔請填寫 1–1200 的整數。');
  if (!['day', 'week', 'month'].includes(unit)) throw new Error('請選擇有效的間隔單位。');
  return { code: normalized, amount, unit, fixed: false };
}
export function gradeLabel(grade: Grade): string {
  return `${grade.amount} ${ { day: '天', week: '週', month: '個月' }[grade.unit]}`;
}
