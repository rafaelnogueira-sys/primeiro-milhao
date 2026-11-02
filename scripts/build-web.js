// Copia o app web (app/) para www/, a pasta que o Capacitor empacota no APK.
// O service worker não é necessário dentro do APK (o app já vai embutido).
const fs = require('fs'), path = require('path');
const origem = path.join(__dirname, '..', 'app'), destino = path.join(__dirname, '..', 'www');
fs.rmSync(destino, { recursive: true, force: true });
fs.cpSync(origem, destino, { recursive: true });
fs.rmSync(path.join(destino, 'sw.js'), { force: true });
console.log('www/ pronto');
