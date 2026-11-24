import nodemailer from 'nodemailer';

const mailbox='recrutement@hns.ma';
export function deliveryConfig(env){
 const provider=env('HNS_MAIL_PROVIDER')||'resend';
 const from=env('HNS_INVITATION_FROM')||env('HNS_EMAIL_FROM');
 if(!from||/[\r\n]/.test(from))return null;
 if(provider==='gmail'){
  const user=env('HNS_GMAIL_USER'),password=(env('HNS_GMAIL_APP_PASSWORD')||'').replace(/\s/g,'');
  if(user.toLowerCase()!==mailbox||!/^[a-zA-Z0-9]{16}$/.test(password)||!(from.toLowerCase()===mailbox||from.toLowerCase().endsWith('<'+mailbox+'>')))return null;
  return {provider,from,user,password};
 }
 if(provider!=='resend')return null;
 const apiKey=env('HNS_RESEND_API_KEY')||env('RESEND_API_KEY');
 return apiKey?{provider,from,apiKey}:null;
}
export async function deliverInvitation(config,{email,mail,qrCode,id},{fetcher=fetch,createTransport=nodemailer.createTransport}={}){
 const png=qrCode.split(',')[1];
 if(config.provider==='gmail'){
  const transport=createTransport({host:'smtp.gmail.com',port:587,secure:false,requireTLS:true,auth:{user:config.user,pass:config.password},tls:{minVersion:'TLSv1.2'},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true});
  try{
   const result=await transport.sendMail({from:config.from,to:email,replyTo:config.user,subject:mail.subject,html:mail.html,text:mail.text,messageId:'<hns-pass-'+id+'@hns.ma>',attachments:[{filename:'pass.png',content:Buffer.from(png,'base64'),cid:'hns-pass-qr',contentType:'image/png',contentDisposition:'inline'}]});
   if(!Array.isArray(result.accepted)||!result.accepted.some(x=>String(x).toLowerCase()===email.toLowerCase())||typeof result.messageId!=='string')throw Error('SMTP acceptance not confirmed');
   return {id:result.messageId,provider:'gmail'};
  }finally{transport.close?.()}
 }
 if(config.provider!=='resend')throw Error('Unsupported provider');
 const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json','Idempotency-Key':'hns-invite-2026/'+id},body:JSON.stringify({from:config.from,to:[email],subject:mail.subject,html:mail.html,text:mail.text,attachments:[{filename:'pass.png',content:png,content_id:'hns-pass-qr',content_type:'image/png'}]}),redirect:'error',signal:AbortSignal.timeout(12000)});
 const result=await response.json().catch(()=>null);
 if(!response.ok||typeof result?.id!=='string')throw Error('Provider acceptance not confirmed');
 return {id:result.id,provider:'resend'};
}
