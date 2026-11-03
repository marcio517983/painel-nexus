#!/usr/bin/env python3
"""Provision a unique local HTTPS certificate over USB, preserving Wi-Fi."""
import json,time,sys,datetime,ipaddress
from pathlib import Path
try:
 import serial
 from cryptography import x509
 from cryptography.x509.oid import NameOID
 from cryptography.hazmat.primitives import hashes,serialization
 from cryptography.hazmat.primitives.asymmetric import rsa
except ImportError:
 raise SystemExit('Execute: python -m pip install pyserial cryptography')
port=input('Porta da central [COM4]: ').strip() or 'COM4'
ip=ipaddress.ip_address(input('IP local exibido em STATUS (ex.: 192.168.1.50): ').strip())
key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'nexus-local.local')])
now=datetime.datetime.now(datetime.timezone.utc)
cert=(x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-datetime.timedelta(days=1)).not_valid_after(now+datetime.timedelta(days=365)).add_extension(x509.SubjectAlternativeName([x509.DNSName('nexus-local.local'),x509.IPAddress(ip)]),critical=False).sign(key,hashes.SHA256()))
Path('nexus-local-cert.crt').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
body={'cert':cert.public_bytes(serialization.Encoding.PEM).decode(),'key':key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()).decode()}
try:
 with serial.Serial(port,115200,timeout=.5,write_timeout=10) as dev:
  time.sleep(2);dev.reset_input_buffer();dev.write(('PORTAL '+json.dumps(body)+'\n').encode());dev.flush();deadline=time.monotonic()+20
  while time.monotonic()<deadline:
   line=dev.readline().decode(errors='replace').strip()
   if line.startswith('PORTAL_SAVED'):print('Certificado exclusivo salvo na placa. Wi-Fi preservado.');break
   if line.startswith('PORTAL_ERROR'):raise SystemExit(line)
  else:raise SystemExit('Sem confirmação. Verifique COM4 e feche outros monitores.')
except serial.SerialException:raise SystemExit('Não foi possível abrir a porta serial.')
print('Abra o monitor serial e procure PORTAL_OK com o endereço de acesso.')

print('Certificado público salvo em nexus-local-cert.crt para importar como confiável no aparelho, se necessário. A chave privada fica somente na placa após o envio.')
