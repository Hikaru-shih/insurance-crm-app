import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, useStyles } from './components';
import { useColors } from './theme';

// A recurring birthday has no year or weekday; February always offers the 29th.
export function BirthdayPicker({ value, onSelect }: { value: string; onSelect: (value: string) => void }) {
  const s = useStyles(), c = useColors();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(Number(value.slice(0, 2)) || new Date().getMonth() + 1);
  const [months, setMonths] = useState(false);
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return <View style={{ gap: 10 }}>
    <Text style={s.label}>生日（選填）</Text>
    <Button secondary onPress={() => { if (!open) { setMonth(Number(value.slice(0, 2)) || new Date().getMonth() + 1); setMonths(false); } setOpen(!open); }}>{value ? `${Number(value.slice(0, 2))} 月 ${Number(value.slice(3, 5))} 日` : '選擇生日'} ▾</Button>
    {open && <View style={{ padding: 12, gap: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: c.paper, maxWidth: 440 }}>
      <View style={s.row}>
        <Button secondary label="生日上個月" onPress={() => setMonth(m => m === 1 ? 12 : m - 1)}>‹</Button>
        <Button secondary onPress={() => setMonths(!months)}>{month} 月 ▾</Button>
        <Button secondary label="生日下個月" onPress={() => setMonth(m => m === 12 ? 1 : m + 1)}>›</Button>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: months ? 12 : days }, (_, i) => i + 1).map(number => {
          const date = `${String(month).padStart(2, '0')}-${String(number).padStart(2, '0')}`;
          const selected = months ? month === number : value === date;
          return <Pressable key={number} accessibilityRole="button" accessibilityLabel={months ? `選擇 ${number} 月` : `生日 ${month} 月 ${number} 日`} accessibilityState={{ selected }} onPress={() => {
            if (months) { setMonth(number); setMonths(false); }
            else { onSelect(date); setOpen(false); }
          }} style={{ width: months ? '25%' : '14.2857%', minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: selected ? c.pale : c.paper }}><Text style={s.label}>{number}{months ? ' 月' : ''}</Text></Pressable>;
        })}
      </View>
      <Button secondary onPress={() => { onSelect(''); setOpen(false); }}>清除生日</Button>
    </View>}
  </View>;
}
