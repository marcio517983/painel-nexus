import {database,adapter} from '../server/database.mjs';
import {application} from '../server/application.mjs';
export default async function handler(req,res){let tx;try{
 const origin=process.env.NEXUS_ORIGIN;if(!origin||!process.env.NEXUS_ADMIN_EMAIL||!process.env.NEXUS_ADMIN_HASH||!process.env.NEXUS_ADMIN_SALT)throw Error('Configuração incompleta');
 const chunks=[];let size=0;if(req.body!==undefined){const part=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body));chunks.push(part);size=part.length}else{for await(const chunk of req){size+=chunk.length;if(size>3300000)break;chunks.push(chunk)}}if(size>3300000){res.statusCode=413;res.setHeader('Content-Type','application/json');return res.end('{"message":"Requisição muito grande."}')}
 const url=new URL(req.url,origin);if(url.pathname==='/api/index'&&url.searchParams.has('path'))url.pathname='/api/'+url.searchParams.get('path');
 const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
 tx=await database().transaction('write');const response=await application(request,{...process.env,DB:adapter(tx),BUCKET:{async put(key,bytes){await tx.execute({sql:'INSERT OR REPLACE INTO firmware_blobs VALUES(?,?)',args:[key,new Uint8Array(bytes)]})},async get(key){const row=(await tx.execute({sql:'SELECT bytes FROM firmware_blobs WHERE key=?',args:[key]})).rows[0];return row?{body:row.bytes}:null}}});await tx.commit();
 res.statusCode=response.status;for(const[k,v]of response.headers)res.setHeader(k,v);res.end(Buffer.from(await response.arrayBuffer()));
 }catch{if(tx)await tx.rollback().catch(()=>{});res.statusCode=503;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end('{"message":"Serviço indisponível. Confira a configuração do servidor e do banco."}')}finally{tx?.close()}}
