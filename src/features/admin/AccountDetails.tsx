import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Account, api, Session } from '../../data/api';
import { parseWorkspace, Workspace } from '../../domain/workspace';
import { nextContactDate } from '../../domain/tracking';
import { Button, Card, Field, s } from '../../ui/components';
import { ScoreScreen } from '../score/ScoreScreen';
export function AccountDetails({ account, session, onBack }: { account: Account; session: Session; onBack: () => void }) {
  const [workspace,setWorkspace]=useState<Workspace | null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [query,setQuery]=useState(''),[contactId,setContactId]=useState<string>();
  const load=async()=>{setLoading(true);setError('');try{setWorkspace(parseWorkspace(await api(`/api/workspaces/${account.id}`,session.token)));}catch(e){setWorkspace(null);setError(e instanceof Error?e.message:'讀取失敗');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[account.id]);
  const contact=workspace?.contacts.find(c=>c.id===contactId);
  return <View style={{gap:20}}><View style={s.row}><Button secondary onPress={onBack}>返回帳號列表</Button><Text style={s.title}>查看帳號：{account.name || account.email} {account.name ? `（${account.email}）` : ''}</Text><Button secondary disabled={loading} onPress={()=>void load()}>重新讀取帳號資料</Button></View>
    {loading ? <Text style={s.muted}>讀取中…</Text> : error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : workspace && <>
      <Card><Text style={s.title}>聯絡人 · {workspace.contacts.length} 位</Text><Field label="搜尋此帳號聯絡人" value={query} onChange={setQuery} placeholder="姓名、IG、群組"/>{workspace.contacts.filter(c=>[c.name,c.instagram,...c.groups].join(' ').toLowerCase().includes(query.trim().toLowerCase())).map(c=><Button key={c.id} secondary onPress={()=>setContactId(c.id)}>{c.name} · {c.grade||'未分級'}{c.archived?'（已封存）':''}</Button>)}{!workspace.contacts.length&&<Text style={s.muted}>此帳號尚無聯絡人。</Text>}</Card>
      {contact&&<Card><Text style={s.title}>{contact.name}</Text>{[['性別',contact.gender],['IG',contact.instagram],['群組',contact.groups.join('、')],['生日',contact.birthday],['備註',contact.notes],['下次聯絡',nextContactDate(contact,workspace.grades)??'未定'],['建立時間',contact.createdAt]].map(([label,value])=><Text key={label} selectable style={s.muted}>{label}：{value||'未填寫'}</Text>)}<Text style={s.title}>聯絡紀錄</Text>{(contact.records??[]).map(r=><Text key={r.id} selectable style={s.muted}>{r.date} · {r.content}</Text>)}{!contact.records?.length&&<Text style={s.muted}>尚無手動紀錄。</Text>}<Text style={s.title}>安排歷史</Text>{(contact.trackingHistory??[]).map(h=><Text key={h.id} style={s.muted}>{h.at} · {h.from??'未定'} → {h.to??'未定'}{h.undone?'（已撤銷）':''}</Text>)}</Card>}
      <ScoreScreen session={session} ownerId={account.id}/>
    </>}
  </View>;
}
