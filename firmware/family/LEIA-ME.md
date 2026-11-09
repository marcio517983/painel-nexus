# Nexus — família física 1.1.0

Não há rotinas de simulação ou acionamentos periódicos. Cada pacote contém um binário específico para processador e perfil. Não grave binário S3 no ESP32 clássico ou C3.

| Pacote | Papel | Relés | Reeds | Entrada de bomba |
|---|---|---:|---:|---:|
| devkit-central | Central direta, sem escravos | 4 | 4 | 1 |
| devkit-hub | Central direta e até 6 escravos | 4 | 4 | 1 |
| s3-central | Central direta, sem escravos | 4 | 4 | 1 |
| s3-hub | Central direta e até 6 escravos | 4 | 4 | 1 |
| devkit-slave | Somente escravo | 4 | 4 | 1 |
| c3-slave | Somente escravo | 2 | 2 | Nenhuma |

A S3 alvo é a N16R8 com flash 16 MB/PSRAM octal. DevKit alvo: ESP32 clássico com flash 4 MB. C3 alvo: C3 com flash 4 MB e pinos abaixo disponíveis. USB nativo e UART são atendidos, mas confirme o pinout impresso da sua placa.

## Pinagem fixa e canais

| Placa | Relés (canais 1, 2, 3, 4) | Reeds (1, 2, 3, 4) | Bomba |
|---|---|---|---|
| DevKit | 25, 23, 26, 27 | 32, 33, 34, 35 | 13 |
| S3 | 4, 21, 16, 17 | 5, 6, 7, 15 | 18 |
| C3 | 0, 1 | 3, 4 | Não disponível |

Relés: interface de acionamento compatível com lógica 3,3 V, saída open-drain ativa em LOW; nunca aplicar 5/12 V no GPIO. O GPIO comanda a interface, não a bobina nem o motor. As saídas começam liberadas e só aceitam pulso se o canal tiver sido habilitado por USB e no Master. O timer desliga o pulso mesmo durante espera HTTP. Use interface que assegure relé desligado também durante reset/boot, quando o firmware ainda não controla o pino.

Reeds: contato seco entre entrada e GND, LOW = fechado. GPIO34 e GPIO35 do ESP32 clássico não possuem pull-up interno: use resistor externo de 10 kΩ para 3,3 V. Os demais usam INPUT_PULLUP. Um reed permite distinguir fechado de não fechado; não confirma abertura total. Bomba: contato auxiliar ou interface isolada, LOW = funcionamento indicado. Nunca ligar GPIO a rede elétrica, bobina do contator ou saída de 12/24 V.

O pulso padrão no Master é 1000 ms, ajustável entre 100 e 5000 ms. Dois acessos não podem usar o mesmo canal físico; portas de reserva ficam sem atribuição ou desabilitadas. Para remapear: desabilitar, aguardar comandos pendentes, transferir os fios com os equipamentos desenergizados, alterar canal no Master, conferir sincronização e só então habilitar. A identidade do acesso e as permissões são preservadas. Não há failover automático de relé.

## Instalar no Windows

Extraia a pasta completa do pacote. Feche monitores seriais. Use uma porta explicitamente escolhida:

```powershell
python -m pip install esptool==4.5.1 pyserial==3.5 cryptography
python gravar.py --porta COM4
```

O script confere SHA-256 do binário e o esptool confere o processador. O instalador desta revisão grava duas faixas e preserva a partição NVS indicada no manifesto; confira as habilitações ao trocar de função. Não use um comando de gravação única do binário completo se pretende preservar NVS. Uma central e um escravo possuem namespaces de credenciais distintos.

Para uma central, baixe o provision.json no Master e copie para a pasta privada do pacote:

```powershell
python configurar.py --arquivo provision.json --porta COM4
```

O perfil da central no Master deve coincidir com o binário instalado. O utilitário lê o perfil da placa e pergunta os relés, reeds e a entrada de bomba conectados. Enter desabilita canais; não é necessário conectar todos os canais da placa. Wi-Fi e chave ficam na memória local, nunca em mensagens ou no GitHub. Senha Wi-Fi é digitada visivelmente apenas no terminal privado do instalador.

Para um escravo, configure primeiro a central com firmware hub e Wi-Fi conectado. Ambos devem usar esta família 1.1.0, sem misturar protocolo antigo:

```powershell
python parear-escravo.py --central COM5 --escravo COM4
```

O pareamento gera LMK individual e transfere as chaves somente pelos dois cabos USB. O Master guarda o MAC público, modelo e canais; não guarda LMK/PMK. O escravo segue o canal da central e procura novamente o canal se perder o contato. Sem associação autenticada e relógio recebido da central, comandos são recusados. Confirmação de transporte não é confirmação de relé: o ACK de sucesso só é emitido após o fim do pulso. Se o ACK não chegar, o estado é desconhecido e o comando não é repetido.

No Master: cadastre o cliente e o perfil; cadastre os acessos/monitor, selecionando local ou escravo, MAC (se escravo) e canal; libere os acessos para moradores. Cada cliente tem token de nuvem próprio. Escravos não recebem o token do gateway e não acessam o banco diretamente.

## Bomba e dados

O sinal é filtrado por 100 ms. A placa soma o tempo do sinal ativo, sem inferir funcionamento por comandos de relé. Partidas e tempo são persistidos em NVS nas transições e a cada 60 segundos. Um reboot com bomba já indicada como ligada não cria uma nova partida. Falta de energia pode perder até o intervalo desde o último checkpoint; não se conta tempo enquanto o ESP está desligado. Isso não é medidor certificado de horas nem confirmação elétrica de corrente no motor.

O contador possui uma identidade de memória (counterEpoch). O Master guarda amostras observadas nas transições de estado e, com estado contínuo, a cada minuto; ignora duplicatas recentes e recusa contadores decrescentes na mesma identidade. Uma limpeza de NVS gera outra identidade, mantida separadamente no banco. O total da placa não deve ser zerado para estimar horas de funcionamento que não foram medidas. Eventos muito rápidos entre consultas podem aparecer só no contador acumulado; o histórico não promete registrar a duração individual de todos os ciclos offline.

## Acesso local e online

Centrais usam HTTPS com raízes de confiança e não seguem redirecionamentos ao enviar credenciais. Master/moradores usam seus próprios logins. Portal local HTTPS é opcional: `python ativar-portal.py`, certificado exclusivo gerado localmente; configure a confiança do certificado no aparelho conforme necessário. Acesso local exige cadastros previamente sincronizados e suporta duas sessões. Convites de visitantes são somente online nesta versão. Moradores não visualizam histórico; síndico fica limitado ao seu condomínio e à gestão de moradores.

Limites atuais: até 6 escravos, 35 funções (acionadores/monitores), 32 cadastros incluindo visitantes ativos e configuração de até 22 KB por central. Não promete 60 moradores por central nesta versão. O firmware não executa OTA: atualização somente por USB com pacote específico.

## Aceite físico antes de colocar um cliente em operação

Compilação e testes de software não validam a fiação, o módulo de relé nem a estabilidade do conjunto real. Com contatos de carga desconectados, confira cada canal, duração do pulso, repouso após reset e mudança de estado do reed. Verifique o feedback da bomba contra uma referência de tempo. Teste comando remoto e local, todos os escravos, Wi-Fi/radio fora de alcance, reconexão e reinício, sem repetição automática de pulso.

Monitore `heap`, `minHeap` e `maxBlock` no serial por pelo menos 30 minutos com HTTPS local e online simultâneos. Se memória estiver insuficiente, a central adia a comunicação e não executa novos comandos remotos; investigue antes de instalar. Só conecte o controle do portão após conferir intertravamentos e dispositivos de proteção próprios do automatizador. MKN New Home: contato COM–NA entre GND e BOT. Ultra Rev.3: contato COM–NA entre +12 V e BOT, sem usar NF; esses contatos ficam eletricamente separados dos GPIOs.

## Correção de memória das centrais 1.1.1

A central serializa e libera o documento de envio antes de iniciar TLS, e encerra TLS antes de analisar a resposta JSON. A verificação distingue memória livre total (reserva de 85 KB) de maior bloco contínuo (24 KB); não exige mais um bloco único de 65 KB. Respostas, inclusive chunked, são limitadas a 32 KB. Falha de conexão, alocação ou parsing não autoriza pulso nem repetição automática. STATUS continua informando heap, minHeap e maxBlock. A compilação não comprova estabilidade no hardware: conferir HTTPS 200 e memória na placa após atualizar.


### Centrais DevKit 1.1.2

A resposta HTTPS usa um pool JSON limitado ao maior bloco livre menos 2 KB, até 48 KB. Evita falha de alocação fixa de 48 KB com blocos de 42–47 KB observados no DevKit. Falha de parsing continua impedindo processamento de comandos; CLOUD_OK identifica resposta validada, enquanto HTTPS 200 sozinho confirma apenas a resposta HTTP. Conferir na placa a sincronização e estabilidade após gravar.
