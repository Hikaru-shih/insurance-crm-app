import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
export type AccountMail = {to:string;purpose:'verify'|'reset';token:string;format?:'code'|'link'};
export type Mailer = (mail:AccountMail)=>Promise<void>;
export function createMailer(env:NodeJS.ProcessEnv=process.env):Mailer {
  const mode=env.MAIL_MODE??'local';
  if(!['local','resend','gmail'].includes(mode))throw new Error('MAIL_MODE 必須為 local、resend 或 gmail');
  if(env.NODE_ENV==='production' && mode==='local')throw new Error('正式環境必須設定正式寄信服務');
  if(mode==='resend' && (!env.MAIL_FROM||!env.RESEND_API_KEY))throw new Error('請設定 Resend 寄信服務');
  const gmailUser=env.GMAIL_USER?.trim().toLowerCase();
  const gmailPassword=env.GMAIL_APP_PASSWORD?.replace(/\s/g,'');
  if(mode==='gmail' && (!gmailUser||!/^[a-z0-9._%+-]+@gmail\.com$/.test(gmailUser)||!gmailPassword||!/^[a-z]{16}$/i.test(gmailPassword)))throw new Error('請設定 Gmail 地址及 Google 產生的 16 字元應用程式密碼');
  const gmail=mode==='gmail'?nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:gmailUser,pass:gmailPassword},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:10000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true}):undefined;
  return async mail=>{
    const subject=mail.purpose==='verify'?'錢脈：驗證信箱':'錢脈：重設密碼';
    let text:string;
    if(mail.format==='code') {
      text=`你的${mail.purpose==='verify'?'信箱驗證':'重設密碼'}驗證碼是：${mail.token}\n請返回錢脈 App 輸入驗證碼，10 分鐘內有效，最多嘗試 5 次。\n若不是你提出的要求，請忽略這封信。請勿將驗證碼提供給他人。`;
    } else {
      // Compatibility for old development clients; production issues codes only.
      if(env.NODE_ENV==='production')throw new Error('正式環境僅支援 App 驗證碼');
      const link=new URL(env.PUBLIC_APP_URL??'http://localhost:8081');
      if(!['http:','https:'].includes(link.protocol)||link.username||link.password)throw new Error('PUBLIC_APP_URL 無效');
      link.hash=`action=${mail.purpose}&token=${mail.token}`;
      text=`請開啟以下連結完成${mail.purpose==='verify'?'信箱驗證（24 小時內有效）':'密碼重設（30 分鐘內有效）'}：\n${link.href}\n若不是你提出的要求，請忽略這封信。`;
    }
    if(mode==='local'){
      const directory=env.MAIL_OUTBOX_DIR??'.data/mail-outbox';mkdirSync(directory,{recursive:true});
      writeFileSync(join(directory,randomUUID()+'.json'),JSON.stringify({to:mail.to,subject,text},null,2),{flag:'wx',mode:0o600});return;
    }
    if(gmail){
      try {
        const result=await gmail.sendMail({from:{name:'錢脈',address:gmailUser!},to:[{address:mail.to,name:''}],subject,text});
        if(!result.accepted?.length||result.rejected?.length)throw new Error('Recipient rejected');
      }catch{throw new Error('Gmail 寄信失敗，請確認應用程式密碼、主機 SMTP 連線與寄信額度');}
      return;
    }
    if(!env.RESEND_API_KEY||!env.MAIL_FROM)throw new Error('寄信服務尚未設定');
    const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.MAIL_FROM,to:[mail.to],subject,text})});
    if(!response.ok)throw new Error('寄信服務暫時無法使用');
  };
}
