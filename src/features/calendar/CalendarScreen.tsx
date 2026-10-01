import { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Button, Card, EmptyState, s } from '../../ui/components';
import { colors as c } from '../../ui/theme';

export type CalendarEvent = { id: string; date: string; title: string; time?: string; color?: string; contactId?: string; completed?: boolean };
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function CalendarScreen({ onAddContact, events = [], pending = false, onComplete, saving = false }: { pending?: boolean; saving?: boolean; onComplete?: (event: CalendarEvent) => Promise<void>; onAddContact: () => void; events?: readonly CalendarEvent[] }) {
  const [error, setError] = useState('');
  const complete = async (event: CalendarEvent) => { try { setError(''); await onComplete?.(event); } catch (e) { setError(e instanceof Error ? e.message : '儲存失敗'); } };
  const [selected, setSelected] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const year = month.getFullYear(), m = month.getMonth();
  const days = new Date(year, m + 1, 0).getDate(), offset = month.getDay();
  const now = new Date();
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.date, (counts.get(event.date) ?? 0) + 1);
  const selectedEvents = events.filter(event => event.date === dateKey(selected)).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title));
  const move = (direction: number) => { setMonth(new Date(year, m + direction, 1)); setSelected(new Date(year, m + direction, 1)); };
  return <View style={{ gap: 20 }}><Card>
    <View style={[s.row, { justifyContent: 'space-between' }]}><View><Text style={s.title}>{year} 年 {m + 1} 月</Text><Text style={s.muted}>{pending ? '紅色數字表示當天未完成的聯絡安排' : '規劃下一次聯絡'}</Text></View><View style={s.row}><Button secondary label="上一個月" onPress={() => move(-1)}>‹</Button><Button secondary onPress={() => { setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelected(now); }}>今天</Button><Button secondary label="下一個月" onPress={() => move(1)}>›</Button></View></View>
    <View style={styles.grid}>{['日', '一', '二', '三', '四', '五', '六'].map(d => <View key={d} style={styles.weekday}><Text style={s.muted}>{d}</Text></View>)}
      {Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
        const day = index - offset + 1, valid = day > 0 && day <= days;
        const active = valid && selected.getFullYear() === year && selected.getMonth() === m && selected.getDate() === day;
        const today = valid && now.getFullYear() === year && now.getMonth() === m && now.getDate() === day;
        const count = valid ? counts.get(dateKey(new Date(year, m, day))) ?? 0 : 0;
        return <Pressable key={index} disabled={!valid} accessibilityRole="button" accessibilityLabel={valid ? `${year}年${m + 1}月${day}日，${count} 筆行程` : undefined} accessibilityState={{ selected: active }} onPress={() => setSelected(new Date(year, m, day))} style={[styles.day, active && { backgroundColor: c.pale }]}>{valid && <><View style={[styles.dayNumber, today && { backgroundColor: c.green }]}><Text style={{ color: today ? 'white' : c.ink, fontWeight: active || today ? '700' : '400' }}>{day}</Text></View>{count > 0 && <View style={[styles.count, pending && { backgroundColor: c.error }]}><Text style={styles.countText}>{count}</Text></View>}</>}</Pressable>;
      })}</View>
  </Card>{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Card><Text style={s.title}>{selected.getMonth() + 1} 月 {selected.getDate()} 日 · {selectedEvents.length} 筆行程</Text>{selectedEvents.length ? selectedEvents.map(event => <View key={event.id} style={[styles.event, { borderLeftColor: pending ? c.error : event.color ?? c.green }]}><Text style={s.label}>{event.time || '未設定時間'}</Text><Text style={[s.muted, { flex: 1 }]}>{event.title}{event.completed ? '（已完成）' : ''}</Text>{onComplete && <Button disabled={saving} onPress={() => void complete(event)}>查看／處理行程</Button>}</View>) : <EmptyState title={pending ? '當天沒有未完成行程' : '當天尚無行程'} description={pending ? '此處顯示今天及過去尚未完成的聯絡安排，未来行程請到主頁查看。' : '聯絡人儲存分級後，會依建立日期與分級間隔安排首次聯絡。'}><Button onPress={onAddContact}>＋ 新增聯絡人</Button></EmptyState>}</Card></View>;
}
const styles = StyleSheet.create({ count: { backgroundColor: c.green, borderRadius: 10, minWidth: 20, paddingHorizontal: 5, marginTop: 4, alignItems: 'center' }, countText: { color: 'white', fontSize: 10, fontWeight: '700' }, event: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, borderLeftWidth: 4, padding: 12, backgroundColor: c.pale, borderRadius: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.285714%', alignItems: 'center', paddingVertical: 12 }, day: { width: '14.285714%', minHeight: 72, borderTopWidth: 1, borderColor: c.line, alignItems: 'center', paddingTop: 10 }, dayNumber: { width: 29, height: 29, borderRadius: 15, justifyContent: 'center', alignItems: 'center' } });
