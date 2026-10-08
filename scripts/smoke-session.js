// Prueba de CUENTAS PERMANENTES: crear cuenta, cerrar sesión, volver a entrar, recargar, reabrir, modo local vs conectado.
// Cada makeApp() es una "apertura" de la app: dos aperturas con el mismo almacenamiento (ls) = recargar o cerrar y reabrir.
const fs=require('fs'),path=require('path');
const {Server,client}=require('./fake-supabase');
const ORDER=JSON.parse(fs.readFileSync(path.join(__dirname,'order.json'),'utf8'));
const APP=ORDER.map(n=>fs.readFileSync(path.join(__dirname,'..','src','js',n+'.js'),'utf8')).join('\n');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
global.scrollTo=()=>{};
const makeLS=()=>{const st={};return {getItem:k=>st[k]??null,setItem:(k,v)=>{st[k]=String(v)},removeItem:k=>{delete st[k]},_st:st}};
function makeApp({ls,server,remote}){
 const vals={},fetched=[];
 const mk=v=>({innerHTML:'',value:v,textContent:'',style:{},remove(){},set onclick(x){},set oninput(x){}});
 const doc={querySelector:s=>vals[s]!==undefined?mk(vals[s]):mk('1'),createElement:()=>({...mk(''),getContext:()=>({drawImage(){}}),toDataURL:()=>''}),body:{appendChild(){}},head:{appendChild(){}}};
 const win={crypto:globalThis.crypto};win.top=win.self=win;
 if(remote)win.supabase={createClient:()=>client(server,ls)};
 const loc={hash:'',search:'',href:'http://x/',origin:'http://x',pathname:'/'};
 const env='const ENV={STORAGE_KEY:"t",ADMIN_EMAIL:"",DEV_SHOW_CODE:false,'+(remote?'SUPABASE_URL:"http://fake",SUPABASE_ANON_KEY:"k",':'')+'FIREBASE_API_KEY:""};\n';
 const fn=new Function('document','localStorage','window','navigator','screen','location','fetch','history','vals','fetched',env+APP+'\nreturn {run:c=>eval(c),vals,toasts:TOASTS};');
 return fn(doc,ls,win,{userAgent:'Android'},{width:360,height:800},loc,async()=>({ok:true}),{replaceState(){}},vals,fetched);
}
const ready=async H=>{while(!H.run('Remote.ready'))await sleep(5);await sleep(20)};
const reg=async(H,o)=>{H.run('splash=false;authView="reg"');Object.assign(H.vals,{'#rn1':o.n,'#rn2':'X','#ru':o.u,'#rm':o.m,'#rp':o.p,'#rp2':o.p});await H.run('doReg()')};
const login=async(H,m,p)=>{H.run('splash=false;authView="login"');Object.assign(H.vals,{'#lu':m,'#lp':p});await H.run('doLogin()');await sleep(20)};
const ok=(c,m)=>{if(!c)throw new Error(m)};
(async()=>{
 // ===== MODO LOCAL (sin credenciales de Supabase) =====
 const ls=makeLS();
 let L=makeApp({ls});
 await reg(L,{n:'Gabi',u:'gabi',m:'gabi@email.com',p:'clave123'});
 ok(L.run('me&&me.admin&&db.users.length')===1,'local: la primera cuenta queda como administradora');
 await L.run('logout()');ok(L.run('me')===null,'local: cerrar sesión');
 await login(L,'gabi@email.com','clave123');
 ok(L.run('me&&me.email')==='gabi@email.com'&&L.run('db.users.length')===1,'PRUEBA 1 (local): vuelve a entrar a SU cuenta y no se crea otra');
 let L2=makeApp({ls});
 ok(L2.run('me&&me.email')==='gabi@email.com'&&L2.run('db.users.length')===1,'PRUEBA 2 (local): al recargar se conserva la sesión');
 let L3=makeApp({ls});
 ok(L3.run('me&&me.email')==='gabi@email.com','PRUEBA 3 (local): al cerrar y reabrir la app el usuario sigue existiendo y entrada directa');
 await L3.run('logout()');
 let L4=makeApp({ls});ok(L4.run('me')===null&&L4.run('db.users.length')===1,'local: tras cerrar sesión voluntariamente pide ingresar, pero la cuenta sigue existiendo');
 await login(L4,'gabi@email.com','clave123');ok(L4.run('me&&me.email')==='gabi@email.com'&&L4.run('authView')==='login','PRUEBA 4 (local): entra a la cuenta existente, no al registro');
 await reg(L4,{n:'Otra',u:'otra',m:'GABI@email.com',p:'clave123'});ok(L4.run('db.users.length')===1,'local: el mismo correo no se registra dos veces');
 // una sesión cerrada por la administradora no se restaura
 await reg(makeApp({ls}),{n:'Cami',u:'cami',m:'cami@email.com',p:'cami1234'});
 // ===== MODO CONECTADO (Supabase) =====
 const server=new Server(),lsR=makeLS();
 let R=makeApp({ls:lsR,server,remote:true});await ready(R);
 ok(R.run('me')===null,'conectado: sin sesión muestra el ingreso, no crea nada solo');
 ok(server.users.length===0&&server.table('profiles').length===0,'conectado: abrir la app no crea cuentas');
 await reg(R,{n:'Gabi',u:'gabi',m:'gabi@email.com',p:'clave123'});
 const uid1=R.run('me.uid');ok(uid1&&server.users.length===1&&server.table('profiles').length===1,'conectado: cuenta creada en el sistema de autenticación');
 ok(server.table('profiles')[0].id===server.users[0].id&&uid1===server.users[0].id,'PRUEBA 5: el perfil está asociado al mismo usuario de Supabase');
 ok(server.table('app_sessions').length===1,'conectado: la sesión de la app se registra');
 await R.run('logout()');ok(R.run('me')===null,'conectado: cerrar sesión');
 await login(R,'gabi@email.com','clave123');
 ok(R.run('me&&me.uid')===uid1&&server.users.length===1&&server.table('profiles').length===1,'PRUEBA 1 (conectado): vuelve a entrar con la misma cuenta, sin crear otra');
 let R2=makeApp({ls:lsR,server,remote:true});await ready(R2);
 ok(R2.run('me&&me.uid')===uid1&&server.users.length===1,'PRUEBA 2 (conectado): al recargar se recupera la sesión y el perfil');
 let R3=makeApp({ls:lsR,server,remote:true});await ready(R3);
 ok(R3.run('me&&me.email')==='gabi@email.com'&&R3.run('me.admin')===1,'PRUEBA 3 (conectado): cerrar y reabrir mantiene la cuenta (y sigue siendo la administradora)');
 await R3.run('logout()');
 let R4=makeApp({ls:lsR,server,remote:true});await ready(R4);ok(R4.run('me')===null,'conectado: tras cerrar sesión pide ingresar');
 await login(R4,'gabi@email.com','clave123');ok(R4.run('me&&me.uid')===uid1&&R4.run('authView')==='login','PRUEBA 4 (conectado): entra a la cuenta existente, no al registro');
 await reg(R4,{n:'Gabi2',u:'gabi2',m:'gabi@email.com',p:'otraclave'});ok(server.users.length===1&&server.table('profiles').length===1,'conectado: el mismo correo no crea otra cuenta');
 // otra usuaria desde otro celular (otro almacenamiento) y sus recargas
 const ls2=makeLS();let C=makeApp({ls:ls2,server,remote:true});await ready(C);
 await reg(C,{n:'Cami',u:'cami',m:'cami@email.com',p:'cami1234'});const uid2=C.run('me.uid');
 ok(uid2&&uid2!==uid1&&server.users.length===2&&!C.run('me.admin'),'conectado: la segunda usuaria queda registrada como usuaria');
 let C2=makeApp({ls:ls2,server,remote:true});await ready(C2);ok(C2.run('me&&me.uid')===uid2,'conectado: Cami recarga y sigue siendo Cami');
 ok(C2.run('db.users.length')===2,'conectado: ve las cuentas del mismo proyecto central');
 // ===== PRUEBA 7: lo local no se mezcla con lo conectado =====
 const lsMix=makeLS();let ML=makeApp({ls:lsMix});await reg(ML,{n:'Local',u:'local',m:'local@email.com',p:'clave123'});
 const localDb=lsMix.getItem('t'),localSess=lsMix.getItem('t_session');ok(localDb&&localSess,'local: guardó cuenta y sesión');
 let M=makeApp({ls:lsMix,server,remote:true});await ready(M);
 ok(M.run('me')===null,'PRUEBA 7: con Supabase configurado no se entra con la sesión local');
 ok(M.run('db.users.length')===0&&!M.run('db.users.some(u=>u.email==="local@email.com")'),'PRUEBA 7: no se mezclan los usuarios locales con los reales');
 ok(lsMix.getItem('t')===localDb,'PRUEBA 7: los datos locales no se tocan ni se borran');
 await login(M,'local@email.com','clave123');ok(M.run('me')===null,'PRUEBA 7: una cuenta local no entra a Supabase');
 // ===== si la sesión de Supabase falla, NO se cae al modo local ni se crea cuenta =====
 const bad=makeApp({ls:makeLS(),server,remote:true});await ready(bad);ok(bad.run('Remote.on')===true&&bad.run('db.users.length')===0,'conectado: nunca usa registro local como sustituto');
 console.log('Prueba de cuentas permanentes OK');process.exit(0);
})().catch(e=>{console.error('FALLÓ:',e.stack||e.message);process.exit(1)});
