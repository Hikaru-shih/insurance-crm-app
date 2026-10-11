import {DateRangePicker,useDateRange} from '../../ui/DateRangePicker';
import {creationDate} from '../../domain/followups';
import { AccountForm } from './AccountForm';
import { useWorkspace } from '../../state/useWorkspace';
import { Contact } from '../../domain/contacts';
import { ScheduleEvent } from '../../domain/events';
import { ContactEditor } from '../contacts/ContactEditor';
import { EventEditor } from '../calendar/EventEditor';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Account, api, Session } from '../../data/api';
import { parseWorkspace, Workspace } from '../../domain/workspace';
import { nextContactDate } from '../../domain/tracking';
import { Button, Card, Field, useStyles } from '../../ui/components';
import { ScoreScreen } from '../score/ScoreScreen';
export function AccountDetails({ readOnly = false, account, session, onBack }: { readOnly?: boolean; account: Account; session: Session; onBack: () => void }) {
  const s = useStyles();
  const recordRange=useDateRange();
  const [currentAccount,setCurrentAccount] = useState(account);
  const repository = useMemo(() => ({load: async () => parseWorkspace(await api('/api/workspaces/'+account.id,session.token)), save: async (data: Workspace) => parseWorkspace(await api('/api/workspaces/'+account.id,session.token,'PUT',data))}), [account.id,session.token]);
  const workspace = useWorkspace(repository);
  const {loading,loadError:error} = workspace;
  const load = workspace.reload;
  const [query,setQuery]=useState(''),[contactId,setContactId]=useState<string>();
  const [editor,setEditor] = useState<Contact | null>(null);
  const [eventEditor,setEventEditor] = useState<ScheduleEvent | null>(null);
  if(editor && !readOnly) return <ContactEditor contact={editor} session={session} grades={workspace.grades} saving={workspace.saving} onSave={workspace.saveContact} onAddGrade={workspace.addGrade} onClose={()=>setEditor(null)} />;
  if(eventEditor && !readOnly) return <EventEditor session={session} grades={workspace.grades} onComplete={workspace.completeEvent} onOpenContact={id=>{setEventEditor(null);setContactId(id);}} contacts={workspace.contacts} event={eventEditor} existing saving={workspace.saving} allowDelete={false} onSave={workspace.saveEvent} onDelete={workspace.deleteEvent} onClose={()=>setEventEditor(null)} />;
  const contact=workspace?.contacts.find(c=>c.id===contactId);
  return <View style={{gap:20}}><View style={s.row}><Button secondary onPress={onBack}>返回帳號列表</Button><Text style={s.title}>查看帳號：{currentAccount.name || currentAccount.email} {currentAccount.name ? `（${currentAccount.email}）` : ''}</Text><Button secondary disabled={loading} onPress={()=>void load()}>重新讀取帳號資料</Button></View>
    {readOnly ? <Text style={s.muted}>分享資料 · 僅供查看，不能修改或轉授權。</Text> : <AccountForm session={session} account={currentAccount} onSaved={setCurrentAccount} />}
    {loading ? <Text style={s.muted}>讀取中…</Text> : error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : workspace && <>
      <Card><Text style={s.title}>聯絡人 · {workspace.contacts.length} 位</Text><Field label="搜尋此帳號聯絡人" value={query} onChange={setQuery} placeholder="姓名、IG、群組"/>{workspace.contacts.filter(c=>[c.name,c.instagram,...c.groups].join(' ').toLowerCase().includes(query.trim().toLowerCase())).map(c=><Button key={c.id} secondary onPress={()=>setContactId(c.id)}>{c.name} · {c.grade||'未分級'}{c.archived?'（已封存）':''}</Button>)}{!workspace.contacts.length&&<Text style={s.muted}>此帳號尚無聯絡人。</Text>}</Card>
      {contact&&<Card>{!readOnly && <Button onPress={()=>setEditor(contact)}>編輯此聯絡人</Button>}<Text style={s.title}>{contact.name}</Text>{[['性別',contact.gender],['IG',contact.instagram],['群組',contact.groups.join('、')],['生日',contact.birthday],['備註',contact.notes],['下次聯絡',nextContactDate(contact,workspace.grades)??'未定'],['建立時間',contact.createdAt]].map(([label,value])=><Text key={label} selectable style={s.muted}>{label}：{value||'未填寫'}</Text>)}<Text style={s.title}>聯絡紀錄</Text><DateRangePicker value={recordRange} label="紀錄時段" />{(contact.records??[]).filter(r=>recordRange.contains(r.date)).map(r=><Text key={r.id} selectable style={s.muted}>{r.date} · {r.content}</Text>)}{!(contact.records??[]).some(r=>recordRange.contains(r.date))&&<Text style={s.muted}>此時段沒有聯絡紀錄。</Text>}<Text style={s.title}>安排歷史</Text>{(contact.trackingHistory??[]).filter(h=>recordRange.contains(creationDate(h.at))).map(h=><Text key={h.id} style={s.muted}>{h.at} · {h.from??'未定'} → {h.to??'未定'}{h.undone?'（已撤銷）':''}</Text>)}</Card>}
      <Card><Text style={s.title}>自由行程 · {workspace.events.length} 筆</Text>{workspace.events.map(e => <View key={e.id} style={{borderLeftWidth:4,borderLeftColor:e.color,paddingLeft:12,gap:4}}>{!readOnly && <Button secondary onPress={()=>setEventEditor(e)}>編輯行程：{e.title}</Button>}<Text style={s.label}>{e.title}{e.completed ? '（已完成）' : ''}</Text><Text style={s.muted}>{e.date ?? '未定日期'} {e.time} · {workspace.contacts.find(c => c.id === e.contactId)?.name ?? '未指定聯絡人'}</Text><Text style={s.muted}>{e.notes}</Text><Text style={s.muted}>原始日期：{e.originalDate ?? '未定'}</Text>{e.history.map((h,i) => <Text key={i} style={s.muted}>{h.from ?? '未定'} → {h.to ?? '未定'}</Text>)}</View>)}</Card>
      <ScoreScreen key={workspace.revision} session={session} ownerId={account.id}/>
    </>}
  </View>;
}
