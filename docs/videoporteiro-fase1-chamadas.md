# Video Porteiro Nexus — Fase 1: tela de chamadas

Escopo da branch `feature/interfone-virtual-mvp`. Alterações permanecem na **Preview isolada**; não publicar no `main` sem aceite e testes físicos.

## Duração máxima da ligação
- **Toque:** 30 segundos de espera pelo atendimento, como antes.
- **Conversa:** no momento em que o morador atende, o servidor grava `answered_at` e `expires = answered_at + 90` segundos. Não é possível estender o prazo pelo navegador.
- `GET /api/intercom/public/{cid}/calls/{id}` e `GET /api/intercom/calls/{id}/status` encerram chamadas vencidas ao consultar. A sinalização WebRTC deixa de ser aceita depois do vencimento.
- Visitante e morador exibem a contagem até **01:30**, alertam visualmente nos 15 segundos finais e fecham a conexão local ao chegar em zero. Ao retornar do segundo plano, conferem novamente o prazo absoluto.
- Como a transmissão é WebRTC **P2P**, sem servidor de mídia no meio, o backend não pode interromper sozinho um fluxo P2P já estabelecido caso **ambos os navegadores estejam completamente suspensos**. Os clientes precisam executar o encerramento; o servidor impede a renovação da sessão. Validar em testes com bloqueio de tela e app em segundo plano.

## Controles da tela
- **Morador:** ao atender escolhe **"Atender com vídeo"** (recebe imagem da portaria e áudio) ou **"Somente áudio"** (sem receber/exibir vídeo). Continua com controles de microfone, reativação da reprodução de áudio, viva-voz se houver plugin Android e encerramento.
- **Visitante:** pode silenciar o próprio microfone e encerrar, mas **não possui controles para ocultar/desligar ou trocar a câmera durante a chamada**. Também não recebe imagem do morador.
- O residente jamais captura ou transmite câmera local: a faixa enviada por ele ao visitante é **apenas de áudio**.
- No modo "Somente áudio", o receptor não exibe o vídeo e negocia a faixa de vídeo como `inactive` no SDP WebRTC. Mesmo que um navegador dispare `ontrack` de vídeo antecipadamente, não é anexado à tela.
- **Fase de testes:** a webcam/câmera do celular do visitante simula a câmera fixa da portaria. O piloto exige ativá-la **antes de iniciar a ligação**. Selecionar câmera é possível só antes da chamada; permissões de captura continuam sob controle do sistema operacional do aparelho. Uma eventual revogação de permissão pelo sistema pode interromper o vídeo, mesmo sem botão no aplicativo.
- Não há gravação de áudio ou vídeo neste fluxo.

## Arquitetura da câmera IP dedicada (pós-piloto)
- A câmera será **fixa na portaria, dedicada ao videoporteiro**, independente do aparelho do visitante. O visitante somente escaneará o QR Code para iniciar a chamada; não poderá ligá-la, desligá-la, virá-la ou assistir à imagem do morador.
- Fonte prevista: câmera IP privada (RTSP/ONVIF conforme modelo escolhido). **Navegadores não reproduzem RTSP diretamente**; será necessário um gateway de mídia confiável para entregar vídeo por WebRTC ao morador autorizado. Credenciais da câmera nunca devem ficar no QR Code, JavaScript público ou aplicativo visitante.
- O backend deve emitir autorização curta de visualização por chamada, validar o morador destinatário e derrubar o acesso ao encerrar ou expirar os 90 segundos. A câmera e o gateway não devem publicar vídeo diretamente na internet sem autenticação.
- O áudio bidirecional continuará entre visitante e morador pelo caminho definido para a portaria; a câmera IP será a fonte de vídeo da portaria, **nunca uma câmera do morador**.
- A integração RTSP/WebRTC, seleção de equipamento, dimensionamento de banda e controle de credenciais **não foram implementados nesta fase**. Devem ser especificados e testados antes de substituir a câmera de teste.

## GPS e controle de acesso
- Na Preview `interfone-piloto`, a dispensa temporária do GPS continua ativa com a configuração existente, válida até **25/11/2026 00:00 em Brasília** (2026-11-25 03:00Z). Ela é restrita a esse tenant fictício, branch e banco isolado; a produção mantém geofence.
- O QR Code é estático e, durante a dispensa do GPS, não comprova presença física. Não usar em portaria real.
- **Não há abertura de portões pelo videoporteiro nesta etapa.** Nenhum botão ou API de liberação foi adicionado.
- Decisão para a próxima fase: quando a funcionalidade existir, **somente o Master poderá habilitar a permissão de abertura por videoporteiro** para cada condomínio; o síndico não terá permissão de habilitá-la. O ato físico exigirá ainda autorização específica do morador e registro de auditoria; atender a chamada não acionará o portão automaticamente.

## Aceite manual
1. Testar chamada celular visitante → APK residente em Wi-Fi e 4G.
2. Confirmar cronômetro em ambos os aparelhos ao atender e término em no máximo 90 segundos de conversa quando ambos estão ativos.
3. Silenciar/reativar voz nos dois sentidos; conferir que a imagem continua.
4. Confirmar que o visitante não dispõe de botões para ocultar ou alternar a câmera durante a chamada. Testar os dois modos de atendimento: vídeo aparece apenas se o morador o escolher; no modo somente áudio o vídeo não deve ser negociado nem exibido.
5. Alternar saída de áudio no aplicativo Android, verificar retorno ao viva-voz.
6. Fechar e reabrir o aplicativo durante ligação, conferir prazo.
7. Confirmar que a tela não permite abertura de portão e que não foi solicitada localização no piloto.

Não considerar este roteiro substituto de teste físico.
