import {timingSafeEqual} from 'node:crypto';
import {query,digest,now,passwordHash,validUser,session} from './auth.mjs';

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const denied=()=>json({message:'Convite ou CPF inválido, expirado ou revogado. Confira com seu anfitrião.'},403);

export function normalizeCpf(value){
 if(typeof value!=='string'||value.length>18||!/^[\d.\-\s]+$/.test(value))return null;
 const cpf=value.replace(/\D/g,'');
 if(!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf))return null;
 for(let length=9;length<=10;length++){
  let sum=0;for(let i=0;i<length;i++)sum+=Number(cpf[i])*(length+1-i);
  const digit=(sum*10%11)%10;if(digit!==Number(cpf[length]))return null;
 }
 return cpf;
}

export function vehicleData(value){
 if(!value||typeof value!=='object')return null;
 const model=typeof value.model==='string'?value.model.trim():'',color=typeof value.color==='string'?value.color.trim():'';
 const plate=typeof value.plate==='string'&&value.plate.length<=9?value.plate.replace(/[\s-]/g,'').toUpperCase():'';
 if(model.length<2||model.length>60||color.length<2||color.length>30||/[\x00-\x1f]/.test(model+color)||!(/^[A-Z]{3}\d[A-Z\d]\d{2}$/).test(plate))return null;
 return {model,plate,color};
}

export async function acceptInvite(r,env,{checkOnly=false}={}){
 const raw=await r.text();if(raw.length>2048)return json({message:'Dados inválidos.'},400);
 let b;try{b=JSON.parse(raw);}catch{return json({message:'Dados inválidos.'},400);}
 if(!b||typeof b!=='object')return denied();
 const token=typeof b.token==='string'?b.token:'',cid=typeof b.central==='string'?b.central:'';
 if(!/^[a-f0-9]{64}$/.test(token)||cid.length>36)return denied();
 const row=await query(env,'SELECT * FROM clients WHERE id=?',cid).first();if(!row)return denied();
 const c=JSON.parse(row.data),index=c.users.findIndex(u=>u.inviteHash===digest(token)),u=c.users[index];
 // Legacy links have no CPF and must be recreated. Pending visitors cannot use normal sessions.
 if(!u||u.role!=='visitante'||typeof u.inviteVerified!=='boolean'||!validUser({...u,inviteVerified:true},c))return denied();
 const details=await query(env,'SELECT * FROM invite_details WHERE client_id=? AND user_id=? AND expires>?',cid,u.id,now()).first();if(!details)return denied();
 const key='invite:'+digest(cid+':'+u.id);
 await query(env,'DELETE FROM login_limits WHERE key=? AND expires<=?',key,now()).run();
 const limit=await query(env,'INSERT INTO login_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts',key,now()+900).first();
 if(limit.attempts>5)return json({message:'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.'},429);
 const cpf=normalizeCpf(b.cpf);
 // The raw invitation token is the secret salt: neither CPF nor token is stored in clear text.
 const actual=await passwordHash(cpf||'invalid',token);
 if(!cpf||!(/^[a-f0-9]{64}$/).test(details.cpf_hash)||!timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(details.cpf_hash,'hex')))return denied();
 await query(env,'DELETE FROM login_limits WHERE key=?',key).run();
 const vehicleRequired=u.doors.some(id=>c.nodes.some(n=>n.id===id&&n.type==='gate'&&n.accessKind==='veiculos'));
 const savedVehicle=details.vehicle?vehicleData(JSON.parse(details.vehicle)):null;
 if(checkOnly)return json({vehicleRequired,needsVehicle:vehicleRequired&&!savedVehicle,expires:u.expires});
 const vehicle=savedVehicle||(vehicleRequired?vehicleData(b.vehicle):null);
 if(vehicleRequired&&!vehicle)return json({message:'Informe modelo, placa brasileira válida e cor do veículo.'},400);
 if(vehicleRequired&&!savedVehicle)await query(env,"UPDATE invite_details SET vehicle=? WHERE client_id=? AND user_id=? AND vehicle=''",JSON.stringify(vehicle),cid,u.id).run();
 // Compare the configuration before writing, so accepting a link cannot undo a concurrent revocation.
 const path='$.users['+index+'].inviteVerified';
 const changed=await query(env,"UPDATE clients SET data=json_set(data,?,json('true')),revision=revision+? WHERE id=? AND data=? RETURNING id",path,u.inviteVerified?0:1,cid,row.data).first();
 if(!changed)return json({message:'O convite foi atualizado. Confira os dados e tente novamente.'},409);
 return json({user:{name:u.name,role:u.role,clientId:cid}},200,{'Set-Cookie':await session(env,{...u,clientId:cid})});
}
