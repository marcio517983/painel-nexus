// Initialize the production schema with the deployment's credentials.
// Preview and local builds never change the shared database.
if(process.env.VERCEL_ENV==='production') await import('./migrate.mjs');
import {cpSync,mkdirSync,readFileSync} from 'node:fs';
mkdirSync('dist',{recursive:true});cpSync('public','dist',{recursive:true});
for(const file of ['api/index.mjs','server/application.mjs','server/auth.mjs','server/core.mjs','server/resident.mjs'])if(!readFileSync(file,'utf8').trim())throw Error('Arquivo ausente: '+file);
console.log('Nexus preparado: arquivos estáticos + função Node na Vercel.');
