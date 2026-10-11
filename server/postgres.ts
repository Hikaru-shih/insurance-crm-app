import {AsyncLocalStorage} from 'node:async_hooks';
import {readFileSync} from 'node:fs';
import {Pool,types} from 'pg';
import type {AsyncDatabase,Row} from './asyncDatabase';
// PostgreSQL SUM(integer) returns int8. Never silently round an unsafe integer.
const integer=(text:string)=>{const n=Number(text);if(!Number.isSafeInteger(n))throw new Error('Database integer exceeds safe range');return n;};
export interface PgConnection {query(sql:string,values?:any[]):Promise<{rows:Row[];rowCount?:number|null}>;release():void;}
export interface PgConnections {connect():Promise<PgConnection>;end():Promise<void>;}
export function pgParameters(sql:string){let i=0;return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g,part=>part==='?'?'$'+(++i):part);}
export function postgresAdapter(pool:PgConnections):AsyncDatabase{
 const context=new AsyncLocalStorage<PgConnection>();
 const query=async(sql:string,values:any[]=[])=>{const current=context.getStore();const client=current??await pool.connect();try{return await client.query(pgParameters(sql),values);}finally{if(!current)client.release();}};
 return {kind:'postgres',prepare(sql){return {get:async(...v)=>(await query(sql,v)).rows[0],all:async(...v)=>(await query(sql,v)).rows,run:async(...v)=>({changes:(await query(sql,v)).rowCount??0})};},async transaction(work){if(context.getStore())throw new Error('Nested transaction not supported');const client=await pool.connect();try{await client.query('BEGIN');
 // Serializes API mutation transactions across instances; compatible with the existing workspace revision contract.
 await client.query('SELECT pg_advisory_xact_lock(71628101)');
 const result=await context.run(client,work);await client.query('COMMIT');return result;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}},close:()=>pool.end()};
}
export async function migratePostgres(db:AsyncDatabase){
 await db.transaction(async()=>{
  await db.prepare('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)').run();
  const current=await db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get();
  const version=Number(current?.version??0);if(version>2)throw new Error('PostgreSQL schema is newer than this server');
  if(version===0){const sql=readFileSync(new URL('./migrations/postgres/001.sql',import.meta.url),'utf8');
   // Schema SQL contains no procedural blocks; individual statements work with both pg and the embedded PostgreSQL test engine.
   for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
   await db.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(1,new Date().toISOString());
  }
  if(version<2){
   await db.prepare(readFileSync(new URL('./migrations/postgres/002.sql',import.meta.url),'utf8')).run();
   await db.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(2,new Date().toISOString());
  }
 });
}
export async function openPostgres(url:string){
 const parsed=new URL(url);if(!['postgres:','postgresql:'].includes(parsed.protocol))throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
 const pool=new Pool({connectionString:url,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,statement_timeout:15000,types:{getTypeParser:(oid,format)=>oid===20?integer:types.getTypeParser(oid,format)}});
 pool.on('error',()=>console.error('PostgreSQL idle connection failed'));
 const db=postgresAdapter(pool);try{await migratePostgres(db);return db;}catch(e){await db.close();throw e;}
}
