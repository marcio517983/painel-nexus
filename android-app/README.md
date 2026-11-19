# NexusMaster Android — APK de testes

Este APK é um **protótipo Capacitor** com o painel atual do NexusMaster e o interfone do morador em uma WebView Android conectada **somente à prévia de testes**, não à produção.

## Funcionamento atual
- Entra no NexusMaster de testes e usa o login fictício do morador.
- Abre `/interfone-morador.html` para receber chamadas quando o aplicativo está aberto.
- Reutiliza o áudio WebRTC e a tela de chamada recebida que foram validados no PWA.
- Solicita permissão Android de microfone ao atender a ligação, caso ainda não concedida.
- Permissões e navegação remota limitadas ao servidor HTTPS da prévia.

## Toque nativo — segundo piloto

- O aplicativo Android apresenta a tela nativa de chamada em tela cheia com três botões: **Atender com vídeo**, **Somente áudio** e **Recusar**.
- Ao tocar uma opção, a tela abre diretamente a conversa correspondente na central web — **sem segunda confirmação**. No modo somente áudio, a portaria não transmite imagem para a tela do morador. O visitante nunca vê vídeo do morador.
- **Recusar** também abre a central em segundo plano visual e tenta registrar a recusa no servidor autenticado. Uma falha de rede ou sessão pode impedir o registro; se a ligação ainda estiver pendente, o morador poderá recusá-la na central.
- A ação é criada **somente pelo toque na Activity nativa não exportada**, guardada por poucos segundos no armazenamento privado do aplicativo e consumida uma única vez pela bridge Capacitor. O JavaScript exige sessão de morador válida, chamada ainda tocando, unidade autorizada e autorização do backend. O parâmetro `?call` sozinho **nunca atende automaticamente**.
- Android 13+ pode exigir permissão para notificações; Android 14+ também pode exigir a permissão de **notificações em tela cheia**. A central do interfone oferece botão para abrir essas configurações.
- O alerta nativo é disparado pela página web enquanto o processo do APK está executando. Com o APK **encerrado ou com timers suspensos em segundo plano**, ainda não há entrega confiável. **FCM é obrigatório para a experiência nativa com app fechado/tela bloqueada**, com registro do dispositivo, credenciais Firebase e envio de mensagens do servidor.
- Esta versão é uma prova de interface Android; não é um substituto confiável do interfone físico até testarmos FCM, bateria, interrupções, acessibilidade, limites de spam e rede móvel.

## Viva-voz automático — terceiro piloto

- Ao tocar **Atender**, o aplicativo seleciona automaticamente o **alto-falante externo (viva-voz)** antes de solicitar o microfone; repete a seleção após a captura e quando o áudio remoto chega.
- Android 12+ utiliza `AudioManager.setCommunicationDevice(TYPE_BUILTIN_SPEAKER)`; aparelhos Android anteriores utilizam `setSpeakerphoneOn(true)` como compatibilidade.
- Ao desligar, falhar a captura ou fechar a atividade, o NexusMaster desfaz a preferência temporária e tenta restaurar o modo de áudio anterior.
- A escolha do microfone e as permissões exibidas pelo Android **não** são escondidas à força. O sistema pode rejeitar o roteamento caso haja outros aplicativos em chamada ou restrições específicas do fabricante.
- A implementação está somente no **APK Android de testes**. No PWA acessado pelo navegador, a seleção de saída continua sob controle do navegador e do sistema.

## Atualização desta versão

- Atualizar pelo GitHub Actions **Build NexusMaster Android APK** na branch `feature/nexusmaster-android-apk` — este aprimoramento muda arquivos Java nativos e **precisa reinstalar/atualizar o APK**. Uma atualização da interface remota da Vercel não substitui o build.
- A versão nativa permanece apontada somente para a prévia autorizada do interfone. Não foi habilitado controle de portões.
- O limite de **90 segundos** de conversa, a câmera da portaria visível só ao morador que escolher vídeo e a dispensa temporária de GPS restrita ao piloto seguem definidos no servidor da branch do interfone.
- Testar o toque em tela bloqueada, as duas formas de atendimento, a recusa, o encerramento e o funcionamento com 4G antes de instalar em ambientes reais.

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
