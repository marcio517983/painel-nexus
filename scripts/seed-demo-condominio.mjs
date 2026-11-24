// Fixed demo tenant, idempotently provisioned in the isolated preview database only.
// Never store plaintext passwords in the repository or touch production accounts.
import {createHash,randomBytes} from 'node:crypto';
const CID='controws-demo-5casas';

const DEMO_GATES=[
 {id:'demo-gate-veiculos',name:'Portão de veículos',accessKind:'veiculos',channel:1},
 {id:'demo-gate-pedestres',name:'Portão de pedestres',accessKind:'pedestres',channel:2},
 {id:'demo-gate-hall',name:'Porta principal do hall',accessKind:'hall',channel:3}
];
const demoNodes=()=>[
 ...DEMO_GATES.map(g=>({...g,type:'gate',transport:'local',board:'esp32-devkit',enabled:false,pulseMs:1000,reed:true})),
 {id:'demo-water-pump',name:'Funcionamento e ciclos da bomba',type:'water',accessKind:'agua',transport:'local',board:'esp32-devkit',channel:1,enabled:true,pulseMs:1000,reed:false}
];
function prepareDemoLayout(data){
 let changed=false;
 if(data.demoLayoutVersion>=2)return false;
 for(const g of DEMO_GATES){
  const existing=data.nodes.find(n=>n.id===g.id);
  if(existing){
   if(existing.reed!==true){existing.reed=true;changed=true;}
  }else{
   data.nodes.push(demoNodes().find(n=>n.id===g.id));changed=true;
  }
 }
 if(!data.nodes.some(n=>n.id==='demo-water-pump')){
  data.nodes.push(demoNodes().find(n=>n.id==='demo-water-pump'));changed=true;
 }
 for(const u of data.users){
  if(!['sindico','morador'].includes(u.role)||!u.id.startsWith('demo-'))continue;
  const doors=new Set(Array.isArray(u.doors)?u.doors:[]);
  for(const g of DEMO_GATES)doors.add(g.id);
  if(doors.size!==(u.doors||[]).length){u.doors=[...doors];changed=true;}
 }
 // DevKit reed4 GPIO35 is reserved for the pump-fault dry contact, but firmware
 // 1.1.x does not report it as an independent alarm. Never invent a measured state.
 data.demoPumpFault={name:'Falha da bomba',gpio:35,status:'awaiting-firmware',readOnly:true};
 data.demoLayoutVersion=2;
 return true;
}

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
  if(prepareDemoLayout(data)){
   const oldData=current.rows[0].data;
   const updated=await db.execute({sql:'UPDATE clients SET data=?,revision=revision+1 WHERE id=? AND data=?',args:[JSON.stringify(data),CID,oldData]});
   if(Number(updated.rowsAffected)!==1)throw Error('O cadastro demonstrativo foi alterado durante a migração; nenhuma sobrescrita realizada.');
   console.log('Demo fixa atualizada: 3 portas com reed, bomba/ciclos e GPIO35 reservado para alarme ainda sem firmware. Usuários e senhas preservados.');
  }else console.log('Condomínio demonstrativo existente preservado sem alterações.');
  return;
 }
 const doors=demoNodes();
 const people=[{id:'demo-sindico',name:'Síndico de Demonstração',email:'demo.sindico@controws.invalid',role:'sindico',active:true,doors:DEMO_GATES.map(n=>n.id),expires:0,...sindico}];
 for(let n=1;n<=5;n++)people.push({id:'demo-morador-'+n,name:'Morador de Teste — Casa '+String(n).padStart(2,'0'),
  email:'demo.casa'+String(n).padStart(2,'0')+'@controws.invalid',role:'morador',active:true,doors:DEMO_GATES.map(n=>n.id),expires:0,...morador});
 const data={
  id:CID,name:'Controws | Condomínio Demonstração 5 Casas',
  address:'Ambiente fictício exclusivo de testes',retention:30,allowInvites:false,
  services:{porteiroCloud:true},
  hardware:{profile:'devkit-central',board:'esp32-devkit'},
  nodes:doors,users:people,
  demoLayoutVersion:2,demoPumpFault:{name:'Falha da bomba',gpio:35,status:'awaiting-firmware',readOnly:true}
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
 console.log('Condomínio fictício permanente cadastrado: 5 casas, 1 síndico, 5 moradores; 3 acionadores desabilitados, reeds e monitor da bomba.');
}
