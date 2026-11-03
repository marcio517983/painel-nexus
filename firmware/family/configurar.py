#!/usr/bin/env python3
"""Configure the selected central over USB; never echo credentials."""
import argparse,json,time
from pathlib import Path
try:import serial
except ImportError:raise SystemExit('Execute: python -m pip install pyserial==3.5')
p=argparse.ArgumentParser();p.add_argument('--arquivo',default='provision.json');p.add_argument('--porta',required=True);a=p.parse_args()
try:cfg=json.loads(Path(a.arquivo).read_text(encoding='utf-8-sig'))
except (OSError,ValueError):raise SystemExit('Não foi possível abrir o provision.json.')
if cfg.get('cloudUrl')!='https://painel-nexus-nexus-iot.vercel.app' or len(cfg.get('gatewayId',''))!=36 or len(cfg.get('gatewayToken',''))!=64:raise SystemExit('Credenciais inválidas para este Master.')
def exchange(dev,line,prefix,timeout=15):
 dev.write((line+'\n').encode());dev.flush();deadline=time.monotonic()+timeout
 while time.monotonic()<deadline:
  text=dev.readline().decode(errors='replace').strip()
  if text.startswith(prefix):return text[len(prefix):].strip()
  if text.startswith(('CONFIG_ERROR','PAIR_ERROR')):raise SystemExit(text)
 raise SystemExit('Sem confirmação. Confira a porta e feche outros monitores seriais.')
def mask(label,count):
 text=input(label+' (números separados por vírgula; Enter = nenhum): ').strip()
 if not text:return 0
 try:ports={int(x.strip()) for x in text.split(',')}
 except ValueError:raise SystemExit('Informe apenas os números dos canais.')
 if any(x<1 or x>count for x in ports):raise SystemExit('Canal fora do limite.')
 return sum(1<<(x-1) for x in ports)
try:
 with serial.Serial(a.porta,115200,timeout=.3,write_timeout=5) as dev:
  time.sleep(2);dev.reset_input_buffer();info=json.loads(exchange(dev,'INFO','INFO '));profile=info.get('profile','')
  if profile not in ['devkit-central','devkit-hub','s3-central','s3-hub']:raise SystemExit('A porta selecionada não tem firmware de central desta família.')
  print('Placa detectada:',profile,'— confira o mesmo perfil no cadastro do Master.')
  cfg={k:cfg[k] for k in ['cloudUrl','gatewayId','gatewayToken']};cfg['profile']=profile
  cfg['enabledMask']=mask('Relés conectados e conferidos, canais 1 a 4',4);cfg['reedMask']=mask('Reeds conectados, canais 1 a 4',4);cfg['pumpEnabled']=input('Entrada isolada da bomba conectada? [s/N]: ').strip().lower()=='s'
  cfg['wifiSsid']=input('Nome da rede Wi-Fi 2,4 GHz: ').strip();cfg['wifiPassword']=input('Senha Wi-Fi (visível neste terminal privado): ')
  exchange(dev,'CONFIG '+json.dumps(cfg,separators=(',',':'),ensure_ascii=True),'CONFIG_OK')
 print('Configuração confirmada. Abra o monitor em 115200 e procure HTTPS 200 / WIFI_OK.')
except serial.SerialException:raise SystemExit('Não foi possível usar a porta. Confira o cabo e feche o monitor serial.')
