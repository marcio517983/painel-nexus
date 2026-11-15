const $=s=>document.querySelector(s),notice=s=>$('#notice').textContent=s;let profile,activeCall=null,peer=null,stream=null;
async function req(path,init={}){const r=await fetch('/api/intercom/'+path,{cache:'no-store',...init});const b=await r.json();if(!r.ok)throw Error(b.message||'Falha');return b;}
const post=(path,value)=>req(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
async function refresh(){try{const d=await req('calls');$('#calls').replaceChildren();if(!d.calls.length){$('#calls').textContent='Nenhuma chamada pendente.';return;}for(const c of d.calls){const box=document.createElement('div');box.className='entry';const t=document.createElement('strong');t.textContent=c.label;box.append(t);const detail=document.createElement('p');detail.textContent='Motivo: '+({entrega:'Entrega',visita:'Visita',servico:'Serviço',outro:'Outro assunto'}[c.reason]||c.reason)+' • expira em '+Math.max(0,c.expires-Math.floor(Date.now()/1000))+' s';box.append(detail);for(const [name,verb,className] of [['Atender','answer',''],['Recusar','decline','danger']]){const b=document.createElement('button');b.className=className;b.textContent=name;b.onclick=async()=>{try{await post('calls/'+c.id+'/'+verb,{});if(verb==='answer'){notice('Chamada atendida. Conectando microfone...');connectAudio(c.id).catch(e=>notice('Falha no áudio: '+e.message));}else notice('Chamada recusada.');refresh();}catch(e){notice(e.message)}};box.append(b)}$('#calls').append(box)}}catch(e){notice(e.message);}}
async function setup(){const r=await fetch('/api/auth/me');if(!r.ok){notice('Faça login no NexusMaster e abra esta página novamente.');return;}const d=await r.json();profile=d.user;if(!['morador','sindico'].includes(profile.role)){notice('Acesso restrito a moradores e síndicos.');return;}if(profile.role==='sindico'){$('#setup').hidden=false;const central=profile.clientId;$('#qrurl').textContent=location.origin+'/interfone.html?central='+encodeURIComponent(central);await loadUnits();}await refresh();setInterval(refresh,3000);}
async function loadUnits(){const d=await req('units');$('#units').replaceChildren();for(const u of d.units){const opt=document.createElement('option');opt.value=u.id;opt.textContent=u.label;$('#units').append(opt)}}
$('#addUnit').onclick=async()=>{try{await post('units',{id:$('#unitId').value,label:$('#unitLabel').value});notice('Residência cadastrada.');loadUnits();}catch(e){notice(e.message)}};
$('#addMember').onclick=async()=>{try{await post('members',{unitId:$('#units').value,userId:$('#userId').value});notice('Morador vinculado.');}catch(e){notice(e.message)}};
setup();

const sleep=t=>new Promise(r=>setTimeout(r,t));
async function completeIce(pc){if(pc.iceGatheringState==='complete')return;await Promise.race([new Promise(resolve=>pc.addEventListener('icegatheringstatechange',function done(){if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',done);resolve();}})),sleep(9000)]);}
async function connectAudio(id){
 if(activeCall)return notice('Você já está em outra chamada.');
 stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});activeCall=id;
 peer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
 stream.getTracks().forEach(track=>peer.addTrack(track,stream));
 const remote=new Audio();remote.autoplay=true;remote.setAttribute('playsinline','');remote.style.display='none';document.body.append(remote);
 peer.ontrack=e=>remote.srcObject=e.streams[0];
 peer.onconnectionstatechange=()=>{if(peer?.connectionState==='connected')notice('Interfone conectado. Áudio ativo.');};
 let offer;
 for(let i=0;i<35&&activeCall===id;i++){const d=await req('calls/'+id+'/signal');if(d.offer){offer=d.offer;break;}await sleep(1000);}
 if(!offer)throw Error('Visitante não iniciou áudio.');
 await peer.setRemoteDescription(offer);const answer=await peer.createAnswer();await peer.setLocalDescription(answer);await completeIce(peer);
 await post('calls/'+id+'/signal',peer.localDescription);
 const close=document.createElement('button');close.textContent='Desligar chamada';close.className='danger';$('#calls').prepend(close);
 close.onclick=async()=>{await post('calls/'+id+'/hangup',{}).catch(()=>{});peer?.close();stream?.getTracks().forEach(t=>t.stop());peer=null;stream=null;activeCall=null;close.remove();notice('Chamada encerrada.');};
}
