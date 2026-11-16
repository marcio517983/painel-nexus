document.addEventListener('click',async e=>{
 const a=e.target.closest('[data-logout]');if(!a)return;
 e.preventDefault();
 try{
  const native=window.Capacitor?.Plugins?.NexusCall;
  // Unlink only this Android installation from the resident before logout.
  if(native?.fcmToken){
   try{
    const {token}=await native.fcmToken();
    const ctrl=new AbortController();
    const timeout=setTimeout(()=>ctrl.abort(),3000);
    try{
     if(token)await fetch('/api/intercom/fcm/unregister',{
      method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({token}),signal:ctrl.signal
     });
    }finally{clearTimeout(timeout);}
   }catch{/* Offline logout must remain possible. */}
  }
  const response=await fetch('/api/auth/logout',{method:'POST'});
  if(!response.ok)throw Error();
  try{localStorage.removeItem('nexus:lastCentral')}catch{}
  location.href='/';
 }catch{alert('Não foi possível encerrar a sessão. Tente novamente.')}
});
