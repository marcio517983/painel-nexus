import {validatePassword} from '../public/password-policy.js';
import {randomBytes} from 'node:crypto';import {passwordHash} from '../server/auth.mjs';
if(process.stdin.isTTY)console.error('Digite uma senha de ao menos 8 caracteres, com maiúscula, minúscula e caractere especial e pressione Enter (entrada visível neste terminal):');
let password='';for await(const part of process.stdin){password+=part;if(password.includes('\n'))break;}password=password.trimEnd();validatePassword(password);const salt=randomBytes(16).toString('hex');console.log('NEXUS_ADMIN_SALT='+salt+'\nNEXUS_ADMIN_HASH='+await passwordHash(password,salt));
