// Fixed demo tenant, idempotently provisioned in the isolated preview database only.
// Never store plaintext passwords in the repository or touch production accounts.
import {createHash,randomBytes} from 'node:crypto';
const CID='controws-demo-5casas';
const required=(k,n)=>{const v=process.env[k]||'';if(!new RegExp('^[a-f0-9]{'+n+'}$').test(v))throw Error('Credencial de demo ausente: '+k);return v;};
export async function seedDemoCondominio(db){
 const allowed=process.env.VERCEL_ENV==='preview'&&process.env.NEXUS_PREVIEW_SCHEMA_INIT==='1'
  &&process.env.VERCEL_GIT_COMMIT_REF==='feature/interfone-virtual-mvp'
  &&process.env.TURSO_DATABASE_URL==='libsql://nexusmaster-teste-marcio517983.aws-us-east-1.turso.io';
 if(!allowed)throw Error('Demo bloqueada fora do banco Turso de testes autorizado.');
 const sindico={salt:required('NEXUS_DEMO_SINDICO_SALT',32),hash:required('NEXUS_DEMO_SINDICO_HASH',64)};
 const morador={salt:required('NEXUS_DEMO_MORADOR_SALT',32),hash:required('NEXUS_DEMO_MORADOR_HASH',64)};
 const current=await db.execute({sql:'SELECT data FROM clients WHERE id=?',args:[CID]});
 if(current.rows.length){
  const data=JSON.parse(current.rows[0].data);
  if(data.id!==CID||data.name!=='Controws | Condomínio Demonstração 5 Casas')throw Error('Identificador de demonstração ocupado por outro cadastro.');
  console.log('Condomínio fictício já existente: preservado sem alterar usuários ou senhas.');
  return;
 }
 const doors=[
  {id:'demo-gate-veiculos',name:'Portão de veículos',type:'gate',accessKind:'veiculos',transport:'local',board:'esp32-devkit',channel:1,enabled:false,pulseMs:1000,reed:false},
  {id:'demo-gate-pedestres',name:'Portão de pedestres',type:'gate',accessKind:'pedestres',transport:'local',board:'esp32-devkit',channel:2,enabled:false,pulseMs:1000,reed:false}
 ];
 const people=[{id:'demo-sindico',name:'Síndico de Demonstração',email:'demo.sindico@controws.invalid',role:'sindico',active:true,doors:[],expires:0,...sindico}];
 for(let n=1;n<=5;n++)people.push({id:'demo-morador-'+n,name:'Morador de Teste — Casa '+String(n).padStart(2,'0'),
  email:'demo.casa'+String(n).padStart(2,'0')+'@controws.invalid',role:'morador',active:true,doors:[],expires:0,...morador});
 const data={
  id:CID,name:'Controws | Condomínio Demonstração 5 Casas',
  address:'Ambiente fictício exclusivo de testes',retention:30,allowInvites:false,
  services:{porteiroCloud:true},
  hardware:{profile:'devkit-central',board:'esp32-devkit'},
  nodes:doors,users:people
 };
 // A random unavailable provisioning token prevents any real ESP32 from authenticating
 // to the demo before the Master explicitly issues an individual credential.
 const gatewayHash=createHash('sha256').update(randomBytes(32)).digest('hex');
 const statements=[{sql:'INSERT OR IGNORE INTO clients(id,data,token_hash,revision,applied,seen,telemetry) VALUES(?,?,?,?,?,?,?)',
  args:[CID,JSON.stringify(data),gatewayHash,1,0,0,'{}']}];
 for(let n=1;n<=5;n++){
  const unit='casa-'+String(n).padStart(2,'0');
  statements.push({sql:'INSERT OR IGNORE INTO intercom_units(client_id,id,label,enabled) VALUES(?,?,?,1)',args:[CID,unit,'Casa '+String(n).padStart(2,'0')]});
  statements.push({sql:'INSERT OR IGNORE INTO intercom_unit_members(client_id,unit_id,user_id) VALUES(?,?,?)',
   args:[CID,unit,'demo-morador-'+n]});
 }
 await db.batch(statements,'write');
 console.log('Condomínio fictício permanente cadastrado: 5 casas, 1 síndico, 5 moradores; 2 acionadores desabilitados.');
}
