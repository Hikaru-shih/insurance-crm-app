import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { DateRange } from '../../domain/dateRange';
import { Button } from '../../ui/components';
import { useColors } from '../../ui/theme';

type Rule = { code: string; label: string; points: number };
type Entry = Rule & { id: string; date: string; revoked: number };
const pageSize = 7;

export function ScoreTable({ rules, entries, range, ready, selectedDate, onSelectDate }: {
  rules: Rule[]; entries: Entry[]; range: DateRange; ready: boolean;
  selectedDate: string; onSelectDate: (date: string) => void;
}) {
  const c = useColors();
  const [page, setPage] = useState(0);
  const valid = entries.filter(e => !e.revoked && e.date >= range.start && e.date <= range.end);
  // Render seven dates at a time even for long custom ranges.
  const first = new Date(range.start + 'T12:00:00Z');
  const count = Math.round((new Date(range.end + 'T12:00:00Z').getTime() - first.getTime()) / 86400000) + 1;
  const lastPage = Math.max(0, Math.ceil(count / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const dates = Array.from({ length: Math.min(pageSize, count - currentPage * pageSize) }, (_, index) => {
    const date = new Date(first); date.setUTCDate(date.getUTCDate() + currentPage * pageSize + index);
    return date.toISOString().slice(0, 10);
  });
  const rows = [...rules];
  for (const entry of valid) if (!rows.some(rule => rule.code === entry.code)) rows.push(entry);
  const height = 64;
  const label = (text: string, header = false, total = false) => <View style={{ height, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderColor: c.line, backgroundColor: header ? c.green : total ? c.pale : c.paper }}><Text style={{ color: header ? c.onAccent : c.ink, fontSize: 14, fontWeight: header || total ? '700' : '500' }}>{text}</Text></View>;
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <Button secondary disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)}>上一段日期</Button>
      <Text style={{ color: c.muted }}>{currentPage + 1} / {lastPage + 1}</Text>
      <Button secondary disabled={currentPage === lastPage} onPress={() => setPage(currentPage + 1)}>下一段日期</Button>
    </View>
    <Text style={{ color: c.muted, fontSize: 12 }}>{dates[0]} ～ {dates.at(-1)} · 左右滑動查看日期，點日期查看明細</Text>
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: c.line, borderRadius: 12, overflow: 'hidden' }}>
      <View style={{ width: 144 }}>
        {label('項目／單次分數', true)}
        {rows.map(rule => <View key={rule.code}>{label(`${rule.label} (${rule.points})`)}</View>)}
        {label('總計（分）', false, true)}
      </View>
      <ScrollView horizontal style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row' }}>
          {dates.map(date => {
            const daily = valid.filter(entry => entry.date === date);
            return <View key={date} style={{ width: 88 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`查看 ${date} 計分明細`} accessibilityState={{ selected: date === selectedDate }} onPress={() => onSelectDate(date)} style={{ height, justifyContent: 'center', alignItems: 'center', backgroundColor: c.green, borderBottomWidth: date === selectedDate ? 4 : 1, borderColor: date === selectedDate ? c.accentSoft : c.line }}>
                <Text style={{ color: c.onAccent, fontWeight: '700' }}>{date.slice(5).replace('-', '/')}</Text>
              </Pressable>
              {rows.map(rule => {
                const value = daily.filter(entry => entry.code === rule.code).length;
                return <View key={rule.code} style={{ height, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderColor: c.line, backgroundColor: c.paper }}><Text accessibilityLabel={`${date} ${rule.label} ${ready ? value : '讀取中'} 次`} style={{ color: value ? c.green : c.muted, fontSize: 18, fontWeight: value ? '700' : '400' }}>{ready ? value : '—'}</Text></View>;
              })}
              <View style={{ height, alignItems: 'center', justifyContent: 'center', backgroundColor: c.pale }}><Text accessibilityLabel={`${date} 總計 ${daily.reduce((sum, entry) => sum + entry.points, 0)} 分`} style={{ color: c.green, fontSize: 18, fontWeight: '700' }}>{ready ? daily.reduce((sum, entry) => sum + entry.points, 0) : '—'}</Text></View>
            </View>;
          })}
        </View>
      </ScrollView>
    </View>
    <Text style={{ color: c.muted, fontSize: 12 }}>各項數字為次數；總計依每筆紀錄保存的實際分數加總。</Text>
  </View>;
}
