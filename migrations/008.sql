-- Configuração de um ponto físico de chamada por condomínio.
-- Não armazena a posição de visitantes nem altera comandos de portões.
CREATE TABLE IF NOT EXISTS intercom_entrances (
 client_id TEXT PRIMARY KEY NOT NULL,
 latitude REAL NOT NULL,
 longitude REAL NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1,
 updated_at INTEGER NOT NULL,
 updated_by TEXT NOT NULL
);
