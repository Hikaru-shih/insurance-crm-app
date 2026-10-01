import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api, Session } from '../../data/api';
import { Button, Card, Field, s } from '../../ui/components';
import { colors } from '../../ui/theme';

export function AuthScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    try {
      if (register) await api('/api/auth/register', undefined, 'POST', { email, password });
      const session = await api<Session>('/api/auth/login', undefined, 'POST', { email, password });
      onLogin(session);
    } catch (e) { setError(e instanceof Error ? e.message : '登入失敗'); }
    finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background }} keyboardShouldPersistTaps="handled"><View style={{ width: '100%', maxWidth: 460 }}><Card><Text style={[s.title, { fontSize: 32 }]}>錢脈</Text><Text style={s.muted}>{register ? '建立測試帳號' : '登入你的業務工作台'}</Text><Field label="帳號 Email" value={email} onChange={setEmail} keyboardType="email-address" placeholder="you@example.com" /><Field label="密碼" value={password} onChange={setPassword} secure placeholder="至少 12 個字元" />{!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}<Button disabled={busy} onPress={() => void submit()}>{busy ? '處理中…' : register ? '建立帳號並登入' : '登入'}</Button><Button secondary disabled={busy} onPress={() => { setRegister(!register); setError(''); }}>{register ? '已有帳號，返回登入' : '建立測試帳號'}</Button><Text style={s.muted}>目前為開發測試環境，請使用假資料。自行註冊是否開放由後端設定；不開放時請向管理員取得帳號。</Text></Card></View></ScrollView>;
}
