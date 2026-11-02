import {createClient} from '@libsql/client';
let client;
export function database(){
 if(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN)throw Error('Banco não configurado');
 return client??=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
}
export function adapter(client,metrics){return{prepare(sql){return{bind(...args){const execute=async()=>{const r=await client.execute({sql,args});if(metrics){metrics.dbQueries++;metrics.dbRowsReturned+=r.rows.length;metrics.dbRowsAffected+=Number(r.rowsAffected)||0;}return r;};return{async first(){return (await execute()).rows[0]||null},async all(){return{results:(await execute()).rows}},async run(){return execute()}}}}}};}
