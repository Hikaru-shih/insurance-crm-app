import { isDate } from './contacts';
export type ReportPeriod = 'week' | 'month';
export function reportRange(date: string, period: ReportPeriod) {
  if (!isDate(date)) return null;
  const start = new Date(date + 'T12:00:00Z');
  if (period === 'week') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  else start.setUTCDate(1);
  const end = new Date(start);
  if (period === 'week') end.setUTCDate(end.getUTCDate() + 6);
  else { end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0); }
  return { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) };
}
