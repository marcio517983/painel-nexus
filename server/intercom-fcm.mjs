import {createHash,sign} from 'node:crypto';

const GOOGLE_TOKEN_URL='https://oauth2.googleapis.com/token';
const FIREBASE_SCOPE='https://www.googleapis.com/auth/firebase.messaging';
const PROJECT='controws';
const PACKAGE='com.nexusmaster.interfone.piloto';
let cachedToken='',cachedUntil=0;

export const fcmTokenHash=token=>createHash('sha256').update(token).digest('hex');
export function validFcmToken(token){
 return typeof token==='string'&&token.length>=32&&token.length<=4096&&
  /^[A-Za-z0-9_~:.\-]+$/.test(token);
}
export function fcmConfigured(env){
 return env.NEXUS_FCM_PROJECT_ID===PROJECT && typeof env.NEXUS_FCM_SERVICE_ACCOUNT_JSON==='string'
  && env.NEXUS_FCM_SERVICE_ACCOUNT_JSON.length>=250;
}
function credentials(env){
 const c=JSON.parse(env.NEXUS_FCM_SERVICE_ACCOUNT_JSON);
 if(c.project_id!==PROJECT||c.type!=='service_account'||
  !/^[-a-zA-Z0-9_.]+@controws\.iam\.gserviceaccount\.com$/.test(c.client_email||'')||
  typeof c.private_key!=='string'||!c.private_key.includes('BEGIN PRIVATE KEY')){
  throw Error('Conta de serviço FCM inválida para o projeto de testes');
 }
 return c;
}
const b64=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');
async function oauthToken(env){
 if(cachedToken&&cachedUntil>Date.now()+120000)return cachedToken;
 const c=credentials(env),seconds=Math.floor(Date.now()/1000);
 const unsigned=b64({alg:'RS256',typ:'JWT'})+'.'+b64({
  iss:c.client_email,scope:FIREBASE_SCOPE,aud:GOOGLE_TOKEN_URL,iat:seconds,exp:seconds+3600
 });
 const signature=sign('RSA-SHA256',Buffer.from(unsigned),c.private_key).toString('base64url');
 const request=new URLSearchParams({
  grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
  assertion:unsigned+'.'+signature
 });
 const r=await fetch(GOOGLE_TOKEN_URL,{method:'POST',
  headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:request,signal:AbortSignal.timeout(5500)});
 if(!r.ok)throw Error('Autenticação do servidor Firebase indisponível');
 const data=await r.json();
 if(typeof data.access_token!=='string')throw Error('Token OAuth inválido');
 cachedToken=data.access_token;
 cachedUntil=Date.now()+Math.min(3500,Number(data.expires_in)||3600)*1000;
 return cachedToken;
}
/**
 * Uses Firebase HTTP v1 with a short-lived service account OAuth token.
 * Never accepts an arbitrary endpoint, project or notification recipient.
 * A failed FCM request must not fail the visitor's intercom call.
 */
export async function sendFcmCall(env,token,call){
 if(!fcmConfigured(env)||!validFcmToken(token))return {ok:false,status:0};
 if(!/^[a-f0-9-]{36}$/i.test(call.id)||call.expires<=Math.floor(Date.now()/1000))return {ok:false,status:0};
 try{
  const access=await oauthToken(env);
  const body={message:{
   token,
   data:{kind:'intercom',firebaseProject:PROJECT,callId:call.id,
    expires:String(call.expires),unitId:String(call.unitId),
    label:String(call.label||'Residência').slice(0,80),
    reason:String(call.reason||'Visitante na portaria').slice(0,70)},
   android:{priority:'HIGH',ttl:'30s',collapse_key:'nexus-intercom-'+call.unitId,
    restricted_package_name:PACKAGE}
  }};
  const r=await fetch('https://fcm.googleapis.com/v1/projects/'+PROJECT+'/messages:send',{
   method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(5500)
  });
  return {ok:r.ok,status:r.status};
 }catch{return {ok:false,status:0}}
}
