# NexusMaster — clientes e instalações físicas

Servidor Node.js na Vercel, banco Turso/libSQL e firmwares físicos em `firmware/family`. O HTML anterior em `nexus-iot/index.html` redireciona para o login atual. Não há cadastro de simulador, acionamentos fictícios nem telemetria gerada por software no fluxo operacional.

## Papéis e perfis

| Firmware | Papel | Relés locais | Reeds | Monitor da bomba |
|---|---|---:|---:|---:|
| devkit-central | Central direta | 4 | 4 | 1 |
| devkit-hub | Central direta + até 6 escravos | 4 | 4 | 1 |
| s3-central | Central direta | 4 | 4 | 1 |
| s3-hub | Central direta + até 6 escravos | 4 | 4 | 1 |
| devkit-slave | Somente escravo | 4 | 4 | 1 |
| c3-slave | Somente escravo | 2 | 2 | Nenhum |

S3 nunca é escravo e C3 nunca é central. Só centrais recebem credenciais HTTPS do Master. Escravos usam ESP-NOW criptografado e chaves individuais de pareamento, transferidas via USB. As chaves de rádio não são armazenadas no Master. Veja `firmware/family/LEIA-ME.md` para pinagem, pacotes e instalação.

Master administra clientes, perfis, mapeamento físico e síndicos. Síndico administra moradores e acompanha acessos/monitoramento somente do próprio condomínio. Morador recebe apenas acessos autorizados e convites temporários; histórico de atividades não é exposto a moradores ou visitantes. Convites online herdam apenas permissões do anfitrião e são revogáveis, com validade máxima de sete dias.

## Cadastro de um cliente

1. Master → Novo cliente: nome, endereço e versão da central; guardar provision.json privado.
2. Cadastrar os acessos lógicos, por exemplo Portão de veículos, Portão de pedestres e Porta do hall, ou o monitor da bomba.
3. Atribuir cada acesso a um canal da própria central ou a um canal do escravo (modelo e MAC STA). Não é permitido atribuir dois acessos ao mesmo canal.
4. Instalar o firmware correspondente e configurar por USB somente os canais realmente conectados. Em versões hub, parear os escravos pelos dois cabos USB.
5. Cadastrar síndico e moradores e liberar os acessos individuais.
6. Conferir sincronização, sensores, fim de pulso, reinícios e reconexões na instalação antes de disponibilizar aos usuários.

Criar cadastro ou concluir uma compilação não valida fisicamente o conjunto. O Master não garante que a bobina do relé atracou nem que um portão abriu: recebe o fim do pulso da placa e, separadamente, o reed. Um único reed indica fechado/não fechado, não abertura total. Os dispositivos de segurança do automatizador permanecem independentes.

## Canais, desativação e reserva

A habilitação do canal exige configuração local por USB e habilitação no Master. Permissões dos usuários apontam ao ID lógico, não ao GPIO. Desabilitar ou remapear cancela comandos ainda na fila, preservando nome/ID e permissões. Transferência física dos fios é manual, com o equipamento desenergizado; não há repetição de pulso nem failover automático quando falta confirmação.

Um comando só é criado com telemetria recente. Nas instalações com novo perfil, o gateway só recebe comandos depois de confirmar a revisão atual. O firmware verifica destino, revisão e validade. Os comandos expiram em oito segundos. Ausência de ACK não autoriza repetir automaticamente.

## Bomba

A entrada dedicada mede o sinal de confirmação de funcionamento, sem inferir horas a partir de comandos. Tempo acumulado e partidas ficam na NVS da placa, com checkpoint de até sessenta segundos e salvamento nas transições. Reboot com sinal já ativo não adiciona partida falsa; tempo com o ESP desligado não é estimado. Não usar como medidor certificado.

Turso mantém `pump_totals` por cliente, função e identidade da memória do contador (`counter_epoch`), e `pump_samples` para histórico. O servidor recebe snapshots, registra transições observadas e amostras de até um minuto no estado contínuo; não promete a duração individual de todos os ciclos ocorridos entre consultas ou durante longos períodos offline. Contadores decrescentes na mesma identidade são recusados. Limpar NVS cria outra identidade, preservada separadamente no banco.

## Limites desta versão

- Até seis escravos e 35 funções lógicas por central; até quatro portas por DevKit/S3 e duas por C3.
- Até 32 cadastros incluindo visitantes ativos e configuração serializada de até 22 KB. **Ainda não atende 60 usuários em uma central.** Não aumentar esses limites sem medir memória e revisar o protocolo de sincronização.
- Sessão online de oito horas; portal local HTTPS opcional com duas sessões e cadastros previamente sincronizados.
- Convites de visitante são online e não fazem vínculo criptográfico ao aparelho físico.
- Atualização de firmware por USB, com pacote específico por processador/perfil. Upload OTA sem identificação de destino está desabilitado.
- O pacote anterior `nexus-devkit-central.zip` é legado, de dois acionadores. Os pacotes da família 1.1.0 ficam em `/firmwares/<perfil>.zip`.

## Vercel e banco

Projeto `marcio517983/painel-nexus`, branch `main`, raiz do repositório (não `nexus-iot`). Framework Other, Node.js 22.x, instalação `npm ci`, build `npm run build`, saída `dist`.

| Variável de produção | Finalidade |
|---|---|
| TURSO_DATABASE_URL | URL libsql do banco |
| TURSO_AUTH_TOKEN | Token de banco, segredo |
| NEXUS_ORIGIN | Origem HTTPS principal, sem caminho ou barra final |
| NEXUS_ADMIN_EMAIL | Login Master |
| NEXUS_ADMIN_SALT | Salt gerado no navegador ou utilitário privado |
| NEXUS_ADMIN_HASH | Hash PBKDF2 gerado junto do salt |

A senha Master não vai para a placa nem para o GitHub. Use `/configurar-admin.html` ou `npm run admin:password` em terminal privado. Novas senhas: 8–256 caracteres, maiúscula, minúscula e especial; números opcionais. Salt/hash devem ser salvos juntos. Não há recuperação por e-mail nesta versão.

O endereço principal da produção é acessível sem login da Vercel, mantendo login Nexus e autenticação individual do gateway. URLs de deploy e previews continuam protegidas. Previews devem ter origem e banco separados; builds de preview não executam migrações no banco compartilhado.

## Migrações e dados existentes

`npm run build` executa as migrações idempotentes somente quando `VERCEL_ENV=production`, antes de publicar. Elas criam tabelas necessárias e arquivam exclusivamente clientes explicitamente marcados `simulation=true`, retirando-os da lista ativa, invalidando suas sessões e bloqueando o gateway. Seus dados de auditoria são preservados no banco; nenhum cliente físico é apagado ou convertido em simulador.

Clientes físicos existentes mantêm IDs, usuários e credenciais. Perfis anteriores permanecem compatíveis com seu provisionamento original; editar para um novo perfil exige instalar/configurar o firmware correspondente. Não reaproveitar IDs de módulos sem conferir a correspondência física. Cadastros do banco Cloudflare anterior não são importados automaticamente para o Turso.

## Segurança e verificação

Sessões opacas em cookies HttpOnly/Secure/SameSite=Strict; validação de origem em mutações web; PBKDF2, bloqueio persistente de tentativas e separação por condomínio. Identidade enviada pelo navegador em headers `oai-*` é ignorada. Revogação de usuário/permissão é revalidada antes da entrega do comando. O firmware usa TLS com raízes de confiança; nunca desativar a validação para resolver conexão.

```sh
npm ci
npm test
npm run build
c++ -std=c++17 -Wall -Wextra -Werror tests/physical-io.test.cpp -o /tmp/nexus-physical-test
/tmp/nexus-physical-test
python -m platformio run -d firmware/family
```

Testes de software cobrem autenticação, isolamento de usuários/clientes, revogação, comandos expirados, perfis/canais, remapeamento, migrações, persistência da bomba e lógica de filtragem/contagem. Não equivalem a testes no hardware. O aceite físico detalhado está no LEIA-ME dos pacotes; registrar o resultado por instalação antes de operar fechaduras reais.

## Consumo

`NEXUS_METRICS_SAMPLE_RATE` opcional, padrão 0.01. Logs amostrados incluem categoria da rota, status, duração, bytes e contadores SQL; não incluem e-mails, tokens, senhas, IDs de cliente ou parâmetros SQL. Linhas retornadas/afetadas não são a cobrança exata do provedor.

Consulta da central a cada quatro segundos: cerca de 648.000 requisições em trinta dias, além dos acessos web. Cada consulta envolve várias operações SQL; acompanhar consumo real do Turso e da Vercel por pelo menos sete dias antes de precificar ou ampliar. A bomba acrescenta consultas de contador e escritas de amostras, normalmente uma vez por minuto ou nas transições observadas.

## Reemitir provision.json

No Master, selecione o condomínio → Firmwares → Gerar novo provision.json. A ação exige sessão Master e confirmação, substitui a chave anterior e preserva IDs, portões, pessoas e permissões. Filas anteriores são encerradas sem reenviar pulsos. Baixe e guarde o arquivo privado, substitua o arquivo antigo e configure a central por USB. O provisionamento de um Master antigo em chatgpt.site não é transferido alterando apenas a URL.

## Correção DevKit Central 1.1.1

Corrige o adiamento permanente de HTTPS com heap total suficiente e bloco contínuo menor que 65 KB. Envio JSON e resposta são liberados em fases distintas do TLS. Resposta HTTP limitada a 32 KB. Os novos pacotes usam gravação em duas faixas, excluindo a partição NVS validada no manifesto para preservar Wi-Fi, chave, máscaras físicas e contadores durante atualização dentro desta família. Pacotes antigos, gravados como um único binário de offset zero, podiam apagar a NVS; por isso copie provision.json para a pasta privada e guarde-o antes de atualizar. Ainda é necessário conferir HTTPS 200 e estabilidade na placa.

Validação desta correção: `python tests/installer.test.py`; `c++ -std=c++17 -Wall -Wextra -Werror -Itests/native tests/cloud-response.test.cpp -o /tmp/nexus-response-test && /tmp/nexus-response-test`. O stub Arduino é exclusivo dos testes nativos, não é incluído no firmware. Para publicar só um perfil reconstruído: `python scripts/package-firmware.py --profile devkit-central`.


### Centrais DevKit 1.1.2

A resposta HTTPS usa um pool JSON limitado ao maior bloco livre menos 2 KB, até 48 KB. Evita falha de alocação fixa de 48 KB com blocos de 42–47 KB observados no DevKit. Falha de parsing continua impedindo processamento de comandos; CLOUD_OK identifica resposta validada, enquanto HTTPS 200 sozinho confirma apenas a resposta HTTP. Conferir na placa a sincronização e estabilidade após gravar.
