import { AccountDetails } from './AccountDetails';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api, Account, Session } from '../../data/api';
import { Card, Button, Field, s } from '../../ui/components';
export function AdminScreen({ session }: { session: Session }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Account | null>(null);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState<Account[]>([]); const [error, setError] = useState('');
  const [audit, setAudit] = useState<{ id: string; action: string; created_at: string }[]>([]);
  const load = async () => { try { const settings = await api<{period:'week'|'month'}>('/api/report-settings',session.token); setPeriod(settings.period); setLoaded(true); setUsers(await api('/api/admin/users', session.token)); setAudit(await api('/api/admin/audit', session.token)); setError(''); } catch (e) { setError(e instanceof Error ? e.message : '讀取失敗'); } };
  useEffect(() => { void load(); }, []);
  const savePeriod = async () => {
    setSaving(true); setMessage('');
    try { await api('/api/admin/report-settings',session.token,'PUT',{period}); setMessage('已更新結算週期，使用者重新讀取計分卡即可套用。'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : '儲存失敗'); }
    finally { setSaving(false); }
  };
  if (selected) return <AccountDetails key={selected.id} account={selected} session={session} onBack={() => { setSelected(null); void load(); }} />;
  return <View style={{ gap: 20 }}><Card><Text style={s.title}>計分卡結算設定</Text><Text style={s.muted}>套用至所有使用者。切換週期不清除累計分數；報表依目前有效紀錄重新統計。</Text><View style={s.row}><Button secondary={period !== 'week'} disabled={saving || !loaded} onPress={() => {setPeriod('week');setMessage('');}}>週報（週一至週日）</Button><Button secondary={period !== 'month'} disabled={saving || !loaded} onPress={() => {setPeriod('month');setMessage('');}}>月報（每月一日至月底）</Button></View><Button disabled={saving || !loaded} onPress={() => void savePeriod()}>{saving ? '儲存中…' : '儲存結算設定'}</Button>{!!message && <Text style={s.muted}>{message}</Text>}</Card><Card><Text style={s.title}>管理後台 · 帳號與紀錄</Text><Text style={s.muted}>點選帳號查看其聯絡人、聯絡紀錄、安排與計分報表。</Text><Button secondary onPress={() => void load()}>重新整理</Button>{!!error && <Text style={s.error}>{error}</Text>}<Field label="搜尋帳號姓名或 Email" value={query} onChange={setQuery} placeholder="輸入姓名或 Email" />{loaded && !users.some(u => `${u.name ?? ''} ${u.email}`.toLowerCase().includes(query.trim().toLowerCase())) && <Text style={s.muted}>沒有符合的帳號。</Text>}{users.filter(u => `${u.name ?? ''} ${u.email}`.toLowerCase().includes(query.trim().toLowerCase())).map(u => <Button key={u.id} secondary onPress={() => setSelected(u)}>{u.name || u.email} {u.name ? `（${u.email}）` : '（尚未填姓名）'} · {u.role === 'admin' ? '管理員' : '使用者'} → 查看資料</Button>)}</Card><Card><Text style={s.title}>最近操作</Text>{audit.slice(0, 20).map(a => <Text key={a.id} style={s.muted}>{a.created_at} · {a.action}</Text>)}</Card></View>;
}
