import { useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { api, API_URL, Session } from '../../data/api';
import { Button, Field, useStyles } from '../../ui/components';
export function PolicyLinks() {
  const [error, setError] = useState('');
  const open = async (path: string) => { try { await Linking.openURL(`${API_URL}${path}`); } catch { setError('無法開啟頁面，請稍後再試。'); } };
  return <View style={{gap:12}}><Button secondary onPress={()=>void open('/privacy')}>隱私權政策</Button><Button secondary onPress={()=>void open('/support')}>使用支援</Button>{!!error && <Text accessibilityRole="alert">{error}</Text>}</View>;
}
export function AccountDeletion({session,onComplete}:{session:Session;onComplete:()=>void}) {
  const s=useStyles(), lock=useRef(false);
  const [open,setOpen]=useState(false),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const remove=async()=>{
    if(lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try {await api('/api/auth/account',session.token,'DELETE',{password,confirmation});onComplete();}
    catch(e){setError(e instanceof Error?e.message:'刪除失敗，請重試');}
    finally{lock.current=false;setBusy(false);}
  };
  return <View style={{gap:16}}><PolicyLinks/><Button secondary disabled={busy} onPress={()=>setOpen(true)}>永久刪除帳號</Button>{open&&<><Text style={s.error}>此操作無法復原。將刪除您的帳號、聯絡人、行程、紀錄、分數與分享授權，並登出所有裝置。其他帳號資料不受影響。已匯出的副本不會自動刪除。管理員刪除自己前，請確認已有其他管理員接手。</Text><Field label="目前密碼" value={password} onChange={setPassword} secure/><Field label="輸入「永久刪除」確認" value={confirmation} onChange={setConfirmation}/>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Button disabled={busy||!password||confirmation!=='永久刪除'} onPress={()=>void remove()}>{busy?'刪除中…':'確認永久刪除帳號'}</Button><Button secondary disabled={busy} onPress={()=>{setOpen(false);setPassword('');setConfirmation('');setError('');}}>取消</Button></>}</View>;
}
