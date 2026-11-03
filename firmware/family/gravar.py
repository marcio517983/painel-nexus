#!/usr/bin/env python3
import argparse,hashlib,json,subprocess,sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--porta',required=True);a=p.parse_args();root=Path(__file__).resolve().parent
try:
 info=json.loads((root/'manifest.json').read_text());binary=root/'firmware-completo.bin'
 if hashlib.sha256(binary.read_bytes()).hexdigest()!=info['sha256']:raise ValueError()
except (OSError,ValueError,KeyError):raise SystemExit('Pacote incompleto ou checksum incorreto. Extraia novamente o ZIP completo.')
try:import esptool
except ImportError:raise SystemExit('Execute: python -m pip install esptool==4.5.1 pyserial==3.5')
print('Perfil:',info['profile'],'— mantenha as cargas desconectadas durante a gravação e confira os canais depois.')
probe=subprocess.run([sys.executable,'-m','esptool','--chip',info['chip'],'--port',a.porta,'flash_id'],capture_output=True,text=True)
if probe.returncode:raise SystemExit('Não foi possível identificar a placa. Confira a porta, o chip e o cabo.')
if ('Detected flash size: '+info['flashSize']) not in probe.stdout:raise SystemExit('A memória flash detectada não corresponde ao pacote. Nenhuma gravação realizada.')
subprocess.run([sys.executable,'-m','esptool','--chip',info['chip'],'--port',a.porta,'--baud','460800','write_flash','--flash_size',info['flashSize'],'0x0',str(binary)],check=True)
print('Gravação concluída. Central: configurar.py; escravo: parear-escravo.py. As saídas começam desligadas.')
