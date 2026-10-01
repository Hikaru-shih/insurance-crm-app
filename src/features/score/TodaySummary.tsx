import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api, Session } from '../../data/api';
import { creationDate } from '../../domain/followups';
import { Button, s } from '../../ui/components';
import { colors as c } from '../../ui/theme';

export function TodaySummary({ session, revision, due, onScore }: { session: Session; revision: number; due: number; onScore: () => void }) {
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
  return <View style={{ backgroundColor:c.green, borderRadius:24, padding:26, gap:18 }}>
    <Text style={{ color:'#E8D4A1',fontSize:12,letterSpacing:2 }}>錢脈 · 每一份聯繫，都在累積</Text>
    <Text style={{ color:'white',fontSize:26,fontWeight:'700' }}>今天，讓關係更近一點。</Text>
    <View style={[s.row,{gap:28}]}><View><Text style={{color:'white',fontSize:34,fontWeight:'700'}}>{summary ? `${summary.points} 分` : '—'}</Text><Text style={{color:'#DBE8DF'}}>今日得分</Text></View><View><Text style={{color:'white',fontSize:26,fontWeight:'700'}}>{due}</Text><Text style={{color:'#DBE8DF'}}>今日聯絡安排</Text></View><View><Text style={{color:'white',fontSize:26,fontWeight:'700'}}>{summary?.count ?? '—'}</Text><Text style={{color:'#DBE8DF'}}>已登記行動</Text></View></View>
    <Text style={{color:'#E8D4A1',fontSize:18,fontWeight:'600'}}>累計總分 · {summary ? `${summary.cumulative} 分` : '—'}</Text>
    <View style={[s.row,{justifyContent:'space-between'}]}><Text style={{color:'#DBE8DF'}}>{error ? '分數暫時無法讀取，請到計分卡重試。' : '從一次聯繫開始，慢慢累積成果。'}</Text><Button secondary onPress={onScore}>查看今日成果 →</Button></View>
  </View>;
}
