import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCpf,vehicleData} from '../server/invites.mjs';
test('CPF aceita máscara e confere ambos os dígitos, sem aceitar caracteres ou sequências inválidas',()=>{
 assert.equal(normalizeCpf('529.982.247-25'),'52998224725');
 assert.equal(normalizeCpf('11144477735'),'11144477735');
 for(const value of ['52998224724','11111111111','00000000000','123','cpf52998224725',52998224725,null,'9'.repeat(100)])assert.equal(normalizeCpf(value),null);
});
test('veículo normaliza placa antiga e Mercosul e limita os textos',()=>{
 assert.deepEqual(vehicleData({model:' Fiat Argo ',plate:'abc-1234',color:' Prata '}),{model:'Fiat Argo',plate:'ABC1234',color:'Prata'});
 assert.equal(vehicleData({model:'Fiat Argo',plate:'abc1d23',color:'Prata'}).plate,'ABC1D23');
 for(const value of [null,{}, {model:'Argo',plate:'INVALID',color:'Prata'}, {model:'Argo',plate:'ABC1234',color:''},{model:'x'.repeat(61),plate:'ABC1234',color:'Prata'}])assert.equal(vehicleData(value),null);
});
