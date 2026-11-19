# NexusMaster Interfone — trava GPS de 20 metros

## Objetivo e limitações
Este piloto permite chamadas pelo QR Code impresso somente quando o celular fornece uma posição recente, com distância calculada <= **20 m** do ponto cadastrado e incerteza (campo `accuracy`) <= **20 m**.

**Não é uma prova inviolável de presença:** o navegador oferece coordenadas declaradas pelo próprio dispositivo, que podem ser manipuladas. GPS também pode errar, especialmente perto de prédios ou dentro de portarias. O botão abre somente chamadas do interfone; **nunca autoriza portões**.

## Configuração da portaria

1. Entrar no NexusMaster como **síndico** ou **Master**.
2. Fisicamente na entrada onde será afixado o QR Code, abrir `/interfone-localizacao.html` ou a opção **GPS da Portaria** no painel Master.
3. Master: informar o **código do condomínio** (no piloto: `interfone-piloto`). Síndico usa automaticamente o próprio condomínio.
4. Permitir **localização precisa** no navegador HTTPS; tocar **Usar minha localização atual como portaria** e confirmar o ponto.
5. O backend verifica se a captura é recente e informa precisão de até 20 m. Se válida, registra o ponto em `intercom_entrances`. Enquanto nenhum ponto estiver configurado, chamadas públicas são bloqueadas.
6. Visitantes continuam acessando o QR fixo em `/interfone.html?central=<codigo>`. Ao pressionar Chamar, recebem o pedido de GPS. Sem autorização, com posição antiga, imprecisa ou >20 m da portaria, **nenhuma chamada é gerada**.

## Privacidade
A posição do visitante é usada apenas na requisição POST de início de chamada para calcular a distância. A API não insere coordenadas do visitante no banco nem as inclui na notificação ou nos registros do interfone. A base armazena somente a localização configurada da portaria e identidade administrativa responsável. Desaconselhamos colocar coordenadas em URLs, logs ou QR Codes.

## Testes recomendados
- GPS permitido e preciso, aproximadamente no ponto cadastrado: deve conseguir chamar.
- GPS desligado / permissão negada: não deve permitir chamada.
- Precisão >20 m: recusar, mostrar instrução de ativar localização precisa e permitir tentar novamente.
- Fora de 20 m do ponto cadastrado: bloquear mesmo com foto do QR Code.
- Foto antiga do QR Code usada de longe, sem simulação de localização: bloquear.
- Coordenadas falsas enviadas por ferramentas de desenvolvedor podem contornar a geofence — **não considerar este mecanismo como autorização de acesso físico**.
- Verificar que o Master/síndico pode registrar o ponto e o morador comum não.
- Testar com dispositivos e redes reais antes de usar no condomínio.

## Técnico
- Migração `008.sql`, incluída em `scripts/migrate.mjs`.
- `GET/POST /api/intercom/entrance` para síndico; Master informa `?central=<id>`.
- `GET /api/intercom/public/<id>/units` indica apenas `locationReady` sem expor coordenadas.
- `POST /api/intercom/public/<id>/calls` exige `location` com latitude, longitude, accuracy e timestamp atual.
- WebRTC e demais comandos do NexusMaster não foram alterados por esta validação.
- O QR Code ainda é **fixo**; a regra dos 5 minutos de sessão após a chamada é uma etapa separada, não implementada por esta alteração.

## Antes de publicar
Não mesclar ou ativar em produção até cadastrar e conferir a portaria, validar o GPS em celulares reais e aceitar formalmente o risco de localização falsificada. Para aumentar a garantia de presença posteriormente, acrescentar fator físico (BLE, rede local autenticada, QR rotativo ou código de curta duração).
