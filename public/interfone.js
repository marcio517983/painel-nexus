const $=s=>document.querySelector(s),cid=new URLSearchParams(location.search).get('central');
let call=null,secret='',timer=null,ctx=null,started=0,stream=null,peer=null,audioStarted=false,locationReady=false,networkTestAllowed=false;
let cameraStream=null,remoteAudio=null;
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
  status.textContent=level>0.018?'🎙️ Seu microfone está captando voz.':'🎙️ Microfone ativo, mas não detectamos sua voz. Verifique a entrada e fale mais perto.';
 });
}
window.addEventListener('load',listMicrophones);

const setNotice=s=>$('#notice').textContent=s;
/** The laptop webcam is a temporary portaria camera for this Preview pilot.
 * Never start capture silently; the visitor must click the explicit button.
 * Tracks are held locally until the resident answers the call.
 */
const cameraActive=()=>cameraStream?.getVideoTracks().some(t=>t.readyState==='live')===true;
function stopCamera(){
 cameraStream?.getTracks().forEach(track=>track.stop());
 cameraStream=null;
 $('#calling-video-status').hidden=true;
 $('#camera-start').hidden=false;
 $('#camera-start').disabled=false;
 $('#camera-stop').hidden=true;
 $('#camera-status').textContent='Câmera desligada. A chamada continua disponível somente com áudio.';
}
async function updateVideoDevices(){
 if(!navigator.mediaDevices?.enumerateDevices)return;
 try{
  const sources=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
  const select=$('#camera-device'),selected=select.value;
  select.replaceChildren();
  const defaultOpt=document.createElement('option');
  defaultOpt.value='';defaultOpt.textContent='Câmera padrão do notebook';select.append(defaultOpt);
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
 $('#camera-status').textContent='Solicitando acesso à câmera do notebook...';
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Este navegador não tem acesso à webcam.');
  // Balanced for 3G/4G and Android WebView: fewer frames lower encoder load and
  // queue pressure, while still retaining enough resolution for video intercom.
  const videoSettings={width:{ideal:640,max:640},height:{ideal:360,max:360},
   frameRate:{ideal:12,max:15},resizeMode:'crop-and-scale'};
  if($('#camera-device').value)videoSettings.deviceId={exact:$('#camera-device').value};
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
  $('#camera-status').textContent='Câmera pronta. O vídeo será enviado quando o morador atender.';
 }catch(e){
  $('#camera-status').textContent='Câmera indisponível: '+(e.message||e)+'. Você ainda pode fazer a chamada só com áudio.';
  button.disabled=false;
 }
};
$('#camera-stop').onclick=stopCamera;
window.addEventListener('pagehide',()=>{
 stopCamera();
 stopLiveMic();
 stream?.getTracks().forEach(track=>track.stop());
 peer?.close();
});

async function api(path,options={}){const r=await fetch('/api/intercom/public/'+encodeURIComponent(cid)+'/'+path,{cache:'no-store',...options});const b=await r.json();if(!r.ok){const wait=Number(b.retryAfterSeconds);const explanation=Number.isFinite(wait)&&wait>0?' Tente novamente em cerca de '+Math.ceil(wait/60)+' minuto(s).':'';throw Error((b.message||'Falha de comunicação')+explanation);}return b;}
function tone(frequency,duration){if(!ctx)return;const oscillator=ctx.createOscillator(),g=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;g.gain.value=0.055;oscillator.connect(g).connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+duration); }
function ring(){if(!ctx)return;const elapsed=(Date.now()-started)/1000;if(elapsed%6<1.8){tone(425,.32);setTimeout(()=>{if(call)tone(425,.32)},520);}}
function done(status){stopLiveMic();peer?.close();peer=null;stream?.getTracks().forEach(t=>t.stop());stream=null;remoteAudio?.remove();remoteAudio=null;stopCamera();audioStarted=false;clearInterval(timer);timer=null;call=null;secret='';const map={answered:['Chamada atendida','Conectando áudio com o morador...'],declined:['Ocupado','O morador não pôde atender.'],missed:['Não atendida','O tempo de chamada terminou.'],ended:['Chamada encerrada','A chamada foi encerrada.']};const [title,message]=map[status]||['Chamada encerrada','Tente novamente mais tarde.'];$('#title').textContent=title;$('#sub').textContent=message;$('#clock').textContent='';$('#symbol').textContent='✕';$('#cancel').textContent='Nova chamada';$('#cancel').onclick=()=>location.reload();if(['missed','declined'].includes(status)){tone(480,.25);setTimeout(()=>tone(480,.25),480);setTimeout(()=>tone(480,.25),960);}}
async function poll(){if(!call)return;try{const s=await api('calls/'+call,{headers:{Authorization:'Bearer '+secret}});if(s.status==='answered'){if(!audioStarted){audioStarted=true;$('#title').textContent='Chamada atendida';$('#sub').textContent='Conectando áudio com o morador...';startAudio().catch(e=>{setNotice('Não foi possível transmitir o microfone: '+e.message);offerMicRetry();});}return;}if(s.status!=='ringing'){done(s.status);return;}const seconds=Math.max(0,s.expires-Math.floor(Date.now()/1000));$('#clock').textContent='00:'+String(seconds).padStart(2,'0');if(!seconds){done('missed');return;}ring();}catch(e){setNotice('Conexão instável. Verificando chamada...');}}
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
 if(d.pilotNetworkTestSupported===true){
  $('#camera-test').hidden=false;
 }
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
  if(cameraActive())$('#calling-video-status').hidden=false;
  $('#cancel').onclick=async()=>{
   try{await api('calls/'+call+'/cancel',{method:'POST',headers:{Authorization:'Bearer '+secret}});}catch{}
   done('ended');
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
 peer.onconnectionstatechange=()=>{if(peer?.connectionState==='connected'){setNotice(videoTracks.length?'Áudio e câmera conectados.':'Áudio conectado (sem câmera).');$('#title').textContent='Em comunicação';$('#sub').textContent='Você está falando com o morador.';}};
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
