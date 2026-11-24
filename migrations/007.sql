-- FCM data tokens for authenticated Android residents. Do not expose them to visitors.
CREATE TABLE IF NOT EXISTS intercom_fcm_tokens (
 token_hash TEXT PRIMARY KEY,
 token TEXT NOT NULL,
 client_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS intercom_fcm_by_resident
 ON intercom_fcm_tokens(client_id,user_id);
