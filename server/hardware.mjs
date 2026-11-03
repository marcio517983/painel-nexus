import {PROFILES} from '../public/hardware-profiles.js';
export {PROFILES};
const reject=m=>{throw Object.assign(Error(m),{status:400})};
export const disabledClient=c=>!c||c.simulation===true||c.archived===true;
export function validateHardware(c){
 if(disabledClient(c))reject('Cadastros de simulação foram desativados.');
 const p=c.hardware?.profile?PROFILES[c.hardware.profile]:null;
 if(c.hardware?.profile&&(!p||p.slave))reject('Perfil da central inválido.');
 const resources=new Set(),devices=new Map();
 for(const n of c.nodes){
  const local=n.transport==='local';
  if(n.transport&&!['local','radio'].includes(n.transport))reject('Ligação inválida.');
  if(n.enabled!==undefined&&typeof n.enabled!=='boolean')reject('Habilitação inválida.');
  if(n.pulseMs!==undefined&&(!Number.isInteger(n.pulseMs)||n.pulseMs<100||n.pulseMs>5000))reject('Pulso deve ter de 100 a 5000 ms.');
  if(!p){ // Existing physical installations keep their original identity and provisioning.
   if(c.nodes.some(x=>x.transport==='local')&&c.nodes.some(x=>x.transport!=='local'))reject('Atualize o perfil antes de misturar canais locais e escravos.');
   if(local&&(n.board!=='esp32-devkit'||n.type!=='gate'||![1,2].includes(n.channel)))reject('Atualize o perfil da central para usar novos canais.');
   if(!local&&!/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(n.mac))reject('MAC inválido.');
  }else{
   if(!local&&!p.hub&&n.enabled!==false)reject('Esta versão de central não comanda escravos.');
   const board=local?p.board:n.board;
   if(local&&n.board!==p.board)reject('A saída local deve pertencer ao modelo da central.');
   if(!local&&!['esp32-devkit','esp32-c3'].includes(board))reject('Escravo deve ser DevKit ou C3; S3 não é escravo.');
   if(n.type==='water'&&board==='esp32-c3')reject('C3 é limitado a dois acionadores e dois reeds.');
   if(n.type==='gate'&&(!Number.isInteger(n.channel)||n.channel<1||n.channel>(board==='esp32-c3'?2:4)))reject('Canal físico inválido para a placa.');
   if(!local&&!/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(n.mac))reject('Informe o MAC STA do escravo.');
  }
  const physical=local?'local':n.mac;
  if(devices.has(physical)&&devices.get(physical)!==n.board)reject('O mesmo dispositivo não pode ter dois modelos.');devices.set(physical,n.board);
  const key=physical+':'+n.type+':'+(n.type==='water'?1:n.channel||1);
  if(resources.has(key))reject('Canal físico já atribuído a outro acesso.');resources.add(key);
 }
 if([...devices.keys()].filter(x=>x!=='local').length>6)reject('Máximo de seis escravos por central.');
}
export function hardwareProfile(profile){const p=PROFILES[profile];if(!p||p.slave)reject('Escolha uma versão de central válida.');return{profile,board:p.board};}
export function nodeFields(b,c){const local=b.transport==='local',p=PROFILES[c.hardware?.profile];return{
 transport:local?'local':'radio',board:local&&p?p.board:(b.board||'esp32-devkit'),
 ...(local?{}:{mac:String(b.mac||'').trim().toUpperCase()}),channel:Number(b.channel||1),
 enabled:b.enabled===undefined?true:b.enabled,pulseMs:Number(b.pulseMs||1000),reed:b.reed===true
};}
