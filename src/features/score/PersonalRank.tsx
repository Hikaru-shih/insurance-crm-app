import {useEffect,useState} from 'react';
import {Text,View} from 'react-native';
import {api,Session} from '../../data/api';
import {Button,Card,useStyles} from '../../ui/components';
type Rank={period:'week'|'month'|'custom'|'all';range:{start:string;end:string};total:number;periodRank:number|null;totalRank:number|null};
export function PersonalRank({session,params,revision}:{session:Session;params:string|null;revision:number}){
  const s=useStyles();const [data,setData]=useState<Rank|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{let alive=true;setData(null);setError('');if(!params){setError('請先選擇有效日期區間');return;}api<Rank>('/api/scores/rank?'+params,session.token).then(value=>{if(alive)setData(value);}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'排名讀取失敗');});return()=>{alive=false;};},[session.token,params,revision,retry]);
  return <Card><Text style={s.title}>我的排名</Text>{data?<><Text style={s.muted}>{data.period==='all'?'所有累積':`${data.period==='week'?'週報':data.period==='month'?'月報':'自訂區間'} · ${data.range.start} ～ ${data.range.end}`}</Text>{data.periodRank===null?<Text style={s.muted}>管理員不參與員工排名。</Text>:<View style={{gap:10}}><Text style={s.title}>本期第 {data.periodRank} 名／共 {data.total} 人</Text><Text style={s.label}>累計第 {data.totalRank} 名／共 {data.total} 人</Text></View>}<Text style={s.muted}>包含停用員工，同分並列。僅顯示自己的名次。</Text></>:error?<><Text style={s.error}>{error}</Text><Button secondary onPress={()=>setRetry(v=>v+1)}>重試排名</Button></>:<Text style={s.muted}>正在讀取排名…</Text>}</Card>;
}
