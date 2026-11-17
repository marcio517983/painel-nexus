/* Install entry points on supported browsers. Installation is optional. */
let deferredPrompt;
// Capacitor is already an installed Android/iOS application. Never offer the
// separate browser PWA installation inside its native WebView.
const isNativeApp=()=>{
 const c=window.Capacitor;
 return c?.isNativePlatform?.()===true||
  ['android','ios'].includes(c?.getPlatform?.())||
  Boolean(c?.Plugins?.NexusCall);
};
const standalone=()=>isNativeApp()||matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const display=()=>{
 const target=document.querySelector('[data-pwa-install]');
 if(!target)return;
 target.hidden=standalone();
 if(target.hidden)return;
 target.textContent=deferredPrompt?'Instalar NexusMaster':'Adicionar NexusMaster à tela inicial';
};
// The Capacitor APK uses Firebase Cloud Messaging, not browser Web Push.
if('serviceWorker' in navigator){
 addEventListener('load',()=>{
  if(!isNativeApp())navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
 });
}
addEventListener('beforeinstallprompt',event=>{event.preventDefault();if(isNativeApp())return;deferredPrompt=event;display();});
addEventListener('appinstalled',()=>{deferredPrompt=null;display();});
addEventListener('DOMContentLoaded',()=>{
 const btn=document.querySelector('[data-pwa-install]');if(!btn)return;
 btn.addEventListener('click',async()=>{
  if(deferredPrompt){const current=deferredPrompt;deferredPrompt=null;await current.prompt();display();return;}
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
  alert(ios?'No Safari, toque em Compartilhar e escolha Adicionar à Tela de Início.':'Abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial.');
 });display();
});
