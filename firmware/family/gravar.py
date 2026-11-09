#!/usr/bin/env python3
import argparse,hashlib,json,subprocess,sys,tempfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--porta',required=True);a=p.parse_args();root=Path(__file__).resolve().parent
try:
 info=json.loads((root/'manifest.json').read_text());binary=root/'firmware-completo.bin'
 if hashlib.sha256(binary.read_bytes()).hexdigest()!=info['sha256']:raise ValueError()
except (OSError,ValueError,KeyError):raise SystemExit('Pacote incompleto ou checksum incorreto. Extraia novamente o ZIP completo.')
try:import esptool
except ImportError:raise SystemExit('Execute: python -m pip install esptool==4.5.1 pyserial==3.5')
print('Perfil:',info['profile'],'versão',info['version'],'— mantenha as cargas desconectadas durante a gravação e confira os canais depois.')
probe=subprocess.run([sys.executable,'-m','esptool','--chip',info['chip'],'--port',a.porta,'flash_id'],capture_output=True,text=True)
if probe.returncode:raise SystemExit('Não foi possível identificar a placa. Confira a porta, o chip e o cabo.')
if ('Detected flash size: '+info['flashSize']) not in probe.stdout:raise SystemExit('A memória flash detectada não corresponde ao pacote. Nenhuma gravação realizada.')
# These family partition tables reserve 0x9000..0xdfff for NVS.
# A merged write from offset zero would erase Wi-Fi, keys and physical masks.
raw=binary.read_bytes()
if info.get('nvsOffset')!=0x9000 or info.get('nvsSize')!=0x5000 or len(raw)<=0xe000:raise SystemExit('Mapa NVS do pacote não reconhecido. Nenhuma gravação realizada.')
with tempfile.TemporaryDirectory() as temp:
 boot=Path(temp)/'boot.bin';app=Path(temp)/'app.bin'
 boot.write_bytes(raw[:0x9000]);app.write_bytes(raw[0xe000:])
 subprocess.run([sys.executable,'-m','esptool','--chip',info['chip'],'--port',a.porta,'--baud','460800','write_flash','--flash_size',info['flashSize'],'0x0',str(boot),'0xe000',str(app)],check=True)
print('Gravação concluída; NVS preservada. Configuração inicial: configurar.py (central) ou parear-escravo.py (escravo). As saídas começam desligadas.')
