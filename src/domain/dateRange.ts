import {isDate} from './contacts';
import {reportRange} from './reporting';
export type RangePeriod='week'|'month'|'custom'|'all';
export type DateRange={start:string;end:string};
export function selectedRange(period:RangePeriod,today:string,start:string,end:string):DateRange|null{
  if(period==='all')return {start:'0001-01-01',end:'9999-12-31'};
  if(period!=='custom')return reportRange(today,period);
  return isDate(start)&&isDate(end)&&start<=end?{start,end}:null;
}
export const inRange=(date:string|null|undefined,range:DateRange|null)=>!!date&&!!range&&date>=range.start&&date<=range.end;
export const rangeLabel=(period:RangePeriod)=>period==='week'?'本週':period==='month'?'本月':period==='all'?'所有累積':'自訂區間';
export function queryRange(params:URLSearchParams,fallback:'week'|'month',today:string){
  const period=params.get('period')??fallback;
  if(!['week','month','custom','all'].includes(period))return null;
  const range=selectedRange(period as RangePeriod,params.get('date')??today,params.get('start')??'',params.get('end')??'');
  return range?{period:period as RangePeriod,range}:null;
}
