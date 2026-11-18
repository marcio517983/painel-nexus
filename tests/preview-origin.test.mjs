import test from 'node:test';
import assert from 'node:assert/strict';
import {nexusOriginAllowed} from '../server/preview-origin.mjs';
const pilot='libsql://nexusmaster-teste-marcio517983.aws-us-east-1.turso.io';
const host='painel-nexus-nexus-q7lxc13rw-controws-iot.vercel.app';
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/interfone-virtual-mvp',
 NEXUS_PREVIEW_SCHEMA_INIT:'1',TURSO_DATABASE_URL:pilot,VERCEL_URL:host,
 NEXUS_ORIGIN:'https://fixed-pilot.example'};
const req=(url,origin,hostHeader=new URL(url).host)=>new Request(url,{method:'POST',headers:{
 Host:hostHeader,...(origin?{Origin:origin}:{})
}});
test('Preview accepts only the actual HTTPS browser Host and matching Origin',()=>{
 assert.equal(nexusOriginAllowed(req('https://'+host+'/api/intercom/public/demo/calls','https://'+host),env),true);
 assert.equal(nexusOriginAllowed(req('https://'+host+'/api/intercom/public/demo/calls','https://evil.example'),env),false);
 assert.equal(nexusOriginAllowed(req('https://other-preview.vercel.app/api/intercom/public/demo/calls','https://other-preview.vercel.app'),env),false);
 assert.equal(nexusOriginAllowed(req('http://'+host+'/api/intercom/public/demo/calls','http://'+host),env),false);
 assert.equal(nexusOriginAllowed(req('https://'+host+'/api/intercom/public/demo/calls','https://'+host+':443'),env),false);
 assert.equal(nexusOriginAllowed(req('https://'+host+'/api/intercom/public/demo/calls','https://'+host,'attacker.vercel.app'),env),false);
 assert.equal(nexusOriginAllowed(req('https://'+host+'/api/intercom/public/demo/calls','https://'+host,'painel-nexus-nexus-other-controws-iot.vercel.app'),env),false);
});
test('Preview accepts real browser origin even when Request.url uses fixed NEXUS_ORIGIN',()=>{
 // api/index.mjs builds Request.url from NEXUS_ORIGIN, but retains the incoming Host.
 const forwarded=req('https://fixed-pilot.example/api/intercom/public/interfone-piloto/calls','https://'+host,host);
 assert.equal(nexusOriginAllowed(forwarded,env),true);
 assert.equal(nexusOriginAllowed(forwarded,{...env,VERCEL_URL:'an-alias.vercel.app'}),true);
});
test('production never allows dynamic origins; wrong Preview branch or DB cannot override configured origin',()=>{
 const input=req('https://fixed-pilot.example/api/intercom/public/demo/calls','https://'+host,host);
 assert.equal(nexusOriginAllowed(input,{...env,VERCEL_ENV:'production'}),false);
 assert.equal(nexusOriginAllowed(input,{...env,VERCEL_GIT_COMMIT_REF:'main'}),false);
 assert.equal(nexusOriginAllowed(input,{...env,TURSO_DATABASE_URL:'libsql://nexus-master-production.turso.io'}),false);
 assert.equal(nexusOriginAllowed(input,{...env,NEXUS_PREVIEW_SCHEMA_INIT:'0'}),false);
});
test('configured origin remains supported and missing Origin is always rejected',()=>{
 assert.equal(nexusOriginAllowed(req('https://fixed-pilot.example/api/auth/login','https://fixed-pilot.example'),env),true);
 assert.equal(nexusOriginAllowed(req('https://'+host+'/api/auth/login',null),env),false);
});
