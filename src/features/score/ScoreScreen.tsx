import {DateRangePicker,useDateRange} from '../../ui/DateRangePicker';
import {rangeLabel} from '../../domain/dateRange';
import { PersonalRank } from './PersonalRank';
import { ScoreTable } from './ScoreTable';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { api, Session } from '../../data/api';
import { creationDate } from '../../domain/followups';
import { Button, Card, Field, useStyles } from '../../ui/components';
import { useColors } from '../../ui/theme';
type Rule = { code: string; label: string; points: number };
type Entry = Rule & { id: string; date: string; note: string; revoked: number };
export function ScoreScreen({ session, ownerId }: { session: Session; ownerId?: string }) {
  const s = useStyles();
  const c = useColors();
  const [rules, setRules] = useState<Rule[]>([]), [entries, setEntries] = useState<Entry[]>([]);
  const [date, setDate] = useState(() => creationDate(new Date().toISOString())!);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  const selection=useDateRange();
  const [rankRevision,setRankRevision]=useState(0); const lock = useRef(false);
  const load = async () => {
    const [r, e] = await Promise.all([api<Rule[]>('/api/kpi-rules',session.token),api<Entry[]>(ownerId ? `/api/workspaces/${ownerId}/scores` : '/api/scores',session.token)]);
    setRules(r); setEntries(e); setReady(true); setRankRevision(v=>v+1);
  };
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); } catch (e) { setEntries([]); setRules([]); setReady(false); setError(e instanceof Error ? e.message : '操作失敗'); }
    finally { lock.current = false; setBusy(false); }
  };
  useEffect(() => { void run(load); }, [session.token, ownerId]);
  const daily = entries.filter(e => e.date === date), total = daily.filter(e => !e.revoked).reduce((sum,e) => sum + e.points,0);
  const cumulative = entries.filter(e => !e.revoked).reduce((sum,e) => sum + e.points,0);
  const range = selection.range;
  const reportEntries = entries.filter(e => range && !e.revoked && e.date >= range.start && e.date <= range.end);
  const reportTotal = reportEntries.reduce((sum,e) => sum + e.points,0);
  return <View style={{ gap: 20 }}><Card><DateRangePicker value={selection} label="計分時段" /></Card>
    <Card><Text style={s.title}>每日項目計分表</Text>
      {range ? <ScoreTable key={`${range.start}:${range.end}`} rules={rules} entries={entries} range={selection.period === 'all' ? {start: entries.filter(e => !e.revoked).map(e => e.date).sort()[0] ?? date, end: entries.filter(e => !e.revoked).map(e => e.date).sort().at(-1) ?? date} : range} ready={ready} selectedDate={date} onSelectDate={setDate} /> : <Text style={s.error}>請選擇有效的計分時段。</Text>}
      <Button secondary disabled={busy} onPress={() => void run(load)}>{busy ? '更新中…' : '更新計分資料'}</Button>
    </Card>
    {!ownerId && <PersonalRank session={session} params={selection.params} revision={rankRevision} />}
    <Card><Text style={s.title}>每日計分卡</Text><Field label="計分日期（YYYY-MM-DD）" value={date} onChange={setDate} />
      <Text style={s.label}>當日得分</Text><Text style={{fontSize: 38, fontWeight: '700', color: c.green}}>{ready ? total : '—'} 分</Text>
      <Text style={s.label}>累計總分（所有日期）</Text><Text style={{fontSize: 28, fontWeight: '700', color: c.green}}>{ready ? cumulative : '—'} 分</Text>
      <Text style={s.muted}>每次聯繫都算數，分數持續累積，沒有上限。</Text></Card>
    <Card><Text style={s.title}>{rangeLabel(selection.period)}</Text><Text style={s.muted}>依選定區間的紀錄日期統計，不影響後台結算設定。</Text>{range ? <><Text style={s.label}>{selection.period==='all'?'所有日期':`${range.start} ～ ${range.end}`}</Text><Text style={s.title}>{ready ? reportTotal : '—'} 分</Text><Text style={s.muted}>{reportEntries.length} 筆有效行動</Text>{rules.map(rule => <Text key={rule.code} style={s.muted}>{rule.label}：{reportEntries.filter(e => e.code === rule.code).length} 筆 · {reportEntries.filter(e => e.code === rule.code).reduce((sum,e) => sum+e.points,0)} 分</Text>)}{reportEntries.map(entry => <Text key={entry.id} style={s.muted}>{entry.date} · {entry.label} · {entry.points} 分 · {entry.note}</Text>)}</> : <Text style={s.error}>請輸入有效日期以查看報表。</Text>}</Card>
    <Text style={s.muted}>計分卡僅供查看。請在聯絡紀錄選擇計分項目並儲存；修改或刪除該紀錄會同步更新分數。</Text>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Card><Text style={s.title}>當日明細</Text>{ready && !daily.length && <Text style={s.muted}>當天尚無計分紀錄。</Text>}{daily.map(entry => <View key={entry.id} style={{ gap: 8, paddingVertical: 12 }}><Text style={s.label}>{entry.label} · {entry.points} 分{entry.revoked ? '（已撤銷）' : ''}</Text><Text style={s.muted}>{entry.note || '無備註'}</Text></View>)}</Card>
    <Card><Text style={s.title}>目前計分規則</Text>{rules.map(rule => <Text key={rule.code} style={s.muted}>{rule.label} · {rule.points} 分</Text>)}</Card>
  </View>;
}
