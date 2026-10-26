import { Text, View } from 'react-native';
import { isDate } from '../domain/contacts';
import { useStyles } from './components';
import { CalendarDatePicker } from './CalendarDatePicker';
export function ContactInterval({base,next,onChange}:{base:string;next:string;onChange:(value:string)=>void}) {
 const s=useStyles();
 return <View style={{gap:8}}><Text style={s.label}>選擇聯絡日期</Text><CalendarDatePicker key={isDate(next)?next.slice(0,7):base.slice(0,7)} value={isDate(next)?next:base} onSelect={onChange}/></View>;
}
