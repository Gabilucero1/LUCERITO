// Une src/js/*.js + src/styles.css en dist/index.html (sin dependencias).
const fs=require('fs'),path=require('path'),http=require('http');
const root=path.join(__dirname,'..'),src=path.join(root,'src'),out=path.join(root,'dist');
const ORDER=JSON.parse(fs.readFileSync(path.join(__dirname,'order.json'),'utf8'));
const env={APP_NAME:'LUCERITO',STORAGE_KEY:'lucerito_v1',ADMIN_EMAIL:'',DEV_SHOW_CODE:'false',SUPABASE_URL:'',SUPABASE_ANON_KEY:'',FIREBASE_API_KEY:'',FIREBASE_AUTH_DOMAIN:'',FIREBASE_PROJECT_ID:'',FIREBASE_STORAGE_BUCKET:'',FIREBASE_MESSAGING_SENDER_ID:'',FIREBASE_APP_ID:'',FIREBASE_VAPID_KEY:''};
try{fs.readFileSync(path.join(root,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);if(m&&!l.trim().startsWith('#'))env[m[1]]=m[2]})}catch(e){}
Object.keys(env).forEach(k=>{if(process.env[k])env[k]=process.env[k]});
const js='const ENV='+JSON.stringify({STORAGE_KEY:env.STORAGE_KEY,ADMIN_EMAIL:env.ADMIN_EMAIL,DEV_SHOW_CODE:env.DEV_SHOW_CODE==='true',SUPABASE_URL:env.SUPABASE_URL,SUPABASE_ANON_KEY:env.SUPABASE_ANON_KEY,FIREBASE_API_KEY:env.FIREBASE_API_KEY,FIREBASE_AUTH_DOMAIN:env.FIREBASE_AUTH_DOMAIN,FIREBASE_PROJECT_ID:env.FIREBASE_PROJECT_ID,FIREBASE_STORAGE_BUCKET:env.FIREBASE_STORAGE_BUCKET,FIREBASE_MESSAGING_SENDER_ID:env.FIREBASE_MESSAGING_SENDER_ID,FIREBASE_APP_ID:env.FIREBASE_APP_ID,FIREBASE_VAPID_KEY:env.FIREBASE_VAPID_KEY})+';\n'+ORDER.map(n=>fs.readFileSync(path.join(src,'js',n+'.js'),'utf8')).join('\n');
const css=fs.readFileSync(path.join(src,'styles.css'),'utf8');
const html=fs.readFileSync(path.join(src,'index.html'),'utf8').replace('<title>LUCERITO</title>','<title>'+env.APP_NAME+'</title>').replace('/*CSS*/',()=>css).replace('/*JS*/',()=>js);
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),html);
// Archivos públicos: service worker de notificaciones (con la configuración PÚBLICA de Firebase), manifiesto e íconos
const pub=path.join(root,'public');
const fbCfg=env.FIREBASE_API_KEY?{apiKey:env.FIREBASE_API_KEY,authDomain:env.FIREBASE_AUTH_DOMAIN||(env.FIREBASE_PROJECT_ID+'.firebaseapp.com'),projectId:env.FIREBASE_PROJECT_ID,storageBucket:env.FIREBASE_STORAGE_BUCKET,messagingSenderId:env.FIREBASE_MESSAGING_SENDER_ID,appId:env.FIREBASE_APP_ID}:null;
fs.writeFileSync(path.join(out,'firebase-messaging-sw.js'),fs.readFileSync(path.join(pub,'firebase-messaging-sw.template.js'),'utf8').replace('__FIREBASE_CONFIG__',JSON.stringify(fbCfg)));
for(const f of ['manifest.webmanifest','icon-192.png','icon-512.png'])fs.copyFileSync(path.join(pub,f),path.join(out,f));
console.log('Build listo: dist/index.html ('+Math.round(html.length/1024)+' KB)');
if(process.argv.includes('--serve'))http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(html)}).listen(3000,()=>console.log('Abrí http://localhost:3000'));
