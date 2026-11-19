const $=s=>document.querySelector(s),cid=new URLSearchParams(location.search).get('central');
const visitorDiag=window.NexusCallDiagnostics?.create('visitante','#visitor-diagnostics-output','#visitor-diagnostics-copy')||
 {start(){},event(){},finish(){},render(){}};

let call=null,secret='',timer=null,ctx=null,started=0,stream=null,peer=null,audioStarted=false,locationReady=false,networkTestAllowed=false,gpsPilotAllowed=false;
let cameraStream=null,remoteAudio=null;
let visitorUnitsAvailable=false;
let visitorTalkEndsAt=0,visitorTimer=null;
let visitorConnectionGraceTimer=null,visitorConnectionTicker=null,visitorConnectionDeadline=0;
const VISITOR_RECONNECT_GRACE_MS=15000;
function clearVisitorConnectionGrace(recovered=false){
 const interruptedAt=visitorConnectionDeadline?visitorConnectionDeadline-VISITOR_RECONNECT_GRACE_MS:0;
 if(visitorConnectionGraceTimer!==null){clearTimeout(visitorConnectionGraceTimer);visitorConnectionGraceTimer=null;}
 if(visitorConnectionTicker!==null){clearInterval(visitorConnectionTicker);visitorConnectionTicker=null;}
 visitorConnectionDeadline=0;
 const status=$('#visitor-reconnect-status');
 if(status)status.hidden=true;
 if(recovered&&interruptedAt){
  visitorDiag.event('conexao_restaurada',String(Math.max(0,Math.floor((Date.now()-interruptedAt)/1000)))+'s');
  setNotice('Conexão com o morador recuperada.');
 }
}
function expireVisitorConnection(){
 if(!call||!visitorConnectionDeadline)return;
 // The countdown is based on absolute time, including time spent in background.
 if(Date.now()<visitorConnectionDeadline)return;
 const id=call,accessToken=secret;
 visitorDiag.event('reconexao_esgotada','15s');
 done('network');
 // Notify the server on a best-effort basis. Never wait for network to close local media.
 void api('calls/'+id+'/cancel',{method:'POST',headers:{Authorization:'Bearer '+accessToken}}).catch(()=>{});
}
function updateVisitorConnectionCountdown(){
 if(!call||!visitorConnectionDeadline)return;
 if(Date.now()>=visitorConnectionDeadline){expireVisitorConnection();return;}
 const remaining=Math.max(0,Math.ceil((visitorConnectionDeadline-Date.now())/1000));
 const el=$('#visitor-reconnect-status');
 if(el){el.hidden=false;el.textContent='Reconectando… '+remaining+' s';}
}
function startVisitorConnectionGrace(reason='webrtc'){
 if(!call||visitorConnectionDeadline)return;
 visitorConnectionDeadline=Date.now()+VISITOR_RECONNECT_GRACE_MS;
 visitorDiag.event('conexao_interrompida',reason);
 setNotice('Conexão interrompida. Tentando recuperar sem reiniciar o tempo da chamada.');
 updateVisitorConnectionCountdown();
 visitorConnectionTicker=setInterval(updateVisitorConnectionCountdown,1000);
 visitorConnectionGraceTimer=setTimeout(expireVisitorConnection,VISITOR_RECONNECT_GRACE_MS);
}

const reasons={entrega:'Entrega',visita:'Visita',servico:'Serviço',outro:'Outro'};

let stopMicMonitoring=null;
function microphoneConstraints(){
 const selected=$('#microphone-device').value;
 return {
  echoCancellation:true,noiseSuppression:true,autoGainControl:true,
  ...(selected?{deviceId:{exact:selected}}:{})
 };
}
function audioMeter(sourceStream,context,onLevel){
 const source=context.createMediaStreamSource(sourceStream);
 const analyser=context.createAnalyser();
 analyser.fftSize=1024;source.connect(analyser);
 const readings=new Uint8Array(analyser.fftSize);
 const timer=setInterval(()=>{
  if(sourceStream.getAudioTracks().every(t=>t.readyState!=='live'))return;
  analyser.getByteTimeDomainData(readings);
  const squared=readings.reduce((sum,n)=>sum+((n-128)/128)**2,0)/readings.length;
  onLevel(Math.sqrt(squared));
 },250);
 return ()=>{clearInterval(timer);source.disconnect();analyser.disconnect()};
}
async function listMicrophones(){
 if(!navigator.mediaDevices?.enumerateDevices)return;
 try{
  const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
  const select=$('#microphone-device'),previous=select.value;
  select.replaceChildren();
  const option=document.createElement('option');option.value='';option.textContent='Microfone padrão do dispositivo';select.append(option);
  for(const device of devices){
   if(!device.deviceId)continue;
   const item=document.createElement('option');
   item.value=device.deviceId;item.textContent=device.label||'Entrada de áudio';select.append(item);
  }
  if(devices.some(d=>d.deviceId===previous))select.value=previous;
 }catch{/* Browser may hide device labels before permission. */}
}
$('#microphone-test-button').onclick=async()=>{
 const button=$('#microphone-test-button'),status=$('#microphone-test-status');
 button.disabled=true;
 let sample=null,testCtx=null,stop=null,hasVoice=false;
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Microfone indisponível neste navegador.');
  sample=await navigator.mediaDevices.getUserMedia({audio:microphoneConstraints(),video:false});
  testCtx=new(window.AudioContext||window.webkitAudioContext)();await testCtx.resume();
  await listMicrophones();
  status.textContent='Fale normalmente no microfone por 3 segundos...';
  stop=audioMeter(sample,testCtx,volume=>{
   if(volume>0.018)hasVoice=true;
   if(hasVoice)status.textContent='Microfone captando voz! Pode iniciar a chamada.';
  });
  await new Promise(resolve=>setTimeout(resolve,3000));
  if(!hasVoice)status.textContent='Microfone autorizado, mas sem voz detectável. Verifique se o microfone está mudo e selecione outra entrada.';
 }catch(e){status.textContent='Falha no microfone: '+(e.message||e);}
 finally{
  stop?.();sample?.getTracks().forEach(t=>t.stop());
  await testCtx?.close().catch(()=>{});
  button.disabled=false;
 }
};
function stopLiveMic(){
 stopMicMonitoring?.();stopMicMonitoring=null;
}
function watchLiveMic(audioStream){
 stopLiveMic();
 if(!ctx)return;
 const status=$('#microphone-live-status');
 stopMicMonitoring=audioMeter(audioStream,ctx,level=>{
  status.textContent=audioStream.getAudioTracks().some(t=>t.enabled===false)?'🎙️ Microfone silenciado.':level>0.018?'🎙️ Seu microfone está captando voz.':'🎙️ Microfone ativo, mas não detectamos sua voz. Verifique a entrada e fale mais perto.';
 });
}
window.addEventListener('load',listMicrophones);


function resetVisitorTimer(){
 if(visitorTimer!==null){clearInterval(visitorTimer);visitorTimer=null;}
 visitorTalkEndsAt=0;
}
function updateVisitorTimer(){
 if(!call||!visitorTalkEndsAt)return;
 const remain=Math.max(0,visitorTalkEndsAt-Math.floor(Date.now()/1000));
 const clock=$('#talk-clock');
 clock.textContent=String(Math.floor(remain/60)).padStart(2,'0')+':'+String(remain%60).padStart(2,'0');
 clock.classList.toggle('time-low',remain<=15);
 if(remain===0)done('limit');
}
function startVisitorTimer(expires){
 const next=Number(expires)||0;
 if(!next||next===visitorTalkEndsAt)return;
 resetVisitorTimer();
 visitorTalkEndsAt=next;
 visitorDiag.event('chamada_atendida','limite_90s');
 $('#clock').hidden=true;
 $('#talk-clock').hidden=false;
 $('#talk-time-note').hidden=false;
 $('#visitor-controls').hidden=false;
 updateVisitorTimer();
 visitorTimer=setInterval(updateVisitorTimer,1000);
}
function resetVisitorControls(){
 $('#visitor-controls').hidden=true;
 $('#visitor-mute').disabled=true;
 $('#visitor-mute').textContent='🎙️ Silenciar microfone';
 $('#visitor-mute').setAttribute('aria-pressed','false');
}
$('#visitor-mute').onclick=()=>{
 const mic=stream?.getAudioTracks()[0];
 if(!call||!mic)return;
 mic.enabled=!mic.enabled;
 const muted=!mic.enabled;
 $('#visitor-mute').textContent=muted?'🎙️ Reativar microfone':'🎙️ Silenciar microfone';
 $('#visitor-mute').setAttribute('aria-pressed',String(muted));
};
const setNotice=s=>$('#notice').textContent=s;
/** The visitor phone/notebook camera is a provisional source standing in for the future dedicated IP entrance camera.
 * Never start capture silently; the visitor must click the explicit button.
 * Tracks are held locally until the resident answers the call.
 */
const cameraActive=()=>cameraStream?.getVideoTracks().some(t=>t.readyState==='live')===true;
function updateCallReadiness(){
 $('#call').disabled=!visitorUnitsAvailable||!(locationReady||networkTestAllowed||gpsPilotAllowed)||
  (gpsPilotAllowed&&!cameraActive());
}

function stopCamera(){
 cameraStream?.getTracks().forEach(track=>track.stop());
 cameraStream=null;
 $('#calling-video-status').hidden=true;
 $('#camera-start').hidden=false;
 $('#camera-start').disabled=false;
 $('#camera-stop').hidden=true;
 $('#camera-status').textContent='Câmera desligada. Ative a câmera para iniciar a chamada neste piloto.';
 updateCallReadiness();
}
async function updateVideoDevices(){
 if(!navigator.mediaDevices?.enumerateDevices)return;
 try{
  const sources=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
  const select=$('#camera-device'),selected=select.value;
  select.replaceChildren();
  const defaultOpt=document.createElement('option');
  defaultOpt.value='';defaultOpt.textContent='Câmera padrão do celular';select.append(defaultOpt);
  for(let i=0;i<sources.length;i++){
   const option=document.createElement('option');
   option.value=sources[i].deviceId;
   option.textContent=sources[i].label||'Câmera '+(i+1);
   select.append(option);
  }
  if(sources.some(d=>d.deviceId===selected))select.value=selected;
 }catch{/* Camera capture still works if device listing is unavailable. */}
}
$('#camera-device').addEventListener('change',()=>{
 if(cameraActive()){
  stopCamera();
  $('#camera-status').textContent='Fonte de vídeo alterada. Clique em Ativar câmera para iniciar a nova fonte.';
 }
});
$('#camera-start').onclick=async()=>{
 const button=$('#camera-start');
 button.disabled=true;
 $('#camera-status').textContent='Solicitando acesso à câmera deste celular...';
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Este navegador não tem acesso à webcam.');
  // Balanced for 3G/4G and Android WebView: fewer frames lower encoder load and
  // queue pressure, while still retaining enough resolution for video intercom.
  const videoSettings={width:{ideal:640,max:640},height:{ideal:360,max:360},
   frameRate:{ideal:12,max:15},resizeMode:'crop-and-scale'};
  if($('#camera-device').value)videoSettings.deviceId={exact:$('#camera-device').value};
  else videoSettings.facingMode={ideal:'user'};
  const captured=await navigator.mediaDevices.getUserMedia({video:videoSettings,audio:false});
  if(call){captured.getTracks().forEach(t=>t.stop());throw Error('Ative a câmera antes de iniciar a chamada.');}
  cameraStream=captured;
  for(const track of cameraStream.getVideoTracks()){
   if('contentHint' in track)track.contentHint='motion';
  }
  await updateVideoDevices();
  // Do not attach the camera to any local <video>; only the resident receives it.
  cameraStream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{
   if(!cameraActive())stopCamera();
  }));
  button.hidden=true;$('#camera-stop').hidden=false;
  $('#camera-status').textContent='Câmera pronta para a chamada. O morador poderá optar por vídeo ou somente áudio.';
  updateCallReadiness();
 }catch(e){
  $('#camera-status').textContent='Câmera indisponível: '+(e.message||e)+'. Você ainda pode fazer a chamada só com áudio.';
  button.disabled=false;
 }
};
// Pre-call camera selection is allowed only for the pilot operator.
// During the call no camera-off control is available; release tracks on hangup.
$('#camera-stop').onclick=()=>{if(!call)stopCamera();};
window.addEventListener('pagehide',()=>{
 clearVisitorConnectionGrace();
 resetVisitorTimer();
 stopCamera();
 stopLiveMic();
 stream?.getTracks().forEach(track=>track.stop());
 peer?.close();
});

async function api(path,options={}){const r=await fetch('/api/intercom/public/'+encodeURIComponent(cid)+'/'+path,{cache:'no-store',...options});const b=await r.json();if(!r.ok){const wait=Number(b.retryAfterSeconds);const explanation=Number.isFinite(wait)&&wait>0?' Tente novamente em cerca de '+Math.ceil(wait/60)+' minuto(s).':'';throw Error((b.message||'Falha de comunicação')+explanation);}return b;}
function tone(frequency,duration){if(!ctx)return;const oscillator=ctx.createOscillator(),g=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;g.gain.value=0.055;oscillator.connect(g).connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+duration); }
function ring(){if(!ctx)return;const elapsed=(Date.now()-started)/1000;if(elapsed%6<1.8){tone(425,.32);setTimeout(()=>{if(call)tone(425,.32)},520);}}
function done(status){if(call)visitorDiag.finish(status);clearVisitorConnectionGrace();resetVisitorTimer();resetVisitorControls();stopLiveMic();peer?.close();peer=null;stream?.getTracks().forEach(t=>t.stop());stream=null;remoteAudio?.remove();remoteAudio=null;stopCamera();audioStarted=false;clearInterval(timer);timer=null;call=null;secret='';const map={answered:['Chamada atendida','Conectando áudio com o morador...'],declined:['Ocupado','O morador não pôde atender.'],missed:['Não atendida','O tempo de chamada terminou.'],ended:['Chamada encerrada','A chamada foi encerrada.'],limit:['Tempo encerrado','Limite de 1 minuto e 30 segundos atingido.'],network:['Conexão encerrada','A conexão ficou indisponível por mais de 15 segundos. Faça uma nova chamada.'],manual:['Chamada encerrada','Você encerrou a chamada.'],error:['Chamada encerrada','A comunicação não pôde ser estabelecida.']};const [title,message]=map[status]||['Chamada encerrada','Tente novamente mais tarde.'];$('#title').textContent=title;$('#sub').textContent=message;$('#clock').textContent='';$('#talk-clock').hidden=true;$('#talk-time-note').hidden=true;$('#symbol').textContent='✕';$('#cancel').textContent='Nova chamada';$('#cancel').onclick=()=>location.reload();if(['missed','declined'].includes(status)){tone(480,.25);setTimeout(()=>tone(480,.25),480);setTimeout(()=>tone(480,.25),960);}}
async function poll(){if(!call)return;try{const s=await api('calls/'+call,{headers:{Authorization:'Bearer '+secret}});if(s.status==='answered'){
 startVisitorTimer(s.expires);
 if(!audioStarted){audioStarted=true;$('#title').textContent='Chamada atendida';$('#sub').textContent='Conectando áudio com o morador...';startAudio().catch(e=>{setNotice('Não foi possível transmitir o microfone: '+e.message);offerMicRetry();});}
 return;
}if(s.status!=='ringing'){done(visitorTalkEndsAt&&Date.now()/1000>=visitorTalkEndsAt?'limit':s.status);return;}
const seconds=Math.max(0,s.expires-Math.floor(Date.now()/1000));$('#clock').textContent='00:'+String(seconds).padStart(2,'0');if(!seconds){done('missed');return;}ring();}catch(e){setNotice('Conexão instável. Verificando chamada...');}}
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
// Enforce the absolute call deadline after the browser resumes from background.
function resumeVisitorCall(){
 if(!call)return;
 updateVisitorTimer();
 if(!call)return;
 updateVisitorConnectionCountdown();
 if(!call)return;
 if(peer&&['failed','disconnected'].includes(peer.connectionState))startVisitorConnectionGrace('webrtc_'+peer.connectionState);
 void poll();
}
document.addEventListener('visibilitychange',()=>{
 if(call)visitorDiag.event(document.hidden?'segundo_plano':'primeiro_plano','web');
 if(!document.hidden)resumeVisitorCall();
});
window.addEventListener('focus',resumeVisitorCall);
window.addEventListener('pageshow',resumeVisitorCall);
window.addEventListener('online',()=>{
 if(call)visitorDiag.event('internet_restaurada','navigator_online');
 resumeVisitorCall();
});
window.addEventListener('offline',()=>{
 if(call){visitorDiag.event('internet_indisponivel','navigator_offline');
  if(audioStarted)startVisitorConnectionGrace('navigator_offline');}
});
// Same-network mode is an explicit, temporary Preview-only test, not a geofence.
if(!cid){
 setNotice('QR Code inválido: condomínio não identificado.');
}else api('units').then(d=>{
 $('#place').textContent=d.name||'Bem-vindo!';
 $('#unit').innerHTML='<option value="">Selecione a residência</option>';
 for(const u of d.units){const opt=document.createElement('option');opt.value=u.id;opt.textContent=u.label;$('#unit').append(opt);}
 locationReady=d.locationReady===true;
 networkTestAllowed=d.pilotNetworkTestAllowed===true;
 gpsPilotAllowed=d.pilotGpsTestEnabled===true;
 visitorUnitsAvailable=d.units.length>0;
 updateCallReadiness();
 if(d.pilotNetworkTestSupported===true||gpsPilotAllowed){
  $('#camera-test').hidden=false;
 }
 if(gpsPilotAllowed){
  const expiration=d.pilotGpsTestExpiresAt?new Date(d.pilotGpsTestExpiresAt*1000).toLocaleString('pt-BR'):'temporariamente';
  $('#location-explainer').textContent='MODO DE TESTE • GPS temporariamente desativado somente no condomínio piloto até '+expiration+'. O QR Code não comprova presença física. Não use para acionar portões.';
  $('#call').textContent='☎ Chamar residência (teste sem GPS)';
  setNotice('Ambiente piloto sem GPS. Ative a câmera de teste para chamar. O morador poderá escolher vídeo ou somente áudio.');
 }else if(networkTestAllowed){
  $('#location-explainer').textContent='MODO DE TESTE • Você está usando a mesma saída de internet autorizada pelo morador. GPS dispensado somente neste piloto e por tempo limitado.';
  $('#call').textContent='☎ Chamar (teste na mesma rede)';
  setNotice('Modo de teste liberado. Não é comprovação de presença física.');
 }else if(!locationReady){
  setNotice(d.pilotNetworkTestSupported?
   'Interfone bloqueado: no celular do morador, abra a Central de Interfone e ative o teste na mesma rede. Depois recarregue esta página.':
   'Interfone bloqueado: a administração precisa cadastrar a localização da portaria.');
 }else if(!d.units.length)setNotice('Nenhuma residência disponível no momento.');
}).catch(e=>setNotice(e.message));
$('#call').onclick=async()=>{
 if(!$('#unit').value)return setNotice('Selecione uma residência.');
 if(gpsPilotAllowed&&!cameraActive())return setNotice('Ative a câmera de teste antes de chamar. Na portaria definitiva, a câmera IP ficará fixa e independente do visitante.');
 if(!locationReady&&!networkTestAllowed&&!gpsPilotAllowed)return setNotice('GPS da portaria não configurado. Autorize o teste na rede do morador.');
 $('#call').disabled=true;
 try{
  ctx=new(window.AudioContext||window.webkitAudioContext)();await ctx.resume();
  const body={unitId:$('#unit').value,reason:$('#reason').value};
  if(gpsPilotAllowed){
   setNotice('Conectando no condomínio piloto (sem exigência de GPS)...');
  }else if(networkTestAllowed){
   setNotice('Verificando autorização temporária da rede de testes...');
   body.pilotNetworkTest=true;
  }else{
   setNotice('Verificando a localização do celular...');
   body.location=await freshVisitorLocation();
   setNotice('Localização recebida. Verificando distância da portaria...');
  }
  const s=await api('calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  setNotice('');call=s.callId;secret=s.callToken;started=Date.now();
  visitorDiag.start('aguardando_30s');
  $('#start').classList.add('hidden');$('#calling').classList.remove('hidden');
  $('#microphone-test').hidden=true;$('#clock').hidden=false;
  if(cameraActive())$('#calling-video-status').hidden=false;
  $('#cancel').onclick=async()=>{
   try{await api('calls/'+call+'/cancel',{method:'POST',headers:{Authorization:'Bearer '+secret}});}catch{}
   done('manual');
  };
  await poll();timer=setInterval(poll,900);
 }catch(e){
  stream?.getTracks().forEach(t=>t.stop());stream=null;
  setNotice(e.message);$('#call').disabled=false;
 }
};

const sleep=t=>new Promise(r=>setTimeout(r,t));
async function completeIce(pc){
 if(pc.iceGatheringState==='complete')return;
 // Preview pilot on one network: allow a quicker initial SDP exchange.
 // A few seconds still permit host and STUN candidates to be collected.
 await Promise.race([
  new Promise(resolve=>{
   function onChange(){
    if(pc.iceGatheringState==='complete'){
     pc.removeEventListener('icegatheringstatechange',onChange);resolve();
    }
   }
   pc.addEventListener('icegatheringstatechange',onChange);
  }),
  sleep(4500)
 ]);
}
async function startAudio(){
 if(!call)return;
 const id=call,authorization={Authorization:'Bearer '+secret};
 stream=await navigator.mediaDevices.getUserMedia({audio:microphoneConstraints(),video:false});
 $('#visitor-mute').disabled=false;
 watchLiveMic(stream);
 if(call!==id){stream.getTracks().forEach(t=>t.stop());stream=null;return;}
 peer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
 // One local stream with audio + optional webcam video makes the tracks
 // available together at the remote Android videoporteiro.
 const videoTracks=cameraActive()?cameraStream.getVideoTracks():[];
 const sharedMedia=new MediaStream([...stream.getAudioTracks(),...videoTracks]);
 for(const track of sharedMedia.getTracks()){
  const sender=peer.addTrack(track,sharedMedia);
  if(track.kind==='video'&&sender?.getParameters&&sender?.setParameters){
   try{
    const params=sender.getParameters();
    // Limit uplink/encoder buffering; if not supported the browser keeps its defaults.
    params.encodings=(params.encodings?.length?params.encodings:[{}]).map(e=>({
     ...e,maxBitrate:550_000,maxFramerate:15
    }));
    params.degradationPreference='maintain-framerate';
    await sender.setParameters(params);
   }catch{/* Parameters are optional; keep the call functional. */}
  }
 }
 remoteAudio=new Audio();remoteAudio.autoplay=true;remoteAudio.setAttribute('playsinline','');
 remoteAudio.style.display='none';document.body.append(remoteAudio);
 peer.ontrack=e=>{
  if(e.track.kind!=='audio')return;
  remoteAudio.srcObject=e.streams[0]||new MediaStream([e.track]);
  remoteAudio.play().catch(()=>setNotice('Toque na tela para habilitar o áudio do morador.'));
 };
 const currentPeer=peer;
 peer.onconnectionstatechange=()=>{
  if(call!==id||peer!==currentPeer)return;
  const state=currentPeer.connectionState;
  if(state==='connected'){
   if(visitorConnectionDeadline&&Date.now()>=visitorConnectionDeadline){expireVisitorConnection();return;}
   visitorDiag.event('conexao_estabelecida','webrtc');
   clearVisitorConnectionGrace(true);
   setNotice(videoTracks.length?'Áudio e câmera conectados.':'Áudio conectado (sem câmera).');
   $('#title').textContent='Em comunicação';$('#sub').textContent='Você está falando com o morador.';
  }else if(state==='disconnected'||state==='failed'){
   startVisitorConnectionGrace('webrtc_'+state);
  }
 };
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
