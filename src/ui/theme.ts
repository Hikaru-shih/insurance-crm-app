import { createContext, createElement, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
export type Palette = { background:string;paper:string;ink:string;muted:string;green:string;pale:string;line:string;gold:string;error:string;input:string;onAccent:string;accentSoft:string;radius:number };
export const themes: Record<string,{name:string;description:string;colors:Palette}> = {
  navy:{name:'錢脈藍金',description:'深海藍、暖金與米白，清楚俐落地安排每一天。',colors:{background:'#F3F5F8',paper:'#FFFEFB',ink:'#172F4D',muted:'#607086',green:'#193F6B',pale:'#E8EEF6',line:'#DCE3EC',gold:'#926719',error:'#B13D42',input:'#F8FAFD',onAccent:'#FFFFFF',accentSoft:'#F8E8C4',radius:16}},
  classic:{name:'經典綠金',description:'沉穩綠色與金色點綴，保留熟悉的工作台。',colors:{background:'#F5F5EF',paper:'#FFFFFF',ink:'#233D32',muted:'#64756C',green:'#245C46',pale:'#EAF1E8',line:'#DDE5DB',gold:'#9A762F',error:'#AD4039',input:'#FAFCF8',onAccent:'#FFFFFF',accentSoft:'#F3E4C8',radius:20}},
  journal:{name:'奶油手帳',description:'奶油白、柔和綠與暖杏色，像整理自己的日常手帳。',colors:{background:'#FBF4E8',paper:'#FFFCF5',ink:'#403D32',muted:'#746959',green:'#4B6551',pale:'#EDEEDC',line:'#E5D9C3',gold:'#946039',error:'#AB3F36',input:'#FFF9EE',onAccent:'#FFFFFF',accentSoft:'#FCE5C6',radius:26}},
  bubble:{name:'清新氣泡',description:'淺藍與薄荷色，圓潤、清爽，讓每天的安排更輕鬆。',colors:{background:'#EFF7FC',paper:'#FFFFFF',ink:'#213D50',muted:'#536F7E',green:'#246482',pale:'#E0F1F3',line:'#CDE2EC',gold:'#4865A0',error:'#B13F4B',input:'#F5FBFF',onAccent:'#FFFFFF',accentSoft:'#D5F6F0',radius:28}},
};
const key='qianmai.appearance.v1';
const ThemeContext=createContext({id:'navy',colors:themes.navy.colors,ready:false,busy:false,error:'',choose:async(_id:string)=>{}});
export function ThemeProvider({children}:PropsWithChildren){
  const [id,setId]=useState('navy'),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false);
  useEffect(()=>{let active=true;AsyncStorage.getItem(key).then(value=>{if(active&&value&&Object.hasOwn(themes,value))setId(value);}).catch(()=>{if(active)setError('無法讀取外觀設定，可重新選擇風格。');}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
  const choose=async(next:string)=>{
    if(!ready||lock.current||!Object.hasOwn(themes,next))return;
    lock.current=true;setBusy(true);setError('');
    try{await AsyncStorage.setItem(key,next);setId(next);}catch{setError('外觀設定未能儲存，請再試一次。');}finally{lock.current=false;setBusy(false);}
  };
  return createElement(ThemeContext.Provider,{value:{id,colors:themes[id].colors,ready,busy,error,choose}},children);
}
export const useTheme=()=>useContext(ThemeContext);
export const useColors=()=>useTheme().colors;
