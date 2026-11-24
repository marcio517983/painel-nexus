/**
 * NexusMaster Interfone public-call geofence. This evaluates coordinates reported
 * by the visitor's device; it does NOT provide tamper-resistant proof of presence.
 */
export const INTERCOM_RADIUS_METERS=20;
export const INTERCOM_MAX_ACCURACY_METERS=20;
export const INTERCOM_MAX_POSITION_AGE_MS=30_000;
const EARTH_METERS=6_371_000;

export function validLatLon(latitude,longitude){
 return typeof latitude==='number'&&typeof longitude==='number'&&
  Number.isFinite(latitude)&&Number.isFinite(longitude)&&
  latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180;
}
export function distanceMeters(lat1,lon1,lat2,lon2){
 const rad=Math.PI/180;
 const dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad;
 const a=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
 return 2*EARTH_METERS*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));
}
export function validateIntercomPosition(entrance,position,at=Date.now()){
 if(!entrance||entrance.enabled!==1&&entrance.enabled!==true||
    !validLatLon(Number(entrance.latitude),Number(entrance.longitude))){
  return {ok:false,reason:'not_configured'};
 }
 if(!position||!validLatLon(position.latitude,position.longitude)||
    typeof position.accuracy!=='number'||!Number.isFinite(position.accuracy)||position.accuracy<=0){
  return {ok:false,reason:'invalid'};
 }
 if(typeof position.timestamp!=='number'||!Number.isFinite(position.timestamp)||
    Math.abs(at-position.timestamp)>INTERCOM_MAX_POSITION_AGE_MS){
  return {ok:false,reason:'stale'};
 }
 if(position.accuracy>INTERCOM_MAX_ACCURACY_METERS){
  return {ok:false,reason:'imprecise'};
 }
 const distance=distanceMeters(Number(entrance.latitude),Number(entrance.longitude),position.latitude,position.longitude);
 if(distance>INTERCOM_RADIUS_METERS)return {ok:false,reason:'outside'};
 return {ok:true,distanceMeters:distance};
}
