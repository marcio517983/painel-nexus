-- Private invitation data is never part of the configuration sent to the ESP.
CREATE TABLE IF NOT EXISTS invite_details(client_id TEXT NOT NULL,user_id TEXT NOT NULL,cpf_hash TEXT NOT NULL,vehicle TEXT NOT NULL DEFAULT '',expires INTEGER NOT NULL,PRIMARY KEY(client_id,user_id));
CREATE INDEX IF NOT EXISTS invite_details_expiry ON invite_details(expires);
