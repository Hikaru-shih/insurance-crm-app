import {useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {Contact} from '../../domain/contacts';
import {useStyles,Button} from '../../ui/components';
import {useColors} from '../../ui/theme';
export function ContactAutocomplete({contacts,value,disabled,onChange}:{contacts:Contact[];value?:string;disabled:boolean;onChange:(id?:string)=>void}){
  const s=useStyles(),c=useColors(),selected=contacts.find(item=>item.id===value);
  const [query,setQuery]=useState(''),[open,setOpen]=useState(false);
  const term=query.trim().toLocaleLowerCase();
  const matches=contacts.filter(item=>!item.archived&&item.name.toLocaleLowerCase().startsWith(term));
  return <View style={{gap:6}}><Text style={s.label}>聯絡人（選填）：{selected?.name??'無'}</Text><TextInput accessibilityLabel="搜尋行程聯絡人" value={query} onChangeText={text=>{setQuery(text);setOpen(true);}} onFocus={()=>setOpen(true)} editable={!disabled} placeholder="輸入姓名，從下方建議選擇" placeholderTextColor={c.muted} style={s.input}/>
    {open&&!disabled&&<View style={{borderWidth:1,borderColor:c.line,borderRadius:10,backgroundColor:c.paper,overflow:'hidden'}}><ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{maxHeight:240}}>{matches.slice(0,10).map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`選擇聯絡人 ${item.name}${item.instagram?' '+item.instagram:''}`} onPress={()=>{onChange(item.id);setQuery('');setOpen(false);}} style={({pressed})=>({padding:14,gap:4,borderBottomWidth:1,borderColor:c.line,backgroundColor:pressed?c.pale:c.paper})}><Text style={s.label}>{item.name}{item.id===value?' ✓':''}</Text><Text style={s.muted}>{item.instagram||item.groups.join('、')||'未填寫 IG／群組'} · {item.grade||'未分級'}</Text></Pressable>)}</ScrollView>{!matches.length&&<Text style={[s.muted,{padding:14}]}>沒有符合此姓名開頭的聯絡人。</Text>}{matches.length>10&&<Text style={[s.muted,{padding:10}]}>還有 {matches.length-10} 位，請繼續輸入姓名。</Text>}<Pressable accessibilityRole="button" onPress={()=>{onChange(undefined);setQuery('');setOpen(false);}} style={{padding:14,backgroundColor:c.pale}}><Text style={s.muted}>不指定聯絡人</Text></Pressable><Button secondary onPress={()=>setOpen(false)}>收起搜尋建議</Button></View>}
    {disabled&&<Text style={s.muted}>已有聯絡紀錄，保留原聯絡人。</Text>}
  </View>;
}
