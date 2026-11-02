import{test}from'node:test';import assert from'node:assert/strict';import{deriveAdminCredentials}from'../public/admin-credentials.js';import{passwordHash}from'../server/auth.mjs';
test('configurador local gera credenciais compatíveis com login Master',async()=>{const password='Senha de teste 12!';const d=await deriveAdminCredentials(password);assert.match(d.salt,/^[a-f0-9]{32}$/);assert.equal(d.hash,await passwordHash(password,d.salt));assert.notEqual(d.salt,(await deriveAdminCredentials(password)).salt);await assert.rejects(()=>deriveAdminCredentials('curta'));});

import {validatePassword} from '../public/password-policy.js';
test('política exige oito caracteres, maiúscula, minúscula e especial, sem exigir número',()=>{for(const p of ['Abcdef!g','Ábcdef!g'])assert.doesNotThrow(()=>validatePassword(p));for(const p of ['Abcde!g','abcdef!g','ABCDEFG!','Abcdefgh','Abcdefg ','Abcdefgá','Ab!'+ 'a'.repeat(254)])assert.throws(()=>validatePassword(p));});
