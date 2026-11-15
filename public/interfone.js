const $=s=>document.querySelector(s),cid=new URLSearchParams(location.search).get('central');
let call=null,secret='',timer=null,ctx=null,started=0,stream=null,peer=null,audioStarted=false;
const reasons={entrega:'Entrega',visita:'Visita',servico:'Serviço',outro:'Outro'};
const setNotice=s=>$('#notice').textContent=s;
async function api(path,options={}){const r=await fetch('/api/intercom/public/'+encodeURIComponent(cid)+'/'+path,{cache:'no-store',...options});const b=await r.json();if(!r.ok)throw Error(b.message||'Falha de comunicação');return b;}
function tone(frequency,duration){if(!ctx)return;const oscillator=ctx.createOscillator(),g=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;g.gain.value=0.055;oscillator.connect(g).connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+duration); }
function ring(){if(!ctx)return;const elapsed=(Date.now()-started)/1000;if(elapsed%6<1.8){tone(425,.32);setTimeout(()=>{if(call)tone(425,.32)},520);}}
function done(status){peer?.close();peer=null;stream?.getTracks().forEach(t=>t.stop());stream=null;audioStarted=false;clearInterval(timer);timer=null;call=null;secret='';const map={answered:['Chamada atendida','Conectando áudio com o morador...'],declined:['Ocupado','O morador não pôde atender.'],missed:['Não atendida','O tempo de chamada terminou.'],ended:['Chamada encerrada','A chamada foi encerrada.']};const [title,message]=map[status]||['Chamada encerrada','Tente novamente mais tarde.'];$('#title').textContent=title;$('#sub').textContent=message;$('#clock').textContent='';$('#symbol').textContent='✕';$('#cancel').textContent='Nova chamada';$('#cancel').onclick=()=>location.reload();if(['missed','declined'].includes(status)){tone(480,.25);setTimeout(()=>tone(480,.25),480);setTimeout(()=>tone(480,.25),960);}}
async function poll(){if(!call)return;try{const s=await api('calls/'+call,{headers:{Authorization:'Bearer '+secret}});if(s.status==='answered'){if(!audioStarted){audioStarted=true;startAudio().catch(e=>{setNotice('Falha no microfone: '+e.message);});}return;}if(s.status!=='ringing'){done(s.status);return;}const seconds=Math.max(0,s.expires-Math.floor(Date.now()/1000));$('#clock').textContent='00:'+String(seconds).padStart(2,'0');if(!seconds){done('missed');return;}ring();}catch(e){setNotice('Conexão instável. Verificando chamada...');}}
if(!cid){setNotice('QR Code inválido: condomínio não identificado.');}else api('units').then(d=>{$('#place').textContent=d.name||'Bem-vindo!';$('#unit').innerHTML='<option value="">Selecione a residência</option>';for(const u of d.units){const opt=document.createElement('option');opt.value=u.id;opt.textContent=u.label;$('#unit').append(opt);}$('#call').disabled=!d.units.length;if(!d.units.length)setNotice('Nenhuma residência disponível no momento.');}).catch(e=>setNotice(e.message));
$('#call').onclick=async()=>{if(!$('#unit').value)return setNotice('Selecione uma residência.');$('#call').disabled=true;setNotice('');try{ctx=new(window.AudioContext||window.webkitAudioContext)();await ctx.resume();stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});const s=await api('calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:$('#unit').value,reason:$('#reason').value})});call=s.callId;secret=s.callToken;started=Date.now();$('#start').classList.add('hidden');$('#calling').classList.remove('hidden');$('#cancel').onclick=async()=>{try{await api('calls/'+call+'/cancel',{method:'POST',headers:{Authorization:'Bearer '+secret}});}catch{}done('ended');};await poll();timer=setInterval(poll,2000);}catch(e){stream?.getTracks().forEach(t=>t.stop());stream=null;setNotice(e.message);$('#call').disabled=false;}};

const sleep=t=>new Promise(r=>setTimeout(r,t));
async function completeIce(pc){if(pc.iceGatheringState==='complete')return;await Promise.race([new Promise(resolve=>pc.addEventListener('icegatheringstatechange',function done(){if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',done);resolve();}})),sleep(9000)]);}
async function startAudio(){
 if(!call||!stream)return;
 const id=call,authorization={Authorization:'Bearer '+secret};
 peer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
 stream.getTracks().forEach(track=>peer.addTrack(track,stream));
 const remote=new Audio();remote.autoplay=true;remote.setAttribute('playsinline','');remote.style.display='none';document.body.append(remote);
 peer.ontrack=e=>remote.srcObject=e.streams[0];
 peer.onconnectionstatechange=()=>{if(peer?.connectionState==='connected'){setNotice('Áudio conectado.');$('#title').textContent='Em comunicação';$('#sub').textContent='Você está falando com o morador.';}};
 const offer=await peer.createOffer();await peer.setLocalDescription(offer);await completeIce(peer);
 await api('calls/'+id+'/offer',{method:'POST',headers:{...authorization,'Content-Type':'application/json'},body:JSON.stringify(peer.localDescription)});
 for(let i=0;i<35&&call===id;i++){const d=await api('calls/'+id+'/answer',{headers:authorization});if(d.sdp){await peer.setRemoteDescription(d.sdp);return;}await sleep(1000);}
 throw Error('Tempo de conexão de áudio excedido');
}
