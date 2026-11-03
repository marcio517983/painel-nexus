#!/usr/bin/env python3
"""Owner-operated USB pairing. Radio secrets are transferred only over the two USB links."""
import argparse,json,secrets,time
try:import serial
except ImportError:raise SystemExit('Execute: python -m pip install pyserial==3.5')
p=argparse.ArgumentParser();p.add_argument('--central',required=True);p.add_argument('--escravo',required=True);a=p.parse_args()
if a.central.lower()==a.escravo.lower():raise SystemExit('Escolha duas portas diferentes.')
def exchange(dev,line,prefix,timeout=20):
 dev.write((line+'\n').encode());dev.flush();deadline=time.monotonic()+timeout
 while time.monotonic()<deadline:
  text=dev.readline().decode(errors='replace').strip()
  if text.startswith(prefix):return text[len(prefix):].strip()
  if text.startswith('PAIR_ERROR'):raise SystemExit('Pareamento recusado. Confira a versão e o Wi-Fi da central.')
 raise SystemExit('Sem confirmação USB. Confira as portas e feche monitores.')
def mask(label,count):
 text=input(label+' (canais separados por vírgula; Enter = nenhum): ').strip()
 try:ports={int(x) for x in text.split(',')} if text else set()
 except ValueError:raise SystemExit('Canal inválido.')
 if any(x<1 or x>count for x in ports):raise SystemExit('Canal fora do limite.')
 return sum(1<<(x-1) for x in ports)
try:
 with serial.Serial(a.central,115200,timeout=.3,write_timeout=5) as central,serial.Serial(a.escravo,115200,timeout=.3,write_timeout=5) as slave:
  time.sleep(3);central.reset_input_buffer();slave.reset_input_buffer()
  c=json.loads(exchange(central,'INFO','INFO '));s=json.loads(exchange(slave,'INFO','INFO '))
  if c.get('profile') not in ['devkit-hub','s3-hub'] or s.get('profile') not in ['devkit-slave','c3-slave']:raise SystemExit('Combinação de firmwares inválida. A central deve ser Central + Escravos.')
  if not c.get('channel'):raise SystemExit('Conecte primeiro a central ao Wi-Fi e tente novamente.')
  count=2 if s['profile']=='c3-slave' else 4
  fields={'profile':s['profile'],'enabledMask':mask('Relés conectados no escravo',count),'reedMask':mask('Reeds conectados no escravo',count),'pumpEnabled':False}
  if count==4:fields['pumpEnabled']=input('Entrada isolada da bomba conectada? [s/N]: ').strip().lower()=='s'
  key=secrets.token_hex(16);radio=json.loads(exchange(central,'PAIR_CENTRAL '+json.dumps({'mac':s['mac'],'lmk':key}),'PAIR_READY '))
  fields.update(radio,lmk=key);exchange(slave,'PAIR '+json.dumps(fields,separators=(',',':')),'PAIR_OK')
  print('Pareamento confirmado. MAC público do escravo:',s['mac'])
  print('Cadastre esse MAC e os canais no Master. Nenhum relé foi pulsado pelo pareamento.')
except serial.SerialException:raise SystemExit('Não foi possível abrir uma das portas seriais.')
