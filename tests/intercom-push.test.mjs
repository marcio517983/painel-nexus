import test from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,randomBytes} from 'node:crypto';
import {endpointHash,pushConfigured,validSubscription,validPushEndpoint,sendWebPush} from '../server/intercom-push.mjs';

test('push endpoint accepts only known HTTPS push services',()=>{
 assert.equal(validPushEndpoint('https://fcm.googleapis.com/fcm/send/demo'),true);
 assert.equal(validPushEndpoint('https://web.push.apple.com/push/demo'),true);
 assert.equal(validPushEndpoint('http://127.0.0.1/secret'),false);
 assert.equal(validPushEndpoint('https://fake-fcm.googleapis.com.attacker.example/'),false);
 assert.equal(validPushEndpoint('https://fcm.googleapis.com:4443/push'),false);
});
test('push subscriptions require a valid p256dh point and 16-byte auth',()=>{
 const key=createECDH('prime256v1');key.generateKeys();
 const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/demo',keys:{
  p256dh:key.getPublicKey('base64url','uncompressed'),auth:randomBytes(16).toString('base64url')
 }};
 assert.equal(validSubscription(subscription),true);
 assert.equal(validSubscription({...subscription,keys:{...subscription.keys,auth:'invalid'}}),false);
 assert.equal(endpointHash(subscription.endpoint).length,64);
});
test('VAPID sender signs an ES256 token and produces encrypted web push request',async()=>{
 const vapid=createECDH('prime256v1');vapid.generateKeys();
 const recipient=createECDH('prime256v1');recipient.generateKeys();
 const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/demo',keys:{
  p256dh:recipient.getPublicKey('base64url','uncompressed'),auth:randomBytes(16).toString('base64url')
 }};
 const env={
  NEXUS_VAPID_PUBLIC_KEY:vapid.getPublicKey('base64url','uncompressed'),
  NEXUS_VAPID_PRIVATE_KEY:vapid.getPrivateKey('base64url'),
  NEXUS_VAPID_SUBJECT:'mailto:test@example.org'
 };
 assert.ok(pushConfigured(env));
 const previous=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{
  sent={url,options};return {ok:true,status:201};
 };
 try{
  const result=await sendWebPush(env,subscription,{kind:'intercom',callId:'abc',expires:123,unitId:'apto-102'});
  assert.deepEqual(result,{ok:true,status:201});
  assert.equal(sent.url,subscription.endpoint);
  assert.match(sent.options.headers.Authorization,/^vapid t=[A-Za-z0-9_.-]+, k=[A-Za-z0-9_-]+$/);
  assert.equal(sent.options.headers['Content-Encoding'],'aes128gcm');
  assert.equal(sent.options.body.readUInt32BE(16),4096);
  assert.equal(sent.options.body[20],65);
  assert.ok(sent.options.body.length>100);
 }finally{globalThis.fetch=previous}
});
