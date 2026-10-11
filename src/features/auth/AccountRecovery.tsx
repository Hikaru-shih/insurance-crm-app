import { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { api } from '../../data/api';
import { Button, Field, useStyles } from '../../ui/components';
export function accountLink():{action:'verify'|'reset';token:string}|null {
  if(Platform.OS!=='web')return null;
  const params=new URLSearchParams(globalThis.location?.hash.slice(1));
  const action=params.get('action'),token=params.get('token');
  return (action==='verify'||action==='reset')&&token?{action,token}:null;
}
export function AccountRecovery({initialEmail,onBack,fixedEmail=false,initialAction,onComplete}:{initialEmail:string;onBack:()=>void;fixedEmail?:boolean;initialAction?:'verify'|'reset';onComplete?:()=>void}) {
  const s=useStyles(),lock=useRef(false);
  const [link]=useState(accountLink);
  const [action,setAction]=useState<'verify'|'reset'|undefined>(link?.action??initialAction);
  const [email,setEmail]=useState(initialEmail),[code,setCode]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState(false),[sent,setSent]=useState(false);
  const run=async(selected:'verify'|'reset',consume=false)=>{
    if(lock.current)return;
    if(consume&&selected==='reset'&&password!==confirmation){setMessage('兩次密碼不一致');return;}
    if(consume&&!link&&!/^\d{8}$/.test(code)){setMessage('請輸入信件中的 8 位數驗證碼');return;}
    lock.current=true;setBusy(true);setMessage('');
    try{
      const path=consume?(selected==='verify'?'verify-email':'reset-password'):(selected==='verify'?'request-verification':'forgot-password');
      const body=consume?(link?{token:link.token,password}:{email:email.trim(),code,password}):{email:email.trim(),delivery:'code'};
      const result=await api<{message?:string}>(`/api/auth/${path}`,undefined,'POST',body);
      setMessage(consume?(selected==='verify'?'信箱已驗證，請返回登入。':'密碼已重設，請使用新密碼登入。'):result.message??'已送出申請');
      setAction(selected);
      if(consume){setDone(true);setCode('');setPassword('');setConfirmation('');if(Platform.OS==='web')globalThis.history.replaceState(null,'',globalThis.location.pathname+globalThis.location.search);onComplete?.();}
      else {setSent(true);setCode('');}
    }catch(e){setMessage(e instanceof Error?e.message:'操作失敗');}finally{lock.current=false;setBusy(false);}
  };
  const back=()=>{if(Platform.OS==='web')globalThis.history.replaceState(null,'',globalThis.location.pathname+globalThis.location.search);onBack();};
  return <View style={{gap:16}}>
    <Text style={s.title}>{action?(action==='verify'?'驗證信箱':'重設密碼'):'信箱驗證／忘記密碼'}</Text>
    {!link&&!done&&(fixedEmail||sent?<Text style={s.label}>{email}</Text>:<Field label="收信 Email" value={email} onChange={setEmail} keyboardType="email-address"/>)}
    {!done&&!link&&<>
      <Text style={s.muted}>驗證碼將寄到信箱，請回到 App 輸入。10 分鐘內有效，最多嘗試 5 次；重寄請間隔至少一分鐘。</Text>
      {(!action||action==='verify')&&<Button disabled={busy} onPress={()=>void run('verify')}>申請／重寄驗證信</Button>}
      {(!action||action==='reset')&&<Button secondary disabled={busy} onPress={()=>void run('reset')}>寄送密碼重設信</Button>}
    </>}
    {!done&&(sent||link)&&action&&<>
      {!link&&<Field label="8 位數驗證碼" value={code} onChange={value=>setCode(value.replace(/\s/g,''))} keyboardType="number-pad"/>}
      {action==='reset'&&<><Field label="新密碼（8–128 字元）" secure value={password} onChange={setPassword}/><Field label="再次輸入新密碼" secure value={confirmation} onChange={setConfirmation}/></>}
      <Button disabled={busy} onPress={()=>void run(action,true)}>{action==='verify'?'確認驗證信箱':'確認重設密碼'}</Button>
      {!fixedEmail&&!link&&<Button secondary disabled={busy} onPress={()=>{setSent(false);setAction(undefined);setCode('');setPassword('');setConfirmation('');setMessage('');}}>更換信箱或驗證用途</Button>}
    </>}
    {!!message&&<Text accessibilityRole="alert" style={s.muted}>{message}</Text>}
    <Button secondary disabled={busy} onPress={back}>{fixedEmail?'返回':'返回登入'}</Button>
  </View>;
}
