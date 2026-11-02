import {randomBytes} from 'node:crypto';import {passwordHash} from '../server/auth.mjs';
if(process.stdin.isTTY)console.error('Digite uma senha de ao menos 12 caracteres e pressione Enter (entrada visível neste terminal):');
let password='';for await(const part of process.stdin){password+=part;if(password.includes('\n'))break;}password=password.trimEnd();if(password.length<12||password.length>256)throw Error('Use de 12 a 256 caracteres.');const salt=randomBytes(16).toString('hex');console.log('NEXUS_ADMIN_SALT='+salt+'\nNEXUS_ADMIN_HASH='+await passwordHash(password,salt));
