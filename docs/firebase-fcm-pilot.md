# NexusMaster IoT — Firebase Cloud Messaging (piloto Android)

## Ambiente isolado
- Firebase Project: `controws`
- Android application ID: `com.nexusmaster.interfone.piloto`
- API server: Vercel Preview branch `feature/interfone-virtual-mvp`
- Database: separate Turso `nexusmaster-teste`
- O banco de produção **não deve ser usado** no piloto.

## Integração já presente no código
- APK: `NexusFirebaseMessagingService` recebe mensagens FCM do tipo **data-only** e mostra chamada nativa com expiração.
- WebView autenticada: após consentimento do usuário, solicita `NexusCall.fcmToken()` e chama `POST /api/intercom/fcm/register`.
- Backend: `intercom_fcm_tokens` vincula cada token a um usuário ativo autenticado e ao condomínio; o envio identifica os residentes vinculados à unidade chamada.
- Em caso de logout, `POST /api/intercom/fcm/unregister` desvincula o dispositivo.
- O cadastro de uma residência não concede automaticamente acesso aos acionadores de portão.

## Configuração de envio que exige ação do proprietário
O `google-services.json` **não é credencial de servidor**. Para enviar notificações em segundo plano, uma conta de serviço autorizada precisa estar disponível na Vercel.

1. No **Google Cloud Console** selecione o projeto CONTROWS (project ID `controws`).
2. Confirme que a API **Firebase Cloud Messaging API (V1)** está ativada.
3. Crie uma **conta de serviço exclusiva para o piloto**, com a permissão **Firebase Cloud Messaging API Admin** (`roles/firebasecloudmessaging.admin`).
4. Em *Chaves* dessa conta, crie uma chave JSON apenas se for indispensável; guarde o arquivo de forma privada. Uma integração com identidade federada é preferível em produção.
5. No projeto `painel-nexus-nexus-iot` da Vercel, adicione a variável de ambiente **sensitive** `NEXUS_FCM_SERVICE_ACCOUNT_JSON` com o conteúdo integral da credencial JSON, com alvo **Preview** e Git Branch **feature/interfone-virtual-mvp**. Nunca publique nem envie essa chave neste chat ou no GitHub.
6. A variável `NEXUS_FCM_PROJECT_ID=controws` já foi configurada exclusivamente no Preview da branch de testes.
7. Faça um novo deploy **Preview** da branch para carregar o segredo.
8. Instale o APK atualizado e abra `Central do Interfone`. Autorize notificações e, se solicitado, chamadas em tela cheia. A interface deve mostrar **Celular vinculado ao Firebase**. Se mostrar **Falta habilitar a autorização de envio FCM**, revise a variável secreta e o deploy.
9. Teste com o APK em primeiro plano, depois no segundo plano, com tela bloqueada e com a tela apagada usando dados móveis. Não faça o teste em condomínio real.

## Segurança e limites
- Firebase é utilizado **somente para despertar o Android**; Turso permanece como fonte de usuários, unidades, autorizações e chamadas.
- O Push nunca abre portas, nunca aceita a chamada automaticamente e não contém credenciais do interfone.
- A chamada vence em 30 segundos; o serviço nativo descarta mensagens vencidas.
- Não existe garantia absoluta de entrega imediata quando o Android impede execução em segundo plano, quando o aparelho está sem internet, no modo economia de bateria, com permissões negadas ou quando o usuário força a parada do aplicativo.
- Não ative o envio FCM em **Production** até finalizar testes e revisão de segurança.

