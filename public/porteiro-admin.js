const $=q=>document.querySelector(q);
const clientId=new URLSearchParams(location.search).get('central');
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let model=null,role='';
function msg(text,bad=false){const node=$('#notice');node.textContent=text;node.className=bad?'error':'success';}
async function api(action='',data){
 const endpoint='/api/intercom/admin/clients/'+encodeURIComponent(clientId)+(action?'/'+action:'');
 const response=await fetch(endpoint,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',
  headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
 const payload=await response.json();
 if(!response.ok)throw Error(payload.message||'Falha de comunicação');
 return payload;
}
async function load(){
 model=await api();
 $('#client-name').textContent=model.clientName;
 $('#subscription').hidden=role!=='master';
 $('#enabled').checked=model.enabled;
 $('#subscription-readonly').textContent=model.enabled?'Módulo ativo':'Módulo desabilitado';
 $('#residences').replaceChildren();
 for(const home of model.residences){
  const card=document.createElement('article');card.className='panel';
  const title=document.createElement('h3');title.textContent=home.label+' ('+home.id+')';card.append(title);
  const list=document.createElement('ul');
  for(const uid of home.members){
   const user=model.users.find(x=>x.id===uid);
   const li=document.createElement('li');li.textContent=user?user.name+(user.active?'':' (inativo)'):'Usuário não encontrado';
   const remove=document.createElement('button');remove.type='button';remove.className='danger';
   remove.textContent='Desvincular';remove.style.marginLeft='12px';
   remove.onclick=()=>modify('unlink',home.id,uid);
   li.append(remove);list.append(li);
  }
  card.append(list);
  const available=model.users.filter(x=>x.active&&!home.members.includes(x.id));
  if(available.length){
   const row=document.createElement('div');row.className='controls';
   const select=document.createElement('select');
   select.setAttribute('aria-label','Escolher morador');
   for(const user of available){const option=document.createElement('option');option.value=user.id;option.textContent=user.name+' — '+user.email;select.append(option);}
   const button=document.createElement('button');button.type='button';button.textContent='Vincular morador';
   button.onclick=()=>modify('link',home.id,select.value);
   row.append(select,button);card.append(row);
  }else{
   const paragraph=document.createElement('p');paragraph.className='muted';
   paragraph.textContent=model.users.length?'Nenhum outro morador ativo disponível para vincular.':'Cadastre moradores no NexusMaster primeiro.';
   card.append(paragraph);
  }
  $('#residences').append(card);
 }
 if(!model.residences.length)$('#residences').textContent='Nenhuma residência cadastrada.';
}
async function modify(action,unitId,userId){
 try{await api(action,{unitId,userId});msg(action==='link'?'Morador vinculado.':'Vínculo removido.');await load();}
 catch(e){msg(e.message,true);}
}
$('#add-residence').onsubmit=async event=>{
 event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));
 try{await api('residences',data);event.currentTarget.reset();msg('Residência cadastrada.');await load();}
 catch(e){msg(e.message,true);}
};
$('#save-subscription').onclick=async()=>{
 if(role!=='master')return;
 const enabled=$('#enabled').checked;
 if(!enabled&&!confirm('Desabilitar o Porteiro Cloud encerrará as chamadas em andamento. Confirmar?'))return;
 try{await api('subscription',{enabled});msg('Configuração do módulo salva.');await load();}
 catch(e){msg(e.message,true);}
};
async function setup(){
 try{
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(clientId||''))throw Error('Selecione um cliente pelo NexusMaster.');
  const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw Error('Faça login primeiro.');
  const session=await response.json();role=session.user?.role;
  if(!['master','sindico'].includes(role))throw Error('Acesso exclusivo do Master e do síndico.');
  if(role==='sindico'&&session.user.clientId!==clientId)throw Error('Condomínio não autorizado.');
  await load();
 }catch(e){msg(e.message,true);}
}
setup();
