-- Retire only explicitly marked simulator registrations; preserve their audit data.
UPDATE clients SET data=json_set(data,'$.archived',json('true')) WHERE json_extract(data,'$.simulation')=1 AND coalesce(json_extract(data,'$.archived'),0)<>1;
DELETE FROM sessions WHERE client_id IN (SELECT id FROM clients WHERE json_extract(data,'$.simulation')=1);
UPDATE commands SET status='failed',result='Central de simulação desativada' WHERE status='queued' AND client_id IN (SELECT id FROM clients WHERE json_extract(data,'$.simulation')=1);
CREATE TABLE IF NOT EXISTS pump_totals(client_id TEXT NOT NULL,device_id TEXT NOT NULL,counter_epoch TEXT NOT NULL,cycles INTEGER NOT NULL,runtime_seconds INTEGER NOT NULL,pump INTEGER NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(client_id,device_id,counter_epoch));
CREATE TABLE IF NOT EXISTS pump_samples(id TEXT PRIMARY KEY,client_id TEXT NOT NULL,device_id TEXT NOT NULL,counter_epoch TEXT NOT NULL,at INTEGER NOT NULL,pump INTEGER NOT NULL,cycles INTEGER NOT NULL,runtime_seconds INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS pump_samples_device ON pump_samples(client_id,device_id,at);
