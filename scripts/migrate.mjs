import {readFileSync} from 'node:fs';
import {database} from '../server/database.mjs';
const db=database();
const statements=['001','002'].flatMap(n=>readFileSync(new URL('../migrations/'+n+'.sql',import.meta.url),'utf8').replaceAll('--> statement-breakpoint','').replaceAll('CREATE TABLE `','CREATE TABLE IF NOT EXISTS `').replaceAll('CREATE INDEX `','CREATE INDEX IF NOT EXISTS `').split(';').map(s=>s.trim()).filter(Boolean));
await db.batch(statements,'write');console.log('Estrutura do banco atualizada. Nenhum cliente foi importado ou alterado.');db.close();
