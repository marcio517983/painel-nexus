# Backup do banco Turso — NexusMaster / Porteiro Cloud
Data de preparação: 2026-11-19.

## Situação
**Este documento prepara a exportação; não afirma que a cópia dos dados já foi criada.**
Os backups de código estão nas branches backup/2026-11-19-*.
A base de produção não deve ser modificada para fazer a cópia.

## Pré-requisitos
- Terminal com Turso CLI instalado e conta com acesso ao banco (ver instruções oficiais em https://docs.turso.tech/cli/introduction).
- Não colocar TURSO_AUTH_TOKEN, credenciais, arquivos SQL com dados pessoais nem arquivo .env no GitHub.
- Identificar **com certeza** o nome do banco de produção usando `turso db list` antes de executar.

## Procedimento manual de cópia no Turso (sem alterar a origem)

1. Autentique de forma interativa: `turso auth login`.
2. Liste os bancos: `turso db list`. Copie o nome exato do banco em produção.
3. Crie uma cópia com um nome novo e único (exemplo — ajuste o nome original):
   ```sh
   turso db create nexusmaster-backup-20261119 --from-db NOME_DO_BANCO_ORIGINAL
   ```
4. Confirme a existência do novo banco com `turso db list`.
5. Gere um dump local em pasta privada, fora do repositório:
   ```sh
   turso db shell nexusmaster-backup-20261119 .dump > nexusmaster-backup-20261119.sql
   ```
6. Valide que o dump tem conteúdo e que começa com SQL; **não** interprete arquivo vazio ou erros no terminal como sucesso. Em um computador com sqlite3, teste importando o dump em **outro banco local temporário**, nunca na produção:
   ```sh
   sqlite3 teste-restauracao.sqlite < nexusmaster-backup-20261119.sql
   sqlite3 teste-restauracao.sqlite "PRAGMA integrity_check;"
   ```
   O resultado esperado é `ok`. Verifique também as tabelas e contagens esperadas.
7. Proteja a cópia em armazenamento privado criptografado com retenção e acesso restrito. O dump pode conter dados pessoais e credenciais derivados.
8. Registre a data/hora da exportação, banco de origem, identificação da cópia, tamanho e resultado da restauração de teste.

## Política segura
- **Nunca** execute `DROP`, `DELETE`, `UPDATE`, migrations ou procedimentos de restauração contra o banco de produção para realizar backup.
- O snapshot criado no Turso não equivale a um backup independente da conta do provedor. Guarde também a cópia SQL em local seguro separado.
- Para restaurar depois, crie outro banco e teste a aplicação nele antes de considerar troca da conexão Vercel.
- Esta documentação não executa operações no Turso. A realização exige acesso autenticado à conta proprietária e validação do resultado.
