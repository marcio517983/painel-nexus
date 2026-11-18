/**
 * CSRF Origin check for NexusMaster.
 * Production only accepts the configured NEXUS_ORIGIN.
 *
 * In the isolated Preview pilot, api/index.mjs constructs Request.url using
 * NEXUS_ORIGIN (the static base). The actual browser-hosted preview domain is
 * instead provided by Vercel's incoming Host header. Compare that Host with
 * the browser Origin, and allow ONLY the exact deployment-host format for the
 * pilot project. This never changes production origin policy.
 */
const PREVIEW_HOST=/^painel-nexus-nexus-[a-z0-9]+-controws-iot\.vercel\.app$/;
export function nexusOriginAllowed(request,env){
 const origin=request.headers.get('origin');
 if(!origin)return false;
 if(origin===env.NEXUS_ORIGIN)return true;
 if(env.VERCEL_ENV!=='preview'||
    env.VERCEL_GIT_COMMIT_REF!=='feature/interfone-virtual-mvp'||
    env.NEXUS_PREVIEW_SCHEMA_INIT!=='1'||
    env.TURSO_DATABASE_URL!=='libsql://nexusmaster-teste-marcio517983.aws-us-east-1.turso.io')return false;
 try{
  const suppliedHost=request.headers.get('host')||'';
  const browserOrigin=new URL(origin);
  // No cross-origin calls, external redirects, subdomains, ports or schemes.
  if(browserOrigin.origin!==origin||browserOrigin.protocol!=='https:'||
     browserOrigin.port||!PREVIEW_HOST.test(browserOrigin.hostname))return false;
  return suppliedHost===browserOrigin.host;
 }catch{return false;}
}
