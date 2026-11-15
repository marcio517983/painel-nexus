import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {identity, query, now} from './auth.mjs';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const digest=s=>createHash('sha256').update(String(s)).digest('hex');
const token=()=>randomBytes(32).toString('hex');
const originOk=(r,env)=>r.headers.get('origin')===env.NEXUS_ORIGIN;
const safeId=s=>/^[a-zA-Z0-9_-]{1,64}$/.test(s||'');
const units=async(env,cid)=> (await query(env,'SELECT id,label FROM intercom_units WHERE client_id=? AND enabled=1 ORDER BY label LIMIT 100',cid).all()).results;
const row=async(env,id)=>query(env,'SELECT * FROM intercom_calls WHERE id=?',id).first();
const active=async(env,id)=>{const c=await row(env,id);if(!c)return null;if(c.status==='ringing'&&c.expires<=now()){await query(env,"UPDATE intercom_calls SET status='missed',ended_at=? WHERE id=? AND status='ringing'",now(),id).run();return {...c,status:'missed'};}return c;};
const publicState=c=>({id:c.id,status:c.status,createdAt:c.created_at,expires:c.expires,answeredAt:c.answered_at||null,endedAt:c.ended_at||null});
const validRole=u=>u&&['morador','sindico'].includes(u.role);
const permitted=async(env,u,unitId)=> !!(await query(env,'SELECT 1 FROM intercom_unit_members WHERE client_id=? AND unit_id=? AND user_id=?',u.clientId,unitId,u.id).first())||u.role==='sindico';
const rate=async(env,key,limit=5)=>{const stamp=now(),bucket=Math.floor(stamp/600);await query(env,'DELETE FROM intercom_rate_limits WHERE bucket<?',bucket-2).run();const r=await query(env,'INSERT INTO intercom_rate_limits(key,bucket,n) VALUES(?,?,1) ON CONFLICT(key,bucket) DO UPDATE SET n=n+1 RETURNING n',key,bucket).first();return Number(r.n)<=limit;};
async function payload(r){const txt=await r.text();if(txt.length>1500)throw Error('Corpo muito grande');return JSON.parse(txt);}
export async function intercom(r,env){
 try{
  const p=new URL(r.url).pathname.split('/').filter(Boolean).slice(2); // /api/intercom/...
  const method=r.method;
  if(!['GET','POST'].includes(method))return json({message:'Método não permitido'},405);
  if(method==='POST'&&!originOk(r,env))return json({message:'Origem inválida'},403);
  if(p[0]==='public'){
   const cid=p[1];if(!safeId(cid))return json({message:'Condomínio inválido'},400);
   const client=await query(env,'SELECT data FROM clients WHERE id=?',cid).first();
   if(!client||JSON.parse(client.data).archived===true)return json({message:'Interfone indisponível'},404);
   if(p[2]==='units'&&method==='GET')return json({name:JSON.parse(client.data).name,units:await units(env,cid)});
   if(p[2]==='calls'&&p.length===3&&method==='POST'){
    const ip=(r.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim().slice(0,100);
    if(!await rate(env,digest(cid+':'+ip),5))return json({message:'Limite de chamadas atingido. Aguarde alguns minutos.'},429);
    const b=await payload(r),unitId=String(b.unitId||''),reason=String(b.reason||'');
    if(!/^[a-zA-Z0-9_-]{1,64}$/.test(unitId)||!['entrega','visita','servico','outro'].includes(reason))return json({message:'Escolha uma unidade e o motivo'},400);
    const u=await query(env,'SELECT id FROM intercom_units WHERE client_id=? AND id=? AND enabled=1',cid,unitId).first();
    if(!u)return json({message:'Unidade indisponível'},404);
    const pending=await query(env,"SELECT id FROM intercom_calls WHERE client_id=? AND unit_id=? AND status='ringing' AND expires>?",cid,unitId,now()).first();
    if(pending)return json({message:'Esta unidade está recebendo outra chamada.'},409);
    const id=randomUUID(),secret=token(),created=now();
    await query(env,'INSERT INTO intercom_calls(id,client_id,unit_id,reason,token_hash,status,created_at,expires) VALUES(?,?,?,?,?,?,?,?)',id,cid,unitId,reason,digest(secret),'ringing',created,created+30).run();
    return json({callId:id,callToken:secret,status:'ringing',expires:created+30},201);
   }
   if(p[2]==='calls'&&p[3]&&method==='GET'){
    const c=await active(env,p[3]);if(!c||c.client_id!==cid||!r.headers.get('authorization')?.startsWith('Bearer ')||digest(r.headers.get('authorization').slice(7))!==c.token_hash)return json({message:'Chamada não encontrada'},404);
    return json(publicState(c));
   }
   if(p[2]==='calls'&&p[3]&&p[4]==='cancel'&&method==='POST'){
    const c=await active(env,p[3]);if(!c||c.client_id!==cid||!r.headers.get('authorization')?.startsWith('Bearer ')||digest(r.headers.get('authorization').slice(7))!==c.token_hash)return json({message:'Chamada não encontrada'},404);
    await query(env,"UPDATE intercom_calls SET status='ended',ended_at=? WHERE id=? AND status='ringing'",now(),c.id).run();
    return json({ok:true});
   }
   return json({message:'Rota inexistente'},404);
  }
  const u=await identity(r,env);if(!validRole(u))return json({message:'Entre como morador ou síndico'},401);
  if(p[0]==='units'){
   if(method==='GET'){
    const rows=await query(env,'SELECT id,label,enabled FROM intercom_units WHERE client_id=? ORDER BY label',u.clientId).all();
    return json({units:rows.results});
   }
   if(method==='POST'&&u.role==='sindico'){
    const b=await payload(r),unitId=String(b.id||''),label=String(b.label||'').trim();
    if(!safeId(unitId)||label.length<2||label.length>55)return json({message:'Unidade inválida'},400);
    await query(env,'INSERT INTO intercom_units(client_id,id,label,enabled) VALUES(?,?,?,1) ON CONFLICT(client_id,id) DO UPDATE SET label=excluded.label,enabled=1',u.clientId,unitId,label).run();
    return json({ok:true},201);
   }
  }
  if(p[0]==='members'&&method==='POST'&&u.role==='sindico'){
   const b=await payload(r),unitId=String(b.unitId||''),userId=String(b.userId||'');
   if(!safeId(unitId)||!safeId(userId))return json({message:'Cadastro inválido'},400);
   const unit=await query(env,'SELECT 1 FROM intercom_units WHERE client_id=? AND id=?',u.clientId,unitId).first();
   const target=u.client.users.find(x=>x.id===userId&&x.active&&['morador','sindico'].includes(x.role));
   if(!unit||!target)return json({message:'Unidade ou morador inexistente'},404);
   await query(env,'INSERT OR IGNORE INTO intercom_unit_members(client_id,unit_id,user_id) VALUES(?,?,?)',u.clientId,unitId,userId).run();return json({ok:true},201);
  }
  if(p[0]==='calls'&&p.length===1&&method==='GET'){
   await query(env,"UPDATE intercom_calls SET status='missed',ended_at=? WHERE client_id=? AND status='ringing' AND expires<=?",now(),u.clientId,now()).run();
   const calls=(await query(env,"SELECT c.id,c.unit_id,c.reason,c.status,c.created_at,c.expires,u.label FROM intercom_calls c JOIN intercom_units u ON u.client_id=c.client_id AND u.id=c.unit_id WHERE c.client_id=? AND c.status='ringing' AND ( ?='sindico' OR EXISTS(SELECT 1 FROM intercom_unit_members m WHERE m.client_id=c.client_id AND m.unit_id=c.unit_id AND m.user_id=?)) ORDER BY c.created_at DESC LIMIT 15",u.clientId,u.role,u.id).all()).results;
   return json({calls});
  }
  if(p[0]==='calls'&&p[1]&&p[2]==='answer'&&method==='POST'){
   const c=await active(env,p[1]);if(!c||c.client_id!==u.clientId||!await permitted(env,u,c.unit_id))return json({message:'Chamada não autorizada'},403);
   const result=await query(env,"UPDATE intercom_calls SET status='answered',answered_at=?,answered_by=? WHERE id=? AND status='ringing' AND expires>? RETURNING id",now(),u.id,c.id,now()).first();
   return result?json({ok:true,status:'answered'}):json({message:'Chamada encerrada ou já atendida'},409);
  }
  if(p[0]==='calls'&&p[1]&&p[2]==='decline'&&method==='POST'){
   const c=await active(env,p[1]);if(!c||c.client_id!==u.clientId||!await permitted(env,u,c.unit_id))return json({message:'Chamada não autorizada'},403);
   await query(env,"UPDATE intercom_calls SET status='declined',ended_at=? WHERE id=? AND status='ringing'",now(),c.id).run();
   return json({ok:true});
  }
  return json({message:'Rota inexistente'},404);
 }catch(e){return json({message:'Não foi possível processar esta solicitação.'},400);}
}
