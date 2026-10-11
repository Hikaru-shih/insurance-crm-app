import { isDate } from './contacts';

export const EVENT_COLORS = { 綠色: '#245C49', 藍色: '#3679B5', 橘色: '#BC742D', 紫色: '#8656A3', 紅色: '#BD4545' };
export type ScheduleEvent = {
  id: string; title: string; date: string | null; time: string; color: string; notes: string; completed: boolean; contactId?: string;
  originalDate: string | null;
  recordId?: string;
  history: { from: string | null; to: string | null; at: string }[];
};
export const emptyEvent = (id: string, date: string | null): ScheduleEvent => ({ id, title: '', date, originalDate: date, time: '', color: EVENT_COLORS.綠色, notes: '', completed: false, history: [] });
const dateValid = (value: unknown) => value === null || typeof value === 'string' && isDate(value);
export function parseEvents(input: unknown): ScheduleEvent[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 10000) throw new Error('行程格式錯誤');
  const ids = new Set<string>();
  return input.map(e => {
    if (!e || typeof e.id !== 'string' || !e.id || e.id.length > 100 || ids.has(e.id) ||
      typeof e.title !== 'string' || !e.title.trim() || e.title.length > 200 ||
      !dateValid(e.date) || !dateValid(e.originalDate) || typeof e.time !== 'string' ||
      e.time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time) ||
      !Object.values(EVENT_COLORS).includes(e.color) || typeof e.notes !== 'string' || e.notes.length > 5000 ||
      typeof e.completed !== 'boolean' || (e.contactId !== undefined && (typeof e.contactId !== 'string' || !e.contactId)) || !Array.isArray(e.history) || e.history.length > 1000 ||
      (e.recordId !== undefined && (typeof e.recordId !== 'string' || !e.recordId || e.recordId.length > 100 || !e.contactId)) ||
      e.history.some((h: ScheduleEvent['history'][number]) => !h || !dateValid(h.from) || !dateValid(h.to) || typeof h.at !== 'string' || !Number.isFinite(Date.parse(h.at)))) throw new Error('請確認行程標題、日期（YYYY-MM-DD）與時間（HH:mm）格式。');
    ids.add(e.id);
    return { id: e.id, title: e.title.trim(), date: e.date, originalDate: e.originalDate, time: e.time, color: e.color, notes: e.notes, completed: e.completed, ...(e.contactId ? {contactId: e.contactId} : {}), ...(e.recordId ? {recordId:e.recordId} : {}), history: e.history.map((h: ScheduleEvent['history'][number]) => ({ from: h.from, to: h.to, at: h.at })) };
  });
}
export function saveEvent(events: ScheduleEvent[], draft: ScheduleEvent): ScheduleEvent[] {
  const old = events.find(e => e.id === draft.id);
  if(old?.recordId && (draft.contactId!==old.contactId || draft.recordId!==old.recordId))throw new Error('已有聯絡紀錄的行程不可更換聯絡人。');
  const next = { ...draft, originalDate: old ? old.originalDate : draft.date, history: old ? [...old.history, ...(old.date !== draft.date ? [{ from: old.date, to: draft.date, at: new Date().toISOString() }] : [])] : [] };
  return parseEvents(old ? events.map(e => e.id === next.id ? next : e) : [...events, next]);
}
export const pendingScheduleEvents = (events: ScheduleEvent[], today: string) => events.filter(e => !e.completed && (e.date === null || e.date <= today));
