const token=location.hash.slice(1),central=new URLSearchParams(location.search).get('central')||'';
history.replaceState(null,'',location.pathname+location.search);
const form=document.querySelector('#invite-access'),button=document.querySelector('#enter'),cpf=document.querySelector('#cpf'),vehicle=document.querySelector('#vehicle'),notice=document.querySelector('#notice');
let needsVehicle=false,busy=false;
function showVehicle(show){needsVehicle=show;vehicle.hidden=!show;for(const input of vehicle.querySelectorAll('input'))input.disabled=!show;button.textContent=show?'Confirmar e acessar':'Continuar';}
async function submit(path,body){
 const response=await fetch('/api/auth/invite'+path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,central,...body})});
 const data=await response.json();if(!response.ok)throw Error(data.message||'Não foi possível conferir o convite.');return data;
}
if(!/^[a-f0-9]{64}$/.test(token)||!central){button.disabled=true;notice.textContent='Abra novamente o link completo enviado pelo seu anfitrião.';}
cpf.addEventListener('input',()=>{showVehicle(false);notice.textContent='';});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;busy=true;button.disabled=true;notice.textContent='Conferindo seu convite…';notice.className='';
 try{
  const fields=new FormData(form),body={cpf:fields.get('cpf')};
  if(!needsVehicle){
   const check=await submit('/check',body);
   if(check.needsVehicle){showVehicle(true);notice.textContent='CPF confirmado. Complete os dados do veículo para continuar.';vehicle.querySelector('input').focus();return;}
  }else body.vehicle={model:fields.get('model'),plate:fields.get('plate'),color:fields.get('color')};
  await submit('',body);cpf.value='';location.replace('/morador.html?central='+encodeURIComponent(central));
 }catch(error){notice.textContent=error.message;notice.className='error';}
 finally{busy=false;button.disabled=false;}
});
