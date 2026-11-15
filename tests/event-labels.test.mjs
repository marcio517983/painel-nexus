import {test} from 'node:test';
import assert from 'node:assert/strict';
import {labelEvent} from '../server/event-labels.mjs';
const uid='11111111-1111-4111-8111-111111111111',nid='22222222-2222-4222-8222-222222222222';
const client={users:[{id:uid,name:'Ana Silva',email:'ana@example.test',active:false}],nodes:[{id:nid,name:'Portão Veículo'}]};
test('histórico antigo resolve pessoa e portão, incluindo cadastro desativado, sem alterar auditoria',()=>{
 const row={actor:'resident:'+uid,device:nid,at:1794762204,action:'Execucao',result:'Pulso concluído'};
 const out=labelEvent(row,client);
 assert.equal(out.actorName,'Ana Silva');assert.equal(out.deviceName,'Portão Veículo');
 for(const key of Object.keys(row))assert.equal(out[key],row[key]);assert.equal(row.actorName,undefined);
});
test('resolve identidade local e e-mail do próprio cliente; Master identificado pelo e-mail configurado',()=>{
 assert.equal(labelEvent({actor:uid},client).actorName,'Ana Silva');
 assert.equal(labelEvent({actor:'ANA@example.test'},client).actorName,'Ana Silva');
 assert.equal(labelEvent({actor:'admin@example.test'},client,'admin@example.test').actorName,'Master');
 assert.equal(labelEvent({actor:'Central',device:'Cliente'},client).actorName,'Central');
});
test('não procura nomes em outro cliente e não exibe IDs desconhecidos como nomes',()=>{
 const out=labelEvent({actor:'resident:'+uid,device:nid},{users:[],nodes:[]});
 assert.equal(out.actorName,'Pessoa não identificada');assert.equal(out.deviceName,'Acesso não identificado');
});
