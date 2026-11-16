# NexusMaster Android — APK de testes

Este APK é um **protótipo Capacitor** com o painel atual do NexusMaster e o interfone do morador em uma WebView Android conectada **somente à prévia de testes**, não à produção.

## Funcionamento atual
- Entra no NexusMaster de testes e usa o login fictício do morador.
- Abre `/interfone-morador.html` para receber chamadas quando o aplicativo está aberto.
- Reutiliza o áudio WebRTC e a tela de chamada recebida que foram validados no PWA.
- Solicita permissão Android de microfone ao atender a ligação, caso ainda não concedida.
- Permissões e navegação remota limitadas ao servidor HTTPS da prévia.

## Limite importante
**Este primeiro APK NÃO implementa uma ligação nativa com o aplicativo fechado ou a tela bloqueada.** O Web Push do navegador/PWA não pode ser presumido funcional dentro da WebView Capacitor. Para o toque de interfone de verdade em segundo plano, precisamos configurar um projeto Firebase Cloud Messaging (FCM) e enviar push de dados do backend para um serviço Android que cria uma notificação de chamada CallStyle/full-screen quando autorizado pelo Android. Esse desenvolvimento será separado; não reutilizar o segredo do Turso nem tokens VAPID para FCM.

Não habilitar acesso físico nem distribuir este APK a clientes finais. Nenhum portão é acionado automaticamente.

## Instalar
Faça download do artefato `NexusMaster-Android-APK-Teste` na aba **Actions → Build NexusMaster Android APK** do GitHub. Dentro do ZIP existe `NexusMaster-Teste-debug.apk`.
No Android, abra o APK e permita a instalação de aplicativos desse navegador ou gerenciador de arquivos.

Ao instalar pela primeira vez, abra a tela de login, autentique como morador fictício e vá para a Central do Interfone. Para o piloto, mantenha o APK visível durante a chamada. Não precisa desinstalar o PWA existente (são aplicativos separados).

## Compilação
```sh
cd android-app
npm install
npx cap add android
npx cap sync android
# requer JDK + Android SDK
python3 scripts/patch_android.py
cd android && ./gradlew :app:assembleDebug
```
O workflow GitHub Actions executa essas etapas automaticamente, com as permissões e ícones configurados. A assinatura é **debug**, não aceita para publicação em lojas.
