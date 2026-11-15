# NexusMaster Interfone — piloto WebRTC

## Situação
Este módulo está em **branch de desenvolvimento**, não validado em produção ou em hardware real.

A interface do visitante fica em `/interfone.html?central=<ID_DO_CONDOMINIO>` e a central do morador em `/interfone-morador.html` (exige login NexusMaster). Não há comando de abertura de relé neste módulo.

## Como configurar
1. Implantar **em ambiente de teste separado**, com banco Turso isolado. Aplicar a migração `005.sql` pelo script `npm run db:migrate`. A rotina de build em produção já executa migrações; não apontar previews para a base real.
2. Entrar no NexusMaster como **síndico** e abrir `/interfone-morador.html`.
3. Cadastrar as unidades com IDs estáveis (`apto-102`, `casa-01`). A interface permite vincular o ID do morador já cadastrado no NexusMaster à unidade.
4. Criar um QR Code com o link gerado na central do síndico. A URL contém o ID do cliente, **não** credenciais ou dados pessoais.
5. Abrir o QR Code em um celular e entrar como morador em outro dispositivo. Testar chamar, aceitar, conversar, recusar, timeout e encerrar.

## Comportamento
- Visitante escolhe unidade e motivo (entrega, visita, serviço ou outro).
- Chamada entra como `ringing` por **30 segundos**, com tom de chamada local a cada ~6 segundos.
- O morador pode atender ou recusar no painel navegador. Recusa e expiração informam tom de ocupado ao visitante. Ao atender, as telas trocam uma oferta/resposta WebRTC pelo backend.
- Chamadas atendidas expiram em até **5 minutos**; botões permitem desligar antes.
- A API separa clientes, moradores e chamadas por autorização. O token do visitante é aleatório e guardado no banco apenas como hash.
- Nenhum acionamento de portão é oferecido por esta primeira versão.

## Limitações antes de oferecer a clientes
- **Telegram ainda não está integrado:** é necessário criar o bot, vincular identidades de moradores, cadastrar webhook com segredo e enviar notificações com botão para abrir o painel de atendimento. A Bot API não inicia uma chamada de voz nativa.
- **WebRTC precisa de TURN em produção** para funcionar atrás de CGNAT/firewalls restritos. O piloto usa STUN público de teste e poderá falhar em certas redes.
- O morador precisa manter a página web aberta para perceber o chamado. Notificações push e Telegram fazem parte da próxima etapa.
- A lista de unidades é pública: evite associar nomes, telefones ou dados pessoais aos rótulos.
- O QR Code estático não comprova presença física. Antes de implementar abertura remota por esse canal, adicionar verificação de presença, proteção antiabuso mais forte e auditoria.
- Ainda faltam testes em navegadores reais, chamadas simultâneas, falhas de rede, acessibilidade e validação do tempo de toque.

## Endpoints
- GET `/api/intercom/public/:clientId/units`
- POST `/api/intercom/public/:clientId/calls`
- GET `/api/intercom/public/:clientId/calls/:callId` com Bearer token do visitante
- POST `/api/intercom/public/:clientId/calls/:callId/cancel`
- POST `/api/intercom/public/:clientId/calls/:callId/offer`, GET `.../answer`
- GET/POST `/api/intercom/units` (POST só síndico)
- POST `/api/intercom/members` (síndico)
- GET `/api/intercom/calls`
- POST `/api/intercom/calls/:callId/answer`, `.../decline`, `.../signal`, `.../hangup`
- GET `/api/intercom/calls/:callId/signal`

## Próxima fase
Integração do Telegram, associação segura usuário↔chat, botão "Atender", servidor TURN e teste em Android/iOS.
