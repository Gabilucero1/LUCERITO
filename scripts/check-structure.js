// Revisa que el repositorio tenga TODAS las carpetas y archivos necesarios (sirve para detectar subidas incompletas a GitHub).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const need = [
  'package.json', 'vercel.json', 'db/schema.sql',
  'api/_lib.js', 'api/_alerts.js', 'api/notify.js', 'api/cron-alerts.js',
  'public/manifest.webmanifest', 'public/firebase-messaging-sw.template.js', 'public/icon-192.png', 'public/icon-512.png',
  'src/index.html', 'src/styles.css', 'scripts/build.js', 'scripts/order.json',
];
const order = JSON.parse(fs.readFileSync(path.join(root, 'scripts/order.json'), 'utf8'));
(Array.isArray(order) ? order : []).forEach((f) => need.push('src/js/' + f + '.js'));
const missing = [...new Set(need)].filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length) {
  console.error('FALTAN archivos en el repositorio (la subida a GitHub quedó incompleta):\n - ' + missing.join('\n - '));
  process.exit(1);
}
console.log('Estructura OK (' + new Set(need).size + ' archivos requeridos presentes).');
