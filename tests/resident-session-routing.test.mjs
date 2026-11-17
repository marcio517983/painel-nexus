import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../public/morador.js',import.meta.url),'utf8');
function harness(user){
 const nodes=new Map();const timers=[],requests=[],history=[];
 function node(selector){
  if(!nodes.has(selector))nodes.set(selector,{hidden:false,textContent:'',className:'',value:'',children:[],dataset:{},classList:{add(){},remove(){}},addEventListener(){},replaceChildren(...items){this.children=items},append(...items){this.children.push(...items)}});
  return nodes.get(selector);
 }
 let origin='https://preview.vercel.app';
 const location={search:'?central=stale-other',href:origin+'/morador.html?central=stale-other'};
 const context={document:{querySelector:node,createElement:tag=>({href:'',textContent:'',style:{},dataset:{},append(){},addEventListener(){},tag})},location,history:{replaceState(...items){history.push(items)}},localStorage:{setItem(){}},URL,URLSearchParams,
  window:{},crypto:{randomUUID(){return 'test'}},setInterval(fn,ms){timers.push(ms)},setTimeout(){},
  fetch:async(url)=>{requests.push(url);if(url==='/api/auth/me')return{ok:true,json:async()=>({user})};
   if(url.startsWith('/api/resident/dashboard'))return{ok:true,json:async()=>({role:'morador',name:'Pilot',client:{name:'Piloto'},online:true,devices:[],water:[],allowInvites:false})};
   return{ok:true,json:async()=>({})}},console,Date,Math,FormData:class{}};
 runInNewContext(source,context);
 return {context,node,requests,history,timers};
}
test('resident page derives condominium from authenticated session instead of stale query',async()=>{
 const h=harness({role:'morador',clientId:'interfone-piloto'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(h.requests.some(x=>String(x).includes('/api/resident/dashboard?central=interfone-piloto')),JSON.stringify(h.requests));
 assert.ok(h.history.length>0);
 assert.match(String(h.history[0][2]),/central=interfone-piloto/);
});
test('master session cannot view resident controls',async()=>{
 const h=harness({role:'master',clientId:''});
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(!h.requests.some(x=>String(x).includes('/api/resident/dashboard')));
 assert.match(h.node('#hello').textContent,/sem perfil de morador/i);
});
