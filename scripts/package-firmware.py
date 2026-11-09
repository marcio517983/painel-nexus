#!/usr/bin/env python3
"""Build distribution archives from the six verified PlatformIO outputs."""
from pathlib import Path
import argparse,hashlib,json,re,subprocess,tempfile,zipfile,sys,struct
root=Path(__file__).resolve().parents[1];family=root/'firmware/family'
pio=Path.home()/'.platformio/packages';out=root/'public/firmwares';out.mkdir(exist_ok=True)
profiles=['devkit-central','devkit-hub','s3-central','s3-hub','devkit-slave','c3-slave']
parser=argparse.ArgumentParser();parser.add_argument('--profile',action='append',choices=profiles);args=parser.parse_args()
selected=args.profile or profiles
catalog=json.loads((out/'catalog.json').read_text()) if (out/'catalog.json').exists() else []
catalog=[item for item in catalog if item['profile'] not in selected]
for profile in selected:
 chip='esp32s3' if profile.startswith('s3') else 'esp32c3' if profile.startswith('c3') else 'esp32'
 flash='16MB' if chip=='esp32s3' else '4MB';build=family/'.pio/build'/profile
 with tempfile.TemporaryDirectory() as temp:
  binary=Path(temp)/'firmware-completo.bin'
  subprocess.run([sys.executable,str(pio/'tool-esptoolpy/esptool.py'),'--chip',chip,'merge_bin','-o',str(binary),'--flash_size',flash,'0x1000' if chip=='esp32' else '0x0',str(build/'bootloader.bin'),'0x8000',str(build/'partitions.bin'),'0xe000',str(pio/'framework-arduinoespressif32/tools/partitions/boot_app0.bin'),'0x10000',str(build/'firmware.bin')],check=True)
  version='1.1.0' if profile.endswith('slave') else re.search(r'VERSION="([^"]+)"',(family/'src/main.cpp').read_text()).group(1)
  entries=[struct.unpack('<HBBII16sI',entry) for entry in [ (build/'partitions.bin').read_bytes()[i:i+32] for i in range(0,(build/'partitions.bin').stat().st_size-31,32)] if entry[:2]==b'\xaa\x50']
  nvs=next(entry for entry in entries if entry[1:3]==(1,2))
  assert nvs[3:5]==(0x9000,0x5000),'Unexpected NVS layout'
  manifest={'nvsOffset':nvs[3],'nvsSize':nvs[4],'profile':profile,'version':version,'chip':chip,'flashSize':flash,'sha256':hashlib.sha256(binary.read_bytes()).hexdigest(),'binaryBytes':binary.stat().st_size,'applicationBytes':(build/'firmware.bin').stat().st_size,'hardwareValidation':'Obrigatória na instalação; compilação não substitui teste físico.'}
  path=out/(profile+'.zip')
  with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
   z.write(binary,'firmware-completo.bin');z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
   for name in ['platformio.ini','LEIA-ME.md','gravar.py','configurar.py','parear-escravo.py','ativar-portal.py']:z.write(family/name,name)
   for source in sorted((family/'src').iterdir()):
    if source.suffix in ('.h','.cpp'):z.write(source,'src/'+source.name)
  with zipfile.ZipFile(path) as z:
   assert z.testzip() is None
   assert hashlib.sha256(z.read('firmware-completo.bin')).hexdigest()==manifest['sha256']
  catalog.append({**manifest,'archive':profile+'.zip','archiveSha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(out/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
print(str(len(selected))+' pacotes conferidos: CRC e SHA-256.')
