import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const txt=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
test('install manifest has correct NexusMaster entry point and icons',()=>{
 const m=JSON.parse(txt('manifest.webmanifest'));
 assert.equal(m.start_url,'/morador.html');
 assert.equal(m.display,'standalone');
 for(const size of ['192x192','512x512']) assert.ok(m.icons.some(i=>i.sizes===size&&i.type==='image/png'));
});
test('PWA uses network only for private or command APIs',()=>{
 const sw=txt('sw.js');
 assert.match(sw,/path\.startsWith\('\/api\/'\)/);
 assert.ok(!sw.includes('caches.put('));
 assert.ok(!sw.includes('localStorage'));
});
test('resident and intercom pages both declare the app manifest',()=>{
 for(const path of ['index.html','morador.html','interfone-morador.html','master.html']){
  assert.match(txt(path),/rel="manifest"/);
  assert.match(txt(path),/src="\/pwa\.js"/);
 }
});