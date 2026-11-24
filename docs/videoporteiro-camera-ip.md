# NexusMaster Videoporteiro — piloto com câmera do notebook

## Situação implementada

- Escopo: branch `feature/interfone-virtual-mvp`, condomínio fictício `interfone-piloto` na Vercel Preview.
- O notebook, atuando como visitante/portaria, pode ligar a **webcam mediante clique e permissão explícita**.
- **Não existe prévia de vídeo para o visitante.** A captura da webcam só começa por clique e a imagem é transmitida exclusivamente ao morador depois que ele aceita a chamada.
- A trilha de vídeo usa a mesma sessão WebRTC já utilizada pelo áudio, agora com `audio + video` quando a câmera está disponível. O visitante não recebe nenhuma trilha de vídeo do apartamento.
- Modo fluidez: captura até **640 × 360, 12 a 15 quadros/s** e tentativa de limite de bitrate **550 kbps** (dependendo do suporte do browser); negociações WebRTC esperam no máximo **4,5 segundos por lado** para coleta inicial de ICE no piloto.
- O aplicativo Android do morador mostra o vídeo sem reproduzir áudio duplicado; áudio em dois sentidos continua no elemento de áudio.
- Se a câmera estiver desligada, negada ou indisponível, a chamada mantém seu fluxo original de áudio.
- O browser e o Android não gravam fotos ou vídeos por essa funcionalidade. Desligar a câmera, encerrar a ligação ou fechar a página interrompe as trilhas locais.
- O botão e a prévia da webcam são exibidos somente para a configuração isolada de testes, não para as demais instalações.

## Teste com notebook + celular

1. Conecte notebook e celular ao mesmo Wi-Fi/internet. Faça login como morador do `interfone-piloto` no APK.
2. Na Central do Interfone do morador, autorize o **modo de teste pela mesma rede por 15 minutos**.
3. No notebook, abra `/interfone.html?central=interfone-piloto`.
4. Selecione **Apartamento 102**. No campo **Câmera da portaria — piloto**, clique **Ativar câmera do notebook** e autorize a webcam.
5. Confira a prévia local, selecione o motivo e clique em **Chamar (teste na mesma rede)**.
6. No celular, abra/atenda a chamada. Assim que o WebRTC estabelecer a sessão, o vídeo deve aparecer em **Videoporteiro**.
7. Confirme imagem, microfone dos dois lados, botão Desligar e interrupção da webcam após a chamada.
8. Repita sem ativar câmera: o vídeo não aparece, mas o áudio deve continuar funcionando.

A ligação depende das permissões de câmera e microfone e do suporte WebRTC da rede. A notificação nativa do Android **não** exibe vídeo na tela bloqueada; a imagem começa no painel após atender.

## Próxima fase: câmera IP real

A webcam testa o fluxo de mídia. Câmeras IP RTSP/ONVIF não são capturadas diretamente por `getUserMedia` no navegador. Para a câmera física, preparar um **gateway de mídia local**, por exemplo go2rtc ou MediaMTX, que:

1. Autentique-se na câmera e consuma seu RTSP internamente (evitar publicar RTSP na internet).
2. Exponha vídeo compatível com navegador (WebRTC) por HTTPS/WSS, com autenticação e origem restrita ao NexusMaster.
3. Entregue a trilha de vídeo ao fluxo WebRTC do videoporteiro, sem divulgar credenciais da câmera ou endereços privados aos visitantes.
4. Use o ESP32-S3 somente para automação/controle; transcodificação de mídia deve ficar no NVR, mini-PC ou Raspberry Pi compatível.
5. Considere TURN/relay para ligações entre redes e retenção zero de gravações por padrão.

Alternativa temporária para uma câmera IP: no notebook da portaria, abrir o stream RTSP em um software como OBS e disponibilizá-lo como **câmera virtual**. O browser poderá então capturar essa câmera como uma webcam normal. Isso ainda exige configuração do software no notebook; não é integração RTSP nativa no NexusMaster.

## Segurança e restrições

O modo sem GPS é somente para `interfone-piloto` no banco de testes e requer autorização temporal de 15 minutos do morador. Mesmo IP público **não significa** proximidade física. A produção preserva a trava de GPS de 20 metros. Sessões WebRTC dependem de autorização prévia do morador, permissão da câmera e sinalização autenticada. O preview não deve alterar aparelhos reais nem abrir portões.

## Limites de desempenho

A otimização reduz carga da webcam e tempo inicial de sinalização, mas não garante atraso mínimo em todas as redes. Para mensurar atraso audiovisual, testar com um movimento visível e comparar o instante no notebook com o vídeo no celular; redes com perda de pacotes, uplink insuficiente ou hardware sobrecarregado podem adicionar latência. As medidas aplicadas priorizam fluidez no piloto; a integração direta de RTSP/ONVIF continua pendente de gateway de mídia local.
