import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INTERCOM_TALK_MAX_SECONDS,talkExpiry} from '../server/intercom-duration.mjs';
import {intercom} from '../server/intercom.mjs';

test('conversation expires exactly 90 seconds after answered, independent of the 30s ringing timeout',()=>{
 assert.equal(INTERCOM_TALK_MAX_SECONDS,90);
 assert.equal(talkExpiry(1000),1090);
 const server=readFileSync(new URL('../server/intercom.mjs',import.meta.url),'utf8');
 assert.match(server,/const answeredAt=now\(\),expires=talkExpiry\(answeredAt\)/);
 assert.match(server,/created\+30/);
 assert.doesNotMatch(server,/now\(\)\+300/);
});
test('both call screens expose countdown and media controls, and never show a gate opener',()=>{
 const v=readFileSync(new URL('../public/interfone.html',import.meta.url),'utf8');
 const r=readFileSync(new URL('../public/interfone-morador.html',import.meta.url),'utf8');
 const visitor=readFileSync(new URL('../public/interfone.js',import.meta.url),'utf8');
 const resident=readFileSync(new URL('../public/interfone-morador.js',import.meta.url),'utf8');
 for(const id of ['talk-clock','visitor-mute','visitor-camera','visitor-flip'])assert.match(v,new RegExp('id="'+id+'"'));
 for(const id of ['resident-talk-clock','resident-mute','resident-speaker','hangup'])assert.match(r,new RegExp('id="'+id+'"'));
 assert.match(visitor,/startVisitorTimer\(s.expires\)/);
 assert.match(resident,/startResidentTimer\(answerResult.expires\)/);
 assert.ok(resident.includes("await post('calls/'+id+'/hangup'"));
 assert.doesNotMatch(r,/id="open-gate"|id="open-door"/);
});
test('server answer returns the authoritative deadline of a maximum 90-second call',async()=>{
 const n=Math.floor(Date.now()/1000);
 const cid='interfone-piloto',userId='user-test',id='call-one';
 const salt='0'.repeat(32),hash='1'.repeat(64);
 const client={id:cid,name:'Piloto',address:'Fictício',allowInvites:false,retention:30,
  nodes:[],users:[{id:userId,name:'Morador Teste',email:'tester@example.invalid',
   role:'morador',active:true,doors:[],salt,hash}]};
 let answerParams=null;
 const DB={prepare(sql){return{bind(...args){return{
  async first(){
   if(sql.includes('FROM sessions'))return{client_id:cid,user_id:userId};
   if(sql.includes('FROM clients'))return{id:cid,data:JSON.stringify(client)};
   if(sql.includes('FROM intercom_calls'))return{client_id:cid,id,unit_id:'apto-102',status:'ringing',expires:n+30};
   if(sql.includes('FROM intercom_unit_members'))return{id:1};
   if(sql.includes('UPDATE intercom_calls SET status=\'answered\'')){answerParams=args;return{id};}
   return null;
  },
  async run(){return{rowsAffected:1};},
  async all(){return{results:[]};}
 };}}}};
 const response=await intercom(new Request('https://demo.example/api/intercom/calls/'+id+'/answer',{
  method:'POST',headers:{origin:'https://demo.example',cookie:'nexus_session='+('a'.repeat(64))},
  body:'{}'}),{DB,NEXUS_ORIGIN:'https://demo.example'});
 assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 const body=await response.json();
 assert.equal(body.maxTalkSeconds,90);
 assert.equal(body.expires,answerParams[0]+90);
 assert.equal(answerParams[2],body.expires);
});
