# Video Porteiro Nexus — validação de estabilidade e segurança (piloto)

Data: 19/11/2026. Branch: `feature/interfone-virtual-mvp`.
**Escopo: apenas o condomínio fictício `interfone-piloto`, banco de testes isolado e prévia Vercel.** Sem habilitar abertura física de portas e portões.

## Salvaguardas verificáveis por código
- Espera por atendimento: 30 segundos. Conversa: **90 segundos**, contados do `answered_at` registrado no backend, nunca do relógio ajustável da interface.
- A consulta de status de chamada encerra conversa expirada no banco mesmo que um navegador tenha ficado suspenso. Escritas de oferta/resposta SDP só são aceitas se `status='answered'` e `expires > now()` no próprio `UPDATE`.
- Visitante e morador encerram os fluxos locais e fecham o `RTCPeerConnection` quando o prazo vence. Ao reaparecer a página, ganhar foco ou recuperar rede, o relógio é recalculado e o estado remoto conferido.
- Quando o WebRTC entra em `disconnected` ou `failed`, a UI informa **tentativa de recuperação de até 15 segundos**. Uma transição para `connected` cancela o desligamento; se a conexão não voltar, os fluxos locais são desligados mesmo se o servidor estiver inacessível. O prazo de conversa **não é prorrogado** na reconexão.
- A comunicação continua **P2P, sem servidor de mídia**, e a implementação atual não negocia `ICE restart` nem dispõe de TURN próprio. Uma troca de rede pode recuperar ou exigir uma nova ligação.
- **Limitação essencial:** se *ambos* os navegadores/WebViews estiverem totalmente suspensos pelo sistema operacional e ainda houver uma conexão P2P ativa, o banco não consegue interromper diretamente esse transporte. A interface aplica o prazo ao voltar à execução; a prova de desligamento em segundo plano requer teste de hardware. Não prometer encerramento rígido de mídia em todas as condições sem um servidor de mídia com controle da sessão.
- A imagem da câmera da portaria só é recebida pelo morador no modo vídeo. Não existe transmissão da câmera do morador ao visitante. A abertura de portões continua indisponível pelo videoporteiro. Na futura fase de liberação, somente o Master poderá habilitar a funcionalidade.

## Roteiro de testes reais (dois dispositivos)
| Teste | Procedimento | Resultado esperado |
|---|---|---|
| A. Duração | Faça uma chamada e atenda. Deixe ambos os dispositivos ativos. | A contagem começa em **01:30** e o áudio/vídeo para em até **90 s**, sem botão para prorrogar. |
| B. Bloqueio de tela | Atenda no APK, bloqueie o Android por 30–45 s, desbloqueie antes dos 90 s. | O cronômetro mostra os segundos efetivamente restantes; não reinicia em 01:30. Verificar se mídia continuou/retomou: comportamento depende do Android. |
| C. Retorno após limite | Atenda, bloqueie o Android e desbloqueie depois dos 90 s. | A interface detecta o prazo vencido e não apresenta chamada ativa; a API registra a chamada como encerrada. Conferir áudio real durante bloqueio. |
| D. Breve interrupção de rede | Durante chamada, desligue e religue Wi-Fi ou troque para 4G rapidamente. | Aviso de reconexão, com recuperação se o mesmo `RTCPeerConnection` voltar a `connected`; o cronômetro segue correndo. |
| E. Longa interrupção de rede | Desligue os dados móveis/Wi-Fi por mais de 15 s após a chamada estar conectada. | Fecha a mídia local, mostra a razão e não mantém microfone/câmera ativos. Uma nova ligação pode ser necessária. |
| F. Modo de áudio | Inicie nova chamada usando **Somente áudio** no Android. | O morador ouve o visitante; não recebe imagem, e o visitante não vê o morador. |
| G. Segurança piloto | Verifique que não existe abrir portão no videoporteiro e que o visitante não pode ocultar câmera durante a chamada. | Sem abertura física. O GPS é dispensado **somente** no piloto durante a autorização temporária. |

Registre para os testes B–E: modelo e versão Android, se o app estava em primeiro/segundo plano, hora de início/fim e quais lados ouviram/viram áudio e vídeo.

### Critério de aceite
- Os testes automatizados validam comportamento **emulado** da aplicação; não substituem a validação no celular.
- Se o áudio continuar depois de 90 segundos com a tela do Android bloqueada, o piloto não passa no critério de encerramento rígido. Antes de uso real, será necessário encerramento de mídia independente da WebView (ex.: gateway/SFU de mídia com prazo de sessão controlado no servidor).
- Se a chamada cair imediatamente na troca Wi-Fi/4G, o cenário deve ser registrado como limitação de reconexão: TURN + ICE restart serão trabalhos futuros, sem afetar a segurança de acesso.
- Não utilizar o modo sem GPS em instalação de condomínio; a suspensão provisória do geofence expira em **25/11/2026 00:00 (Brasília)**, conforme a variável de ambiente autorizada.
