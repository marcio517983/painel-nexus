import test from 'node:test';
import assert from 'node:assert/strict';
import {intercom} from '../server/intercom.mjs';

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
