import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api, Session } from '../../data/api';
import { creationDate } from '../../domain/followups';
import { Button, useStyles } from '../../ui/components';
import { useColors, Palette } from '../../ui/theme';

export function TodaySummary({ session, revision, due, onScore }: { session: Session; revision: number; due: number; onScore: () => void }) {
  const s = useStyles();
  const c = useColors();
  const [summary, setSummary] = useState<{ points: number; count: number; cumulative: number } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    api<{date:string; points:number; revoked:number}[]>('/api/scores',session.token).then(rows => {
      const today = rows.filter(row => !row.revoked && row.date === creationDate(new Date().toISOString()));
      if (active) { setSummary({points: today.reduce((sum,row)=>sum+row.points,0),count:today.length,cumulative:rows.filter(row => !row.revoked).reduce((sum,row)=>sum+row.points,0)}); setError(false); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [session.token,revision]);
  return <View style={[s.row,{backgroundColor:c.green,borderRadius:12,paddingHorizontal:16,paddingVertical:10,gap:14}]}>
    <Text style={{color:'white',fontWeight:'700'}}>今日 {summary ? summary.points : '—'} 分</Text>
    <Text style={{color:c.accentSoft}}>聯絡安排 {due}</Text>
    <Text style={{color:c.accentSoft}}>已登記 {summary?.count ?? '—'} 筆</Text>
    <Text style={{color:c.accentSoft}}>累計 {summary ? summary.cumulative : '—'} 分</Text>
    {error && <Text accessibilityRole="alert" style={{color:c.accentSoft}}>分數暫時無法讀取</Text>}
    <Button secondary onPress={onScore}>查看成果 →</Button>
  </View>;
}
