# NexusMaster Interfone — risco do QR Code fixo

**Risco:** o QR Code impresso é um endereço público. Uma fotografia permite reabrir a página de qualquer lugar. O token de chamada efêmero protege a sessão, mas não prova que o visitante está na portaria. Limitadores de chamadas por IP/unidade mitigam abuso, mas não são presença física.

## Mudança visual realizada
- Título das notificações do PWA: **NexusMaster • Chamada da Portaria**.
- Corpo: **Destino: <residência> • Motivo: <motivo>**.
- Painel: **Portaria → <residência>**.
- FCM de Android: `label='Portaria'` e campo adicional `destinationLabel`. Se um APK nativo antigo não interpretar `destinationLabel`, deverá receber atualização do código nativo para exibir também o destino.
- O QR Code não deve aparecer como originador. Futuramente, permitir cadastro de múltiplas entradas (Portaria Principal, Portaria Serviço, Portão Pedestre).

## Proteção recomendada antes de uso real

**QR impresso + código temporário visível somente na portaria.**
1. QR impresso abre a página pública, mas não autoriza tocar na residência.
2. Um display físico simples, instalado no local, mostra um código curto que muda a cada 30–60 segundos.
3. O visitante informa esse código ao iniciar a chamada.
4. A API valida assinatura/validade e recusa códigos inválidos, reutilizados em excesso ou expirados. Não confiar em validação apenas no JavaScript.
5. Limitar chamadas por origem, unidade e condomínio e adicionar controles anti-spam, sem expor nomes dos moradores.
6. Não existe proteção absoluta contra compartilhamento em tempo real do código; ela impede a reutilização simples de uma foto antiga.

**Alternativa com mais recursos:** QR Code rotativo num display. Exige energia, tela e controle eletrônico na portaria. Um QR Code impresso sozinho nunca será prova de presença.

**Alternativa econômica apenas provisória:** restrição geográfica pelo navegador mais rate-limit/CAPTCHA. Localização GPS pode ser imprecisa e falsificada, e o visitante precisa conceder permissão. Não afirmar que resolve o abuso remoto.

## Status

Apenas a correção da origem da notificação está implementada. O desafio de presença física ainda **não** foi implementado. Não colocar QR Code público real na portaria até selecionar e validar um dos métodos de presença física.
