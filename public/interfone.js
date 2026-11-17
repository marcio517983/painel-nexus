const $=s=>document.querySelector(s),cid=new URLSearchParams(location.search).get('central');
let call=null,secret='',timer=null,ctx=null,started=0,stream=null,peer=null,audioStarted=false,locationReady=false,networkTestAllowed=false;
const reasons={entrega:'Entrega',visita:'Visita',servico:'Serviço',outro:'Outro'};
const setNotice=s=>$('#notice').textContent=s;
async function api(path,options={}){const r=await fetch('/api/intercom/public/'+encodeURIComponent(cid)+'/'+path,{cache:'no-store',...options});const b=await r.json();if(!r.ok){const wait=Number(b.retryAfterSeconds);const explanation=Number.isFinite(wait)&&wait>0?' Tente novamente em cerca de '+Math.ceil(wait/60)+' minuto(s).':'';throw Error((b.message||'Falha de comunicação')+explanation);}return b;}
function tone(frequency,duration){if(!ctx)return;const oscillator=ctx.createOscillator(),g=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;g.gain.value=0.055;oscillator.connect(g).connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+duration); }
function ring(){if(!ctx)return;const elapsed=(Date.now()-started)/1000;if(elapsed%6<1.8){tone(425,.32);setTimeout(()=>{if(call)tone(425,.32)},520);}}
function done(status){peer?.close();peer=null;stream?.getTracks().forEach(t=>t.stop());stream=null;audioStarted=false;clearInterval(timer);timer=null;call=null;secret='';const map={answered:['Chamada atendida','Conectando áudio com o morador...'],declined:['Ocupado','O morador não pôde atender.'],missed:['Não atendida','O tempo de chamada terminou.'],ended:['Chamada encerrada','A chamada foi encerrada.']};const [title,message]=map[status]||['Chamada encerrada','Tente novamente mais tarde.'];$('#title').textContent=title;$('#sub').textContent=message;$('#clock').textContent='';$('#symbol').textContent='✕';$('#cancel').textContent='Nova chamada';$('#cancel').onclick=()=>location.reload();if(['missed','declined'].includes(status)){tone(480,.25);setTimeout(()=>tone(480,.25),480);setTimeout(()=>tone(480,.25),960);}}
async function poll(){if(!call)return;try{const s=await api('calls/'+call,{headers:{Authorization:'Bearer '+secret}});if(s.status==='answered'){if(!audioStarted){audioStarted=true;$('#title').textContent='Chamada atendida';$('#sub').textContent='Conectando áudio com o morador...';startAudio().catch(e=>{setNotice('Microfone não autorizado: '+e.message);offerMicRetry();});}return;}if(s.status!=='ringing'){done(s.status);return;}const seconds=Math.max(0,s.expires-Math.floor(Date.now()/1000));$('#clock').textContent='00:'+String(seconds).padStart(2,'0');if(!seconds){done('missed');return;}ring();}catch(e){setNotice('Conexão instável. Verificando chamada...');}}
function freshVisitorLocation(){
 return new Promise((resolve,reject)=>{
  if(!window.isSecureContext||!navigator.geolocation){reject(Error('Este navegador não disponibiliza GPS seguro. Abra o QR Code pelo navegador HTTPS do celular.'));return;}
  navigator.geolocation.getCurrentPosition(position=>{
   const accuracy=position.coords.accuracy;
   if(!Number.isFinite(accuracy)||accuracy<=0||accuracy>20){
    reject(Error('O GPS está com precisão insuficiente para o limite de 20 m. Ative a localização precisa, aproxime-se da entrada e tente novamente.'));return;
   }
   resolve({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy,timestamp:position.timestamp});
  },error=>{
   const explanations={1:'Você precisa permitir o acesso à localização para chamar pelo interfone.',2:'Não foi possível determinar sua localização. Ative o GPS e tente novamente.',3:'O GPS demorou para responder. Tente novamente perto da entrada.'};
   reject(Error(explanations[error?.code]||'Não foi possível obter a localização do aparelho.'));
  },{enableHighAccuracy:true,timeout:18000,maximumAge:0});
 });
}
// Same-network mode is an explicit, temporary Preview-only test, not a geofence.
if(!cid){
 setNotice('QR Code inválido: condomínio não identificado.');
}else api('units').then(d=>{
 $('#place').textContent=d.name||'Bem-vindo!';
 $('#unit').innerHTML='<option value="">Selecione a residência</option>';
 for(const u of d.units){const opt=document.createElement('option');opt.value=u.id;opt.textContent=u.label;$('#unit').append(opt);}
 locationReady=d.locationReady===true;
 networkTestAllowed=d.pilotNetworkTestAllowed===true;
 $('#call').disabled=!d.units.length||!(locationReady||networkTestAllowed);
 if(networkTestAllowed){
  $('#location-explainer').textContent='MODO DE TESTE • Seu notebook está usando a mesma saída de internet autorizada pelo morador. O GPS de 20 m está dispensado somente neste piloto e por tempo limitado.';
  $('#call').textContent='☎ Chamar (teste na mesma rede)';
  setNotice('Modo de teste liberado. Não é uma comprovação de proximidade física.');
 }else if(!locationReady){
  setNotice(d.pilotNetworkTestSupported?
   'Interfone bloqueado: no celular do morador, abra a Central de Interfone e ative o teste na mesma rede. Depois recarregue esta página no notebook.':
   'Interfone bloqueado: a administração precisa cadastrar a localização da portaria.');
 }else if(!d.units.length)setNotice('Nenhuma residência disponível no momento.');
}).catch(e=>setNotice(e.message));
$('#call').onclick=async()=>{
 if(!$('#unit').value)return setNotice('Selecione uma residência.');
 if(!locationReady&&!networkTestAllowed)return setNotice('GPS da portaria não configurado. Autorize o teste na rede do morador.');
 $('#call').disabled=true;
 try{
  ctx=new(window.AudioContext||window.webkitAudioContext)();await ctx.resume();
  const body={unitId:$('#unit').value,reason:$('#reason').value};
  if(networkTestAllowed){
   setNotice('Verificando autorização temporária da rede de testes...');
   body.pilotNetworkTest=true;
  }else{
   setNotice('Verificando a localização do celular...');
   body.location=await freshVisitorLocation();
   setNotice('Localização recebida. Verificando distância da portaria...');
  }
  const s=await api('calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  setNotice('');call=s.callId;secret=s.callToken;started=Date.now();
  $('#start').classList.add('hidden');$('#calling').classList.remove('hidden');
  $('#cancel').onclick=async()=>{
   try{await api('calls/'+call+'/cancel',{method:'POST',headers:{Authorization:'Bearer '+secret}});}catch{}
   done('ended');
  };
  await poll();timer=setInterval(poll,2000);
 }catch(e){
  stream?.getTracks().forEach(t=>t.stop());stream=null;
  setNotice(e.message);$('#call').disabled=false;
 }
};

const sleep=t=>new Promise(r=>setTimeout(r,t));
async function completeIce(pc){if(pc.iceGatheringState==='complete')return;await Promise.race([new Promise(resolve=>pc.addEventListener('icegatheringstatechange',function done(){if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',done);resolve();}})),sleep(9000)]);}
async function startAudio(){
 if(!call)return;
 const id=call,authorization={Authorization:'Bearer '+secret};
 stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
 if(call!==id){stream.getTracks().forEach(t=>t.stop());return;}
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

function offerMicRetry(){
 const parent=$('#calling');if(!parent||!call||parent.querySelector('#retry-mic'))return;
 const button=document.createElement('button');button.id='retry-mic';button.type='button';button.textContent='Permitir microfone para conversar';
 button.onclick=()=>{button.remove();startAudio().catch(e=>{setNotice('Não foi possível acessar o microfone: '+e.message);offerMicRetry();});};
 parent.append(button);
}
