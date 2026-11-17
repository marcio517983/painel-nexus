import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const text=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
test('visitor and resident intercom scripts are valid JavaScript',()=>{
 for(const file of ['interfone.js','interfone-morador.js']){
  assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',new URL('../public/'+file,import.meta.url).pathname],{stdio:'pipe'}));
 }
});
test('resident separates audio and video before attaching to media elements',()=>{
 const js=text('interfone-morador.js');
 assert.match(js,/const media=new MediaStream\(\[event\.track\]\)/);
 assert.match(js,/if\(event\.track\.kind==='video'\)/);
 assert.match(js,/if\(event\.track\.kind==='audio'\)/);
 assert.match(js,/audio\.muted=false;audio\.volume=1;audio\.srcObject=media/);
 assert.match(js,/tryPlayVisitorAudio\(\)/);
 assert.match(js,/startInboundAudioDiagnostics\(\)/);
});
test('resident provides manual visitor sound recovery',()=>{
 const html=text('interfone-morador.html'),js=text('interfone-morador.js');
 assert.match(html,/id="enable-visitor-audio"/);
 assert.match(html,/id="visitor-audio-status"/);
 assert.match(js,/Reativar áudio/);
 assert.match(js,/await preferNativeSpeaker\(\);await tryPlayVisitorAudio\(\)/);
});
test('visitor checks input microphone and captures the chosen source',()=>{
 const html=text('interfone.html'),js=text('interfone.js');
 assert.match(html,/id="microphone-test-button"/);
 assert.match(html,/id="microphone-device"/);
 assert.match(js,/getUserMedia\(\{audio:microphoneConstraints\(\),video:false\}\)/);
 assert.match(js,/watchLiveMic\(stream\)/);
 assert.match(js,/function audioMeter/);
});
