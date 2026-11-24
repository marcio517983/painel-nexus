import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('Web Push identifies the portaria as caller and residence as destination',()=>{
 const sw=src('public/sw.js');
 assert.match(sw,/Chamada da Portaria/);
 assert.match(sw,/destinationLabel/);
 assert.match(sw,/Destino: /);
});
test('intercom backend sends authorized destination label to Web Push',()=>{
 const api=src('server/intercom.mjs');
 assert.match(api,/destinationLabel:String\(destinationLabel\|\|'Residência'\)/);
 assert.match(api,/notifyResidents\(env,cid,unitId,reason,id,created\+30,u\.label\)/);
});
test('resident dashboard and FCM use portaria as the caller',()=>{
 const ui=src('public/interfone-morador.js');
 const fcm=src('server/intercom-fcm.mjs');
 assert.match(ui,/label:'Portaria'/);
 assert.match(ui,/Destino: /);
 assert.match(fcm,/label:'Portaria',destinationLabel:/);
});
