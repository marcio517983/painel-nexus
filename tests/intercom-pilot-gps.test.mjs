import test from 'node:test';
import assert from 'node:assert/strict';
import {pilotGpsBypass} from '../server/intercom-pilot-gps.mjs';
import {intercom} from '../server/intercom.mjs';
const config={
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/interfone-virtual-mvp',
 NEXUS_PREVIEW_SCHEMA_INIT:'1',
 TURSO_DATABASE_URL:'libsql://nexusmaster-teste-marcio517983.aws-us-east-1.turso.io',
 TURSO_AUTH_TOKEN:'fictional-token-not-for-production-12345',
 NEXUS_ORIGIN:'https://nexus.example',
 NEXUS_PILOT_GPS_BYPASS_UNTIL:'2026-11-25T03:00:00.000Z'
};
const at=Date.parse('2026-11-18T20:00:00.000Z');
test('pilot GPS bypass is opt-in, time-limited, preview-only, and single tenant',()=>{
 assert.equal(pilotGpsBypass(config,'interfone-piloto',at).enabled,true);
 for(const env of [
  {...config,VERCEL_ENV:'production'},
  {...config,VERCEL_GIT_COMMIT_REF:'main'},
  {...config,NEXUS_PREVIEW_SCHEMA_INIT:'0'},
  {...config,TURSO_DATABASE_URL:'libsql://nexus-master-prod.turso.io'},
  {...config,NEXUS_PILOT_GPS_BYPASS_UNTIL:''},
  {...config,NEXUS_PILOT_GPS_BYPASS_UNTIL:'2030-01-01T03:00:00Z'}
 ])assert.equal(pilotGpsBypass(env,'interfone-piloto',at).enabled,false);
 assert.equal(pilotGpsBypass(config,'other-tenant',at).enabled,false);
 assert.equal(pilotGpsBypass(config,'interfone-piloto',Date.parse(config.NEXUS_PILOT_GPS_BYPASS_UNTIL)).enabled,false);
});
function mockDB(){
 const queries=[],calls=[];
 return{queries,calls,prepare(sql){
  return{bind(...args){
   return{
    async first(){
     queries.push({sql,args});
     if(sql.includes('FROM clients'))return{data:JSON.stringify({name:'Condomínio Piloto NexusMaster'})};
     if(sql.includes('FROM intercom_units'))return{id:'apto-102',label:'Apartamento 102'};
     if(sql.includes('intercom_rate_limits')&&sql.includes('RETURNING'))return{n:1};
     if(sql.includes('FROM intercom_calls'))return null;
     if(sql.includes('FROM intercom_entrances'))return null;
     return null;
    },
    async all(){queries.push({sql,args});if(sql.includes('FROM intercom_units'))return{results:[{id:'apto-102',label:'Apartamento 102'}]};return{results:[]}},
    async run(){queries.push({sql,args});if(sql.startsWith('INSERT INTO intercom_calls'))calls.push(args);return{rowsAffected:1};}
   };
  }};
 }};
}
test('fictional preview visitor can call without geolocation while production never can',async()=>{
 const DB=mockDB(),env={...config,DB};const url='https://nexus.example/api/intercom/public/interfone-piloto/';
 const units=await intercom(new Request(url+'units'),env);
 assert.equal(units.status,200);
 const unitJson=await units.json();
 assert.equal(unitJson.pilotGpsTestEnabled,true);
 assert.equal(unitJson.locationRequired,false);
 const result=await intercom(new Request(url+'calls',{method:'POST',headers:{origin:'https://nexus.example','content-type':'application/json'},
 body:JSON.stringify({unitId:'apto-102',reason:'visita'})}),env);
 assert.equal(result.status,201);
 assert.equal(DB.calls.length,1);
 const production=await intercom(new Request(url+'calls',{method:'POST',headers:{origin:'https://nexus.example','content-type':'application/json'},
 body:JSON.stringify({unitId:'apto-102',reason:'visita'})}),{...env,VERCEL_ENV:'production',DB:mockDB()});
 assert.equal(production.status,409,'GPS remains required when entrance is not configured in production');
});

test('realistic Vercel preview visitor POST reaches call creation despite fixed API base URL',async()=>{
 const host='painel-nexus-nexus-k8n55hoyh-controws-iot.vercel.app';
 // api/index.mjs uses NEXUS_ORIGIN as Request.url base but forwards the real
 // browser Host and Origin headers from Vercel.
 const url='https://nexus.example/api/intercom/public/interfone-piloto/calls';
 const payload=JSON.stringify({unitId:'apto-102',reason:'visita'});
 const fake=mockDB();
 const req=new Request(url,{method:'POST',headers:{
  host,origin:'https://'+host,'content-type':'application/json'
 },body:payload});
 const response=await intercom(req,{...config,DB:fake});
 assert.equal(response.status,201,JSON.stringify(await response.clone().json()));
 assert.equal(fake.calls.length,1);
 const attack=await intercom(new Request(url,{method:'POST',headers:{
  host,origin:'https://evil.example','content-type':'application/json'
 },body:payload}),{...config,DB:mockDB()});
 assert.equal(attack.status,403);
 assert.equal((await attack.json()).message,'Origem inválida');
});
