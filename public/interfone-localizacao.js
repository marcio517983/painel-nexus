const $=s=>document.querySelector(s);let profile=null;
const setStatus=s=>$('#status').textContent=s;
function suffix(){return profile?.role==='master'?'?central='+encodeURIComponent($('#central').value.trim()):'';}
async function api(method,body){const r=await fetch('/api/intercom/entrance'+suffix(),{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw Error(d.message||'Falha na configuração');return d;}
function capturePosition(){return new Promise((resolve,reject)=>{if(!window.isSecureContext||!navigator.geolocation)return reject(Error('Abra esta página no navegador HTTPS de um celular com GPS.'));
navigator.geolocation.getCurrentPosition(p=>{
 if(!Number.isFinite(p.coords.accuracy)||p.coords.accuracy<=0||p.coords.accuracy>20)return reject(Error('Precisão insuficiente: '+Math.round(p.coords.accuracy)+' m. Vá à portaria, ative localização precisa e tente novamente.'));
 resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp});
},e=>reject(Error(({1:'Permita a localização precisa neste navegador.',2:'Localização indisponível. Ative o GPS.',3:'A localização demorou. Tente novamente.'})[e.code]||'Erro ao consultar GPS.')),{enableHighAccuracy:true,maximumAge:0,timeout:18000});
});}
async function updateStatus(){if(!profile)return;try{const d=await api('GET');setStatus(d.configured?'Portaria configurada. Raio de '+d.radiusMeters+' m. Atualização: '+new Date(d.entrance.updated_at*1000).toLocaleString('pt-BR'):'A portaria ainda não possui localização cadastrada: as chamadas públicas estão bloqueadas.')}catch(e){setStatus(e.message);}}
async function setup(){try{const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('Entre na sua conta NexusMaster primeiro.');profile=(await r.json()).user;
if(!['master','sindico'].includes(profile.role))throw Error('Apenas Master e síndico podem configurar a localização.');
$('#central').value=profile.role==='master'?new URLSearchParams(location.search).get('central')||'':profile.clientId;$('#central').disabled=profile.role!=='master';$('#capture').disabled=false;
await updateStatus();}catch(e){setStatus(e.message);}}
$('#central').addEventListener('change',()=>updateStatus());
$('#capture').onclick=async()=>{if(!$('#central').value.trim())return setStatus('Informe o código do condomínio antes de continuar.');const button=$('#capture');button.disabled=true;try{setStatus('Buscando posição GPS precisa...');const pos=await capturePosition();if(!confirm('Você está exatamente no ponto da portaria onde o QR Code será colocado? Salvar esta localização?')){setStatus('Cadastro cancelado.');return;}
setStatus('Gravando localização de portaria...');await api('POST',pos);setStatus('Localização salva. O QR Code agora exige distância de até 20 metros e precisão de até 20 metros.');}
catch(e){setStatus(e.message);}finally{button.disabled=false;}};
setup();
