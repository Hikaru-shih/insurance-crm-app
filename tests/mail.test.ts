import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import {createMailer} from '../server/mail';

test('Gmail requires app credentials, pins TLS and sender, sends code text and hides SMTP errors',async()=>{
  assert.throws(()=>createMailer({NODE_ENV:'production',MAIL_MODE:'gmail'}));
  assert.throws(()=>createMailer({NODE_ENV:'production',MAIL_MODE:'gmail',GMAIL_USER:'sender@example.test',GMAIL_APP_PASSWORD:'abcdefghijklmnop'}));
  assert.throws(()=>createMailer({NODE_ENV:'production',MAIL_MODE:'gmail',GMAIL_USER:'sender@gmail.com',GMAIL_APP_PASSWORD:'ordinary-password'}));
  let configuration:any,message:any,fail=false,reject=false;
  const stub=mock.method(nodemailer,'createTransport',(options:any)=>{
    configuration=options;
    return {sendMail:async(input:any)=>{message=input;if(fail)throw new Error('SMTP credentials must never leak');return {accepted:reject?[]:['recipient@example.test'],rejected:reject?['recipient@example.test']:[]};}} as any;
  });
  try {
    const send=createMailer({NODE_ENV:'production',MAIL_MODE:'gmail',GMAIL_USER:' Sender@gmail.com ',GMAIL_APP_PASSWORD:'abcd efgh ijkl mnop',MAIL_FROM:'spoof@example.test'});
    assert.equal(configuration.host,'smtp.gmail.com');assert.equal(configuration.port,465);assert.equal(configuration.secure,true);
    assert.equal(configuration.tls.rejectUnauthorized,true);assert.equal(configuration.auth.pass,'abcdefghijklmnop');
    const mail={to:'recipient@example.test',purpose:'reset' as const,format:'code' as const,token:'12345678'};
    await send(mail);
    assert.equal(message.from.address,'sender@gmail.com');assert.equal(message.to[0].address,mail.to);
    assert.match(message.text,/12345678/);assert.doesNotMatch(message.text,/https?:\/\//);
    fail=true;await assert.rejects(send(mail),error=>error instanceof Error&&!error.message.includes('credentials must never leak'));
    fail=false;reject=true;await assert.rejects(send(mail),/Gmail/);
  }finally{stub.mock.restore();}
});
