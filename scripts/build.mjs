// Initialize the production schema with the deployment's credentials.
// Preview and local builds never change the shared database.
if(process.env.VERCEL_ENV==='production') await import('./migrate.mjs');
// Explicit, one-branch-only bootstrap for the isolated NexusMaster test database.
// Never run preview migrations on an unknown database or an unrecognized branch.
if(process.env.VERCEL_ENV==='preview' && process.env.NEXUS_PREVIEW_SCHEMA_INIT==='1'){
 const expectedDatabase='libsql://nexusmaster-teste-marcio517983.aws-us-east-1.turso.io';
 const expectedBranch='feature/interfone-virtual-mvp';
 if(process.env.TURSO_DATABASE_URL!==expectedDatabase||process.env.VERCEL_GIT_COMMIT_REF!==expectedBranch){
  throw Error('Migração de Preview bloqueada: banco ou branch não autorizados.');
 }
 if(!process.env.TURSO_AUTH_TOKEN)throw Error('Migração de Preview bloqueada: token de teste ausente.');
 await import('./migrate.mjs');
 console.log('Nexus Interfone: migrações aplicadas somente ao banco de testes autorizado.');
}
import {cpSync,mkdirSync,readFileSync} from 'node:fs';
mkdirSync('dist',{recursive:true});cpSync('public','dist',{recursive:true});
for(const file of ['api/index.mjs','server/application.mjs','server/auth.mjs','server/core.mjs','server/resident.mjs'])if(!readFileSync(file,'utf8').trim())throw Error('Arquivo ausente: '+file);
console.log('Nexus preparado: arquivos estáticos + função Node na Vercel.');
