# NexusMaster — Vercel

Aplicação com servidor Node, login próprio e banco Turso/libSQL. O painel e o portal reutilizam a versão validada na bancada; o HTML antigo em `nexus-iot/index.html` redireciona para o novo login.

## Estado desta entrega

Implementado: Master com clientes e módulos; síndico limitado ao próprio condomínio e à gestão de moradores; login por e-mail/senha; portões autorizados para moradores; convites temporários revogáveis; histórico restrito a síndico/Master; recebimento de nível, ciclos e tempo acumulado de bomba; protocolo HTTPS de gateway e OTA assinada da S3. A leitura de ciclos/horas é exibida somente se recebida da placa, nunca estimada por comandos.

Limites herdados: 6 módulos e 32 usuários (incluindo visitantes ativos) por S3; máximo de 7 dias por convite; sessão de 8 horas; comandos expiram em 8 segundos e não têm reenvio automático. O cadastro permite indicar ESP32 DevKit, C3 e ESP8266; isso **não cria nem valida firmware para cada modelo**. O firmware físico validado anteriormente é o da bancada S3 + DevKit. Bomba/C3 e hall/ESP8266 exigem firmware e teste específicos. Convites por link desta versão são de acesso online; não há vínculo criptográfico ao aparelho do visitante nem conversão automática para o portal local da S3.

## Configurar Vercel

1. O projeto deve importar `marcio517983/painel-nexus`, branch `main`.
2. **Root Directory: raiz do repositório**, vazio ou `.`. Não usar `nexus-iot`.
3. Framework Preset: **Other**; Build Command: `npm run build`; Output Directory: `dist`; Install Command: `npm ci`; Node.js 22.x.
4. Criar um banco Turso e configurar as variáveis abaixo somente no servidor da Vercel. Nenhum segredo deve entrar no GitHub ou em arquivos públicos.
5. Aplicar as migrações com `npm run db:migrate` em terminal confiável com `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` no ambiente. O script é idempotente e não importa clientes existentes.
6. Fazer o deploy e validar `/`, login Master e criação de central antes de alterar qualquer placa.

| Variável | Valor |
| --- | --- |
| TURSO_DATABASE_URL | URL libsql do banco |
| TURSO_AUTH_TOKEN | Token de acesso do banco |
| NEXUS_ORIGIN | Origem HTTPS final do projeto, sem barra final e sem caminho |
| NEXUS_ADMIN_EMAIL | E-mail do administrador Master |
| NEXUS_ADMIN_SALT | Salt gerado localmente |
| NEXUS_ADMIN_HASH | Hash gerado localmente |

`npm run admin:password` lê uma senha do terminal e gera apenas salt e hash compatíveis com o login. A entrada desse utilitário é visível: use um terminal privado. A senha não deve ser enviada em mensagens ou gravada em arquivos do projeto. Não use CPF como senha. As novas senhas devem ter de 8 a 256 caracteres, incluindo letra maiúscula, minúscula e caractere especial. Números são opcionais. O servidor não tem recuperação de senha por e-mail: o administrador pode definir nova senha para moradores/síndicos pelo cadastro; redefinir o Master exige trocar salt/hash nas variáveis de ambiente.

Todas as variáveis devem estar no ambiente **Production**. Previews precisam de origem e banco próprios para não interferir na operação.

## Primeiro uso

- Master: entrar em `/` com o e-mail e a senha definidos acima; não é necessário código de condomínio.
- Criar um cliente, salvar o `provision.json` e cadastrar os módulos por nome, MAC STA, placa e função.
- Cadastrar o síndico. Compartilhar `https://SEU-DOMINIO/?central=ID_DO_CLIENTE`.
- Síndico pode cadastrar/editar/revogar moradores do seu condomínio; não cria outros síndicos ou equipamentos.
- Morador entra pelo mesmo link, vê somente seus acessos e cria convites quando `allowInvites` estiver habilitado nas configurações do cliente.
- Link de visitante é secreto, funciona até expirar ou ser revogado e não exige senha. Quem tiver o link poderá usar os acessos liberados. Revogar o anfitrião ou retirar suas permissões também invalida os convidados dependentes.
- Síndico acessa o portal do morador para convites e monitoração simplificada; o Master é o painel de gestão completa.

## Migração das placas e dos cadastros existentes

O banco deste projeto é independente do banco Cloudflare da versão hospedada no ChatGPT. Não há importação automática. **Não apague a central atual.** Planeje uma transferência dos cadastros e IDs ou uma nova provisão controlada em bancada antes de migrar a operação.

A API mantém `/api/v1/gateway/poll`, autenticação por token individual da central e os campos do protocolo existente. Para apontar uma S3 à Vercel é preciso atualizar a origem/credencial de provisão e conferir a cadeia TLS aceita pelo firmware. Não desabilitar verificação de certificado. O teste completo com placa física no novo domínio ainda é obrigatório; passar os testes de servidor não confirma abertura física de fechadura.

Não apontar uma placa física para IDs recém-criados sem conferir a correspondência entre módulo, relé e sensores. O cadastro da placa identifica o hardware, mas a configuração de ESP-NOW e pinagem continua sendo parte do firmware/provisionamento. A migração não altera automaticamente os firmwares já instalados.

## Persistência e segurança

- Turso guarda configurações, comandos, atividades, limites de login, sessões e binários OTA. Nenhum dado operacional depende do disco temporário da função Vercel.
- Alterações são executadas em transação no servidor. O token de gateway é independente das sessões web.
- Sessões opacas em cookie HttpOnly/Secure/SameSite=Strict; validação de origem para mutações; credenciais derivadas por PBKDF2 compatíveis com a S3; bloqueio de tentativas persistente no banco.
- O servidor ignora identidade `oai-*` fornecida pelo navegador; usuários são reconhecidos pela sessão própria.
- Cada consulta de residente verifica cadastro ativo e permissão atual. O gateway revalida comandos de residentes/visitantes antes da entrega.
- OTA aceita firmware e assinatura RSA compatíveis com a S3; a assinatura continua sendo validada no firmware antes da instalação.
- O indicador online é baseado em contato recente (15 s), com atualização da interface a cada 5 s. Isso não é garantia de entrega instantânea.

## Desenvolvimento e validação

```sh
npm ci
npm test
npm run build
```

Os testes incluem autenticação, origem, isolamento por condomínio, RBAC, convites/revogação, bloqueio de comandos vencidos ou revogados, e o adaptador libSQL. A integração com Vercel/Turso reais e com o hardware depende das credenciais e configuração de implantação. Nenhum segredo é incluído neste repositório.

## Medição de custos em operação

`NEXUS_METRICS_SAMPLE_RATE` é opcional e vale `0.01` por padrão (amostra de 1% das requisições). Pode ser desativada com `0`. Uma linha `nexus_usage_sample` registra somente categoria da rota, status, duração, tamanho do corpo recebido/enviado e contadores SQL do adaptador. Não inclui e-mails, IDs de condomínio, tokens ou senhas. Grupos: gateway, resident, auth e management.

**Esses contadores não são a fatura.** `dbRowsReturned` conta linhas devolvidas ao aplicativo, não todas as linhas lidas pelo motor e índices. `dbRowsAffected` também não representa necessariamente todas as escritas faturadas. Operações diretas do armazenamento de firmware não passam pelo adaptador. Tamanhos medidos não incluem cabeçalhos/TLS ou a transferência entre função e banco. Duração é tempo de atendimento, não CPU faturada. Use essas amostras para explicar padrões; confira os totais cobrados nos painéis oficiais da Vercel e do Turso.

Faça um piloto de pelo menos 7 dias com uma S3, cadastros, moradores e convites representativos. Registre diariamente: centrais ativas, consultas à API, linhas lidas/escritas no Turso, armazenamento, consumo da Vercel e custo exibido pelos provedores. Separe criação/carga inicial de cadastros e envio de firmware do consumo recorrente. Projete o período para 30 dias e acrescente margem de variação antes de formar preço.

O firmware de bancada atual usa consulta ao gateway a cada **4 segundos**, aproximadamente **648.000 consultas por central em 30 dias**, antes de falhas/reconexões e acessos dos usuários. Dez centrais equivalem a cerca de 6,48 milhões dessas consultas. Cada consulta pode gerar várias operações SQL. Isso não se traduz automaticamente em 648 mil linhas escritas nem em determinado preço. Esta instrumentação não altera a frequência do firmware.

Em publicações de produção na Vercel, o build executa as migrações idempotentes antes de publicar. Builds locais e de preview não alteram o banco compartilhado. Se a conexão ou o token do Turso falhar, a publicação falha sem substituir a versão ativa.

## Central ESP32 DevKit com dois acionadores locais

O pacote `public/nexus-devkit-central.zip` contém fontes, ferramentas e firmware compilado para ESP32 clássico de 4 MB. O painel aceita dois canais locais sem MAC (GPIO25/23, pulso de 1 segundo). Não misturar com escravos. Estado dos portões desconhecido nesta variante; sensores e estabilidade em hardware ainda precisam ser validados. Flash de aplicação: 1.076.021 bytes; RAM estática: 50.180 bytes. As alocações dinâmicas de TLS/JSON precisam ser medidas na bancada. Consulte o LEIA-ME dentro do pacote antes de gravar.
