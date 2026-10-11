import { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { Account, api, Session } from '../../data/api';
import { Button, Card, Field, useStyles } from '../../ui/components';

export function AccountForm({ session, account, onSaved }: { session: Session; account?: Account; onSaved: (account: Account) => void }) {
  const s = useStyles();
  const [name, setName] = useState(account?.name ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>(account?.role ?? 'user');
  const [active, setActive] = useState(account?.active !== 0);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const self = account?.id === session.user.id;
  const save = async () => {
    setSaving(true); setMessage('');
    try {
      const result = await api<Account>(account ? `/api/admin/users/${account.id}` : '/api/admin/users', session.token, account ? 'PUT' : 'POST', account ? {name,role,active} : {name,email,password,role});
      setPassword(''); setConfirm(false); setMessage(account ? '帳號設定已儲存' : '帳號已建立'); onSaved(result);
    } catch (e) { setConfirm(false); setMessage(e instanceof Error ? e.message : '儲存失敗'); }
    finally { setSaving(false); }
  };
  return <Card><Text style={s.title}>{account ? '帳號設定' : '建立帳號'}</Text>
    <Field label="帳號姓名" value={name} onChange={setName} />
    {account ? <Text style={s.muted}>{account.email}</Text> : <><Field label="新帳號 Email" keyboardType="email-address" value={email} onChange={setEmail} /><Field label="初始密碼（8–128 字元）" secure value={password} onChange={setPassword} /></>}
    <View style={s.row}><Button disabled={saving || self} secondary={role !== 'user'} onPress={() => setRole('user')}>一般使用者</Button><Button disabled={saving || self} secondary={role !== 'admin'} onPress={() => setRole('admin')}>管理員</Button></View>
    {account && <><Text style={s.label}>狀態：{active ? '啟用' : '停用'}</Text><Button secondary disabled={saving || self} onPress={() => setActive(!active)}>{active ? '設為停用' : '恢復啟用'}</Button><Text style={s.muted}>停用會保留資料並立即登出該帳號；權限變更後需重新登入。自己的管理權限與啟用狀態不可變更。</Text></>}
    <Button disabled={saving} onPress={() => setConfirm(true)}>{account ? '儲存帳號設定' : '建立新帳號'}</Button>
    {!!message && <Text accessibilityRole="alert" style={s.muted}>{message}</Text>}
    <Modal visible={confirm} transparent onRequestClose={() => !saving && setConfirm(false)}><View style={{flex:1,justifyContent:'center',padding:24,backgroundColor:'#0006'}}><Card><Text style={s.title}>確認帳號設定</Text><Text style={s.muted}>{name} · {account?.email ?? email}{'\n'}權限：{role === 'admin' ? '管理員（可查看與管理所有帳號）' : '一般使用者'}{'\n'}狀態：{active ? '啟用' : '停用'}</Text><Button secondary disabled={saving} onPress={() => setConfirm(false)}>取消</Button><Button disabled={saving} onPress={() => void save()}>{saving ? '儲存中…' : '確認儲存帳號'}</Button></Card></View></Modal>
  </Card>;
}
