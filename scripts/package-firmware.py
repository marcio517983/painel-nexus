#!/usr/bin/env python3
"""Build distribution archives from the six verified PlatformIO outputs."""
from pathlib import Path
import hashlib,json,subprocess,tempfile,zipfile
root=Path(__file__).resolve().parents[1];family=root/'firmware/family'
pio=Path.home()/'.platformio/packages';out=root/'public/firmwares';out.mkdir(exist_ok=True)
profiles=['devkit-central','devkit-hub','s3-central','s3-hub','devkit-slave','c3-slave']
catalog=[]
for profile in profiles:
 chip='esp32s3' if profile.startswith('s3') else 'esp32c3' if profile.startswith('c3') else 'esp32'
 flash='16MB' if chip=='esp32s3' else '4MB';build=family/'.pio/build'/profile
 with tempfile.TemporaryDirectory() as temp:
  binary=Path(temp)/'firmware-completo.bin'
  subprocess.run(['python',str(pio/'tool-esptoolpy/esptool.py'),'--chip',chip,'merge_bin','-o',str(binary),'--flash_size',flash,'0x1000' if chip=='esp32' else '0x0',str(build/'bootloader.bin'),'0x8000',str(build/'partitions.bin'),'0xe000',str(pio/'framework-arduinoespressif32/tools/partitions/boot_app0.bin'),'0x10000',str(build/'firmware.bin')],check=True)
  manifest={'profile':profile,'version':'1.1.0','chip':chip,'flashSize':flash,'sha256':hashlib.sha256(binary.read_bytes()).hexdigest(),'binaryBytes':binary.stat().st_size,'applicationBytes':(build/'firmware.bin').stat().st_size,'hardwareValidation':'Obrigatória na instalação; compilação não substitui teste físico.'}
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
print('Seis pacotes conferidos: CRC e SHA-256.')
