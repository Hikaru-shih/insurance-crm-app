import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api, Account, Session } from '../../data/api';
import { Card, Button, s } from '../../ui/components';
export function AdminScreen({ session }: { session: Session }) {
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
  return <View style={{ gap: 20 }}><Card><Text style={s.title}>計分卡結算設定</Text><Text style={s.muted}>套用至所有使用者。切換週期不清除累計分數；報表依目前有效紀錄重新統計。</Text><View style={s.row}><Button secondary={period !== 'week'} disabled={saving || !loaded} onPress={() => {setPeriod('week');setMessage('');}}>週報（週一至週日）</Button><Button secondary={period !== 'month'} disabled={saving || !loaded} onPress={() => {setPeriod('month');setMessage('');}}>月報（每月一日至月底）</Button></View><Button disabled={saving || !loaded} onPress={() => void savePeriod()}>{saving ? '儲存中…' : '儲存結算設定'}</Button>{!!message && <Text style={s.muted}>{message}</Text>}</Card><Card><Text style={s.title}>管理後台 · 帳號與紀錄</Text><Text style={s.muted}>目前提供帳號查閱及稽核紀錄。資料修改 API 已有權限控制，完整管理表單於後續階段接上。</Text><Button secondary onPress={() => void load()}>重新整理</Button>{!!error && <Text style={s.error}>{error}</Text>}{users.map(u => <Text key={u.id} style={s.label}>{u.email} · {u.role === 'admin' ? '管理員' : '使用者'}</Text>)}</Card><Card><Text style={s.title}>最近操作</Text>{audit.slice(0, 20).map(a => <Text key={a.id} style={s.muted}>{a.created_at} · {a.action}</Text>)}</Card></View>;
}
