import {AsyncLocalStorage} from 'node:async_hooks';
import type {DatabaseSync} from 'node:sqlite';
export type Row=Record<string,any>;
export interface AsyncDatabase {
 kind:'sqlite'|'postgres';
 prepare(sql:string):{get(...values:any[]):Promise<Row|undefined>;all(...values:any[]):Promise<Row[]>;run(...values:any[]):Promise<{changes:number}>};
 transaction<T>(work:()=>Promise<T>):Promise<T>;
 close():Promise<void>;
}
export type ScoreDatabase=Pick<DatabaseSync,'prepare'>|AsyncDatabase;
export function sqliteAsync(raw:DatabaseSync):AsyncDatabase{
 const context=new AsyncLocalStorage<boolean>();let tail=Promise.resolve();
 const exclusive=async<T>(work:()=>Promise<T>):Promise<T>=>{if(context.getStore())return work();const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve;});await previous;try{return await context.run(true,work);}finally{release();}};
 return {kind:'sqlite',prepare(sql){return {get:(...v)=>exclusive(async()=>raw.prepare(sql).get(...v)),all:(...v)=>exclusive(async()=>raw.prepare(sql).all(...v)),run:(...v)=>exclusive(async()=>({changes:Number(raw.prepare(sql).run(...v).changes)}))};},transaction:work=>exclusive(async()=>{raw.exec('BEGIN IMMEDIATE');try{const result=await work();raw.exec('COMMIT');return result;}catch(e){raw.exec('ROLLBACK');throw e;}}),close:()=>exclusive(async()=>raw.close())};
}
