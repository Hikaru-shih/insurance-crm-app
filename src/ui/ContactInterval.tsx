import { Text, View } from 'react-native';
import { addInterval, isDate } from '../domain/contacts';
import { Field, useStyles } from './components';
export function ContactInterval({base,next,onChange}:{base:string;next:string;onChange:(value:string)=>void}) {
  const s=useStyles();
  const days=isDate(base)&&isDate(next)?Math.round((Date.parse(next+'T12:00:00Z')-Date.parse(base+'T12:00:00Z'))/86400000):null;
  return <View style={{gap:8}}><Field label="本次聯絡間隔（天）" keyboardType="number-pad" value={days===null?'':String(days)} onChange={value=>{
    const n=Number(value);
    if(!/^\d+$/.test(value)||!Number.isInteger(n)||n<1||n>36500||!isDate(base)){onChange('invalid');return;}
    onChange(addInterval(base,{code:'',amount:n,unit:'day',fixed:false}));
  }}/><Text style={s.muted}>從 {base} 起算{isDate(next)?`，下次聯絡：${next}`:'；請輸入 1–36500 的整數天數'}。僅調整本次安排，不修改共用分級。</Text></View>;
}
