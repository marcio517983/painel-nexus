import {test} from 'node:test';import assert from 'node:assert/strict';import{DatabaseSync}from'node:sqlite';import{readFileSync}from'node:fs';import{handle}from'../server/core.mjs';import{application}from'../server/application.mjs';import{passwordHash}from'../server/auth.mjs';
function env(){const sqlite=new DatabaseSync(':memory:');for(const n of ['001','002','003','004'])sqlite.exec(readFileSync(new URL('../migrations/'+n+'.sql',import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));return {sqlite,DB:{prepare(sql){return{bind(...args){return{async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return{results:sqlite.prepare(sql).all(...args)};},async run(){return sqlite.prepare(sql).run(...args);}};}};}},BUCKET:{async put(){},async get(){return null;}},SITE_SERVICE_TOKEN:'test-service-only'};}
async function call(env,path,method='GET',body,headers={}){const r=await handle(new Request('https://nexus.test/api/v1'+path,{method,headers:{'Origin':'https://nexus.test','oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test','Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env);return{status:r.status,data:await r.json()};}
async function client(env){const r=await call(env,'/clients','POST',{name:'Bancada',address:'Teste'});assert.equal(r.status,201);return r.data;}
async function poll(env,c,b={}){return call(env,'/gateway/poll','POST',{applied:1,nodes:[],...b},{'X-Gateway-Id':c.client.id,Authorization:'Bearer '+c.gatewayToken});}
async function setup(){const e=env();e.sqlite.exec(readFileSync(new URL('../migrations/002.sql',import.meta.url),'utf8'));Object.assign(e,{NEXUS_ORIGIN:'https://nexus.test',NEXUS_ADMIN_EMAIL:'admin@example.test',NEXUS_ADMIN_SALT:'a'.repeat(32),NEXUS_ADMIN_HASH:await passwordHash('master-password-test','a'.repeat(32))});return e;}
async function app(e,path,method='GET',body,cookie='',extra={}){const r=await application(new Request('https://nexus.test'+path,{method,headers:{Origin:'https://nexus.test','Content-Type':'application/json',cookie,...extra},body:body===undefined?undefined:JSON.stringify(body)}),e);return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function master(e){const r=await app(e,'/api/auth/login','POST',{email:'admin@example.test',password:'master-password-test'});assert.equal(r.status,200);return r.cookie;}
async function populated(e,cookie){const c=(await app(e,'/api/v1/clients','POST',{name:'Araras',address:'Teste'},cookie)).data.client;for(const [name,type,board,accessKind,mac]of [['Portão de veículos','gate','esp32-devkit','veiculos','AA:BB:CC:DD:EE:01'],['Porta do hall','gate','esp32-devkit','hall','AA:BB:CC:DD:EE:02'],['Caixa de água','water','esp32-devkit','agua','AA:BB:CC:DD:EE:03']])assert.equal((await app(e,'/api/v1/clients/'+c.id+'/nodes','POST',{name,type,board,accessKind,mac},cookie)).status,200);const cfg=(await app(e,'/api/v1/clients','GET',undefined,cookie)).data.clients[0];for(const[email,role]of[['m@example.test','morador'],['s@example.test','sindico']])assert.equal((await app(e,'/api/v1/clients/'+c.id+'/users','POST',{name:role,email,role,salt:'b'.repeat(32),hash:await passwordHash('resident-test-password','b'.repeat(32)),doors:[cfg.nodes[0].id]},cookie)).status,200);return cfg;}
async function member(e,c,email){const r=await app(e,'/api/auth/login','POST',{email,password:'resident-test-password',central:c.id});assert.equal(r.status,200);return r.cookie;}
test('login próprio, bloqueio de headers forjados, origem, limite de tentativas e logout',async()=>{const e=await setup();assert.equal((await app(e,'/api/v1/clients','GET',undefined,'',{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'admin@example.test'})).status,401);assert.equal((await app(e,'/api/auth/login','POST',{},'',{Origin:'https://evil.test'})).status,403);const cookie=await master(e);assert.equal((await app(e,'/api/v1/clients','GET',undefined,cookie)).status,200);assert.equal((await app(e,'/api/auth/logout','POST',{},cookie)).status,200);assert.equal((await app(e,'/api/auth/me','GET',undefined,cookie)).status,401);for(let i=0;i<10;i++)assert.equal((await app(e,'/api/auth/login','POST',{email:'wrong@test',password:'wrong'})).status,401);assert.equal((await app(e,'/api/auth/login','POST',{email:'wrong@test',password:'wrong'})).status,429);});
test('síndico isolado por condomínio e sem promoção de perfil; morador sem histórico nem cadastros',async()=>{const e=await setup(),owner=await master(e),c=await populated(e,owner),s=await member(e,c,'s@example.test'),m=await member(e,c,'m@example.test');const other=(await app(e,'/api/v1/clients','POST',{name:'Outro',address:'Outro'},owner)).data.client;assert.deepEqual((await app(e,'/api/v1/clients','GET',undefined,s)).data.clients.map(c=>c.id),[c.id]);assert.equal((await app(e,'/api/v1/clients/'+other.id+'/events','GET',undefined,s)).status,403);assert.equal((await app(e,'/api/v1/clients/'+c.id+'/users','POST',{role:'sindico'},s)).status,403);assert.equal((await app(e,'/api/resident/logs?central='+c.id,'GET',undefined,m)).status,403);assert.equal((await app(e,'/api/v1/clients','GET',undefined,m)).status,403);assert.equal((await app(e,'/api/resident/dashboard?central='+c.id,'GET',undefined,m)).data.devices.length,1);assert.equal((await app(e,'/api/resident/dashboard?central='+other.id,'GET',undefined,m)).status,403);const d=(await app(e,'/api/resident/dashboard?central='+c.id,'GET',undefined,s)).data;assert.equal(d.devices.length,2);assert.equal(d.water.length,1);});
test('convite temporário só herda portas autorizadas e revogação bloqueia sessão e comando pendente',async()=>{const e=await setup(),owner=await master(e),c=await populated(e,owner),m=await member(e,c,'m@example.test'),route='/api/resident/invites?central='+c.id;const expires=Math.floor(Date.now()/1000)+3600;assert.equal((await app(e,route,'POST',{name:'Guest',cpf:'52998224725',expires,doors:[c.nodes[1].id]},m)).status,403);const invite=await app(e,route,'POST',{name:'Guest',cpf:'52998224725',expires,doors:[c.nodes[0].id]},m);assert.equal(invite.status,201);const v=await app(e,'/api/auth/invite','POST',{token:invite.data.url.split('#')[1],central:c.id,cpf:'529.982.247-25',vehicle:{model:'Fiat Argo',plate:'ABC1D23',color:'Prata'}});assert.equal(v.status,200);assert.equal((await app(e,route,'GET',undefined,v.cookie)).status,403);assert.equal((await app(e,'/api/resident/dashboard?central='+c.id,'GET',undefined,v.cookie)).data.devices.length,1);assert.equal((await app(e,'/api/resident/logs?central='+c.id,'GET',undefined,v.cookie)).status,403);await app(e,'/api/resident/invites/'+invite.data.id+'?central='+c.id,'DELETE',undefined,m);assert.equal((await app(e,'/api/auth/me','GET',undefined,v.cookie)).status,401);assert.equal((await app(e,'/api/auth/invite','POST',{token:invite.data.url.split('#')[1],central:c.id})).status,403);});
test('troca de senha encerra sessões existentes',async()=>{const e=await setup(),owner=await master(e),c=await populated(e,owner),m=await member(e,c,'m@example.test');const stored=JSON.parse(e.sqlite.prepare('SELECT data FROM clients WHERE id=?').get(c.id).data),u=stored.users[0];assert.equal((await app(e,'/api/v1/clients/'+c.id+'/users/'+u.id,'PATCH',{salt:'c'.repeat(32),hash:await passwordHash('replacement-password','c'.repeat(32))},owner)).status,200);assert.equal((await app(e,'/api/auth/me','GET',undefined,m)).status,401);assert.equal((await app(e,'/api/auth/login','POST',{email:u.email,password:'resident-test-password',central:c.id})).status,401);});

test('revogação do anfitrião impede entrega de pulso de visitante e ciclos são preservados',async()=>{
 const e=await setup(),owner=await master(e),c=await populated(e,owner),m=await member(e,c,'m@example.test');
 const visitor=await app(e,'/api/resident/invites?central='+c.id,'POST',{name:'Guest',cpf:'52998224725',expires:Math.floor(Date.now()/1000)+3600,doors:[c.nodes[0].id]},m);
 const v=await app(e,'/api/auth/invite','POST',{token:visitor.data.url.split('#')[1],central:c.id,cpf:'52998224725',vehicle:{model:'Fiat Argo',plate:'ABC1234',color:'Prata'}});
 const gateway={client:c,gatewayToken:'test-gateway-token'};e.sqlite.prepare('UPDATE clients SET token_hash=? WHERE id=?').run((await import('../server/auth.mjs')).digest(gateway.gatewayToken),c.id);
 const nodes=c.nodes.map(n=>({id:n.id,online:true,state:0,cycles:3,runtimeSeconds:7200}));await poll(e,gateway,{nodes});
 const cmd=await app(e,'/api/resident/commands?central='+c.id,'POST',{deviceId:c.nodes[0].id,requestId:crypto.randomUUID()},v.cookie);assert.equal(cmd.status,202);
 const cfg=JSON.parse(e.sqlite.prepare('SELECT data FROM clients WHERE id=?').get(c.id).data),parent=cfg.users.find(u=>u.email==='m@example.test');
 assert.equal((await app(e,'/api/v1/clients/'+c.id+'/users/'+parent.id,'PATCH',{active:false},owner)).status,200);
 assert.equal((await poll(e,gateway,{nodes})).data.commands.length,0);assert.equal(e.sqlite.prepare('SELECT status FROM commands WHERE id=?').get(cmd.data.commandId).status,'failed');
 const telemetry=JSON.parse(e.sqlite.prepare('SELECT telemetry FROM clients WHERE id=?').get(c.id).telemetry);assert.equal(telemetry.nodes[2].cycles,3);assert.equal(telemetry.nodes[2].runtimeSeconds,7200);
});

test('somente Master renova chave preservando cadastros e invalida chave anterior',async()=>{
 const e=await setup(),owner=await master(e),c=await populated(e,owner),cid=c.id;
 const oldKey='fixture-old-gateway-key';e.sqlite.prepare('UPDATE clients SET token_hash=? WHERE id=?').run((await import('../server/auth.mjs')).digest(oldKey),cid);
 const queued=crypto.randomUUID(),sent=crypto.randomUUID();for(const [id,status] of [[queued,'queued'],[sent,'sent']])e.sqlite.prepare('INSERT INTO commands VALUES(?,?,?,?,?,?,?,?)').run(id,cid,c.nodes[0].id,'Master',1,9999999999,status,'');
 const before=e.sqlite.prepare('SELECT * FROM clients WHERE id=?').get(cid);
 const syndic=await member(e,c,'s@example.test');
 assert.equal((await app(e,'/api/v1/clients/'+cid+'/credentials','POST',{confirm:true},syndic)).status,403);
 assert.equal((await app(e,'/api/v1/clients/'+cid+'/credentials','POST',{confirm:true})).status,401);
 assert.equal((await app(e,'/api/v1/clients/'+cid+'/credentials','POST',{},owner)).status,400);
 const result=await app(e,'/api/v1/clients/'+cid+'/credentials','POST',{confirm:true},owner);
 assert.equal(result.status,200);assert.equal(result.data.gatewayId,cid);assert.equal(result.data.cloudUrl,e.NEXUS_ORIGIN);assert.match(result.data.gatewayToken,/^[a-f0-9]{64}$/);
 const after=e.sqlite.prepare('SELECT * FROM clients WHERE id=?').get(cid);
 assert.equal(after.data,before.data);assert.equal(after.revision,before.revision);assert.notEqual(after.token_hash,before.token_hash);assert.equal(after.seen,0);assert.equal(after.applied,0);
 assert.equal(e.sqlite.prepare('SELECT status FROM commands WHERE id=?').get(queued).status,'failed');assert.equal(e.sqlite.prepare('SELECT status FROM commands WHERE id=?').get(sent).status,'unknown');
 assert.equal((await app(e,'/api/v1/gateway/poll','POST',{nodes:[]},'',{'X-Gateway-Id':cid,Authorization:'Bearer '+oldKey})).status,401);
 assert.equal((await app(e,'/api/v1/gateway/poll','POST',{nodes:[]},'',{'X-Gateway-Id':cid,Authorization:'Bearer '+result.data.gatewayToken})).status,200);
 assert.equal(JSON.stringify((await app(e,'/api/v1/clients','GET',undefined,owner)).data).includes(result.data.gatewayToken),false);
});

test('Master e síndico recebem nomes nos eventos antigos, preservando IDs e isolamento',async()=>{
 const e=await setup(),owner=await master(e),c=await populated(e,owner);
 const stored=JSON.parse(e.sqlite.prepare('SELECT data FROM clients WHERE id=?').get(c.id).data),u=stored.users.find(u=>u.role==='morador');
 const eid=crypto.randomUUID(),at=Math.floor(Date.now()/1000);
 e.sqlite.prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?)').run(eid,c.id,at,'resident:'+u.id,'Execucao',c.nodes[0].id,'Pulso concluído');
 const masterEvents=await app(e,'/api/v1/clients/'+c.id+'/events','GET',undefined,owner);
 assert.equal(masterEvents.status,200);const row=masterEvents.data.events.find(x=>x.id===eid);
 assert.equal(row.actorName,u.name);assert.equal(row.deviceName,c.nodes[0].name);assert.equal(row.at,at);assert.equal(row.actor,'resident:'+u.id);
 const s=await member(e,c,'s@example.test');
 const logs=await app(e,'/api/resident/logs?central='+c.id,'GET',undefined,s);
 assert.equal(logs.status,200);assert.ok(logs.data.events.some(x=>x.actorName===u.name&&x.deviceName===c.nodes[0].name));
 const raw=e.sqlite.prepare('SELECT actor,device FROM events WHERE id=?').get(eid);
 assert.equal(raw.actor,'resident:'+u.id);assert.equal(raw.device,c.nodes[0].id);
});

const cpfFixture='52998224725',carFixture={model:'Fiat Argo',plate:'ABC1D23',color:'Prata'};
async function invitationFixture({pedestrian=false}={}){
 const e=await setup(),owner=await master(e),c=await populated(e,owner),m=await member(e,c,'m@example.test');
 const s=await member(e,c,'s@example.test'),door=c.nodes[pedestrian?1:0].id,route='/api/resident/invites?central='+c.id;
 const payload={name:'Visitante de teste',cpf:cpfFixture,expires:Math.floor(Date.now()/1000)+3600,doors:[door]};
 const invited=await app(e,route,'POST',payload,pedestrian?s:m);assert.equal(invited.status,201);
 return {e,owner,c,m,s,route,payload,invited,credentials:{token:invited.data.url.split('#')[1],central:c.id,cpf:cpfFixture}};
}
test('convite exige CPF válido, não libera sessão antes da conferência e guarda veículo fora da central',async()=>{
 const f=await invitationFixture(),{e,c,m,route,payload,credentials,invited}=f;
 for(const cpf of [undefined,'11111111111','52998224724'])assert.equal((await app(e,route,'POST',{...payload,cpf},m)).status,400);
 const missing=await app(e,'/api/auth/invite','POST',{...credentials,cpf:undefined});assert.equal(missing.status,403);assert.equal(missing.cookie,undefined);
 const wrong=await app(e,'/api/auth/invite','POST',{...credentials,cpf:'11144477735'});assert.equal(wrong.status,403);assert.equal(wrong.cookie,undefined);
 const checked=await app(e,'/api/auth/invite/check','POST',credentials);assert.deepEqual(checked.data,{vehicleRequired:true,needsVehicle:true,expires:payload.expires});assert.equal(checked.cookie,undefined);
 assert.equal((await app(e,'/api/auth/invite','POST',credentials)).status,400);
 assert.equal((await app(e,'/api/auth/invite','POST',{...credentials,vehicle:{...carFixture,plate:'bad'}})).status,400);
 const accepted=await app(e,'/api/auth/invite','POST',{...credentials,vehicle:carFixture});assert.equal(accepted.status,200);assert.ok(accepted.cookie);
 assert.equal((await app(e,'/api/auth/me','GET',undefined,accepted.cookie)).status,200);
 const stored=e.sqlite.prepare('SELECT data FROM clients WHERE id=?').get(c.id).data;
 for(const secret of [cpfFixture,credentials.token,'ABC1D23','cpf_hash'])assert.equal(stored.includes(secret),false);
 const privateRow=e.sqlite.prepare('SELECT * FROM invite_details WHERE user_id=?').get(invited.data.id);
 assert.notEqual(privateRow.cpf_hash,cpfFixture);assert.equal(JSON.parse(privateRow.vehicle).plate,'ABC1D23');
 assert.equal(JSON.stringify((await app(e,route,'GET',undefined,m)).data).includes(privateRow.cpf_hash),false);
 assert.deepEqual((await app(e,route,'GET',undefined,m)).data.invites[0].vehicle,carFixture);
 // The same visitor can return with CPF and link without entering the vehicle again.
 assert.equal((await app(e,'/api/auth/invite/check','POST',credentials)).data.needsVehicle,false);
 const before=e.sqlite.prepare('SELECT revision FROM clients WHERE id=?').get(c.id).revision;
 assert.equal((await app(e,'/api/auth/invite','POST',credentials)).status,200);
 assert.equal(e.sqlite.prepare('SELECT revision FROM clients WHERE id=?').get(c.id).revision,before);
 assert.equal(JSON.stringify(e.sqlite.prepare('SELECT * FROM events').all()).includes(cpfFixture),false);
});
test('pedestre confirma somente CPF, sem cadastro de veículo',async()=>{
 const {e,credentials,s,route}=await invitationFixture({pedestrian:true});
 assert.equal((await app(e,'/api/auth/invite/check','POST',credentials)).data.needsVehicle,false);
 assert.equal((await app(e,'/api/auth/invite','POST',credentials)).status,200);
 assert.equal((await app(e,route,'GET',undefined,s)).data.invites[0].vehicle,null);
});
test('cinco falhas bloqueiam o convite por 15 minutos, inclusive com rotação de IP',async()=>{
 const {e,credentials}=await invitationFixture();
 for(let i=0;i<5;i++)assert.equal((await app(e,'/api/auth/invite/check','POST',{...credentials,cpf:'11144477735'},'',{'x-forwarded-for':'192.0.2.'+i})).status,403);
 assert.equal((await app(e,'/api/auth/invite','POST',{...credentials,vehicle:carFixture})).status,429);
 e.sqlite.prepare('UPDATE login_limits SET expires=? WHERE key LIKE ?').run(Math.floor(Date.now()/1000)-1,'invite:%');
 assert.equal((await app(e,'/api/auth/invite','POST',{...credentials,vehicle:carFixture})).status,200);
});
test('link de outra central, validade e revogação são conferidos também no passo do veículo',async()=>{
 const {e,owner,c,m,credentials,invited}=await invitationFixture();
 const other=(await app(e,'/api/v1/clients','POST',{name:'Outro cliente',address:'Outra rua'},owner)).data.client;
 assert.equal((await app(e,'/api/auth/invite','POST',{...credentials,central:other.id,vehicle:carFixture})).status,403);
 assert.equal((await app(e,'/api/auth/invite/check','POST',credentials)).status,200);
 await app(e,'/api/resident/invites/'+invited.data.id+'?central='+c.id,'DELETE',undefined,m);
 assert.equal((await app(e,'/api/auth/invite','POST',{...credentials,vehicle:carFixture})).status,403);
 const cfg=JSON.parse(e.sqlite.prepare('SELECT data FROM clients WHERE id=?').get(c.id).data),v=cfg.users.find(v=>v.id===invited.data.id);v.active=true;v.expires=Math.floor(Date.now()/1000)-1;
 e.sqlite.prepare('UPDATE clients SET data=? WHERE id=?').run(JSON.stringify(cfg),c.id);
 assert.equal((await app(e,'/api/auth/invite/check','POST',credentials)).status,403);
});
test('convite pendente e links antigos não autorizam sessão nem entrega de comando',async()=>{
 const {e,c,credentials,invited}=await invitationFixture();
 const {session}=await import('../server/auth.mjs');
 const cfg=JSON.parse(e.sqlite.prepare('SELECT data FROM clients WHERE id=?').get(c.id).data),v=cfg.users.find(v=>v.id===invited.data.id);
 const cookie=(await session(e,{...v,clientId:c.id})).split(';')[0];
 assert.equal((await app(e,'/api/auth/me','GET',undefined,cookie)).status,401);
 const queued=crypto.randomUUID();e.sqlite.prepare('INSERT INTO commands VALUES(?,?,?,?,?,?,?,?)').run(queued,c.id,c.nodes[0].id,'resident:'+v.id,Math.floor(Date.now()/1000),Math.floor(Date.now()/1000)+8,'queued','');
 const key='gateway-for-pending-test';e.sqlite.prepare('UPDATE clients SET token_hash=? WHERE id=?').run((await import('../server/auth.mjs')).digest(key),c.id);
 assert.equal((await poll(e,{client:c,gatewayToken:key},{nodes:c.nodes.map(n=>({id:n.id,online:true}))})).data.commands.length,0);
 delete v.inviteVerified;e.sqlite.prepare('UPDATE clients SET data=? WHERE id=?').run(JSON.stringify(cfg),c.id);
 assert.equal((await app(e,'/api/auth/invite','POST',{...credentials,vehicle:carFixture})).status,403);
 assert.equal((await app(e,'/api/auth/me','GET',undefined,cookie)).status,401);
});
test('dados do veículo ficam restritos ao anfitrião e síndico; origem e corpo inválidos não autenticam',async()=>{
 const {e,owner,c,m,s,route,credentials}=await invitationFixture();
 assert.equal((await app(e,'/api/auth/invite','POST',{...credentials,vehicle:carFixture},'',{Origin:'https://evil.test'})).status,403);
 assert.equal((await app(e,'/api/auth/invite','POST',null)).status,403);
 assert.equal((await app(e,'/api/auth/invite','POST',{...credentials,vehicle:{model:'x'.repeat(3000)}})).status,400);
 await app(e,'/api/auth/invite','POST',{...credentials,vehicle:carFixture});
 assert.equal((await app(e,'/api/v1/clients/'+c.id+'/users','POST',{name:'Outro morador',email:'other@example.test',role:'morador',salt:'b'.repeat(32),hash:await passwordHash('resident-test-password','b'.repeat(32)),doors:[c.nodes[0].id]},owner)).status,200);
 const another=await member(e,c,'other@example.test');
 assert.deepEqual((await app(e,route,'GET',undefined,another)).data.invites,[]);
 for(const cookie of [m,s])assert.equal((await app(e,route,'GET',undefined,cookie)).data.invites[0].vehicle.plate,'ABC1D23');
});
