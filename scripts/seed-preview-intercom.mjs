// Idempotent, fictional-only pilot data. This script MUST NOT be used for production.
import {createHash, randomBytes} from 'node:crypto';
export async function seedPreviewIntercom(db){
 const allowed=process.env.VERCEL_ENV==='preview'
  &&process.env.NEXUS_PREVIEW_SCHEMA_INIT==='1'
  &&process.env.VERCEL_GIT_COMMIT_REF==='feature/interfone-virtual-mvp'
  &&process.env.TURSO_DATABASE_URL==='libsql://nexusmaster-teste-marcio517983.aws-us-east-1.turso.io';
 if(!allowed)throw Error('Cadastro piloto bloqueado: ambiente ou banco não autorizado.');
 const salt=process.env.NEXUS_TEST_RESIDENT_SALT,hash=process.env.NEXUS_TEST_RESIDENT_HASH;
 if(!/^[0-9a-f]{32}$/.test(salt||'')||!/^[0-9a-f]{64}$/.test(hash||''))throw Error('Credenciais do morador fictício ausentes ou inválidas.');
 const cid='interfone-piloto',userId='morador-piloto',unitId='apto-102';
 const existing=await db.execute({sql:'SELECT id FROM clients WHERE id=?',args:[cid]});
 if(!existing.rows.length){
  const data={
   id:cid,name:'Condomínio Piloto NexusMaster',
   address:'Ambiente de testes sem endereço físico',retention:30,allowInvites:false,
   nodes:[],users:[{id:userId,name:'Morador de Teste',email:'morador.piloto@nexusmaster.invalid',
    role:'morador',active:true,doors:[],salt,hash}]
  };
  const gatewayHash=createHash('sha256').update(randomBytes(32)).digest('hex');
  await db.execute({sql:'INSERT INTO clients(id,data,token_hash,revision,applied,seen,telemetry) VALUES(?,?,?,?,?,?,?)',
   args:[cid,JSON.stringify(data),gatewayHash,1,0,0,'{}']});
 }
 await db.execute({sql:'INSERT OR IGNORE INTO intercom_units(client_id,id,label,enabled) VALUES(?,?,?,1)',
  args:[cid,unitId,'Apartamento 102']});
 await db.execute({sql:'INSERT OR IGNORE INTO intercom_unit_members(client_id,unit_id,user_id) VALUES(?,?,?)',
  args:[cid,unitId,userId]});
 console.log('Nexus Interfone: dados fictícios do piloto preparados; nenhum acionador físico cadastrado.');
}
