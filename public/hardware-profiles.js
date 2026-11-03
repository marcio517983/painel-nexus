export const PROFILES = Object.freeze({
 'devkit-central':{name:'DevKit Central',board:'esp32-devkit',hub:false,gates:4,pump:true},
 'devkit-hub':{name:'DevKit Central + Escravos',board:'esp32-devkit',hub:true,gates:4,pump:true},
 's3-central':{name:'S3 Central',board:'esp32-s3',hub:false,gates:4,pump:true},
 's3-hub':{name:'S3 Central + Escravos',board:'esp32-s3',hub:true,gates:4,pump:true},
 'devkit-slave':{name:'DevKit Escravo',board:'esp32-devkit',slave:true,gates:4,pump:true},
 'c3-slave':{name:'C3 Escravo',board:'esp32-c3',slave:true,gates:2,pump:false}
});
