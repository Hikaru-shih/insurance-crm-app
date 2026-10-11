import { Pressable, Text, View } from 'react-native';
import { Card, useStyles } from '../../ui/components';
import { themes, useTheme } from '../../ui/theme';
export function AppearanceScreen(){
  const theme=useTheme(),s=useStyles();
  return <View style={{gap:18}}><Card><Text style={s.title}>選一個喜歡的日常風格</Text><Text style={s.muted}>點選即可套用，會記住在這支手機或這個瀏覽器。不同裝置可選不同風格，不影響聯絡人、行程與分數。</Text>{!theme.ready&&<Text style={s.muted}>讀取外觀設定中…</Text>}{!!theme.error&&<Text accessibilityRole="alert" style={s.error}>{theme.error}</Text>}</Card>
    {Object.entries(themes).map(([id,item])=><Pressable key={id} accessibilityRole="radio" aria-checked={theme.id===id} accessibilityLabel={`套用${item.name}`} accessibilityState={{checked:theme.id===id,disabled:!theme.ready||theme.busy}} disabled={!theme.ready||theme.busy} onPress={()=>void theme.choose(id)} style={{padding:22,gap:12,borderRadius:item.colors.radius,backgroundColor:item.colors.background,borderWidth:2,borderColor:theme.id===id?item.colors.green:item.colors.line}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',gap:12}}><Text style={{color:item.colors.ink,fontSize:20,fontWeight:'700'}}>{item.name}</Text>{theme.id===id&&<Text style={{color:item.colors.green,fontWeight:'700'}}>✓ 使用中</Text>}</View>
      <Text style={{color:item.colors.muted,lineHeight:23}}>{item.description}</Text><View style={{backgroundColor:item.colors.paper,borderRadius:16,padding:16,gap:12}}><Text style={{color:item.colors.ink,fontWeight:'600'}}>今天，讓關係更近一點。</Text><View style={{flexDirection:'row',gap:8}}>{[item.colors.green,item.colors.pale,item.colors.gold].map(color=><View key={color} style={{width:28,height:28,borderRadius:14,backgroundColor:color}}/>)}</View><Text style={{color:item.colors.green}}>查看今天的安排 →</Text></View>
    </Pressable>)}
  </View>;
}
