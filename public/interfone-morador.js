const $=s=>document.querySelector(s);
const residentDiag=window.NexusCallDiagnostics?.create('morador','#resident-diagnostics-output','#resident-diagnostics-copy')||
 {start(){},event(){},finish(){},render(){}};

const reasons={entrega:'Entrega ou encomenda',visita:'Visita pessoal',servico:'Prestação de serviço',outro:'Outro assunto'};
const notice=s=>$('#notice').textContent=s;
let profile,activeCall=null,peer=null,stream=null,currentRing=null,ringInterval=null,alertCtx=null,pollBusy=false,processing=false;
let residentTalkEndsAt=0,residentTalkInterval=null,residentSpeakerEnabled=true;
let residentOfferTag=null,residentNegotiating=false,residentSignalBusy=false;
let residentConnectionGraceTimer=null,residentConnectionTicker=null,residentConnectionDeadline=0;
const RESIDENT_RECONNECT_GRACE_MS=15000;
function clearResidentConnectionGrace(recovered=false){
 const interruptedAt=residentConnectionDeadline?residentConnectionDeadline-RESIDENT_RECONNECT_GRACE_MS:0;
 if(residentConnectionGraceTimer!==null){clearTimeout(residentConnectionGraceTimer);residentConnectionGraceTimer=null;}
 if(residentConnectionTicker!==null){clearInterval(residentConnectionTicker);residentConnectionTicker=null;}
 residentConnectionDeadline=0;
 const status=$('#resident-reconnect-status');
 if(status)status.hidden=true;
 if(recovered&&interruptedAt){
  residentDiag.event('conexao_restaurada',String(Math.max(0,Math.floor((Date.now()-interruptedAt)/1000)))+'s');
  notice('Conexão com a portaria recuperada.');
 }
}
function expireResidentConnection(){
 if(!activeCall||!residentConnectionDeadline)return;
 if(Date.now()<residentConnectionDeadline)return;
 if(peer?.connectionState==='connected'&&navigator.onLine!==false){
  clearResidentConnectionGrace(true);
  return;
 }
 residentDiag.event('reconexao_esgotada','15s');
 void hangup('network');
}
function updateResidentConnectionCountdown(){
 if(!activeCall||!residentConnectionDeadline)return;
 if(Date.now()>=residentConnectionDeadline){expireResidentConnection();return;}
 const remaining=Math.max(0,Math.ceil((residentConnectionDeadline-Date.now())/1000));
 const el=$('#resident-reconnect-status');
 if(el){el.hidden=false;el.textContent='Reconectando… '+remaining+' s';}
}
function startResidentConnectionGrace(reason='webrtc'){
 if(!activeCall||residentConnectionDeadline)return;
 residentConnectionDeadline=Date.now()+RESIDENT_RECONNECT_GRACE_MS;
 residentDiag.event('conexao_interrompida',reason);
 notice('Conexão interrompida. Tentando recuperar sem reiniciar o tempo da chamada.');
 updateResidentConnectionCountdown();
 residentConnectionTicker=setInterval(updateResidentConnectionCountdown,1000);
 residentConnectionGraceTimer=setTimeout(expireResidentConnection,RESIDENT_RECONNECT_GRACE_MS);
}

let residentReceiveVideo=true;
let inboundAudioTimer=null,lastInboundAudioBytes=0;
const nexusNative=()=>window.Capacitor?.Plugins?.NexusCall||null;
let lastNativeCallId=null;

/**
 * The native Android call screen can record one explicit choice made by the
 * resident. Never trust a URL ?mode= query to auto-answer a WebRTC call.
 * The native plugin returns and consumes a short-lived, one-time decision.
 * The authenticated server is still responsible for the authorization.
 */
async function resumeNativeCallChoice(){
 const native=nexusNative();
 if(!native?.consumePendingCallAction)return false;
 let pending;
 try{pending=await native.consumePendingCallAction();}
 catch(e){notice('Não foi possível recuperar a escolha do Android: '+(e.message||e));return false;}
 if(!pending?.callId||!['video','audio','decline'].includes(pending.action))return false;
 // Server truth: pending UUID must still be a ringing call assigned to this
 // authenticated resident. The native selection alone grants no access.
 let calls=[];
 try{calls=(await req('calls')).calls||[];}
 catch(e){notice('Falha ao conferir chamada no servidor: '+(e.message||e));return false;}
 const c=calls.find(item=>item.id===pending.callId&&item.status==='ringing'&&
     Number(item.expires)>Math.floor(Date.now()/1000));
 if(!c){notice('A chamada selecionada já foi atendida ou expirou.');return false;}
 lastCalls=calls;
 await act(c,pending.action==='decline'?'decline':'answer',
           pending.action==='video'?'video':'audio');
 return true;
}

/** Android APK only: default the conversation to the built-in loudspeaker. */
async function preferNativeSpeaker(){
 const native=nexusNative();
 if(!native?.preferSpeaker)return;
 try{
  const result=await native.preferSpeaker();
  if(result?.selected===false)notice('Viva-voz indisponível neste aparelho. Verifique a saída de áudio.');
 }catch{ /* Android can override routing; let WebRTC continue normally. */ }
}
function resetInboundAudioDiagnostics(){
 if(inboundAudioTimer){clearInterval(inboundAudioTimer);inboundAudioTimer=null;}
 lastInboundAudioBytes=0;
 const status=$('#visitor-audio-status'),unlock=$('#enable-visitor-audio');
 if(status)status.textContent='Aguardando áudio do visitante...';
 if(unlock)unlock.hidden=true;
}
function showAudioUnlock(message){
 $('#visitor-audio-status').textContent=message;
 const button=$('#enable-visitor-audio');button.hidden=false;button.textContent='🔊 Ouvir visitante';
}
async function tryPlayVisitorAudio(){
 const audio=$('#remote-audio');
 if(!audio.srcObject)return showAudioUnlock('Aguardando a voz do visitante...');
 audio.autoplay=true;audio.muted=false;audio.volume=1;
 try{
  await audio.play();
  const button=$('#enable-visitor-audio');
  button.hidden=false;
  button.textContent='🔊 Reativar áudio';
  $('#visitor-audio-status').textContent='Áudio do visitante habilitado. Se não ouvir, toque em Reativar áudio.';
 }catch{
  showAudioUnlock('O Android bloqueou a reprodução automática. Toque em Ouvir visitante.');
 }
}
$('#enable-visitor-audio').onclick=async()=>{await preferNativeSpeaker();await tryPlayVisitorAudio();};
function startInboundAudioDiagnostics(){
 if(inboundAudioTimer)return;
 inboundAudioTimer=setInterval(async()=>{
  if(!peer||!activeCall)return;
  try{
   const data=await peer.getStats();
   let bytes=0,found=false;
   data.forEach(stat=>{
    if(stat.type==='inbound-rtp'&&(stat.kind==='audio'||stat.mediaType==='audio')){
     bytes+=Number(stat.bytesReceived||0);found=true;
    }
   });
   const status=$('#visitor-audio-status');
   if(!found)return;
   if(bytes<=lastInboundAudioBytes){
    status.textContent='Sem pacotes de voz do visitante. Confira o microfone do notebook.';
   }else if($('#enable-visitor-audio').hidden){
    status.textContent='Recebendo áudio do visitante. Se não ouvir, verifique o volume ou saída de áudio do celular.';
   }
   lastInboundAudioBytes=bytes;
  }catch{ /* Network stats are diagnostic only, never interrupt a call. */ }
 },2000);
}
function releaseNativeSpeaker(){
 const native=nexusNative();
 if(native?.releaseSpeaker)native.releaseSpeaker().catch(()=>{});
}
function stopResidentTimer(){
 if(residentTalkInterval!==null){clearInterval(residentTalkInterval);residentTalkInterval=null;}
 residentTalkEndsAt=0;
}
function updateResidentTimer(){
 if(!activeCall||!residentTalkEndsAt)return;
 const remain=Math.max(0,residentTalkEndsAt-Math.floor(Date.now()/1000));
 const clock=$('#resident-talk-clock');
 clock.textContent=String(Math.floor(remain/60)).padStart(2,'0')+':'+String(remain%60).padStart(2,'0');
 clock.classList.toggle('warning',remain<=15);
 if(remain===0)hangup('limit');
}
function startResidentTimer(expires){
 stopResidentTimer();
 residentTalkEndsAt=Number(expires)||0;
 if(!residentTalkEndsAt)return;
 updateResidentTimer();
 residentTalkInterval=setInterval(updateResidentTimer,1000);
}
function resetResidentControls(){
 $('#resident-mute').textContent='🎙️ Silenciar microfone';
 $('#resident-mute').setAttribute('aria-pressed','false');
 residentSpeakerEnabled=true;
 const button=$('#resident-speaker');
 button.hidden=!Boolean(nexusNative()?.preferSpeaker&&nexusNative()?.releaseSpeaker);
 button.textContent='🔊 Viva-voz ligado';
 button.setAttribute('aria-pressed','true');
}
$('#resident-mute').onclick=()=>{
 const track=stream?.getAudioTracks()[0];
 if(!activeCall||!track)return;
 track.enabled=!track.enabled;
 const muted=!track.enabled;
 $('#resident-mute').textContent=muted?'🎙️ Reativar microfone':'🎙️ Silenciar microfone';
 $('#resident-mute').setAttribute('aria-pressed',String(muted));
};
$('#resident-speaker').onclick=async()=>{
 if(!activeCall||!nexusNative())return;
 try{
  if(residentSpeakerEnabled){
   await nexusNative().releaseSpeaker();
   residentSpeakerEnabled=false;
  }else{
   const result=await nexusNative().preferSpeaker();
   if(result?.selected===false)throw Error('O Android não selecionou o alto-falante.');
   residentSpeakerEnabled=true;
  }
  $('#resident-speaker').textContent=residentSpeakerEnabled?'🔊 Viva-voz ligado':'🔈 Usar viva-voz';
  $('#resident-speaker').setAttribute('aria-pressed',String(residentSpeakerEnabled));
 }catch(e){notice('Não foi possível alterar a saída de áudio: '+(e.message||e));}
};
// Always derive the visible notification state from Android permission AND the
// authenticated FCM device binding, not from a button click remembered locally.
let nativeNotificationSyncing=false;
async function registerFirebaseDevice(){
 const native=nexusNative();
 if(!native?.fcmToken)throw Error('Firebase indisponível nesta versão do aplicativo.');
 const result=await native.fcmToken();
 if(!result?.token)throw Error('Token Firebase não disponível.');
 return post('fcm/register',{token:result.token});
}
function setNativeNotificationUi(message,{buttonLabel='Ativar notificações',showButton=true}={}){
 const button=$('#enable-notifications');
 $('#notification-status').textContent=message;
 button.hidden=!showButton;
 button.disabled=false;
 button.textContent=buttonLabel;
}
async function syncNativeNotificationUi(){
 if(nativeNotificationSyncing||!validUser()||!nexusNative())return;
 nativeNotificationSyncing=true;
 try{
  const permissions=await nexusNative().status();
  if(!permissions?.notificationEnabled){
   setNativeNotificationUi('As notificações estão desativadas nas configurações do Android.');
   return;
  }
  let device;
  try{device=await registerFirebaseDevice();}
  catch(e){
   setNativeNotificationUi('Notificações permitidas, mas o Firebase não está vinculado: '+(e.message||e),{
    buttonLabel:'Vincular ao Firebase'
   });
   return;
  }
  if(!permissions.fullScreenEnabled){
   setNativeNotificationUi('Notificações ativadas e celular vinculado ao Firebase. Falta permitir que as chamadas apareçam sobre a tela.',{
    buttonLabel:'Permitir chamadas em tela cheia'
   });
   return;
  }
  if(device?.deliveryConfigured){
   setNativeNotificationUi('Notificações ativadas. Celular vinculado ao Firebase e chamadas em tela cheia permitidas.',{
    showButton:false
   });
  }else{
   setNativeNotificationUi('Notificações do Android ativadas. Celular vinculado; envio pelo servidor Firebase ainda não configurado.',{
    buttonLabel:'Verificar notificações'
   });
  }
 }catch(e){
  setNativeNotificationUi('Não foi possível verificar notificações: '+(e.message||e),{
   buttonLabel:'Verificar notificações'
  });
 }finally{nativeNotificationSyncing=false;}
}
async function showNativeIncoming(c){
 const native=nexusNative();
 if(!native||lastNativeCallId===c.id)return;
 lastNativeCallId=c.id;
 try{
  await native.showIncoming({callId:c.id,label:'Portaria',destinationLabel:c.label,reason:(reasons[c.reason]||'Visita')+' • Destino: '+c.label,expires:c.expires});
 }catch(e){lastNativeCallId=null;notice('Alerta Android indisponível: '+(e.message||e));}
}
function closeNativeIncoming(id){
 if(!id)return;
 nexusNative()?.dismiss({callId:id}).catch(()=>{});
 if(lastNativeCallId===id)lastNativeCallId=null;
}
async function req(path,init={}){
 const r=await fetch('/api/intercom/'+path,{cache:'no-store',credentials:'same-origin',...init});
 const b=await r.json();if(!r.ok)throw Error(b.message||'Falha ao consultar o interfone');return b;
}
const post=(path,value)=>req(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const validUser=()=>profile&&['morador','sindico'].includes(profile.role);
function beep(frequency=460,duration=.25){
 if(!alertCtx||alertCtx.state!=='running')return;
 const oscillator=alertCtx.createOscillator(),gain=alertCtx.createGain();
 oscillator.type='sine';oscillator.frequency.value=frequency;
 gain.gain.value=.07;oscillator.connect(gain).connect(alertCtx.destination);
 oscillator.start();oscillator.stop(alertCtx.currentTime+duration);
}
function stopRing(){
 if(ringInterval){clearInterval(ringInterval);ringInterval=null;}
}
function startRing(){
 if(ringInterval)return;
 const play=()=>{beep(445,.22);setTimeout(()=>beep(445,.22),500)};
 play();ringInterval=setInterval(play,3600);
}
function clearPopup(){
 const old=currentRing;
 stopRing();currentRing=null;
 closeNativeIncoming(old);
 if($('#incoming-dialog').open)$('#incoming-dialog').close();
 if(!activeCall)document.body.classList.remove('nexus-call-open');
 if(!activeCall)document.title='NexusMaster | Central de interfone';
}
function dismissPush(id){
 navigator.serviceWorker?.controller?.postMessage({type:'nexus-dismiss-intercom',callId:id});
}
function renderIncoming(c){
 if(activeCall||processing)return;
 const now=Math.floor(Date.now()/1000);
 if(c.expires<=now)return clearPopup();
 const isNew=currentRing!==c.id;
 currentRing=c.id;
 $('#incoming-unit').textContent='Destino: '+c.label;
 $('#incoming-reason').textContent='Motivo: '+(reasons[c.reason]||'Chamada na entrada');
 $('#incoming-countdown').textContent='Tempo restante: '+Math.max(0,c.expires-now)+' segundos';
 // Always open the incoming call as a full-screen modal, even if the user
 // is currently viewing the dashboard or the Android WebView restored a page.
 if(!$('#incoming-dialog').open)$('#incoming-dialog').showModal();
 document.body.classList.add('nexus-call-open');
 if(isNew){
  $('#incoming-answer').focus?.();
  startRing();
  if(navigator.vibrate)navigator.vibrate([250,130,250]);
  document.title='📞 Chamada da Portaria — NexusMaster';
  if(nexusNative())showNativeIncoming(c);
 }
}
async function refresh(){
 if(!validUser()||pollBusy)return;
 pollBusy=true;
 try{
  const d=await req('calls');
  const calls=d.calls||[];lastCalls=calls;
  $('#calls').replaceChildren();
  if(!calls.length){$('#calls').textContent='Nenhuma chamada pendente.';if(currentRing&&!processing)clearPopup();}
  else for(const c of calls){
   const box=document.createElement('div');box.className='entry';
   const h=document.createElement('strong');h.textContent='Portaria → '+c.label;box.append(h);
   const p=document.createElement('p');p.textContent='Motivo: '+(reasons[c.reason]||c.reason)+' • '+Math.max(0,c.expires-Math.floor(Date.now()/1000))+' s restantes';box.append(p);
   for(const [title,kind,css,mode] of [
    ['📹 Atender com vídeo','answer','','video'],
    ['🎙️ Somente áudio','answer','','audio'],
    ['Recusar','decline','danger','audio']
   ]){
    const b=document.createElement('button');b.textContent=title;b.className=css;b.type='button';
    b.onclick=()=>act(c,kind,mode);box.append(b);
   }
   $('#calls').append(box);
  }
  if(!activeCall&&!processing){const focus=new URLSearchParams(location.search).get('call');const next=calls.find(c=>c.id===focus)||calls[0];if(next)renderIncoming(next);}
  if(activeCall){await syncActiveCall();void checkResidentRenegotiation();}
 }catch(e){notice(e.message)}finally{pollBusy=false;}
}
async function act(c,kind,mode='video'){
 if(processing||activeCall)return;
 processing=true;stopRing();
 $('#incoming-answer').disabled=true;$('#incoming-answer-audio').disabled=true;$('#incoming-decline').disabled=true;
 let localStream=null;
 try{
  if(kind==='answer'){
   // Route BEFORE capture so the Android WebView does not start in earpiece mode.
   await preferNativeSpeaker();
   localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
   // WebRTC may replace the routing decision when the microphone starts.
   await preferNativeSpeaker();
   residentReceiveVideo=mode==='video';
   const answerResult=await post('calls/'+c.id+'/answer',{});
   stream=localStream;localStream=null;activeCall=c.id;
   residentDiag.start(mode==='video'?'modo_video':'somente_audio');
   residentDiag.event('chamada_atendida','limite_90s');
   resetResidentControls();
   startResidentTimer(answerResult.expires);
   clearPopup();dismissPush(c.id);
   $('#active-audio').hidden=false;
   document.body.classList.add('nexus-call-open');
   document.title='📞 Em ligação com a Portaria — NexusMaster';
   $('#active-audio-label').textContent='Conectando a '+c.label+'...';
   $('#resident-call-mode').textContent=residentReceiveVideo?'📹 Atendimento com vídeo da portaria':'🎙️ Atendimento somente com áudio';
   resetInboundAudioDiagnostics();
   $('#video-status').textContent=residentReceiveVideo?'Verificando transmissão de vídeo da portaria...':'Modo somente áudio: a câmera da portaria não será exibida.';
   $('#remote-video').hidden=true;
   notice(residentReceiveVideo?'Chamada atendida. Preparando áudio e vídeo...':'Chamada atendida. Preparando somente áudio...');
   connectAudio(c.id).catch(async e=>{
    notice('Não foi possível estabelecer o áudio: '+e.message);
    await hangup();
   });
  }else{
   await post('calls/'+c.id+'/decline',{});
   clearPopup();dismissPush(c.id);notice('Chamada recusada.');
  }
 }catch(e){
  if(kind==='answer'&&!activeCall){residentReceiveVideo=true;releaseNativeSpeaker();}
  notice('Falha ao '+(kind==='answer'?'atender':'recusar')+': '+e.message);
 }
 finally{
  localStream?.getTracks().forEach(t=>t.stop());
  processing=false;$('#incoming-answer').disabled=false;$('#incoming-answer-audio').disabled=false;$('#incoming-decline').disabled=false;
  refresh();
 }
}
$('#incoming-answer').onclick=()=>{
 if(!currentRing)return;
 const c=currentCall();if(c)act(c,'answer','video');
};
$('#incoming-answer-audio').onclick=()=>{
 if(!currentRing)return;
 const c=currentCall();if(c)act(c,'answer','audio');
};
$('#incoming-decline').onclick=()=>{
 if(!currentRing)return;
 const c=currentCall();if(c)act(c,'decline');
};
let lastCalls=[];
function currentCall(){return lastCalls.find(c=>c.id===currentRing)||null;}
$('#incoming-dialog').addEventListener('cancel',e=>e.preventDefault());
async function completeIce(pc){
 if(pc.iceGatheringState==='complete')return;
 await Promise.race([new Promise(resolve=>{
  function change(){if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',change);resolve()}}
  pc.addEventListener('icegatheringstatechange',change);
 }),sleep(4500)]);
}
async function checkResidentRenegotiation(){
 if(!activeCall||!peer||residentSignalBusy||residentNegotiating||peer.signalingState!=='stable')return;
 residentSignalBusy=true;
 const id=activeCall,pc=peer;
 try{
  const d=await req('calls/'+id+'/signal');
  if(activeCall!==id||peer!==pc||!d.offer||!d.offerTag||d.offerTag===residentOfferTag)return;
  residentNegotiating=true;
  try{
   await pc.setRemoteDescription(d.offer);
   const answer=await pc.createAnswer();
   await pc.setLocalDescription(answer);await completeIce(pc);
   await req('calls/'+id+'/signal',{method:'POST',headers:{'Content-Type':'application/json','x-intercom-offer':d.offerTag},body:JSON.stringify(pc.localDescription)});
   residentOfferTag=d.offerTag;
   residentDiag.event('resposta_reconexao_enviada','webrtc');
  }finally{residentNegotiating=false;}
 }catch(e){residentDiag.event('falha_resposta_reconexao',String(e.message||e).slice(0,90));}
 finally{residentSignalBusy=false;}
}
async function connectAudio(id){
 if(!stream||activeCall!==id)return;
 peer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
 for(const track of stream.getTracks())peer.addTrack(track,stream);
 peer.ontrack=event=>{
  // Android WebView: keep video and voice in distinct playback streams.
  // A combined audio+video MediaStream bound to both elements may be routed
  // inconsistently when video is muted.
  const media=new MediaStream([event.track]);
  if(event.track.kind==='video'){
   if(!residentReceiveVideo){
    const ignored=$('#remote-video');
    ignored.pause();ignored.srcObject=null;ignored.hidden=true;
    $('#video-status').textContent='Modo somente áudio: imagem da portaria não recebida.';
    return;
   }
   const video=$('#remote-video');
   video.muted=true; // Caller audio plays only in #remote-audio.
   video.playsInline=true;
   video.srcObject=media;
   video.hidden=false;
   $('#video-status').textContent='📹 Vídeo ao vivo da portaria.';
   video.play().catch(()=>{
    $('#video-status').textContent='Vídeo recebido. Toque na tela para iniciar a reprodução.';
   });
   event.track.addEventListener('ended',()=>{
    video.pause();video.srcObject=null;video.hidden=true;
    $('#video-status').textContent='A imagem da portaria foi interrompida. O áudio pode continuar.';
   },{once:true});
   return;
  }
  if(event.track.kind==='audio'){
   // Video is muted, but the independent audio element must not be.
   const audio=$('#remote-audio');
   audio.muted=false;audio.volume=1;audio.srcObject=media;
   tryPlayVisitorAudio();
   startInboundAudioDiagnostics();
   event.track.addEventListener('ended',()=>showAudioUnlock('O microfone do visitante parou de transmitir. Peça para ele verificar o notebook.'),{once:true});
  }
 };
 const currentPeer=peer;
 peer.onconnectionstatechange=()=>{
  if(activeCall!==id||peer!==currentPeer)return;
  const state=currentPeer.connectionState;
  if(state==='connected'){
   if(residentConnectionDeadline&&Date.now()>=residentConnectionDeadline){expireResidentConnection();return;}
   residentDiag.event('conexao_estabelecida','webrtc');
   clearResidentConnectionGrace(true);
   $('#active-audio-label').textContent='Em comunicação';
   notice('Áudio conectado.');
  }else if(state==='failed'||state==='disconnected'){
   startResidentConnectionGrace('webrtc_'+state);
  }
 };
 let offer=null,offerTag=null;
 // Fast negotiation while the call is active. A short poll interval improves
 // pickup speed without changing the normal idle call-check cadence.
 for(let i=0;i<55&&activeCall===id;i++){
  const d=await req('calls/'+id+'/signal');
  if(d.offer){offer=d.offer;offerTag=d.offerTag;break}
  await sleep(650);
 }
 if(!offer||activeCall!==id)throw Error('Oferta de áudio indisponível');
 await peer.setRemoteDescription(offer);
 if(!residentReceiveVideo){
  // In WebRTC, reject incoming video at SDP negotiation rather than merely
  // hiding it in the UI. Never send any resident camera track.
  for(const transceiver of peer.getTransceivers?.()||[]){
   if(transceiver.receiver?.track?.kind==='video')transceiver.direction='inactive';
  }
 }else if(!offer.sdp.includes('m=video')){
  $('#video-status').textContent='Câmera da portaria indisponível neste teste. Áudio permanece ativo.';
 }
 const answer=await peer.createAnswer();await peer.setLocalDescription(answer);await completeIce(peer);
 await req('calls/'+id+'/signal',{method:'POST',headers:{'Content-Type':'application/json','x-intercom-offer':offerTag},body:JSON.stringify(peer.localDescription)});
 residentOfferTag=offerTag;
}
async function hangup(reason='manual'){
 const id=activeCall;
 if(!id)return;
 residentDiag.finish(reason);
 clearResidentConnectionGrace();
 stopResidentTimer();
 residentReceiveVideo=true;
 resetInboundAudioDiagnostics();
 activeCall=null;residentOfferTag=null;peer?.close();peer=null;
 stream?.getTracks().forEach(t=>t.stop());stream=null;
 releaseNativeSpeaker();
 $('#remote-audio').pause();$('#remote-audio').srcObject=null;
 const remoteVideo=$('#remote-video');remoteVideo.pause();remoteVideo.srcObject=null;remoteVideo.hidden=true;
 $('#video-status').textContent='Vídeo encerrado.';
 $('#active-audio').hidden=true;
 document.body.classList.remove('nexus-call-open');
 document.title='NexusMaster | Central de interfone';
 resetResidentControls();
 // Restore the UI immediately, even if the network is unavailable and
 // the best-effort hangup request takes a long time to complete.
 notice(reason==='limit'?'Tempo máximo de 1 minuto e 30 segundos atingido.':
        reason==='remote'?'O visitante encerrou a chamada.':
        reason==='network'?'Ligação encerrada: conexão não recuperada em 15 segundos.':'Chamada encerrada.');
 // The authoritative server deadline will expire regardless of request success.
 void post('calls/'+id+'/hangup',{}).catch(()=>{});
 void refresh();
}
$('#hangup').onclick=()=>hangup('manual');
window.addEventListener('pagehide',releaseNativeSpeaker);
async function syncActiveCall(){
 if(!activeCall)return;
 try{
  const c=await req('calls/'+activeCall+'/status');
  if(c.status!=='answered'){
   await hangup(residentTalkEndsAt&&Date.now()/1000>=residentTalkEndsAt?'limit':'remote');
   return;
  }
  if(Number.isFinite(Number(c.expires))&&c.expires>0&&c.expires!==residentTalkEndsAt)startResidentTimer(c.expires);
 }catch{ /* falha temporária; não desligar sem confirmação */ }
}
function decodeKey(base64url){
 const raw=atob(base64url.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-base64url.length%4)%4));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function enableNotifications(){
 const button=$('#enable-notifications'),status=$('#notification-status');
 button.disabled=true;
 try{
  const native=nexusNative();
  if(native){
   const permission=await native.enable();
   if(!permission?.notificationEnabled)throw Error('Autorize as notificações do NexusMaster nas configurações do Android.');
   if(!permission.fullScreenEnabled)await native.fullScreenSettings();
   await syncNativeNotificationUi();
   return;
  }
  if(!('Notification' in window)||!('PushManager' in window)||!('serviceWorker' in navigator)){
   throw Error('Este navegador não oferece notificações Push para o aplicativo.');
  }
  // A user gesture explicitly arms the in-app ring tone (autoplay restrictions).
  try{alertCtx??=new (window.AudioContext||window.webkitAudioContext)();await alertCtx.resume()}catch{}
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('Permissão de notificações não concedida. Verifique as configurações do celular.');
  const key=await req('push/key');
  await navigator.serviceWorker.register('/sw.js',{scope:'/'});
  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(key.publicKey)});
  await post('push/subscribe',sub.toJSON());
  status.textContent='Notificações ativadas neste aparelho! Os próximos chamados poderão aparecer mesmo com o PWA fechado.';
  button.textContent='Alertas ativados';button.hidden=true;
  localStorage.setItem('nexus:intercom-notify-enabled','1');
 }catch(e){
  status.textContent=e.message;
  button.disabled=false;
 }
}
$('#enable-notifications').onclick=enableNotifications;
async function checkNotificationState(){
 if(nexusNative()){
  $('#intercom-description').textContent='Receba chamadas da portaria no aplicativo NexusMaster. Os alertas em segundo plano dependem do Android, da rede e das permissões.';
  $('#notification-explainer').textContent='As permissões são verificadas automaticamente quando você abre o aplicativo. Você só precisará agir se alguma delas estiver desativada.';
  await syncNativeNotificationUi();
  return;
 }
 if(!('Notification' in window))return;
 if(Notification.permission==='denied')$('#notification-status').textContent='Notificações bloqueadas. Autorize o NexusMaster nas configurações do navegador.';
 if(Notification.permission==='granted'){
  $('#notification-status').textContent='Permissão concedida. Use o botão para vincular este dispositivo à sua residência.';
 }
}
async function loadUnits(){
 const d=await req('units');$('#units').replaceChildren();
 for(const u of d.units){const opt=document.createElement('option');opt.value=u.id;opt.textContent=u.label;$('#units').append(opt)}
}
$('#addUnit').onclick=async()=>{
 try{await post('units',{id:$('#unitId').value,label:$('#unitLabel').value});notice('Residência cadastrada.');await loadUnits()}
 catch(e){notice(e.message)}
};
$('#addMember').onclick=async()=>{
 try{await post('members',{unitId:$('#units').value,userId:$('#userId').value});notice('Morador vinculado.')}
 catch(e){notice(e.message)}
};
let pilotNetworkActive=false;
function renderPilotNetworkState(state){
 const panel=$('#pilot-network-panel'),status=$('#pilot-network-status'),button=$('#pilot-network-toggle');
 if(!state?.supported){panel.hidden=true;return;}
 panel.hidden=false;pilotNetworkActive=state.allowed===true;
 if(pilotNetworkActive){
  const until=state.expiresAt?new Date(state.expiresAt*1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'15 minutos';
  status.textContent='Teste liberado para esta rede até '+until+'. O notebook já pode chamar após atualizar a página.';
  button.textContent='Encerrar teste nesta rede';
 }else{
  status.textContent='Teste temporário desativado. O visitante continuará precisando de GPS até que você autorize.';
  button.textContent='Autorizar teste nesta rede por 15 min';
 }
 button.disabled=false;
}
async function checkPilotNetwork(){
 try{renderPilotNetworkState(await req('pilot-network'));}
 catch{$('#pilot-network-panel').hidden=true;}
}
$('#pilot-network-toggle').onclick=async()=>{
 const button=$('#pilot-network-toggle');button.disabled=true;
 try{
  const state=await post('pilot-network',{enabled:!pilotNetworkActive});
  renderPilotNetworkState(state);
 }catch(e){
  $('#pilot-network-status').textContent='Não foi possível autorizar o teste: '+(e.message||e);
  button.disabled=false;
 }
};
async function setup(){
 try{
  const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok){notice('Faça login no NexusMaster e abra esta página novamente.');return}
  profile=(await response.json()).user;
  if(!validUser()){notice('Acesso restrito a moradores e síndicos.');return}
  if(profile.role==='sindico'){
   $('#setup').hidden=false;
   $('#qrurl').textContent=location.origin+'/interfone.html?central='+encodeURIComponent(profile.clientId);
   await loadUnits();
  }
  // Consume the native call choice BEFORE rendering pending calls. Otherwise
  // refresh() would reopen the incoming dialog and trigger another native ring.
  const nativeActionHandled=await resumeNativeCallChoice();
  await checkNotificationState();
  await checkPilotNetwork();
  if(!nativeActionHandled)await refresh();
  setInterval(refresh,2300);
 }catch(e){notice('Não foi possível iniciar o painel: '+e.message)}
}
// When returning from Android notification settings, refresh the visible status.
function resumeResidentCall(){
 if(!activeCall)return;
 updateResidentTimer();
 if(!activeCall)return;
 updateResidentConnectionCountdown();
 if(!activeCall)return;
 if(peer&&['failed','disconnected'].includes(peer.connectionState))startResidentConnectionGrace('webrtc_'+peer.connectionState);
 void syncActiveCall();
}
document.addEventListener('visibilitychange',()=>{
 if(activeCall)residentDiag.event(document.hidden?'segundo_plano':'primeiro_plano','android');
 if(document.hidden)return;
 if(validUser()&&nexusNative())syncNativeNotificationUi();
 if(activeCall)resumeResidentCall();
 else if(validUser())refresh();
});
window.addEventListener('focus',()=>{
 if(validUser()&&nexusNative())syncNativeNotificationUi();
 if(activeCall)resumeResidentCall();
 else if(validUser())refresh();
});
window.addEventListener('pageshow',()=>{if(activeCall)resumeResidentCall();});
window.addEventListener('online',()=>{
 if(activeCall){residentDiag.event('internet_restaurada','navigator_online');resumeResidentCall();}
});
window.addEventListener('offline',()=>{
 if(activeCall){residentDiag.event('internet_indisponivel','navigator_offline');
  startResidentConnectionGrace('navigator_offline');}
});
setup();
