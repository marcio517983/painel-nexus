# NexusMaster — ativação isolada da prévia

**Não apontar a prévia para o banco Turso de produção.** As credenciais atuais do projeto Vercel só estão habilitadas em Production.

## Pré-requisito de conta externa (ação do proprietário)

A conta Turso não está disponível na conexão atual do assistente. O proprietário deve autenticar a conta e criar uma base libSQL VAZIA chamada `nexusmaster-teste` usando o [Turso Dashboard](https://turso.tech/) ou a CLI oficial.

Exemplo de comandos Turso Cloud (após instalar e fazer `turso auth login`):

```sh
turso db create nexusmaster-teste
turso db show nexusmaster-teste --url
turso db tokens create nexusmaster-teste
```

O projeto usa `@libsql/client`, portanto a base precisa ser **libSQL compatível**, não uma troca implícita para outro protocolo.

**Não compartilhar tokens em mensagens, issues ou commits.** Guardar os segredos apenas nas variáveis de ambiente da Vercel.

## Variáveis de ambiente — Vercel Preview

No projeto `painel-nexus-nexus-iot` em Settings > Environment Variables, definir para o alvo **Preview**:

- `TURSO_DATABASE_URL` → URL da nova base vazia
- `TURSO_AUTH_TOKEN` → token gerado para a base de testes, com acesso à base e não a outras bases
- `NEXUS_ORIGIN` → URL HTTPS exata do deployment de Preview que será testado (sem barra final)
- `NEXUS_ADMIN_EMAIL` → e-mail **fictício** de administrador de testes
- `NEXUS_ADMIN_HASH` e `NEXUS_ADMIN_SALT` → par de credenciais de testes criado por `npm run admin:password` localmente; não reutilizar a senha de produção

Confirme que a variável está limitada a **Preview**, não Production. Prefira variáveis vinculadas à branch `feature/interfone-virtual-mvp` se o projeto hospedar outras branches.

## Inicialização

A rotina `scripts/build.mjs` executa migrações automaticamente **somente** para `VERCEL_ENV=production`. Portanto a migração do banco de Preview deve ser executada explicitamente após configurar os segredos em uma sessão local/autorizada:

```sh
npm ci
npm run db:migrate
```

Ela lê os arquivos `migrations/001.sql` a `005.sql`. Execute somente com URL e token da base **de testes**, nunca com os de produção. A migração 003 é específica para arquivar simulações marcadas e por isso o alvo precisa ser uma base vazia.

Após inserir as variáveis no Preview, realizar **Redeploy** da branch. A URL da implantação pode mudar: ajustar `NEXUS_ORIGIN` ou apontar para um hostname estável sob seu controle antes de usar login.

## Validação antes de qualquer uso

1. Conferir se a base de testes está vazia e se os deploys de `main` continuam separados.
2. Entrar com usuário Master de testes e cadastrar condomínio, síndico e morador fictícios. Não usar dados reais.
3. Cadastrar unidade (`apto-102`) e vincular o morador fictício em `/interfone-morador.html`.
4. Abrir `/interfone.html?central=<id-de-teste>` em outro celular.
5. Verificar toques por 30 segundos, recusa, expiração e tentativa de áudio. WebRTC em rede móvel pode precisar de servidor TURN.
6. Não publicar QR Code real nem habilitar abertura de portões nesse piloto.

## Status conhecido

- Pull request em rascunho: https://github.com/marcio517983/painel-nexus/pull/1
- Teste e build no GitHub Actions: https://github.com/marcio517983/painel-nexus/actions/runs/43776286998 (sucesso)
- Preview estático da Vercel pronto, mas **não funcional no backend** até criar base isolada e configurar variáveis.

