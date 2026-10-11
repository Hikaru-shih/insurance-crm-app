import { Text } from 'react-native';
import { Session } from '../../data/api';
import { Card, useStyles } from '../../ui/components';
import { AccountRecovery } from './AccountRecovery';
export function AccountSecurity({session,onComplete,onBack}:{session:Session;onComplete:()=>void;onBack:()=>void}){
  const s=useStyles();
  return <Card><Text style={s.title}>帳號安全</Text><Text style={s.muted}>透過目前帳號的信箱驗證碼更改密碼。成功後，所有裝置需重新登入。</Text><AccountRecovery initialEmail={session.user.email} initialAction="reset" fixedEmail onBack={onBack} onComplete={onComplete}/></Card>;
}
