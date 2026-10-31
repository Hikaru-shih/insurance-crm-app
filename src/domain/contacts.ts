import type { TrackingChange } from './tracking';
export type IntervalUnit = 'day' | 'week' | 'month';
export type Grade = { code: string; amount: number; unit: IntervalUnit; fixed: boolean };
export const DEFAULT_GRADES: readonly Grade[] = [
  { code: 'A', amount: 30, unit: 'day', fixed: false },
  { code: 'B', amount: 60, unit: 'day', fixed: false },
  { code: 'C', amount: 90, unit: 'day', fixed: false },
  { code: 'D', amount: 120, unit: 'day', fixed: false },
];
export type ImportantDate = { id: string; label: string; date: string };
export type ContactRecord = { id: string; date: string; content: string; scoreCode?: string; reviewGrade?: string };
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
      if (!h || typeof h.id !== 'string' || !h.id || ids.has(h.id) || !['complete','reschedule'].includes(h.kind) || typeof h.at !== 'string' || !isDate(h.at) || (h.from !== null && (typeof h.from !== 'string' || !isDate(h.from))) || (h.to !== null && (typeof h.to !== 'string' || !isDate(h.to))) || (h.undone !== undefined && typeof h.undone !== 'boolean') || (h.previousGrade !== undefined && (typeof h.previousGrade !== 'string' || h.previousGrade.length > 100)) || (h.recordId !== undefined && typeof h.recordId !== 'string')) return '追蹤歷史無效。';
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
      if (record.reviewGrade !== undefined && (typeof record.reviewGrade !== 'string' || record.reviewGrade.length > 100)) return '重新分級資料無效。';
      if (record.scoreCode !== undefined && (typeof record.scoreCode !== 'string' || record.scoreCode.length > 100)) return '計分項目無效。';
      if (typeof record.date !== 'string' || !isDate(record.date)) return '紀錄日期請使用有效的 YYYY-MM-DD 日期。';
      if (typeof record.content !== 'string') return '紀錄內容格式錯誤。';
    }
  }
  if (!draft.name.trim()) return '請輸入姓名。';
  if (draft.birthday && !isDate('2000-' + birthdayMonthDay(draft.birthday))) return '生日請填寫有效的月日，例如 05-20。';
  for (const date of draft.importantDates) {
    if (!date.label.trim()) return '請填寫每筆重要日期的名稱，或移除不需要的項目。';
    if (!isDate(date.date)) return '重要日期請使用有效的 YYYY-MM-DD 日期。';
  }
  return null;
}
// Accept legacy full dates, while presenting and saving only month/day.
export function birthdayMonthDay(value: string): string {
  return isDate(value) ? value.slice(5) : value;
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
  if (existing.some(g => g.code === normalized)) throw new Error('這個等級已經存在。');
  if (!Number.isInteger(amount) || amount < 1 || amount > 1200) throw new Error('間隔請填寫 1–1200 的整數。');
  if (!['day', 'week', 'month'].includes(unit)) throw new Error('請選擇有效的間隔單位。');
  return { code: normalized, amount, unit, fixed: false };
}
export function gradeLabel(grade: Grade): string {
  return `${grade.amount} ${ { day: '天', week: '週', month: '個月' }[grade.unit]}`;
}
