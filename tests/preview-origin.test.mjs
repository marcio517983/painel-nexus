import test from 'node:test';
import assert from 'node:assert/strict';
import {nexusOriginAllowed} from '../server/preview-origin.mjs';
const pilot='libsql://nexusmaster-teste-marcio517983.aws-us-east-1.turso.io';
const host='painel-nexus-nexus-q7lxc13rw-controws-iot.vercel.app';
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/interfone-virtual-mvp',TURSO_DATABASE_URL:pilot,VERCEL_URL:host,NEXUS_ORIGIN:'https://fixed-pilot.example'};
const req=(url,origin)=>new Request(url,{method:'POST',headers:origin?{Origin:origin}:{}});
test('Preview accepts only same-origin HTTPS requests on its own deployment hostname',()=>{
 assert.equal(nexusOriginAllowed(req('https://'+host+'/api/intercom/public/demo/calls','https://'+host),env),true);
 assert.equal(nexusOriginAllowed(req('https://'+host+'/api/intercom/public/demo/calls','https://evil.example'),env),false);
 assert.equal(nexusOriginAllowed(req('https://other-preview.vercel.app/api/intercom/public/demo/calls','https://other-preview.vercel.app'),env),false);
 assert.equal(nexusOriginAllowed(req('http://'+host+'/api/intercom/public/demo/calls','http://'+host),env),false);
});
test('production never allows dynamic origins; wrong Preview branch or DB cannot override configured origin',()=>{
 const input=req('https://'+host+'/api/auth/login','https://'+host);
 assert.equal(nexusOriginAllowed(input,{...env,VERCEL_ENV:'production'}),false);
 assert.equal(nexusOriginAllowed(input,{...env,VERCEL_GIT_COMMIT_REF:'main'}),false);
 assert.equal(nexusOriginAllowed(input,{...env,TURSO_DATABASE_URL:'libsql://nexus-master-production.turso.io'}),false);
 assert.equal(nexusOriginAllowed(input,{...env,VERCEL_URL:'a-different-deployment.vercel.app'}),false);
 assert.equal(nexusOriginAllowed(input,{...env,VERCEL_URL:undefined}),false);
});
test('configured origin remains supported and missing Origin is always rejected',()=>{
 assert.equal(nexusOriginAllowed(req('https://fixed-pilot.example/api/auth/login','https://fixed-pilot.example'),env),true);
 assert.equal(nexusOriginAllowed(req('https://'+host+'/api/auth/login',null),env),false);
});
