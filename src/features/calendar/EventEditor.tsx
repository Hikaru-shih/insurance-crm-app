import { EventCompletion } from '../../domain/eventCompletion';
import { Session } from '../../data/api';
import { EventCompletionForm } from './EventCompletionForm';
import { ContactAutocomplete } from './ContactAutocomplete';
import { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { EVENT_COLORS, ScheduleEvent } from '../../domain/events';
import { Contact, Grade } from '../../domain/contacts';
import { Button, Card, Field, useStyles } from '../../ui/components';

export function EventEditor({ session, grades, onComplete, onOpenContact, allowDelete = true, contacts, event, existing, saving, onSave, onDelete, onClose }: { session: Session; grades: Grade[]; onComplete: (event:ScheduleEvent,input:EventCompletion)=>Promise<ScheduleEvent>; onOpenContact?: (id:string)=>void; allowDelete?: boolean; contacts: Contact[]; event: ScheduleEvent; existing: boolean; saving: boolean; onSave: (e: ScheduleEvent) => Promise<ScheduleEvent>; onDelete: (id: string) => Promise<void>; onClose: () => void }) {
  const s = useStyles();
  const [completing,setCompleting]=useState(false);
  const [draft, setDraft] = useState(event);
  const [snapshot, setSnapshot] = useState(JSON.stringify(event));
  const [persisted, setPersisted] = useState(existing);
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);
  const change = (patch: Partial<ScheduleEvent>) => { setDraft(d => ({ ...d, ...patch })); setMessage(''); };
  const back = () => { if (JSON.stringify(draft) !== snapshot) setConfirm('leave'); else onClose(); };
  const accept=(result:ScheduleEvent)=>{setDraft(result);setSnapshot(JSON.stringify(result));setPersisted(true);setMessage('已儲存');setCompleting(false);};
  const linkedContact=contacts.find(c=>c.id===draft.contactId);
  const linkedRecord=linkedContact?.records?.find(r=>r.id===draft.recordId);
  const save = async () => {
    try { accept(await onSave(draft)); }
    catch (e) { setMessage(e instanceof Error ? e.message : '儲存失敗'); }
  };
  const remove = async () => { try { await onDelete(draft.id); onClose(); } catch (e) { setConfirm(null); setMessage(e instanceof Error ? e.message : '刪除失敗'); } };
  return <View style={{ flex: 1 }}><View style={[s.row, { padding: 20, justifyContent: 'space-between' }]}><Text style={s.title}>{persisted ? '編輯行程' : '新增行程'}</Text><View style={s.row}><Button secondary disabled={saving} onPress={back}>返回</Button><Button disabled={saving} onPress={() => void save()}>{saving ? '儲存中…' : '儲存'}</Button></View></View>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}><Card>
      <Field label="行程標題" value={draft.title} onChange={title => change({ title })} />
      <ContactAutocomplete contacts={contacts} value={draft.contactId} disabled={saving||!!draft.recordId} onChange={contactId=>change({contactId})}/>
      <Field label="行程日期（留空表示未定）" placeholder="YYYY-MM-DD" value={draft.date ?? ''} onChange={date => change({ date: date || null })} />
      <Field label="行程時間（選填）" placeholder="HH:mm" value={draft.time} onChange={time => change({ time })} />
      <Text style={s.label}>顏色</Text><View style={s.row}>{Object.entries(EVENT_COLORS).map(([label, color]) => <Button label={`${label}${draft.color===color ? ' ✓' : ''}`} key={color} secondary={draft.color !== color} onPress={() => change({ color })}><Text style={{color}}>● </Text>{label}{draft.color === color ? ' ✓' : ''}</Button>)}</View>
      <Field label="行程內容" multiline value={draft.notes} onChange={notes => change({ notes })} />
      <Text style={s.label}>狀態：{draft.completed ? '已完成' : '未完成'}</Text><Button secondary disabled={saving} onPress={() => {if(!draft.completed && draft.contactId && !linkedRecord)setCompleting(true);else change({completed:!draft.completed});}}>{draft.completed ? '改為未完成' : '標記完成'}</Button>
      <Text style={s.muted}>修改後按「儲存」保存。有聯絡人的行程可一併新增紀錄、計分與安排下次聯絡。</Text>
      {draft.completed&&draft.contactId&&!linkedRecord&&<Button secondary disabled={saving} onPress={()=>setCompleting(true)}>補登聯絡紀錄</Button>}
      {!!draft.recordId&&<Text style={s.muted}>{linkedRecord?'已連結聯絡紀錄。恢復未完成或刪除行程會保留紀錄與分數，再次完成不重複計分；要撤銷分數請在聯絡人刪除紀錄或撤銷安排。':'原聯絡紀錄已刪除或撤銷，可重新完成並建立紀錄。'}</Text>}
      {linkedRecord&&<Text style={s.muted}>{linkedRecord.date} · {linkedRecord.content}</Text>}
      {draft.recordId&&onOpenContact&&<Button secondary disabled={saving} onPress={()=>{if(JSON.stringify(draft)!==snapshot)setMessage('請先儲存行程修改，再查看聯絡紀錄。');else onOpenContact(draft.contactId!);}}>查看聯絡人與紀錄</Button>}
      {!!message && <Text accessibilityRole="alert" style={message === '已儲存' ? s.muted : s.error}>{message}</Text>}
    </Card>{persisted && <Card><Text style={s.title}>日期變更紀錄</Text><Text style={s.muted}>原始日期：{draft.originalDate ?? '未定'}</Text>{draft.history.map((h, i) => <Text key={i} style={s.muted}>{h.from ?? '未定'} → {h.to ?? '未定'} · {new Date(h.at).toLocaleString('zh-TW')}</Text>)}{allowDelete && <Button secondary disabled={saving} onPress={() => setConfirm('delete')}>刪除行程</Button>}</Card>}</ScrollView>
    {completing&&<EventCompletionForm event={draft} grades={grades} session={session} saving={saving} onSave={async input=>accept(await onComplete(draft,input))} onOnly={async()=>accept(await onSave({...draft,completed:true}))} onCancel={()=>setCompleting(false)}/>}
    <Modal visible={confirm !== null} transparent onRequestClose={() => !saving && setConfirm(null)}><View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0006' }}><Card><Text style={s.title}>{confirm === 'delete' ? '確定刪除行程？' : '尚有未儲存的修改'}</Text><Text style={s.muted}>{confirm === 'delete' ? '刪除後無法復原。' : '返回將放棄這次修改。'}</Text><Button secondary disabled={saving} onPress={() => setConfirm(null)}>繼續編輯</Button><Button disabled={saving} onPress={() => confirm === 'delete' ? void remove() : onClose()}>{confirm === 'delete' ? '確認刪除' : '放棄修改並返回'}</Button></Card></View></Modal>
  </View>;
}
