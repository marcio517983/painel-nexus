export async function recordPumps(db,c,nodes,now){
 if(!c.nodes.some(n=>n.type==='water'))return;
 for(const n of nodes){
  if(!n.online||!c.nodes.some(d=>d.id===n.id&&d.type==='water')||![0,1].includes(n.pump)||!Number.isSafeInteger(n.cycles)||!Number.isSafeInteger(n.runtimeSeconds)||n.cycles<0||n.runtimeSeconds<0||!/^[a-f0-9]{32}$/.test(n.counterEpoch||''))continue;
  const old=await db.prepare('SELECT * FROM pump_totals WHERE client_id=? AND device_id=? AND counter_epoch=?').bind(c.id,n.id,n.counterEpoch).first();
  if(old&&(n.cycles<old.cycles||n.runtimeSeconds<old.runtime_seconds))throw Object.assign(Error('Contadores da bomba diminuíram; confira a memória e o provisionamento.'),{status:409});
  if(old&&old.pump===n.pump&&now-old.updated<60)continue;
  await db.prepare('INSERT INTO pump_totals VALUES(?,?,?,?,?,?,?) ON CONFLICT(client_id,device_id,counter_epoch) DO UPDATE SET cycles=excluded.cycles,runtime_seconds=excluded.runtime_seconds,pump=excluded.pump,updated=excluded.updated').bind(c.id,n.id,n.counterEpoch,n.cycles,n.runtimeSeconds,n.pump,now).run();
  await db.prepare('INSERT INTO pump_samples VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),c.id,n.id,n.counterEpoch,now,n.pump,n.cycles,n.runtimeSeconds).run();
 }
 await db.prepare('DELETE FROM pump_samples WHERE client_id=? AND at<?').bind(c.id,now-c.retention*86400).run();
}
