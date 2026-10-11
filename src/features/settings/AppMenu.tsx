import {Modal,Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useColors} from '../../ui/theme';
import {useStyles} from '../../ui/components';
export type MenuItem={label:string;onPress:()=>void;disabled?:boolean};
export function AppMenu({visible,onClose,email,items}:{visible:boolean;onClose:()=>void;email:string;items:MenuItem[]}){
 const c=useColors(),s=useStyles();
 return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}><View style={{flex:1,flexDirection:'row',backgroundColor:'rgba(0,0,0,0.38)'}}><SafeAreaView style={{width:'84%',maxWidth:340,backgroundColor:c.paper}}><ScrollView contentContainerStyle={{padding:22,gap:8}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={s.title}>功能選單</Text><Pressable accessibilityRole="button" accessibilityLabel="關閉功能選單" onPress={onClose} style={{padding:14}}><Text style={s.title}>×</Text></Pressable></View><Text style={[s.muted,{marginBottom:22}]}>{email}</Text>{items.map(item=><Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} disabled={item.disabled} onPress={()=>{onClose();item.onPress();}} style={({pressed})=>({paddingVertical:17,paddingHorizontal:12,borderBottomWidth:1,borderBottomColor:c.line,backgroundColor:pressed?c.pale:c.paper,opacity:item.disabled?.5:1})}><Text style={s.label}>{item.label}</Text></Pressable>)}</ScrollView></SafeAreaView><Pressable accessibilityRole="button" accessibilityLabel="收起功能選單" onPress={onClose} style={{flex:1}} /></View></Modal>;
}
