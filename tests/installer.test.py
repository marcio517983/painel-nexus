import hashlib,json,runpy,subprocess,sys,tempfile,types,unittest
from pathlib import Path
from unittest.mock import patch
SOURCE=Path(__file__).resolve().parents[1]/'firmware/family/gravar.py'
class InstallerTest(unittest.TestCase):
 def run_installer(self,bad_hash=False,flash='4MB'):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);script=root/'gravar.py';script.write_text(SOURCE.read_text())
   raw=bytes((i//4096)%256 for i in range(0x11000));(root/'firmware-completo.bin').write_bytes(raw)
   info={'profile':'devkit-central','version':'1.1.1','chip':'esp32','flashSize':'4MB','sha256':('0'*64 if bad_hash else hashlib.sha256(raw).hexdigest()),'nvsOffset':0x9000,'nvsSize':0x5000};(root/'manifest.json').write_text(json.dumps(info))
   calls=[]
   def execute(args,**kwargs):
    calls.append(args)
    if 'flash_id' in args:return subprocess.CompletedProcess(args,0,stdout='Detected flash size: '+flash)
    assert 'write_flash' in args
    assert args[-4]=='0x0' and args[-2]=='0xe000'
    assert Path(args[-3]).read_bytes()==raw[:0x9000]
    assert Path(args[-1]).read_bytes()==raw[0xe000:]
    return subprocess.CompletedProcess(args,0)
   with patch.dict(sys.modules,{'esptool':types.ModuleType('esptool')}),patch.object(sys,'argv',[str(script),'--porta','COM_TEST']),patch('subprocess.run',side_effect=execute),patch('builtins.print'):
    try:runpy.run_path(str(script),run_name='__main__');error=None
    except SystemExit as e:error=str(e)
   return calls,error
 def test_nvs_gap_is_never_written(self):
  calls,error=self.run_installer();self.assertIsNone(error);self.assertEqual(len(calls),2)
 def test_bad_checksum_prevents_any_serial_operation(self):
  calls,error=self.run_installer(bad_hash=True);self.assertEqual(calls,[]);self.assertIn('checksum',error)
 def test_wrong_memory_prevents_flash(self):
  calls,error=self.run_installer(flash='2MB');self.assertEqual(len(calls),1);self.assertIn('Nenhuma gravação',error)
if __name__=='__main__':unittest.main()
