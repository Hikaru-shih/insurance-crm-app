import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { Account, api, ApiError, Session } from '../../data/api';
import { AccountDetails } from '../admin/AccountDetails';
import { Button, Card, Field, useStyles } from '../../ui/components';
type Grant = {viewer_id:string;viewer_name:string;viewer_email:string;viewer_active:number};
type SharedAccount = Pick<Account,'id'|'name'|'email'>;
export function SharingScreen({session}: {session:Session}) {
  const s = useStyles();
  const [grants,setGrants]=useState<Grant[]>([]),[owners,setOwners]=useState<SharedAccount[]>([]);
  const [selected,setSelected]=useState<SharedAccount|null>(null),[email,setEmail]=useState('');
  const [query,setQuery]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false);
  const [confirm,setConfirm]=useState<{email:string;id?:string}|null>(null);
  const selectedId=useRef<string|undefined>(undefined);
  selectedId.current=selected?.id;
  const load=useCallback(async()=>{
    const [sent,received]=await Promise.allSettled([api<Grant[]>('/api/grants',session.token),api<SharedAccount[]>('/api/shared-with-me',session.token)]);
    setGrants(sent.status==='fulfilled'?sent.value:[]);
    setOwners(received.status==='fulfilled'?received.value:[]);
    setLoaded(sent.status==='fulfilled' && received.status==='fulfilled');
    const failure=sent.status==='rejected'?sent.reason:received.status==='rejected'?received.reason:null;
    setError(failure instanceof ApiError && failure.status===404 ? '後端尚未載入授權分享功能，請停止並重新啟動測試服務，再更新分享名單。' : failure instanceof Error ? failure.message : failure ? '讀取失敗' : '');
    if(received.status==='rejected')setSelected(null);
    else if(selectedId.current && !received.value.some(o=>o.id===selectedId.current)){setSelected(null);setMessage('這份分享已撤銷或帳號已停用，無法繼續查看。');}
  },[session.token]);
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),15000);return()=>clearInterval(timer);},[load]);
  const submit=async()=>{
    if(!confirm || busy)return;
    setBusy(true);setError('');setMessage('');
    try {
      await api(confirm.id ? `/api/grants/${confirm.id}` : '/api/grants',session.token,confirm.id?'DELETE':'POST',confirm.id?undefined:{email:confirm.email});
      setMessage(confirm.id?'已撤銷授權':'已新增唯讀授權');setConfirm(null);setEmail('');await load();
    } catch(e){setConfirm(null);setError(e instanceof Error?e.message:'操作失敗');}
    finally{setBusy(false);}
  };
  if(selected)return <AccountDetails key={selected.id} readOnly account={{...selected,role:'user'}} session={session} onBack={()=>{setSelected(null);void load();}}/>;
  return <View style={{gap:20}}><Card><Text style={s.title}>授權分享</Text><Text style={s.muted}>授權對方查看你帳號內所有聯絡人、聯絡紀錄、行程及計分報表。對方必須已有帳號，只能查看，不能修改或轉授權。</Text><Field label="授權對象 Email" keyboardType="email-address" value={email} onChange={setEmail}/><Button disabled={busy || !email.trim()} onPress={()=>setConfirm({email:email.trim().toLowerCase()})}>新增唯讀授權</Button><Button secondary disabled={busy} onPress={()=>void load()}>更新分享名單</Button>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!message&&<Text accessibilityRole="alert" style={s.muted}>{message}</Text>}</Card>
    <Card><Text style={s.title}>我授權的對象</Text>{loaded&&!grants.length&&<Text style={s.muted}>尚未授權任何帳號。</Text>}{grants.map(g=><View key={g.viewer_id} style={s.row}><Text style={s.muted}>{g.viewer_name||g.viewer_email} · {g.viewer_email}{g.viewer_active===0?'（已停用）':''}</Text><Button secondary disabled={busy} label={`撤銷 ${g.viewer_email} 的授權`} onPress={()=>setConfirm({id:g.viewer_id,email:g.viewer_email})}>撤銷授權</Button></View>)}</Card>
    <Card><Text style={s.title}>分享給我</Text><Field label="搜尋分享者姓名或 Email" value={query} onChange={setQuery}/>{loaded&&!owners.length&&<Text style={s.muted}>目前沒有分享給你的資料。</Text>}{owners.filter(o=>`${o.name??''} ${o.email}`.toLowerCase().includes(query.trim().toLowerCase())).map(o=><Button key={o.id} secondary onPress={()=>setSelected(o)}>查看分享：{o.name||o.email}（{o.email}）</Button>)}</Card>
    <Modal visible={!!confirm} transparent onRequestClose={()=>!busy&&setConfirm(null)}><View style={{flex:1,justifyContent:'center',padding:24,backgroundColor:'#0006'}}><Card><Text style={s.title}>{confirm?.id?'確認撤銷授權':'確認分享資料'}</Text><Text style={s.muted}>{confirm?.email}{'\n'}{confirm?.id?'撤銷後對方無法再讀取你的資料；已看過的資訊無法收回。':'對方將能查看你的全部聯絡人、紀錄、行程與計分報表。'}</Text><Button secondary disabled={busy} onPress={()=>setConfirm(null)}>取消</Button><Button disabled={busy} onPress={()=>void submit()}>{confirm?.id?'確認撤銷':'確認授權'}</Button></Card></View></Modal>
  </View>;
}
