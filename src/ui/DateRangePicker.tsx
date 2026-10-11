import {CalendarDatePicker} from './CalendarDatePicker';
import {useState} from 'react';
import {Text,View} from 'react-native';
import {creationDate} from '../domain/followups';
import {inRange,RangePeriod,selectedRange,rangeLabel} from '../domain/dateRange';
import {Button,Field,useStyles} from './components';
export function useDateRange(){
  const today=creationDate(new Date().toISOString())!;
  const [period,setPeriod]=useState<RangePeriod>('week');
  const [start,setStart]=useState(today),[end,setEnd]=useState(today);
  const range=selectedRange(period,today,start,end);
  return {period,setPeriod,start,setStart,end,setEnd,range,contains:(date:string|null|undefined)=>inRange(date,range),params:range?`period=${period}&start=${range.start}&end=${range.end}&date=${today}`:null};
}
export function DateRangePicker({value,label='查看時段'}:{value:ReturnType<typeof useDateRange>;label?:string}){
  const s=useStyles();const [choosing,setChoosing]=useState<'start'|'end'|null>(null);return <View style={{gap:10}}><Text style={s.label}>{label}</Text><View style={s.row}>{(['week','month','custom'] as const).map(period=><Button key={period} secondary={value.period!==period} onPress={()=>value.setPeriod(period)}>{rangeLabel(period)}</Button>)}</View>{value.period==='custom'&&<><View style={s.row}><Button secondary onPress={()=>setChoosing(choosing==='start'?null:'start')}>{label}開始日期：{value.start}</Button><Button secondary onPress={()=>setChoosing(choosing==='end'?null:'end')}>{label}結束日期：{value.end}</Button></View>{choosing&&<><Text style={s.label}>選擇{choosing==='start'?'開始':'結束'}日期</Text><CalendarDatePicker key={choosing} value={choosing==='start'?value.start:value.end} onSelect={date=>{if(choosing==='start')value.setStart(date);else value.setEnd(date);setChoosing(null);}}/><Button secondary onPress={()=>setChoosing(null)}>取消選擇日期</Button></>}<Text style={s.muted}>開始與結束設為同一天，即可查看單日。</Text></>}{value.range?<Text style={s.muted}>{value.period==='all'?'所有日期的累積資料':`${value.range.start} ～ ${value.range.end}（含首尾日期）`}</Text>:<Text accessibilityRole="alert" style={s.error}>請輸入有效日期，且開始日期不得晚於結束日期。</Text>}</View>;
}
