# Video Porteiro Nexus — Fase 1: tela de chamadas

Escopo da branch `feature/interfone-virtual-mvp`. Alterações permanecem na **Preview isolada**; não publicar no `main` sem aceite e testes físicos.

## Duração máxima da ligação
- **Toque:** 30 segundos de espera pelo atendimento, como antes.
- **Conversa:** no momento em que o morador atende, o servidor grava `answered_at` e `expires = answered_at + 90` segundos. Não é possível estender o prazo pelo navegador.
- `GET /api/intercom/public/{cid}/calls/{id}` e `GET /api/intercom/calls/{id}/status` encerram chamadas vencidas ao consultar. A sinalização WebRTC deixa de ser aceita depois do vencimento.
- Visitante e morador exibem a contagem até **01:30**, alertam visualmente nos 15 segundos finais e fecham a conexão local ao chegar em zero. Ao retornar do segundo plano, conferem novamente o prazo absoluto.
- Como a transmissão é WebRTC **P2P**, sem servidor de mídia no meio, o backend não pode interromper sozinho um fluxo P2P já estabelecido caso **ambos os navegadores estejam completamente suspensos**. Os clientes precisam executar o encerramento; o servidor impede a renovação da sessão. Validar em testes com bloqueio de tela e app em segundo plano.

## Controles da tela
- **Morador:** silenciar/reativar microfone, reativar reprodução do áudio do visitante, viva-voz quando o plugin Android `NexusCall` oferece seleção de rota, encerrar ligação e acompanhar o cronômetro.
- **Visitante:** silenciar microfone, ocultar/mostrar transmissão de vídeo, alternar câmera frontal/traseira quando a chamada já tem uma faixa de vídeo negociada, encerrar ligação e acompanhar o cronômetro.
- A troca de câmera utiliza `RTCRtpSender.replaceTrack`, preservando a conexão WebRTC. A opção de alternar não substitui a ativação inicial da câmera: ela deve ser ligada antes da ligação.
- Não foi adicionada captura de vídeo do morador nem gravação de áudio/vídeo.

## GPS e controle de acesso
- Na Preview `interfone-piloto`, a dispensa temporária do GPS continua ativa com a configuração existente, válida até **25/11/2026 00:00 em Brasília** (2026-11-25 03:00Z). Ela é restrita a esse tenant fictício, branch e banco isolado; a produção mantém geofence.
- O QR Code é estático e, durante a dispensa do GPS, não comprova presença física. Não usar em portaria real.
- **Não há abertura de portões pelo videoporteiro nesta etapa.** Nenhum botão ou API de liberação foi adicionado.
- Decisão para a próxima fase: quando a funcionalidade existir, **somente o Master poderá habilitar a permissão de abertura por videoporteiro** para cada condomínio; o síndico não terá permissão de habilitá-la. O ato físico exigirá ainda autorização específica do morador e registro de auditoria; atender a chamada não acionará o portão automaticamente.

## Aceite manual
1. Testar chamada celular visitante → APK residente em Wi-Fi e 4G.
2. Confirmar cronômetro em ambos os aparelhos ao atender e término em no máximo 90 segundos de conversa quando ambos estão ativos.
3. Silenciar/reativar voz nos dois sentidos; conferir que a imagem continua.
4. Alternar câmera durante a chamada no dispositivo visitante com câmera já ativa.
5. Alternar saída de áudio no aplicativo Android, verificar retorno ao viva-voz.
6. Fechar e reabrir o aplicativo durante ligação, conferir prazo.
7. Confirmar que a tela não permite abertura de portão e que não foi solicitada localização no piloto.

Não considerar este roteiro substituto de teste físico.
