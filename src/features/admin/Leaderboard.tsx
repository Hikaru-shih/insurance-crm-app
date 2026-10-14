import {DateRangePicker,useDateRange} from '../../ui/DateRangePicker';
import {rangeLabel} from '../../domain/dateRange';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Account, api, Session } from '../../data/api';
import { Button, Field, useStyles } from '../../ui/components';
import { useColors } from '../../ui/theme';
import { creationDate } from '../../domain/followups';
import { isDate } from '../../domain/contacts';
import { rankedRows, ScoreBoard, ScoreMode } from '../../domain/leaderboard';


export function Leaderboard({session,refreshKey,onSelect}:{session:Session;refreshKey:number;onSelect:(account:Account)=>void}) {
  const s=useStyles(), c=useColors();
  const [board,setBoard]=useState<ScoreBoard|null>(null), [error,setError]=useState('');
  const [query,setQuery]=useState(''); const mode:ScoreMode='periodPoints';
  const [loading,setLoading]=useState(false), [refresh,setRefresh]=useState(0);
  const selection=useDateRange();
  useEffect(()=>{
    let alive=true;
    setError('');setBoard(null);
    if(!selection.params){setLoading(false);setError('請輸入有效的報表日期（YYYY-MM-DD）。');return;}
    setLoading(true);
    const params=`?${selection.params}`;
    api<ScoreBoard>('/api/admin/leaderboard'+params,session.token).then(value=>{if(alive)setBoard(value);}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'讀取排名失敗');}).finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[session.token,refreshKey,refresh,selection.params]);
  const rows=board?rankedRows(board,mode,query):[];

  return <View style={{backgroundColor:c.paper,borderWidth:1,borderColor:c.line,borderRadius:4,padding:20,gap:16}}>
    <Text style={s.title}>員工計分板</Text>
    <Text style={s.muted}>所有員工（含停用）｜管理員不列入｜同分並列｜點選員工查看員工詳情</Text>
    <View style={s.row}><Button secondary disabled={loading} onPress={()=>setRefresh(value=>value+1)}>更新員工排名</Button></View>
    <DateRangePicker value={selection} label="排名時段" />
    {board&&<Text style={s.label}>{board.period==='all'?'所有累積':`${rangeLabel(board.period)} · ${board.range.start} ～ ${board.range.end}`} · 單位：分 · {rows.length} 位員工</Text>}
    <Field label="搜尋員工姓名" value={query} onChange={setQuery} placeholder="輸入姓名中的任意幾個字" />

    {loading&&<Text style={s.muted}>正在讀取排名…</Text>}{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {board&&<View style={{gap:10}}>
      {rows.map(row=>{const medal=row.rank===1?'👑':row.rank===2?'🥈':row.rank===3?'🥉':null;const tint=row.rank===1?'#B88624':row.rank===2?'#7B8999':row.rank===3?'#A76B43':c.line;return <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`第 ${row.rank} 名 ${row.name||row.email}，${row[mode]} 分，查看資料`} onPress={()=>onSelect(row)} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:12,padding:16,borderRadius:14,borderWidth:row.rank<=3?2:1,borderColor:tint,backgroundColor:pressed?c.accentSoft:c.background})}>
        <View style={{width:46,alignItems:'center',gap:2}}>{medal&&<Text style={{fontSize:26}}>{medal}</Text>}<Text style={{fontSize:row.rank<=3?20:16,fontWeight:'800',color:row.rank<=3?tint:c.muted}}>#{row.rank}</Text></View>
        <View style={{flex:1,gap:5}}><Text style={[s.label,{fontSize:17}]}>{row.name||'尚未填姓名'}{row.active===0?'（停用）':''}</Text><Text style={s.muted}>{row.email}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{board.rules.map(rule=><Text key={rule.code} style={{fontSize:11,color:c.muted}}>{rule.label} {row.items.find(item=>item.code===rule.code)?.[mode]??0}</Text>)}</View></View>
        <View style={{alignItems:'flex-end',gap:3}}><Text style={{fontSize:26,fontWeight:'800',color:c.green}}>{row[mode]}</Text><Text style={s.muted}>分 ›</Text></View>
      </Pressable>;})}
      {!rows.length&&<Text style={s.muted}>{query.trim()?'沒有姓名包含這些字的員工。':'目前沒有員工帳號。'}</Text>}
    </View>}
    <Text style={s.muted}>查看其他週／月不會修改全體結算設定。</Text>
  </View>;
}
