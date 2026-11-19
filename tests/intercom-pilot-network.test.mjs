import test from 'node:test';
import assert from 'node:assert/strict';
import {
 isPilotNetworkEnv,publicClientIp,pilotNetworkStatus,
 authorizePilotNetwork,revokePilotNetwork,PILOT_NETWORK_SECONDS
} from '../server/intercom-pilot-network.mjs';

const pilot={
 VERCEL_ENV:'preview',
 VERCEL_GIT_COMMIT_REF:'feature/interfone-virtual-mvp',
 NEXUS_PREVIEW_SCHEMA_INIT:'1',
 TURSO_DATABASE_URL:'libsql://nexusmaster-teste-marcio517983.aws-us-east-1.turso.io',
 TURSO_AUTH_TOKEN:'fake-test-secret-not-production-real',
};
const request=(ip)=>new Request('https://nexus.example/api/intercom/public/interfone-piloto/units',{headers:{'x-vercel-forwarded-for':ip}});
function stubEnv(){
 let value=null;
 return {...pilot,DB:{prepare(sql){return{bind(...args){return{
  async first(){
   if(sql.includes('SELECT expires_at FROM intercom_pilot_network_sessions')){
    return value&&value.client_id===args[0]&&value.ip_hash===args[1]&&value.expires_at>args[2]?
     {expires_at:value.expires_at}:null;
   }
   throw Error('unexpected read '+sql);
  },
  async run(){
   if(sql.includes('INSERT INTO intercom_pilot_network_sessions')){
    value={client_id:args[0],ip_hash:args[1],expires_at:args[2],authorized_by:args[3]};return;
   }
   if(sql.includes('DELETE FROM intercom_pilot_network_sessions')){
    if(value&&value.client_id===args[0]&&value.ip_hash===args[1])value=null;return;
   }
   throw Error('unexpected write '+sql);
  }
 };}};}}};
}

test('preview same-network mode is limited to the specific isolated test tenant',()=>{
 assert.equal(PILOT_NETWORK_SECONDS,900);
 assert.equal(isPilotNetworkEnv(pilot,'interfone-piloto'),true);
 assert.equal(isPilotNetworkEnv(pilot,'real-condo'),false);
 assert.equal(isPilotNetworkEnv({...pilot,VERCEL_ENV:'production'},'interfone-piloto'),false);
 assert.equal(isPilotNetworkEnv({...pilot,TURSO_DATABASE_URL:'libsql://real.example'},'interfone-piloto'),false);
 assert.equal(isPilotNetworkEnv({...pilot,VERCEL_GIT_COMMIT_REF:'main'},'interfone-piloto'),false);
 assert.equal(isPilotNetworkEnv({...pilot,NEXUS_PREVIEW_SCHEMA_INIT:'0'},'interfone-piloto'),false);
});
test('visitors must match the resident public IP and authorization expires or can be revoked',async()=>{
 const env=stubEnv();
 const resident=request('198.51.100.16'),visitorSame=request('198.51.100.16'),stranger=request('198.51.100.17');
 const before=await pilotNetworkStatus(env,'interfone-piloto',visitorSame);
 assert.equal(before.allowed,false);
 const activated=await authorizePilotNetwork(env,'interfone-piloto',resident,'apto-102');
 assert.equal(activated.allowed,true);
 assert.ok(activated.expiresAt>Math.floor(Date.now()/1000));
 assert.equal((await pilotNetworkStatus(env,'interfone-piloto',visitorSame)).allowed,true);
 assert.equal((await pilotNetworkStatus(env,'interfone-piloto',stranger)).allowed,false);
 await revokePilotNetwork(env,'interfone-piloto',resident);
 assert.equal((await pilotNetworkStatus(env,'interfone-piloto',visitorSame)).allowed,false);
});
test('request without a well-formed public IP cannot authorize a network test',async()=>{
 const env=stubEnv();
 const missing=request('unknown'),invalid=request('127.0.0.1:54321');
 assert.equal(publicClientIp(missing),null);
 assert.equal(publicClientIp(invalid),null);
 assert.equal((await authorizePilotNetwork(env,'interfone-piloto',missing,'apto-102')).allowed,false);
 assert.equal((await pilotNetworkStatus(env,'interfone-piloto',invalid)).allowed,false);
});
test('production never touches pilot-network tables even if caller requests test',async()=>{
 const production={...pilot,VERCEL_ENV:'production',DB:{prepare(){throw Error('production query not allowed')}}};
 assert.equal((await pilotNetworkStatus(production,'interfone-piloto',request('198.51.100.16'))).allowed,false);
 assert.equal((await authorizePilotNetwork(production,'interfone-piloto',request('198.51.100.16'),'apto-102')).allowed,false);
});
