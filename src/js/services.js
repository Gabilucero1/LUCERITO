const REMOTE_ON=!!(ENV.SUPABASE_URL&&ENV.SUPABASE_ANON_KEY);
// CAPA DE SERVICIOS: es el único lugar que hay que reemplazar para conectar un servidor real.
// MODO ACTUAL ('local') = DEMOSTRACIÓN: cuentas y datos quedan en este navegador (localStorage).
// NO es seguridad real: cualquiera con acceso técnico al dispositivo puede leer o alterar estos datos.
const Store={
 ok:true,
 probe(){try{localStorage.setItem(KEY+'_p','1');localStorage.removeItem(KEY+'_p');this.ok=true}catch(e){this.ok=false}return this.ok},
 load(){if(REMOTE_ON)return null;try{return JSON.parse(localStorage.getItem(KEY))}catch(e){return null}},
 save(d){if(REMOTE_ON){Remote.schedule();return true}try{localStorage.setItem(KEY,JSON.stringify(d));this.ok=true}catch(e){this.ok=false}return this.ok},
 // Sesión recordada (solo MODO LOCAL). En modo conectado la recuerda Supabase Auth.
 session(){if(REMOTE_ON)return null;try{return JSON.parse(localStorage.getItem(KEY+'_session'))}catch(e){return null}},
 setSession(s){if(REMOTE_ON)return;try{localStorage.setItem(KEY+'_session',JSON.stringify(s))}catch(e){}},
 clearSession(){try{localStorage.removeItem(KEY+'_session')}catch(e){}}
 // TODO servidor: reemplazar por lecturas y escrituras a una base de datos (ej. Postgres / Supabase).
};
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const Mailer={
 // TODO servidor: enviar el correo de verdad (Resend, SendGrid, Supabase Auth, etc.). Desde el navegador NO se puede.
 // Devuelve true solo si el correo realmente salió. Hoy no hay servicio conectado, por eso devuelve false.
 async send(to,subject,text){return false}
};
const Auth={
 // La contraseña nunca se guarda: solo un hash con sal (PBKDF2). En modo demo el hash se calcula en el navegador.
 async hash(pass,salt){
  if(!(window.crypto&&crypto.subtle))throw new Error('Este navegador no puede proteger contraseñas. Abrí la app con https.');
  const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:150000,hash:'SHA-256'},k,256))},
 async check(u,pass){return !!(u&&u.hash&&u.salt)&&await this.hash(pass,u.salt)===u.hash},
 async setPassword(u,pass){u.salt=hex(crypto.getRandomValues(new Uint8Array(16)));u.hash=await this.hash(pass,u.salt)},
 // ----- Recuperación de contraseña (código temporal de 6 dígitos, vence a los 10 min, 5 intentos, un solo uso) -----
 async requestReset(email){const u=db.users.find(x=>x.email===email);
  if(!u)return {mailed:false,code:null,unknown:!!ENV.DEV_SHOW_CODE};
  const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'),salt=hex(crypto.getRandomValues(new Uint8Array(8)));
  db.resets=(db.resets||[]).filter(r=>r.email!==email);db.resets.push({email,salt,hash:await this.hash(code,salt),exp:Date.now()+10*60000,tries:0});save();
  const mailed=await Mailer.send(email,'Tu código de recuperación de LUCERITO','Tu código de recuperación de LUCERITO es: '+code);
  // MODO PRUEBA (solo si se compila con DEV_SHOW_CODE=true): muestra el código en pantalla porque no hay correo conectado.
  return {mailed,code:(!mailed&&ENV.DEV_SHOW_CODE)?code:null}},
 async verifyReset(email,code){const r=(db.resets||[]).find(x=>x.email===email);
  if(!r)return {ok:false,msg:'Pedí un código nuevo.'};
  if(Date.now()>r.exp){db.resets=db.resets.filter(x=>x!==r);save();return {ok:false,msg:'El código venció. Pedí uno nuevo.'}}
  if(r.tries>=5){db.resets=db.resets.filter(x=>x!==r);save();return {ok:false,msg:'Demasiados intentos. Pedí un código nuevo.'}}
  r.tries++;save();
  if(await this.hash(String(code).trim(),r.salt)!==r.hash)return {ok:false,msg:'El código no es correcto.'};
  return {ok:true}},
 async resetPassword(email,code,pass){const v=await this.verifyReset(email,code);if(!v.ok)return v;
  const u=db.users.find(x=>x.email===email);if(!u)return {ok:false,msg:'Cuenta no encontrada.'};
  await this.setPassword(u,pass);db.resets=db.resets.filter(x=>x.email!==email);save();return {ok:true}}
 // TODO servidor: reemplazar por un servicio de autenticación real (login, registro, sesiones y recuperación en servidor).
};
