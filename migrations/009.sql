-- Only used by interfone-piloto in isolated Vercel Preview; never grants production calls.
CREATE TABLE `intercom_pilot_network_sessions` (
 `client_id` TEXT PRIMARY KEY NOT NULL,
 `ip_hash` TEXT NOT NULL,
 `expires_at` INTEGER NOT NULL,
 `authorized_by` TEXT NOT NULL,
 `created_at` INTEGER NOT NULL
);
CREATE INDEX `intercom_pilot_network_sessions_expiry` ON `intercom_pilot_network_sessions` (`expires_at`);
