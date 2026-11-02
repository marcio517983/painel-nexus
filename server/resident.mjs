const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const epoch=()=>Math.floor(Date.now()/1000);
const one=(db,sql,...b)=>db.prepare(sql).bind(...b).first();
const all=async(db,sql,...b)=>(await db.prepare(sql).bind(...b).all()).results;
const run=(db,sql,...b)=>db.prepare(sql).bind(...b).run();
export function residentValid(u,now=epoch()){return !!u&&u.active===true&&['morador','sindico','visitante'].includes(u.role)&&(u.role!=='visitante'||Number(u.expires)>now);}
export function residentAllows(u,deviceId,c){return residentValid(u)&&(!u.parentId||(c.allowInvites&&c.users.some(p=>p.id===u.parentId&&residentValid(p)&&['morador','sindico'].includes(p.role)&&(p.role==='sindico'||u.doors.every(d=>p.doors.includes(d))))))&&c.nodes.some(n=>n.id===deviceId&&n.type==='gate')&&(u.role==='sindico'||u.doors.includes(deviceId));}
async function sameSecret(a,b){if(!a||!b)return false;const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const x=await digest(a),y=await digest(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;}
export async function residentHandle(r,env){try{
 if(!await sameSecret(r.headers.get('X-Nexus-Portal-Key'),env.RESIDENT_PORTAL_SECRET))return json({message:'Portal não autorizado.'},401);
 const url=new URL(r.url),path=url.pathname.replace('/api/v1/resident',''),cid=url.searchParams.get('central')||'',email=(r.headers.get('X-Nexus-Resident-Email')||'').trim().toLowerCase();
 if(r.method!=='GET'&&r.headers.get('Origin')!==url.origin)return json({message:'Origem inválida.'},403);
 const row=await one(env.DB,'SELECT * FROM clients WHERE id=?',cid);const c=row?JSON.parse(row.data):null,u=c?.users.find(x=>x.email.toLowerCase()===email);
 if(!residentValid(u))return json({message:'Seu e-mail não possui cadastro ativo nesta central. Solicite autorização à administração.'},403);
 const actor='resident:'+u.id,online=epoch()-row.seen<15,telemetry=JSON.parse(row.telemetry),devices=c.nodes.filter(n=>residentAllows(u,n.id,c));
 if(path==='/dashboard'&&r.method==='GET')return json({name:u.name,role:u.role,client:{id:cid,name:c.name},online,physical:!c.simulation||!!c.benchRelays,allowInvites:!!c.allowInvites,water:u.role==='sindico'?c.nodes.filter(n=>n.type==='water').map(n=>({id:n.id,name:n.name,...telemetry.nodes?.find(t=>t.id===n.id),online:online&&!!telemetry.nodes?.find(t=>t.id===n.id)?.online})):[],devices:devices.map(n=>{const t=telemetry.nodes?.find(t=>t.id===n.id);return{id:n.id,name:n.name,online:online&&!!t?.online,state:online&&t?.online?t.state:-1};}),time:epoch()});
 if(path==='/commands'&&r.method==='POST'){
  const raw=await r.text();if(raw.length>2048)return json({message:'Dados inválidos.'},400);let b;try{b=JSON.parse(raw);}catch{return json({message:'Dados inválidos.'},400);}
  if(!residentAllows(u,b.deviceId,c))return json({message:'Portão não autorizado.'},403);
  if(!/^[a-f0-9-]{36}$/i.test(b.requestId||''))return json({message:'Identificador inválido.'},400);
  const prior=await one(env.DB,'SELECT * FROM commands WHERE id=?',b.requestId);if(prior){if(prior.client_id!==cid||prior.actor!==actor||prior.device_id!==b.deviceId)return json({message:'Identificador já utilizado.'},409);return json({commandId:prior.id,status:prior.status},200);}
  if(!online||!telemetry.nodes?.some(n=>n.id===b.deviceId&&n.online))return json({message:'Equipamento offline. Nenhum comando enviado.'},409);
  const count=await one(env.DB,'SELECT COUNT(*) AS n FROM commands WHERE client_id=? AND actor=? AND created>?',cid,actor,epoch()-60);if(count.n>=5)return json({message:'Limite de acionamentos. Aguarde um minuto.'},429);
  await run(env.DB,'INSERT INTO commands VALUES(?,?,?,?,?,?,?,?)',b.requestId,cid,b.deviceId,actor,epoch(),epoch()+8,'queued','');return json({commandId:b.requestId,status:'queued'},202);
 }
 if(path.startsWith('/commands/')&&r.method==='GET'){
  const cmd=await one(env.DB,'SELECT * FROM commands WHERE id=? AND client_id=? AND actor=?',path.slice(10),cid,actor);if(!cmd)return json({message:'Comando inexistente.'},404);
  if(!residentAllows(u,cmd.device_id,c))return json({message:'Permissão revogada.'},403);
  if(['queued','sent'].includes(cmd.status)&&cmd.expires+10<epoch()){cmd.status=cmd.status==='sent'?'unknown':'expired';await run(env.DB,'UPDATE commands SET status=? WHERE id=?',cmd.status,cmd.id);}
  return json({commandId:cmd.id,status:cmd.status,result:cmd.result,created:cmd.created});
 }
 if(path==='/logs'&&r.method==='GET'){if(u.role!=='sindico')return json({message:'Histórico disponível somente para a administração.'},403);return json({events:await all(env.DB,'SELECT at,actor,action,device,result FROM events WHERE client_id=? AND at>=? ORDER BY at DESC LIMIT 30',cid,epoch()-c.retention*86400)});}
 return json({message:'Rota indisponível.'},404);
 }catch{return json({message:'Falha de comunicação. Não repita o acionamento sem conferir o estado.'},500);}}
