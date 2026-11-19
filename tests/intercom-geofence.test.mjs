import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceMeters,validateIntercomPosition,INTERCOM_RADIUS_METERS} from '../server/intercom-geofence.mjs';
import {intercom} from '../server/intercom.mjs';

const entrance={latitude:-23.0,longitude:-46.0,enabled:1};
const position=(latitude,longitude,accuracy=5,timestamp=Date.now())=>({latitude,longitude,accuracy,timestamp});
test('geofence enforces 20 meter radius with Haversine, including 0 and nearby points',()=>{
 assert.equal(INTERCOM_RADIUS_METERS,20);
 assert.equal(validateIntercomPosition(entrance,position(-23,-46)).ok,true);
 const near=position(-23+15/111195,-46);
 assert.ok(distanceMeters(entrance.latitude,entrance.longitude,near.latitude,near.longitude)<20);
 assert.equal(validateIntercomPosition(entrance,near).ok,true);
 const far=position(-23+27/111195,-46);
 assert.equal(validateIntercomPosition(entrance,far).reason,'outside');
});
test('imprecise stale missing spoofable coordinates and disabled entrances fail closed',()=>{
 assert.equal(validateIntercomPosition(entrance,position(-23,-46,21)).reason,'imprecise');
 assert.equal(validateIntercomPosition(entrance,position(-23,-46,5,Date.now()-60_000)).reason,'stale');
 assert.equal(validateIntercomPosition(entrance,null).reason,'invalid');
 assert.equal(validateIntercomPosition(entrance,position(91,-46)).reason,'invalid');
 assert.equal(validateIntercomPosition(null,position(-23,-46)).reason,'not_configured');
 assert.equal(validateIntercomPosition({...entrance,enabled:0},position(-23,-46)).reason,'not_configured');
});
const makeEnv=(entranceRow)=>{
 const queries=[];
 const DB={prepare(sql){return{bind(...args){return{
  first:async()=>{
   queries.push(sql);
   if(sql.includes('FROM clients'))return{data:JSON.stringify({name:'Condomínio Piloto',users:[]})};
   if(sql.includes('FROM intercom_entrances'))return entranceRow;
   throw Error('Unexpected DB call before proximity validation: '+sql);
  },
  all:async()=>({results:[]}),
  run:async()=>{throw Error('Unexpected database write before proximity validation');}
 };}};}};
 return {env:{NEXUS_ORIGIN:'https://nexus.example',DB},queries};
};
const tryCall=(env,location)=>intercom(new Request('https://nexus.example/api/intercom/public/demo/calls',{
 method:'POST',headers:{origin:'https://nexus.example','content-type':'application/json'},
 body:JSON.stringify({unitId:'apto-102',reason:'entrega',location})
}),env);
test('call endpoint denies reused QR when visitor is outside 20 meters',async()=>{
 const {env,queries}=makeEnv(entrance);
 const response=await tryCall(env,position(-23+30/111195,-46));
 assert.equal(response.status,403);
 assert.match((await response.json()).message,/20 metros/);
 assert.ok(queries.some(x=>x.includes('FROM intercom_entrances')));
});
test('call endpoint denies unconfigured site and missing visitor GPS',async()=>{
 let result=await tryCall(makeEnv(null).env,position(-23,-46));
 assert.equal(result.status,409);
 result=await tryCall(makeEnv(entrance).env,null);
 assert.equal(result.status,403);
});
