import {readFileSync} from 'node:fs';
import {database} from '../server/database.mjs';
const db=database();
const statements=['001','002','003','004','005','006','007','008'].flatMap(n=>readFileSync(new URL('../migrations/'+n+'.sql',import.meta.url),'utf8').replaceAll('--> statement-breakpoint','').replaceAll('CREATE TABLE `','CREATE TABLE IF NOT EXISTS `').replaceAll('CREATE INDEX `','CREATE INDEX IF NOT EXISTS `').replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean));
await db.batch(statements,'write');
if(process.env.VERCEL_ENV==='preview'&&process.env.NEXUS_PREVIEW_SCHEMA_INIT==='1'){
 const {seedPreviewIntercom}=await import('./seed-preview-intercom.mjs');
 await seedPreviewIntercom(db);
}
console.log('Estrutura atualizada; cadastros explicitamente simulados arquivados; clientes físicos preservados.');db.close();
