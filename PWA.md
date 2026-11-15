# NexusMaster — PWA instalável (piloto)

O NexusMaster agora possui manifesto web, ícones 192/512, atalho de instalação no painel e service worker com fallback **somente informativo** quando não houver internet.

## Instalação

- Android/Chrome: abrir o endereço HTTPS do NexusMaster, fazer login e tocar em **Instalar NexusMaster** ou usar o menu do navegador.
- iPhone/Safari: abrir o endereço HTTPS, usar **Compartilhar → Adicionar à Tela de Início**. O botão explica os passos quando o navegador não suporta instalação programática.
- Computador/Chrome/Edge: usar o botão de instalação ou o menu do navegador.

O app inicia em `/morador.html` e fornece acesso ao interfone em `/interfone-morador.html` (autenticado).

## Política de dados e conectividade

O service worker **não faz cache** de respostas da API, credenciais, páginas privadas, interfone ou comandos de portão. O cache offline armazena apenas `/offline.html` e o ícone SVG. Se ficar offline, o app exibe aviso explícito: **nenhum comando foi enviado**. Controle de portão e interfone exigem conexão ativa e autenticação.

## Limites da implementação atual

- **Web Push em segundo plano ainda não está implementado.** O morador continua precisando manter a central do interfone aberta para receber a chamada durante o piloto. O PWA instalável por si só não envia notificações com o celular bloqueado.
- O Telegram permanece opcional, não é exigido para instalar o PWA.
- Chamada de voz WebRTC requer testes em dispositivos reais e infraestrutura TURN para redes restritas; não foi validada em produção.
- O piloto do interfone está na branch `feature/interfone-virtual-mvp`, não mesclada na produção.
- Ícone PNG e SVG precisam ser verificados visualmente em Android/iOS e auditoria de instalação no navegador.

## Próximas tarefas

1. Implementar subscriptions Web Push autenticadas por morador e condomínio, com VAPID guardado somente no servidor.
2. Disparar notificação após a criação de chamada, com link de atendimento, validação de expiração e revogação.
3. Executar testes de permissão e notificações em Android/iOS com tela bloqueada.
4. Completar a segurança do QR Code e TURN antes de liberar em condomínios.
