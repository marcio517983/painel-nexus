/* NexusMaster intercom pilot diagnostics. No credentials, audio, video or GPS
 * are captured. Local, bounded records only; no telemetry is transmitted.
 */
(function(root){
 'use strict';
 const KEY='nexus:intercom:diagnostics:v1';
 const MAX_SESSIONS=12,MAX_EVENTS=64,RETENTION_MS=48*60*60*1000;
 let fallback=[];
 const names={
  chamada_iniciada:'Chamada iniciada',
  chamada_atendida:'Chamada atendida',
  conexao_estabelecida:'Conexão WebRTC estabelecida',
  conexao_interrompida:'Conexão WebRTC interrompida',
  conexao_restaurada:'Conexão WebRTC recuperada',
  internet_indisponivel:'Internet indisponível (evento do aparelho)',
  internet_restaurada:'Internet restaurada (evento do aparelho)',
  segundo_plano:'Aplicativo em segundo plano',
  primeiro_plano:'Aplicativo em primeiro plano',
  reconexao_esgotada:'Reconexão esgotada',
  encerrada:'Chamada encerrada'
 };
 const reasons={
  network:'Regra de 15 segundos sem recuperação',
  limit:'Limite de 90 segundos',
  manual:'Encerrada manualmente neste aparelho',
  ended:'Encerrada pelo outro participante ou servidor',
  remote:'Encerrada pelo outro participante ou servidor',
  declined:'Chamada recusada',
  missed:'Chamada não atendida',
  error:'Falha de comunicação'
 };
 const clean=(value)=>String(value||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48);
 const moment=()=>new Date().toISOString();
 function read(){
  try{
   const raw=root.localStorage?.getItem(KEY);
   if(raw){const value=JSON.parse(raw);if(Array.isArray(value))return value;}
  }catch{}
  return fallback;
 }
 function persist(rows){
  const now=Date.now();
  const last=rows.filter(row=>row&&Number.isFinite(Date.parse(row.startedAt))&&
      now-Date.parse(row.startedAt)<RETENTION_MS).slice(-MAX_SESSIONS);
  fallback=last;
  try{root.localStorage?.setItem(KEY,JSON.stringify(last));}catch{}
  return last;
 }
 function create(side,selector,copySelector){
  const role=side==='morador'?'morador':'visitante';
  let active=null;
  const view=()=>root.document?.querySelector(selector);
  function latest(){
   const rows=persist(read());
   return [...rows].reverse().find(item=>item.side===role)||null;
  }
  function format(){
   const last=latest();
   if(!last)return 'Nenhum teste registrado neste aparelho.';
   const result=['NexusMaster • Diagnóstico do interfone ('+role+')',
    'Início: '+new Date(last.startedAt).toLocaleString('pt-BR'),
    'Situação: '+(last.endedAt?'Encerrada':'Em andamento'),
    last.reason?'Motivo: '+(reasons[last.reason]||last.reason):'',
    '',
    'Histórico:'];
   for(const item of last.events||[]){
    result.push(new Date(item.at).toLocaleTimeString('pt-BR',{hour12:false})+
      ' • '+(names[item.kind]||item.kind)+(item.detail?' ('+item.detail+')':''));
   }
   return result.filter(line=>line!==null).join('\n');
  }
  function render(){
   const el=view();
   if(el)el.textContent=format();
  }
  function modify(kind,detail){
   if(!active)return;
   active.events.push({at:moment(),kind:clean(kind),detail:clean(detail)});
   active.events=active.events.slice(-MAX_EVENTS);
   const rows=read().filter(row=>row!==active&&row.key!==active.key);
   persist([...rows,active]);
   render();
  }
  function start(detail){
   // A new call starts a fresh test record; never carry private call IDs/tokens.
   active={key:Date.now()+'-'+Math.random().toString(36).slice(2,7),
    side:role,startedAt:moment(),endedAt:null,reason:null,events:[]};
   modify('chamada_iniciada',detail||'');
  }
  function event(kind,detail){modify(kind,detail);}
  function finish(reason){
   if(!active)return;
   modify('encerrada',reason);
   active.reason=clean(reason);
   active.endedAt=moment();
   const rows=read().filter(row=>row.key!==active.key);
   persist([...rows,active]);
   active=null;render();
  }
  const button=root.document?.querySelector(copySelector);
  if(button){
   button.addEventListener('click',async()=>{
    const report=format();
    try{
     if(!root.navigator?.clipboard?.writeText)throw Error('clipboard');
     await root.navigator.clipboard.writeText(report);
     button.textContent='Diagnóstico copiado';
    }catch{
     button.textContent='Selecione e copie o texto abaixo';
    }
   });
  }
  render();
  return {start,event,finish,latest,format,render};
 }
 root.NexusCallDiagnostics={create};
})(window);
