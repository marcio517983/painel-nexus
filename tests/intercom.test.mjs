import test from 'node:test';
import assert from 'node:assert/strict';
import {intercom,intercomPilotRatePolicy} from '../server/intercom.mjs';

const env={NEXUS_ORIGIN:'https://nexus.example',DB:{}};
test('intercom rejects unsupported methods before database access',async()=>{
 const r=new Request('https://nexus.example/api/intercom/public/demo/units',{method:'DELETE'});
 const result=await intercom(r,env);assert.equal(result.status,405);
});
test('intercom requires same-origin writes',async()=>{
 const r=new Request('https://nexus.example/api/intercom/public/demo/calls',{method:'POST',headers:{Origin:'https://attacker.example'},body:'{}'});
 const result=await intercom(r,env);assert.equal(result.status,403);
});
test('intercom refuses invalid public client IDs before database access',async()=>{
 const r=new Request('https://nexus.example/api/intercom/public/invalid%40id/units');
 const result=await intercom(r,env);assert.equal(result.status,400);
});

test('only isolated Preview uses increased rate allowance',()=>{
 const pilot={VERCEL_ENV:'preview',NEXUS_PREVIEW_SCHEMA_INIT:'1',TURSO_DATABASE_URL:'libsql://nexusmaster-teste-marcio517983.aws-us-east-1.turso.io'};
 assert.deepEqual(intercomPilotRatePolicy(pilot),{pilot:true,limit:20});
 assert.deepEqual(intercomPilotRatePolicy({...pilot,VERCEL_ENV:'production'}),{pilot:false,limit:5});
 assert.deepEqual(intercomPilotRatePolicy({...pilot,TURSO_DATABASE_URL:'libsql://nexus-master-prod.turso.io'}),{pilot:false,limit:5});
 assert.deepEqual(intercomPilotRatePolicy({...pilot,NEXUS_PREVIEW_SCHEMA_INIT:'0'}),{pilot:false,limit:5});
});
