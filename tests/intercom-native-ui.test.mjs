import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const pwaSource=readFileSync(new URL('../public/pwa.js',import.meta.url),'utf8');

function installButtonFor(capacitor){
 const handlers={},button={hidden:true,textContent:'',addEventListener(){}};
 const ctx={
  window:{Capacitor:capacitor},
  document:{querySelector:()=>button},
  matchMedia:()=>({matches:false}),
  navigator:{standalone:false},
  addEventListener:(type,cb)=>{handlers[type]=cb;},
  alert(){},
 };
 runInNewContext(pwaSource,ctx);
 handlers.DOMContentLoaded();
 return button;
}
test('Capacitor APK hides redundant browser installation prompt',()=>{
 const button=installButtonFor({isNativePlatform:()=>true,Plugins:{NexusCall:{}}});
 assert.equal(button.hidden,true);
});
test('PWA install prompt remains available in ordinary browser',()=>{
 const button=installButtonFor(undefined);
 assert.equal(button.hidden,false);
 assert.equal(button.textContent,'Adicionar NexusMaster à tela inicial');
});
test('Android FCM interface evaluates actual native permission and registration',()=>{
 const js=readFileSync(new URL('../public/interfone-morador.js',import.meta.url),'utf8');
 assert.match(js,/nativeNotificationSyncing/);
 assert.match(js,/nexusNative\(\)\.status\(\)/);
 assert.match(js,/registerFirebaseDevice\(\)/);
 assert.match(js,/if\(device\?\.deliveryConfigured\)/);
 assert.match(js,/showButton:false/);
});
