import {validatePassword} from './password-policy.js';
const $=s=>document.querySelector(s);
const TITLE='Controws | Condomínio Demonstração 5 Casas';
const log=s=>{$('#progress').textContent+='\n'+s;};
let generated=null,deviceConfig=null,clientId=null;
async function request(path,{method='GET',body}={}){
 const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',
  headers:body?{'Content-Type':'application/json'}:{},
  body:body?JSON.stringify(body):undefined});
 const d=await r.json().catch(()=>({message:'Resposta inválida do servidor'}));
 if(!r.ok)throw Error(d.message||'Operação indisponível');
 return d;
}
const master=(path,options)=>request('/api/v1'+path,options);
const intercom=(path,body)=>request('/api/intercom/admin/clients/'+encodeURIComponent(clientId)+'/'+path,
 body?{method:'POST',body}:{});
const randomHex=length=>[...crypto.getRandomValues(new Uint8Array(length))]
 .map(x=>x.toString(16).padStart(2,'0')).join('');
const temporaryPassword=()=>{const p='D'+randomHex(11)+'a!';validatePassword(p);return p;};
async function credential(password){
 const salt=randomHex(16);
 const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const buf=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),
  iterations:100000,hash:'SHA-256'},base,256);
 const hash=[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
 return {salt,hash};
}
function saveFile(filename,data){
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
$('#agree').onchange=()=>{$('#create').disabled=!$('#agree').checked;};
$('#save-credentials').onclick=()=>{if(generated)saveFile('controws-demo-credenciais.json',generated);};
$('#save-device').onclick=()=>{if(deviceConfig)saveFile('provision.json',deviceConfig);};
async function setup(){
 $('#create').disabled=true;
 const session=await request('/api/auth/me');
 if(session.user?.role!=='master')throw Error('Entre como Administrador Master para criar a demonstração.');
 const existing=(await master('/clients')).clients.find(c=>c.name===TITLE);
 if(existing){
  clientId=existing.id;
  throw Error('Condomínio demonstrativo já existe: '+clientId+'. Não foi criado outro. Abra o Master para gerenciá-lo.');
 }
 const created=await master('/clients',{method:'POST',body:{
  name:TITLE,address:'Ambiente fictício de demonstração — sem endereço físico',
  profile:'devkit-central',allowInvites:false
 }});
 clientId=created.client.id;
 deviceConfig={cloudUrl:created.cloudUrl,gatewayId:clientId,gatewayToken:created.gatewayToken,
  profile:'devkit-central',wifiSsid:'PREENCHER',wifiPassword:'PREENCHER'};
 const accounts=[];
 // The two logical outputs remain OFF until the installer verifies the physical circuit.
 for(const [name,accessKind,channel] of [
  ['Portão de veículos','veiculos',1],['Portão de pedestres','pedestres',2]]){
  await master('/clients/'+clientId+'/nodes',{method:'POST',body:{
   name,type:'gate',accessKind,transport:'local',board:'esp32-devkit',
   channel,pulseMs:1000,reed:false,enabled:false
  }});
  log('Canal '+channel+' cadastrado e desabilitado: '+name);
 }
 let current=(await master('/clients')).clients.find(c=>c.id===clientId);
 const doors=current.nodes.map(n=>n.id);
 for(let i=0;i<6;i++){
  const role=i===0?'sindico':'morador';
  const name=i===0?'Síndico Demonstrativo':'Morador Demonstrativo — Casa '+String(i).padStart(2,'0');
  const email=i===0?'demo.sindico@controws.invalid':'demo.casa'+String(i).padStart(2,'0')+'@controws.invalid';
  const password=temporaryPassword();
  const {salt,hash}=await credential(password);
  await master('/clients/'+clientId+'/users',{method:'POST',body:{
   name,email,role,doors,salt,hash
  }});
  accounts.push({name,email,password,role});
  log('Conta '+(i+1)+'/6 criada: '+name);
 }
 current=(await master('/clients')).clients.find(c=>c.id===clientId);
 for(let i=1;i<=5;i++){
  const unitId='casa-'+String(i).padStart(2,'0');
  await intercom('residences',{id:unitId,label:'Casa '+String(i).padStart(2,'0')});
  const user=current.users.find(u=>u.email===accounts[i].email);
  if(!user)throw Error('Não foi possível encontrar a conta da Casa '+i);
  await intercom('link',{unitId,userId:user.id});
  log('Casa '+String(i).padStart(2,'0')+' vinculada ao respectivo morador.');
 }
 await intercom('subscription',{enabled:true});
 log('Módulo Porteiro Cloud habilitado. GPS físico ainda pendente.');
 generated={clientId,clientName:TITLE,
  loginUrl:location.origin+'/?central='+encodeURIComponent(clientId),
  notes:'Contas fictícias exclusivas de demonstração. Não usar como usuários reais. Não compartilhar este arquivo publicamente.',
  accounts};
 $('#client-id').textContent='Código do condomínio: '+clientId;
 const label=document.createElement('p');
 label.textContent='Acesso para síndico e moradores: '+generated.loginUrl;
 const list=document.createElement('ul');
 for(const a of accounts){
  const li=document.createElement('li');
  li.textContent=a.name+' | '+a.email+' | senha: '+a.password;
  list.append(li);
 }
 $('#credentials').replaceChildren(label,list);
 $('#manage').href='/porteiro-admin.html?central='+encodeURIComponent(clientId);
 $('#result').hidden=false;
 log('Cadastro concluído. Guarde agora os dois arquivos de acesso e configuração.');
}
$('#create').onclick=async()=>{
 $('#progress').textContent='Verificando sessão Master e banco de testes...';
 $('#result').hidden=true;
 try{await setup();}
 catch(error){
  if(/Entre para continuar|Faça login|Administrador Master/.test(error.message)){
   log('Faça login como Master neste mesmo endereço antes de preparar o condomínio.');
   const link=document.createElement('a');
   link.href='/?next='+encodeURIComponent('/demo-condominio.html');
   link.textContent='Entrar como Master e voltar ao cadastro';
   $('#progress').append(document.createElement('br'),link);
  }else{
   log('ERRO: '+error.message);
  }
  if(clientId)log('Se parte do processo foi salva, não clique novamente sem verificar o cliente '+clientId+'.');
 }finally{$('#create').disabled=true;}
};
