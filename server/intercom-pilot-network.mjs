/**
 * Temporary same-public-IP intercom test for the isolated, fictional Preview pilot.
 * Matching public addresses DOES NOT establish physical proximity or prove Wi-Fi.
 * Production always keeps the 20 m GPS restriction.
 */
import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {query,now} from './auth.mjs';

export const PILOT_NETWORK_SECONDS=15*60;
export function isPilotNetworkEnv(env,cid){
 return cid==='interfone-piloto'&&
  env.VERCEL_ENV==='preview'&&
  env.NEXUS_PREVIEW_SCHEMA_INIT==='1'&&
  env.TURSO_DATABASE_URL==='libsql://nexusmaster-teste-marcio517983.aws-us-east-1.turso.io'&&
  typeof env.TURSO_AUTH_TOKEN==='string'&&env.TURSO_AUTH_TOKEN.length>20&&
  (!env.VERCEL_GIT_COMMIT_REF||env.VERCEL_GIT_COMMIT_REF==='feature/interfone-virtual-mvp');
}
export function publicClientIp(r){
 // Vercel's forwarding header takes precedence over the general proxy header.
 const raw=(r.headers.get('x-vercel-forwarded-for')||r.headers.get('x-forwarded-for')||'').split(',')[0].trim();
 const address=raw.startsWith('::ffff:')?raw.slice(7):raw;
 return isIP(address)?address:null;
}
function networkHash(env,r){
 const ip=publicClientIp(r);
 if(!ip)return null;
 return createHmac('sha256',env.TURSO_AUTH_TOKEN)
  .update('nexusmaster:pilot-network:v1:'+ip).digest('hex');
}
export async function pilotNetworkStatus(env,cid,r){
 if(!isPilotNetworkEnv(env,cid))return {supported:false,allowed:false,expiresAt:null};
 const hash=networkHash(env,r);
 if(!hash)return {supported:true,allowed:false,expiresAt:null};
 const row=await query(env,
  'SELECT expires_at FROM intercom_pilot_network_sessions WHERE client_id=? AND ip_hash=? AND expires_at>?',
  cid,hash,now()).first();
 return {supported:true,allowed:!!row,expiresAt:row?Number(row.expires_at):null};
}
export async function authorizePilotNetwork(env,cid,r,actor){
 if(!isPilotNetworkEnv(env,cid))return {supported:false,allowed:false,expiresAt:null};
 const hash=networkHash(env,r);
 if(!hash)return {supported:true,allowed:false,expiresAt:null};
 const expiresAt=now()+PILOT_NETWORK_SECONDS;
 await query(env,`INSERT INTO intercom_pilot_network_sessions(client_id,ip_hash,expires_at,authorized_by,created_at)
 VALUES(?,?,?,?,?)
 ON CONFLICT(client_id) DO UPDATE SET ip_hash=excluded.ip_hash,expires_at=excluded.expires_at,
 authorized_by=excluded.authorized_by,created_at=excluded.created_at`,
  cid,hash,expiresAt,actor,now()).run();
 return {supported:true,allowed:true,expiresAt};
}
export async function revokePilotNetwork(env,cid,r){
 const active=await pilotNetworkStatus(env,cid,r);
 if(!active.supported)return active;
 const hash=networkHash(env,r);
 if(hash)await query(env,'DELETE FROM intercom_pilot_network_sessions WHERE client_id=? AND ip_hash=?',cid,hash).run();
 return {supported:true,allowed:false,expiresAt:null};
}
