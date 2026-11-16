import {createCipheriv,createECDH,createHmac,createPrivateKey,createSign,randomBytes,createHash} from 'node:crypto';

// RFC 8291 + RFC 8292 (VAPID), using Node.js crypto without a third-party push service.
const b64=b=>Buffer.from(b).toString('base64url');
const unpack=s=>Buffer.from(s,'base64url');
const hmac=(key,data)=>createHmac('sha256',key).update(data).digest();
function expand(prk,info,count){
 const blocks=[];let prev=Buffer.alloc(0),i=1;
 while(Buffer.concat(blocks).length<count){prev=hmac(prk,Buffer.concat([prev,Buffer.from(info),Buffer.from([i++])]));blocks.push(prev)}
 return Buffer.concat(blocks).subarray(0,count);
}
export const endpointHash=s=>createHash('sha256').update(s).digest('hex');
export function validPushEndpoint(endpoint){
 try{
  const url=new URL(endpoint),host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||(url.port&&url.port!=='443')||url.username||url.password||url.hash)return false;
  return ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','api.push.apple.com'].includes(host)
   || /^wns[\w-]*\.notify\.windows\.com$/.test(host);
 }catch{return false}
}
export function validSubscription(s){
 if(!s||typeof s.endpoint!=='string'||s.endpoint.length>2048||!validPushEndpoint(s.endpoint))return false;
 const {p256dh,auth}=s.keys||{};
 if(typeof p256dh!=='string'||typeof auth!=='string'||!/^[A-Za-z0-9_-]{80,120}$/.test(p256dh)||!/^[A-Za-z0-9_-]{16,40}$/.test(auth))return false;
 return unpack(p256dh).length===65&&unpack(p256dh)[0]===4&&unpack(auth).length===16;
}
function vapidJwt(endpoint,config){
 const publicKey=unpack(config.NEXUS_VAPID_PUBLIC_KEY),privateKey=unpack(config.NEXUS_VAPID_PRIVATE_KEY);
 if(publicKey.length!==65||publicKey[0]!==4||privateKey.length!==32)throw Error('VAPID inválido');
 const jwk={kty:'EC',crv:'P-256',x:b64(publicKey.subarray(1,33)),y:b64(publicKey.subarray(33)),d:b64(privateKey)};
 const header=b64(JSON.stringify({typ:'JWT',alg:'ES256'}));
 const payload=b64(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:config.NEXUS_VAPID_SUBJECT||'mailto:suporte@nexusmaster.invalid'}));
 const unsigned=header+'.'+payload;
 const signature=createSign('SHA256').update(unsigned).end();
 const signer=createSign('SHA256');signer.update(unsigned);signer.end();
 const token=unsigned+'.'+b64(signer.sign({key:createPrivateKey({key:jwk,format:'jwk'}),dsaEncoding:'ieee-p1363'}));
 return {token,publicKey:b64(publicKey)};
}
function encryptPush(body,subscription){
 const receiver=unpack(subscription.keys.p256dh),auth=unpack(subscription.keys.auth);
 const local=createECDH('prime256v1');local.generateKeys();
 const serverPub=local.getPublicKey(undefined,'uncompressed');
 const shared=local.computeSecret(receiver);
 const ikm=expand(hmac(auth,shared),Buffer.concat([Buffer.from('WebPush: info\0'),receiver,serverPub]),32);
 const salt=randomBytes(16),prk=hmac(salt,ikm);
 const contentKey=expand(prk,Buffer.from('Content-Encoding: aes128gcm\0'),16);
 const nonce=expand(prk,Buffer.from('Content-Encoding: nonce\0'),12);
 const content=Buffer.concat([Buffer.from(JSON.stringify(body)),Buffer.from([2])]);
 if(content.length>3000)throw Error('Payload Push excede limite');
 const cipher=createCipheriv('aes-128-gcm',contentKey,nonce);
 const encrypted=Buffer.concat([cipher.update(content),cipher.final(),cipher.getAuthTag()]);
 const rs=Buffer.alloc(4);rs.writeUInt32BE(4096);
 return Buffer.concat([salt,rs,Buffer.from([serverPub.length]),serverPub,encrypted]);
}
export function pushConfigured(env){
 return /^[A-Za-z0-9_-]{86,88}$/.test(env.NEXUS_VAPID_PUBLIC_KEY||'')
   && /^[A-Za-z0-9_-]{42,44}$/.test(env.NEXUS_VAPID_PRIVATE_KEY||'');
}
export async function sendWebPush(env,subscription,payload){
 if(!pushConfigured(env)||!validSubscription(subscription))return {ok:false,status:0};
 try{
  const {token,publicKey}=vapidJwt(subscription.endpoint,env);
  const response=await fetch(subscription.endpoint,{
   method:'POST',headers:{
    Authorization:`vapid t=${token}, k=${publicKey}`,
    'Content-Type':'application/octet-stream','Content-Encoding':'aes128gcm',
    TTL:'35',Urgency:'high'
   },body:encryptPush(payload,subscription),signal:AbortSignal.timeout(3500)
  });
  return {ok:response.ok,status:response.status};
 }catch{return {ok:false,status:0}}
}
