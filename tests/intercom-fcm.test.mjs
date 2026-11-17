import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {validFcmToken,fcmTokenHash,fcmConfigured,sendFcmCall} from '../server/intercom-fcm.mjs';

test('Android FCM token validation rejects missing or unusual values',()=>{
 assert.ok(validFcmToken('dG9rZW46QUJDMDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5'));
 assert.equal(validFcmToken('abc'),false);
 assert.equal(validFcmToken('https://somewhere.example/fcm'),false);
 assert.equal(fcmTokenHash('token').length,64);
});
test('FCM sender refuses missing service-account configuration',async()=>{
 assert.deepEqual(await sendFcmCall({NEXUS_FCM_PROJECT_ID:'controws'},'x'.repeat(128),{id:'04af4a65-7b3a-4db6-bc75-2bc194087008',expires:Math.floor(Date.now()/1000)+25}),{ok:false,status:0});
 assert.equal(fcmConfigured({NEXUS_FCM_PROJECT_ID:'another-project',NEXUS_FCM_SERVICE_ACCOUNT_JSON:'x'.repeat(400)}),false);
});
test('FCM sends high-priority, time-limited data message to the authorized Android app',async()=>{
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const credentials={type:'service_account',project_id:'controws',client_email:'test@controws.iam.gserviceaccount.com',
  private_key:privateKey.export({format:'pem',type:'pkcs8'})};
 const env={NEXUS_FCM_PROJECT_ID:'controws',NEXUS_FCM_SERVICE_ACCOUNT_JSON:JSON.stringify(credentials)};
 const token='nexusToken-'.repeat(15),id='04af4a65-7b3a-4db6-bc75-2bc194087008';
 let posts=[],orig=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  posts.push({url,options});
  if(url.includes('oauth2.googleapis.com'))return {ok:true,json:async()=>({access_token:'temporary-server-token',expires_in:3600})};
  return {ok:true,status:200};
 };
 try{
  const out=await sendFcmCall(env,token,{id,unitId:'apto-102',label:'Apartamento 102',reason:'entrega',expires:Math.floor(Date.now()/1000)+25});
  assert.equal(out.ok,true);
  assert.equal(posts.length,2);
  const message=JSON.parse(posts[1].options.body).message;
  assert.equal(posts[1].url,'https://fcm.googleapis.com/v1/projects/controws/messages:send');
  assert.equal(message.token,token);
  assert.equal(message.data.kind,'intercom');
  assert.equal(message.data.callId,id);
  assert.equal(message.data.label,'Portaria');
  assert.equal(message.data.destinationLabel,'Apartamento 102');
  assert.equal(message.data.reason,'Entrega • Destino: Apartamento 102');
  assert.equal(message.data.firebaseProject,'controws');
  assert.equal(message.android.priority,'HIGH');
  assert.equal(message.android.ttl,'30s');
  assert.equal(message.android.restricted_package_name,'com.nexusmaster.interfone.piloto');
  assert.equal(message.notification,undefined);
 }finally{globalThis.fetch=orig}
});
