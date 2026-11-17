import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext,Script} from 'node:vm';

function browserHarness(filename){
 const source=readFileSync(new URL('../public/'+filename,import.meta.url),'utf8');
 new Script(source,{filename}); // Browser syntax must remain valid.
 const nodes=new Map();
 function element(selector){
  if(!nodes.has(selector)){
   nodes.set(selector,{
    hidden:false,disabled:false,srcObject:null,textContent:'',value:'',
    open:false,classList:{add(){},remove(){}},
    addEventListener(){},replaceChildren(){},append(){},
    play(){this.played=true;return Promise.resolve();},pause(){this.paused=true;},
    close(){this.open=false;},showModal(){this.open=true;}
   });
  }
  return nodes.get(selector);
 }
 class Track{
  constructor(kind){this.kind=kind;this.readyState='live';this.handlers={};}
  stop(){this.readyState='ended';}
  addEventListener(event,cb){this.handlers[event]=cb;}
 }
 class MediaStream{
  constructor(tracks=[]){this.tracks=tracks;}
  getTracks(){return this.tracks;}
  getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}
  getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}
 }
 const webcam=new MediaStream([new Track('video')]);
 const mic=new MediaStream([new Track('audio')]);
 const captures=[];
 const peerConnections=[];
 class Peer{
  constructor(){this.iceGatheringState='complete';this.connectionState='connected';this.added=[];this.localDescription={type:'offer',sdp:'v=0'};peerConnections.push(this);}
  addTrack(track,media){this.added.push({kind:track.kind,media});}
  close(){this.closed=true;}
  async createOffer(){return {type:'offer',sdp:'v=0'};}
  async createAnswer(){return {type:'answer',sdp:'v=0'};}
  async setLocalDescription(desc){this.localDescription=desc;}
  async setRemoteDescription(desc){this.remoteDescription=desc;}
 }
 const remoteVideoOffer={type:'offer',sdp:'v=0\\r\\nm=video 9 UDP/TLS/RTP/SAVPF 96'};
 const ctx=createContext({
  window:{addEventListener(){},Capacitor:undefined,isSecureContext:true},
  document:{querySelector:element,body:{append(){}},addEventListener(){}},
  navigator:{mediaDevices:{async getUserMedia(options){captures.push(options);return options.video?webcam:mic;}}},
  location:{search:'',origin:'https://nexus.example'},URLSearchParams,
  MediaStream,RTCPeerConnection:Peer,Track,Audio:class{constructor(){this.style={};}play(){return Promise.resolve();}setAttribute(){}remove(){}},
  fetch:async(url,options)=>{
   const data=String(url).includes('/api/auth/me')?{user:null}:
    String(url).includes('/signal')&&!options?.method?{offer:remoteVideoOffer}:
    String(url).includes('/answer')?{sdp:{type:'answer',sdp:'v=0'}}:{ok:true};
   return {ok:!String(url).includes('/api/auth/me'),json:async()=>data};
  },
  setInterval(){},clearInterval(){},setTimeout(){},clearTimeout(){},
  console,URL,Date,Math,Uint8Array
 });
 runInContext(source,ctx);
 return {ctx,element,peerConnections,webcam,mic,captures,Track,MediaStream};
}

test('visitor webcam capture only starts by explicit click and adds video+audio to WebRTC',async()=>{
 const h=browserHarness('interfone.js');
 assert.equal(h.captures.length,0,'camera must not start just by opening the visitor page');
 await h.element('#camera-start').onclick();
 assert.equal(h.captures.length,1);
 assert.equal(h.captures[0].audio,false);
 assert.ok(h.captures[0].video);
 assert.equal(h.element('#camera-status').textContent.includes('Câmera pronta.'),true);
 runInContext('call="123"; secret="test-call-token";',h.ctx);
 await runInContext('startAudio()',h.ctx);
 const peer=h.peerConnections.at(-1);
 assert.deepEqual(peer.added.map(t=>t.kind),['audio','video']);
 assert.equal(peer.added[0].media,peer.added[1].media);
 runInContext('done("ended")',h.ctx);
 assert.equal(h.webcam.getVideoTracks()[0].readyState,'ended');
 assert.equal(h.element('#calling-video-status').hidden,true);
});

test('visitor call stays audio-only when the webcam is off',async()=>{
 const h=browserHarness('interfone.js');
 runInContext('call="123"; secret="test-call-token";',h.ctx);
 await runInContext('startAudio()',h.ctx);
 const peer=h.peerConnections.at(-1);
 assert.deepEqual(peer.added.map(t=>t.kind),['audio']);
 assert.equal(h.captures.length,1);
 assert.equal(h.captures[0].video,false);
});

test('resident displays remote video while audio still uses its own element',async()=>{
 const h=browserHarness('interfone-morador.js');
 runInContext('activeCall="abc"; stream=new MediaStream([new Track("audio")]);',h.ctx);
 await runInContext('connectAudio("abc")',h.ctx);
 const peer=h.peerConnections.at(-1);
 assert.ok(peer);
 const remoteStream=new h.MediaStream([new h.Track('video'),new h.Track('audio')]);
 const videoTrack=remoteStream.getVideoTracks()[0];
 peer.ontrack({track:videoTrack,streams:[remoteStream]});
 assert.equal(h.element('#remote-video').hidden,false);
 assert.equal(h.element('#remote-video').srcObject,remoteStream);
 assert.equal(h.element('#remote-video').played,true);
 peer.ontrack({track:remoteStream.getAudioTracks()[0],streams:[remoteStream]});
 assert.equal(h.element('#remote-audio').srcObject,remoteStream);
 assert.equal(h.element('#remote-audio').played,true);
 videoTrack.handlers.ended();
 assert.equal(h.element('#remote-video').hidden,true);
});

test('videoporteiro markup includes distinct camera capture and resident playback controls',()=>{
 const visitor=readFileSync(new URL('../public/interfone.html',import.meta.url),'utf8');
 const resident=readFileSync(new URL('../public/interfone-morador.html',import.meta.url),'utf8');
 for(const id of ['camera-device','camera-start','camera-stop','camera-status','calling-video-status'])assert.match(visitor,new RegExp('id="'+id+'"'));
 // Visitor cannot see the captured camera even during an active call.
 assert.doesNotMatch(visitor,/<video\b/i);
 assert.doesNotMatch(visitor,/id="camera-preview"|id="calling-video"/);
 for(const id of ['remote-video','video-status','remote-audio'])assert.match(resident,new RegExp('id="'+id+'"'));
});
