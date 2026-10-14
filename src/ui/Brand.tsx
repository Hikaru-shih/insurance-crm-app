import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useColors } from './theme';
export function Brand({loading=false}:{loading?:boolean}) {
  const c=useColors();
  return <View style={{alignItems:'center',gap:12,paddingVertical:24}}>
    <Image source={require('../../Logo/Logo.png')} accessibilityLabel="錢脈" style={{width:loading?112:80,height:loading?112:80,borderRadius:20}} resizeMode="contain"/>
    <Text style={{fontSize:28,fontWeight:'700',letterSpacing:4,color:c.ink}}>錢脈</Text>
    <View style={{width:32,height:2,backgroundColor:c.gold}}/>
    {loading?<><ActivityIndicator color={c.green}/><Text style={{color:c.muted,fontSize:14}}>正在準備你的工作台…</Text></>:<Text style={{color:c.muted,fontSize:13,letterSpacing:1}}>把關係放在心上</Text>}
  </View>;
}
