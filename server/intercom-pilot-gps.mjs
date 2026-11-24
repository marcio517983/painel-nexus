/**
 * Preview-only, short-lived GPS suspension for two-phone NexusMaster intercom tests.
 * NOT proof of proximity. Only fictional 'interfone-piloto' on the isolated DB.
 * No impact on production, physical access commands or other tenants.
 */
export const PILOT_GPS_TENANT='interfone-piloto';
export function pilotGpsBypass(env,cid,at=Date.now()){
 if(cid!==PILOT_GPS_TENANT||
   env.VERCEL_ENV!=='preview'||
   env.VERCEL_GIT_COMMIT_REF!=='feature/interfone-virtual-mvp'||
   env.NEXUS_PREVIEW_SCHEMA_INIT!=='1'||
   env.TURSO_DATABASE_URL!=='libsql://nexusmaster-teste-marcio517983.aws-us-east-1.turso.io')return {enabled:false,expiresAt:null};
 // Requires an explicit branch-scoped Vercel setting; expires automatically.
 const expiry=String(env.NEXUS_PILOT_GPS_BYPASS_UNTIL||'');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(expiry))return {enabled:false,expiresAt:null};
 const expires=Date.parse(expiry);
 if(!Number.isFinite(expires)||at>=expires||expires-at>7*86400*1000)return {enabled:false,expiresAt:null};
 return {enabled:true,expiresAt:Math.floor(expires/1000)};
}
