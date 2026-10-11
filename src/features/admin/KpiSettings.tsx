import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api, Session } from '../../data/api';
import { Button, Card, Field, useStyles } from '../../ui/components';
type Rule = {code: string; label: string; points: number};
export function KpiSettings({session}: {session: Session}) {
  const s = useStyles();
  const [rules,setRules] = useState<Rule[]>([]), [error,setError] = useState('');
  const load = async () => { try {setRules(await api<Rule[]>('/api/kpi-rules',session.token));setError('');} catch(e){setError(e instanceof Error ? e.message : '讀取失敗');} };
  useEffect(() => {void load();}, []);
  return <Card><Text style={s.title}>計分規則設定</Text><Text style={s.muted}>每項 0–10000 分。既有紀錄保留原分數；新增計分或更換紀錄的計分項目時，套用目前分數。</Text>{!!error && <><Text style={s.error}>{error}</Text><Button onPress={() => void load()}>重試讀取計分規則</Button></>}{rules.map(rule => <RuleForm key={rule.code} rule={rule} session={session} />)}</Card>;
}
function RuleForm({rule,session}: {rule:Rule;session:Session}) {
  const s = useStyles();
  const [points,setPoints]=useState(String(rule.points)), [saving,setSaving]=useState(false), [message,setMessage]=useState('');
  const save=async()=>{if(!/^\d+$/.test(points) || Number(points)>10000){setMessage('分數須為 0–10000 的整數');return;}setSaving(true);setMessage('');try{await api('/api/admin/kpi-rules',session.token,'PUT',{code:rule.code,points:Number(points)});setMessage('分數已儲存');}catch(e){setMessage(e instanceof Error?e.message:'儲存失敗');}finally{setSaving(false);}};
  return <View style={{gap:8}}><Field label={`${rule.label}分數`} value={points} onChange={value=>{setPoints(value);setMessage('');}} keyboardType="number-pad"/><Button secondary disabled={saving} onPress={()=>void save()}>儲存{rule.label}分數</Button>{!!message&&<Text accessibilityRole="alert" style={s.muted}>{message}</Text>}</View>;
}
