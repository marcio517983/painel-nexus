# NexusMaster — PWA instalável (piloto)

O NexusMaster agora possui manifesto web, ícones 192/512, atalho de instalação no painel e service worker com fallback **somente informativo** quando não houver internet.

## Instalação

- Android/Chrome: abrir o endereço HTTPS do NexusMaster, fazer login e tocar em **Instalar NexusMaster** ou usar o menu do navegador.
- iPhone/Safari: abrir o endereço HTTPS, usar **Compartilhar → Adicionar à Tela de Início**. O botão explica os passos quando o navegador não suporta instalação programática.
- Computador/Chrome/Edge: usar o botão de instalação ou o menu do navegador.

O app inicia em `/morador.html` e fornece acesso ao interfone em `/interfone-morador.html` (autenticado).

## Política de dados e conectividade

O service worker **não faz cache** de respostas da API, credenciais, páginas privadas, interfone ou comandos de portão. O cache offline armazena apenas `/offline.html` e o ícone SVG. Se ficar offline, o app exibe aviso explícito: **nenhum comando foi enviado**. Controle de portão e interfone exigem conexão ativa e autenticação.


## Alertas de chamadas — piloto (16/11/2026)

- O interfone do visitante agora inicia o tom de chamada **sem pedir o microfone**. O Android pode solicitar o dispositivo somente depois que o morador atender, pois esta escolha é controlada pelo navegador/sistema operacional.
- A tela `/interfone-morador.html` possui uma janela de **Chamada no interfone** com botões **Atender** e **Recusar**, um tom de aviso condicionado à permissão de reprodução de áudio do navegador e atualização automática das chamadas.
- O morador deve tocar **Ativar notificações** na central do interfone, permitir a notificação do site/PWA e permanecer cadastrado na residência correta. Isso cria uma assinatura Web Push individual, associada ao condomínio e ao usuário autorizado.
- A API armazena as assinaturas em `intercom_push_subscriptions` (migração `006.sql`) e envia notificações Web Push criptografadas e autenticadas (VAPID) ao criar uma chamada. A assinatura não contém credencial de abertura física.
- O service worker exibe a notificação e, ao tocá-la, abre a Central do Interfone para que o morador **decida se aceita**. Tocar na notificação não aciona portões nem aceita automaticamente a ligação.
- A implementação inicial de Web Push precisa ser validada em aparelhos reais com Chrome/Android e no iPhone com o PWA instalado na tela inicial. **Web Push não garante toque imediato, alerta contínuo ou comportamento de chamada nativa**, especialmente com economia de bateria, modo silencioso, permissões bloqueadas ou rede instável.
- A chamada permanece com expiração de **30 segundos**; notificações entregues após a expiração são ignoradas pelo service worker.
- O ambiente de produção e os portões continuam fora desta branch. A criação das chaves VAPID e a migração 006 foram restritas à branch Preview de testes.
- Para diagnosticar falha de Push: conferir se o botão exibe `Alertas ativados`, se o navegador permitiu notificações, se o app tem acesso à rede, e se o celular permite execução/notificações em segundo plano. Não publicar chaves de assinatura, endpoints ou segredos em capturas.

## Limites da implementação atual

- Web Push está implementado em caráter experimental, mas ainda depende de autorização do morador e de testes de recebimento em celulares reais, inclusive com tela bloqueada.
- O Telegram permanece opcional, não é exigido para instalar o PWA.
- Chamada de voz WebRTC requer testes em dispositivos reais e infraestrutura TURN para redes restritas; não foi validada em produção.
- O piloto do interfone está na branch `feature/interfone-virtual-mvp`, não mesclada na produção.
- Ícone PNG e SVG precisam ser verificados visualmente em Android/iOS e auditoria de instalação no navegador.

## Próximas tarefas

1. Implementar subscriptions Web Push autenticadas por morador e condomínio, com VAPID guardado somente no servidor.
2. Disparar notificação após a criação de chamada, com link de atendimento, validação de expiração e revogação.
3. Executar testes de permissão e notificações em Android/iOS com tela bloqueada.
4. Completar a segurança do QR Code e TURN antes de liberar em condomínios.
