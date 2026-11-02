import {handle,validateConfig} from './core.mjs';
import {identity,login,session,query,randomToken,digest,now,validUser} from './auth.mjs';
const json=(v,status=200,headers={})=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const denied=()=>json({message:'Acesso não autorizado.'},403);
const safeUser=u=>({name:u.name||'Administrador',email:u.email,role:u.role,clientId:u.clientId||''});
function forwarded(r,env,u,path,body){const url=new URL(path,r.url);const headers=new Headers({'Content-Type':r.headers.get('Content-Type')||'application/json',Origin:new URL(r.url).origin,'oai-authenticated-user-id':u.id||'master','oai-authenticated-user-email':u.role==='master'?u.email:'resident:'+u.id,'X-Nexus-Portal-Key':env.RESIDENT_PORTAL_SECRET,'X-Nexus-Resident-Email':u.email||''});return new Request(url,{method:r.method,headers,body:['GET','HEAD'].includes(r.method)?undefined:body});}
async function save(env,c){validateConfig(c);await query(env,'UPDATE clients SET data=?,revision=revision+1 WHERE id=?',JSON.stringify(c),c.id).run();}
async function audit(env,c,u,action,result){await query(env,'INSERT INTO events VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),c.id,now(),'resident:'+u.id,action,'Convite',result).run();}
export async function application(r,environment){try{
 const env={...environment,RESIDENT_PORTAL_SECRET:'server-internal-only'},url=new URL(r.url),p=url.pathname;
 if(r.method!=='GET'&&r.method!=='HEAD'&&!p.startsWith('/api/v1/gateway/')&&r.headers.get('Origin')!==env.NEXUS_ORIGIN)return denied();
 if(p==='/api/auth/login'&&r.method==='POST'){const out=await login(r,env);return out.user?json({user:safeUser(out.user)},200,{'Set-Cookie':out.cookie}):json({message:out.message},out.status);}
 if(p==='/api/auth/invite'&&r.method==='POST'){
  const b=await r.json(),token=String(b.token||'');if(!/^[a-f0-9]{64}$/.test(token))return denied();
  const row=await query(env,'SELECT * FROM clients WHERE id=?',String(b.central||'')).first();if(!row)return denied();const c=JSON.parse(row.data),u=c.users.find(u=>u.inviteHash===digest(token));if(!validUser(u,c)||u.role!=='visitante')return denied();return json({user:safeUser({...u,clientId:c.id})},200,{'Set-Cookie':await session(env,{...u,clientId:c.id})});
 }
 if(p.startsWith('/api/v1/gateway/')){const headers=new Headers(r.headers);headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');return handle(new Request(r,{headers}),env);}
 const u=await identity(r,env);if(!u)return json({message:'Entre para continuar.'},401);
 if(p==='/api/auth/me'&&r.method==='GET')return json({user:safeUser(u)});
 if(p==='/api/auth/logout'&&r.method==='POST'){const token=(r.headers.get('cookie')||'').match(/(?:^|;\s*)nexus_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(token)await query(env,'DELETE FROM sessions WHERE token_hash=?',digest(token)).run();return json({ok:true},200,{'Set-Cookie':'nexus_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});}
 if(p.startsWith('/api/resident/')){
  if(u.role==='master')return denied();if(url.searchParams.get('central')!==u.clientId)return denied();
  const sub=p.slice('/api/resident/'.length);
  if(sub==='invites'){
   if(!['morador','sindico'].includes(u.role)||!u.client.allowInvites)return denied();
   if(r.method==='GET')return json({invites:u.client.users.filter(v=>v.role==='visitante'&&(u.role==='sindico'||v.parentId===u.id)).map(v=>({id:v.id,name:v.name,expires:v.expires,active:v.active,doors:v.doors}))});
   if(r.method==='POST'){
    const b=await r.json(),name=String(b.name||'').trim(),expires=Number(b.expires),doors=b.doors;
    if(!name||name.length>70||!Number.isInteger(expires)||expires<=now()||expires>now()+7*86400||!Array.isArray(doors)||!doors.length)return json({message:'Informe nome, acessos e validade de até 7 dias.'},400);
    if(doors.some(id=>!u.client.nodes.some(n=>n.id===id&&n.type==='gate')||(u.role!=='sindico'&&!u.doors.includes(id))))return denied();
    const c=structuredClone(u.client);c.users=c.users.filter(v=>v.role!=='visitante'||v.expires>now());const token=randomToken(),id=crypto.randomUUID();c.users.push({id,name,email:id+'@visitor.invalid',role:'visitante',active:true,doors:[...new Set(doors)],expires,parentId:u.id,inviteHash:digest(token),salt:randomToken().slice(0,32),hash:randomToken()});await save(env,c);await audit(env,c,u,'Convite criado',name);return json({id,url:env.NEXUS_ORIGIN+'/convite.html?central='+encodeURIComponent(c.id)+'#'+token},201);
   }
  }
  if(sub.startsWith('invites/')&&r.method==='DELETE'){
   if(!['morador','sindico'].includes(u.role))return denied();const c=structuredClone(u.client),v=c.users.find(v=>v.id===sub.slice(8)&&v.role==='visitante');if(!v||(u.role!=='sindico'&&v.parentId!==u.id))return denied();v.active=false;await save(env,c);await audit(env,c,u,'Convite revogado',v.name);return json({ok:true});
  }
  if(!/^(dashboard|logs|commands(?:\/[a-f0-9-]{36})?)$/i.test(sub))return json({message:'Rota inexistente.'},404);
  return handle(forwarded(r,env,u,'/api/v1/resident/'+sub+url.search,await r.text()),env);
 }
 if(!p.startsWith('/api/v1/'))return json({message:'Rota inexistente.'},404);
 if(p.includes('/resident/')||p.includes('/gateway/'))return denied();
 if(u.role==='sindico'){
  if(p==='/api/v1/clients'&&r.method==='GET'){
   const out=await handle(forwarded(r,env,u,p),env),data=await out.json();data.clients=data.clients.filter(c=>c.id===u.clientId);return json(data,out.status);
  }
  const prefix='/api/v1/clients/'+u.clientId+'/',sub=p.startsWith(prefix)?p.slice(prefix.length):null;
  if(sub===null)return denied();
  if(sub==='users'&&r.method==='POST'){const b=await r.clone().json();if(b.role!=='morador')return denied();}
  else if(sub.startsWith('users/')&&r.method==='PATCH'){const b=await r.clone().json(),target=u.client.users.find(v=>v.id===sub.slice(6));if(!target||target.role!=='morador'||Object.keys(b).some(k=>!['active','doors','name','email','salt','hash'].includes(k)))return denied();}
  else if(!(r.method==='GET'&&sub==='events')&&!(r.method==='POST'&&sub==='commands')&&!(r.method==='GET'&&/^commands\/[a-f0-9-]{36}$/i.test(sub)))return denied();
 }else if(u.role!=='master')return denied();
 const raw=await r.arrayBuffer();const out=await handle(forwarded(r,env,u,p+url.search,raw),env);if(out.ok&&r.method==='PATCH'&&/\/users\/[^/]+$/.test(p)){const b=JSON.parse(new TextDecoder().decode(raw));if(b.hash)await query(env,'DELETE FROM sessions WHERE client_id=? AND user_id=?',p.split('/')[4],p.split('/')[6]).run();}return out;
 }catch(e){return json({message:e.status?e.message:'Não foi possível concluir a operação.'},e.status||400)}}
