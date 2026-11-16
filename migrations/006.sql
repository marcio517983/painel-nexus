-- Browser Push subscriptions are scoped by tenant and authenticated resident.
-- Never expose endpoint, auth or p256dh to the public interfone API.
CREATE TABLE IF NOT EXISTS intercom_push_subscriptions (
 client_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 endpoint_hash TEXT NOT NULL,
 endpoint TEXT NOT NULL,
 p256dh TEXT NOT NULL,
 auth TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(client_id,user_id,endpoint_hash)
);
CREATE INDEX IF NOT EXISTS intercom_push_recipient
 ON intercom_push_subscriptions(client_id,user_id);
