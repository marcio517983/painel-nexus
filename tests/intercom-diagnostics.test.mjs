import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/intercom-diagnostics.js',import.meta.url),'utf8');
function environment(){
 const data=new Map(),elements=new Map();
 const make=id=>({
  textContent:'',handlers:{},
  addEventListener(event,handler){this.handlers[event]=handler;}
 });
 const clipboard=[];
 const window={
  localStorage:{
   getItem:key=>data.get(key)||null,
   setItem:(key,value)=>data.set(key,value)
  },
  document:{querySelector:sel=>{if(!elements.has(sel))elements.set(sel,make(sel));return elements.get(sel);}},
  navigator:{clipboard:{async writeText(text){clipboard.push(text);}}}
 };
 runInNewContext(source,{window,Date,Math,JSON,console});
 return{window,data,elements,clipboard};
}
test('diagnostic log records when the network fails, recovers, and the ending reason',async()=>{
 const {window,data,elements,clipboard}=environment();
 const log=window.NexusCallDiagnostics.create('morador','#log','#copy');
 log.start('somente_audio');
 log.event('chamada_atendida','limite_90s');
 log.event('conexao_estabelecida','webrtc');
 log.event('internet_indisponivel','navigator_offline');
 log.event('conexao_interrompida','webrtc_disconnected');
 log.event('internet_restaurada','navigator_online');
 log.event('conexao_restaurada','8s');
 log.finish('network');
 const saved=JSON.parse(data.get('nexus:intercom:diagnostics:v1'));
 assert.equal(saved.length,1);
 assert.equal(saved[0].reason,'network');
 assert.ok(saved[0].endedAt);
 assert.equal(saved[0].events.at(-1).kind,'encerrada');
 assert.equal(saved[0].events.find(x=>x.kind==='conexao_restaurada').detail,'8s');
 assert.match(elements.get('#log').textContent,/Regra de 15 segundos/);
 assert.match(elements.get('#log').textContent,/Conexão WebRTC recuperada/);
 await elements.get('#copy').handlers.click();
 assert.match(clipboard[0],/NexusMaster/);
 assert.match(elements.get('#copy').textContent,/copiado/);
});
test('diagnostic log never saves camera, audio, GPS coordinates, IP, user names or call tokens',()=>{
 const {window,data}=environment();
 const log=window.NexusCallDiagnostics.create('visitante','#log','#copy');
 log.start('aguardando_30s');
 log.event('internet_indisponivel','navigator_offline');
 log.finish('limit');
 const saved=data.get('nexus:intercom:diagnostics:v1');
 for(const field of ['token','email','latitude','longitude','ip_address','videoData','audioData','callId']){
  assert.equal(saved.includes('"'+field+'"'),false);
 }
 assert.match(saved,/"reason":"limit"/);
});
test('last diagnostic survives reload in storage, is filtered by role and old records expire',()=>{
 const {window,data,elements}=environment();
 const visitor=window.NexusCallDiagnostics.create('visitante','#visitor','#visitor-copy');
 visitor.start();visitor.finish('manual');
 const another=window.NexusCallDiagnostics.create('morador','#resident','#resident-copy');
 another.start();another.finish('network');
 const next=window.NexusCallDiagnostics.create('visitante','#reload','#reload-copy');
 assert.match(next.format(),/Encerrada manualmente neste aparelho/);
 assert.doesNotMatch(next.format(),/Regra de 15 segundos/);
 assert.equal(JSON.parse(data.get('nexus:intercom:diagnostics:v1')).length,2);
 const records=JSON.parse(data.get('nexus:intercom:diagnostics:v1'));
 records[0].startedAt=new Date(Date.now()-60*60*1000*60).toISOString();
 data.set('nexus:intercom:diagnostics:v1',JSON.stringify(records));
 const cleaned=window.NexusCallDiagnostics.create('visitante','#another','#copy');
 assert.match(cleaned.format(),/Nenhum teste registrado/);
 assert.equal(JSON.parse(data.get('nexus:intercom:diagnostics:v1')).length,1);
});
test('both call pages load the privacy-safe diagnostic logger ahead of their call script',()=>{
 for(const file of ['interfone.html','interfone-morador.html']){
  const html=readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
  assert.ok(html.indexOf('src="/intercom-diagnostics.js"')>=0);
  assert.ok(html.indexOf('src="/intercom-diagnostics.js"')<html.indexOf('src="/'+file.replace('.html','.js')+'"'));
  assert.match(html,/reconnect-status/);
  assert.match(html,/diagnostics-copy/);
 }
});
