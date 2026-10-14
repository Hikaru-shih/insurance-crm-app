import { Brand } from '../../ui/Brand';
import { PolicyLinks } from './AccountDeletion';
import { useState } from 'react';
import { AccountRecovery, accountLink } from './AccountRecovery';
import { ScrollView, Text, View } from 'react-native';
import { api, Session } from '../../data/api';
import { Button, Card, Field, useStyles } from '../../ui/components';
import { useColors } from '../../ui/theme';

export function AuthScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const s = useStyles();
  const colors = useColors();
  const [recovery,setRecovery]=useState(()=>!!accountLink());
  const [name, setName] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    try {
      if (register) { await api('/api/auth/register', undefined, 'POST', { email, password, name }); setRegister(false); }
      const session = await api<Session>('/api/auth/login', undefined, 'POST', { email, password });
      onLogin(session);
    } catch (e) { setError(e instanceof Error ? e.message : '登入失敗'); }
    finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background }} keyboardShouldPersistTaps="handled"><View style={{ width: '100%', maxWidth: 460 }}><Card><Brand/>{recovery?<AccountRecovery initialEmail={email} onBack={()=>{setRecovery(false);setRegister(false);setError('');}}/>:<><Text style={s.muted}>{register ? (__DEV__ ? '建立測試帳號' : '建立帳號') : '登入你的業務工作台'}</Text>{register && <Field label="姓名（必填）" value={name} onChange={setName} placeholder="請輸入姓名" />}<Field label="帳號 Email" value={email} onChange={setEmail} keyboardType="email-address" placeholder="you@example.com" /><Field label="密碼" value={password} onChange={setPassword} secure placeholder="至少 8 個字元" />{!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}<Button disabled={busy} onPress={() => void submit()}>{busy ? '處理中…' : register ? '建立帳號並登入' : '登入'}</Button><Button secondary disabled={busy} onPress={() => { setRegister(!register); setError(''); }}>{register ? '已有帳號，返回登入' : (__DEV__ ? '建立測試帳號' : '建立帳號')}</Button><Button secondary disabled={busy} onPress={()=>setRecovery(true)}>信箱驗證／忘記密碼</Button><Text style={s.muted}>自行註冊是否開放由後端設定；不開放時請向管理員取得帳號。需要驗證信箱時，請使用上方「信箱驗證／忘記密碼」。</Text></>}<PolicyLinks/></Card></View></ScrollView>;
}
