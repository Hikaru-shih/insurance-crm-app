import { useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { Text, View } from 'react-native';
import { Contact, ContactDraft, Grade, addInterval } from '../../domain/contacts';
import { changeTracking, nextContactDate, undoTracking, needsGradeReview, reviewContactGrade } from '../../domain/tracking';
import { creationDate } from '../../domain/followups';
import { api, Session } from '../../data/api';
import { Button, Card, Field, s } from '../../ui/components';
export function TrackingPanel({contact,grades,session,saving,onSave}: {contact:Contact;grades:Grade[];session:Session;saving:boolean;onSave:(draft:ContactDraft,id?:string)=>Promise<Contact>}) {
  const today = creationDate(new Date().toISOString())!;
  const [date,setDate]=useState(today),[next,setNext]=useState(nextContactDate(contact,grades) ?? ''),[content,setContent]=useState(''),[code,setCode]=useState('');
  const [reviewGrade, setReviewGrade] = useState('');
  const [mode,setMode]=useState<'complete'|'reschedule'|null>(null),[confirm,setConfirm]=useState<'undo'|'archive'|null>(null),[error,setError]=useState('');
  const [rules,setRules]=useState<{code:string;label:string;points:number}[]>([]);
  const lock=useRef(false),operationId=useRef(Crypto.randomUUID());
  useEffect(()=>{api<typeof rules>('/api/kpi-rules',session.token).then(setRules).catch(()=>setError('計分規則讀取失敗，請重新開啟聯絡人。'));},[session.token]);
  const run=async(action:()=>Promise<unknown>)=>{if(lock.current || saving)return;lock.current=true;setError('');try{await action();setMode(null);setConfirm(null);setContent('');}catch(e){setError(e instanceof Error?e.message:'操作失敗');}finally{lock.current=false;}};
  const open=(value:'complete'|'reschedule')=>{operationId.current=Crypto.randomUUID();setMode(value);setReviewGrade('');setError('');setDate(today);const grade=grades.find(g=>g.code===reviewGrade);setNext(value==='complete'?(grade?addInterval(today,grade):''):(nextContactDate(contact,grades)??''));};
  return <Card><Text style={s.title}>聯絡安排</Text><Text style={s.muted}>{contact.archived?'已封存，暫停聯絡提醒':`下次聯絡：${nextContactDate(contact,grades) ?? '尚未安排日期'}`}</Text>
    {needsGradeReview(contact) && !contact.archived && <View style={{gap:12}}><Text style={s.error}>已聯絡，尚未重新分級。選擇等級即可補分級並安排下次聯絡。</Text><View style={s.row}>{grades.map(g=><Button key={g.code} secondary disabled={saving} onPress={()=>void run(()=>onSave(reviewContactGrade(contact,g.code,grades),contact.id))}>確認分級 {g.code}</Button>)}</View></View>}
    <View style={s.row}>{!contact.archived && <><Button disabled={saving} onPress={()=>open('complete')}>完成聯絡並安排下次</Button><Button secondary disabled={saving} onPress={()=>open('reschedule')}>重新安排日期</Button>{contact.trackingHistory?.some(h=>!h.undone)&&<Button secondary disabled={saving} onPress={()=>setConfirm('undo')}>撤銷最近一次安排</Button>}</>}<Button secondary disabled={saving} onPress={()=>setConfirm('archive')}>{contact.archived?'恢復聯絡人':'封存聯絡人'}</Button></View>
    {mode && <View style={{gap:16}}>{mode==='complete'&&<><Field label="完成日期（YYYY-MM-DD）" value={date} onChange={value=>{setDate(value);const grade=grades.find(g=>g.code===reviewGrade);try{if(grade)setNext(addInterval(value,grade));}catch{}}}/><Text style={s.label}>本次重新分級（必須重新選擇，可沿用原等級）</Text><View style={s.row}>{grades.map(g=><Button key={g.code} secondary={reviewGrade!==g.code} onPress={()=>{setReviewGrade(g.code);try{setNext(addInterval(date,g));}catch{}}}>{g.code}</Button>)}</View><Text style={s.muted}>未選分級仍可保存聯絡紀錄與計分，但會進入未定行程，不自動沿用舊分級排程。</Text><Field label="本次聯絡內容" value={content} onChange={setContent} multiline/><View style={s.row}>{[{code:'',label:'不計分',points:0},...rules].map(rule=><Button key={rule.code} secondary={code!==rule.code} onPress={()=>setCode(rule.code)}>{rule.label} · {rule.points} 分</Button>)}</View></>}
      <Field label="下次聯絡日期（YYYY-MM-DD，留空為未定）" value={next} onChange={setNext}/><Text style={s.muted}>完成日期加上分級間隔會帶出建議日期，可自行調整。儲存後才更新行程、紀錄及分數。</Text><View style={s.row}><Button secondary disabled={saving} onPress={()=>setMode(null)}>取消安排</Button><Button disabled={saving} onPress={()=>void run(()=>onSave(changeTracking(contact,grades,{id:operationId.current,kind:mode,date,next:next.trim()||null,content,scoreCode:code,gradeCode:reviewGrade}),contact.id))}>儲存聯絡安排</Button></View>
    </View>}
    {confirm && <View style={{gap:12}}><Text style={s.muted}>{confirm==='undo'?'撤銷最近一次安排會恢復原日期；若是完成聯絡，也會移除該次紀錄並撤銷其分數。':contact.archived?'恢復後重新顯示聯絡提醒。':'封存後保留紀錄與積分，但停止日曆提醒。'}</Text><View style={s.row}><Button secondary disabled={saving} onPress={()=>setConfirm(null)}>取消</Button><Button disabled={saving} onPress={()=>void run(()=>onSave(confirm==='undo'?undoTracking(contact):{...contact,archived:!contact.archived},contact.id))}>確認{confirm==='undo'?'撤銷':contact.archived?'恢復':'封存'}</Button></View></View>}
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {(contact.trackingHistory??[]).slice().reverse().map(h=><Text key={h.id} style={s.muted}>{h.at} · {h.kind==='complete'?'完成聯絡':'重新安排'} · {h.from??'未定'} → {h.to??'未定'}{h.undone?'（已撤銷）':''}</Text>)}
  </Card>;
}
