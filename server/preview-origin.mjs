/**
 * Validate browser CSRF Origin. Production only accepts the configured origin.
 * The isolated NexusMaster Preview pilot additionally accepts its own current
 * canonical Vercel deployment URL, which changes on each Git push.
 */
export function nexusOriginAllowed(request,env){
 const origin=request.headers.get('origin');
 if(!origin)return false;
 if(origin===env.NEXUS_ORIGIN)return true;
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!=='feature/interfone-virtual-mvp'||
    env.TURSO_DATABASE_URL!=='libsql://nexusmaster-teste-marcio517983.aws-us-east-1.turso.io')return false;
 try{
  const page=new URL(request.url),sent=new URL(origin);
  return sent.origin===page.origin&&page.protocol==='https:'&&
   typeof env.VERCEL_URL==='string'&&page.hostname===env.VERCEL_URL&&
   page.hostname.endsWith('.vercel.app');
 }catch{return false;}
}
