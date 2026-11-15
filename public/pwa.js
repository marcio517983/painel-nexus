/* Install entry points on supported browsers. Installation is optional. */
let deferredPrompt;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const display=()=>{
 const target=document.querySelector('[data-pwa-install]');
 if(!target)return;
 target.hidden=standalone();
 if(target.hidden)return;
 target.textContent=deferredPrompt?'Instalar NexusMaster':'Adicionar NexusMaster à tela inicial';
};
if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{}));}
addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;display();});
addEventListener('appinstalled',()=>{deferredPrompt=null;display();});
addEventListener('DOMContentLoaded',()=>{
 const btn=document.querySelector('[data-pwa-install]');if(!btn)return;
 btn.addEventListener('click',async()=>{
  if(deferredPrompt){const current=deferredPrompt;deferredPrompt=null;await current.prompt();display();return;}
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
  alert(ios?'No Safari, toque em Compartilhar e escolha Adicionar à Tela de Início.':'Abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial.');
 });display();
});
