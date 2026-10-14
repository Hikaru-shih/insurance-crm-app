import { ContactInterval } from '../../ui/ContactInterval';
import {useEffect,useRef,useState} from 'react';
import * as Crypto from 'expo-crypto';
import {Modal,ScrollView,Text,View} from 'react-native';
import {api,Session} from '../../data/api';
import {Grade,addInterval} from '../../domain/contacts';
import {creationDate} from '../../domain/followups';
import {EventCompletion} from '../../domain/eventCompletion';
import {ScheduleEvent} from '../../domain/events';
import {Button,Card,Field,useStyles} from '../../ui/components';
export function EventCompletionForm({event,grades,session,saving,onSave,onCancel,onOnly}:{event:ScheduleEvent;grades:Grade[];session:Session;saving:boolean;onSave:(input:EventCompletion)=>Promise<void>;onCancel:()=>void;onOnly:()=>Promise<void>}){
  const s=useStyles(),[id]=useState(()=>Crypto.randomUUID());
  const [date,setDate]=useState(()=>creationDate(new Date().toISOString())!),[content,setContent]=useState([event.title,event.notes].filter(Boolean).join('\n'));
  const [gradeCode,setGrade]=useState(''),[next,setNext]=useState(''),[scoreCode,setScore]=useState(''),[error,setError]=useState('');
  const [rules,setRules]=useState<{code:string;label:string;points:number}[]>([]),[rulesError,setRulesError]=useState('');
  const lock=useRef(false);
  useEffect(()=>{let active=true;api<typeof rules>('/api/kpi-rules',session.token).then(value=>{if(active)setRules(value);}).catch(()=>{if(active)setRulesError('計分項目讀取失敗，可先不計分保存，或取消後重試。');});return()=>{active=false;};},[session.token]);
  const submit=async()=>{if(lock.current||saving)return;lock.current=true;try{setError('');await onSave({id,date,content,gradeCode,next:next.trim()||null,scoreCode});}catch(e){setError(e instanceof Error?e.message:'儲存失敗');}finally{lock.current=false;}};
  return <Modal visible animationType="slide" onRequestClose={()=>!saving&&onCancel()}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,gap:16}}><Card><Text style={s.title}>完成行程並記錄聯絡</Text><Text style={s.muted}>一次儲存行程、聯絡紀錄、計分與下次安排。</Text>
    <Field label="行程完成日期（YYYY-MM-DD）" value={date} onChange={value=>{setDate(value);const grade=grades.find(g=>g.code===gradeCode);try{if(grade)setNext(addInterval(value,grade));}catch{}}}/>
    <Field label="行程聯絡內容" multiline value={content} onChange={setContent}/>
    <Text style={s.label}>計分項目</Text><View style={s.row}>{[{code:'',label:'不計分',points:0},...rules].map(rule=><Button key={rule.code} secondary={scoreCode!==rule.code} disabled={saving} onPress={()=>setScore(rule.code)}>{rule.label} · {rule.points} 分</Button>)}</View>{!!rulesError&&<Text style={s.error}>{rulesError}</Text>}
    <Text style={s.label}>本次重新分級（沿用原等級也請選一次）</Text><View style={s.row}><Button disabled={saving} secondary={gradeCode!==''} onPress={()=>{setGrade('');setNext('');}}>稍後分級</Button>{grades.map(g=><Button key={g.code} disabled={saving} secondary={gradeCode!==g.code} onPress={()=>{setGrade(g.code);try{setNext(addInterval(date,g));}catch{}}}>{g.code}</Button>)}</View>
    {!!gradeCode&&<ContactInterval base={date} next={next} onChange={setNext}/>}<Text style={s.muted}>未選分級仍可保存紀錄與計分，聯絡人會列入未定行程。</Text>{!!gradeCode&&<Field label="下次聯絡日期（留空為未定）" value={next} onChange={setNext}/>}
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Button disabled={saving} onPress={()=>void submit()}>儲存完成與聯絡紀錄</Button><Button secondary disabled={saving} onPress={()=>{if(lock.current||saving)return;lock.current=true;void onOnly().catch(e=>setError(e instanceof Error?e.message:'儲存失敗')).finally(()=>{lock.current=false;});}}>僅完成行程，不新增聯絡紀錄</Button><Button secondary disabled={saving} onPress={onCancel}>取消完成</Button>
  </Card></ScrollView></Modal>;
}
