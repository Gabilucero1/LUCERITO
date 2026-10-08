// Ingreso con CORREO + contraseña, registro, recuperación de contraseña y sesiones.
// AVISO: en modo demo todo vive en este dispositivo (ver services.js). No es autenticación real hasta conectar un servidor.
let splash=true,authView='login',authMsg='',sid=null,fpStep=1,fpEmail='',fpCode='',fpDev=null;
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const setMsg=t=>{const e=$('#le');if(!e)return;e.textContent=t;if(e.style)e.style.display='block'};
// ----- sesiones (clave aparte para que otras pestañas del mismo navegador las vean) -----
const SKEY=KEY+'_sessions';
const loadSess=()=>{try{return JSON.parse(localStorage.getItem(SKEY))||[]}catch(e){return[]}};
const saveSess=s=>{try{localStorage.setItem(SKEY,JSON.stringify(s))}catch(e){}};
const deviceKind=()=>/Android|iPhone|iPad|Mobile/.test(navigator.userAgent)?'Celular':'Computadora';
function startSess(){const s=loadSess();sid='s'+Date.now()+Math.random().toString(36).slice(2,6);s.unshift({id:sid,uid:me.id,name:me.name,dev:deviceKind(),start:Date.now(),last:Date.now(),on:1});saveSess(s.slice(0,40))}
function touchSess(){if(Remote.on)return !Remote.revoked;if(!sid||!Store.ok)return true;const s=loadSess(),m=s.find(x=>x.id===sid);if(!m||!m.on)return false;m.last=Date.now();saveSess(s);return true}
const sessAlive=()=>{if(Remote.on)return !Remote.revoked;if(!sid||!Store.ok)return true;const m=loadSess().find(x=>x.id===sid);return !!(m&&m.on)};
function endSess(id){if(Remote.on){Remote.endSession(id);return}const s=loadSess(),m=s.find(x=>x.id===id);if(m){m.on=0;m.end=Date.now();saveSess(s)}}
function endUserSess(uid){if(Remote.on){const u=db.users.find(x=>x.id===uid);if(u)Remote.revokeUser(u.uid);return}const s=loadSess();s.forEach(x=>{if(x.uid===uid&&x.on){x.on=0;x.end=Date.now()}});saveSess(s)}
function forceOut(){if(FORCING)return;FORCING=true;scStop();if(me)log('Sesión cerrada por la administradora','Su sesión fue cerrada');
 const fin=()=>{Store.clearSession();me=null;sid=null;view='home';const s=$('#sh');if(s)s.remove();authMsg='Tu sesión fue cerrada por la administradora.';if(Remote.on)Remote.clear();FORCING=false;render()};
 if(Remote.on){Remote.revoked=true;Remote.flush().catch(()=>{}).then(()=>Remote.signOut()).then(fin,fin)}else fin()}
const CART=`<svg viewBox="0 0 200 170" aria-hidden="true"><g fill="none" stroke="#7d1f3d" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 24h26l20 82h86l16-56H46"/></g><rect x="70" y="52" width="16" height="42" rx="7" fill="#E88CA5"/><rect x="92" y="64" width="30" height="30" rx="5" fill="#F7D6DD" stroke="#C9506F" stroke-width="3"/><rect x="128" y="68" width="22" height="26" rx="5" fill="#C9506F"/><circle cx="76" cy="46" r="5" fill="#C9506F"/><circle cx="80" cy="132" r="10" fill="#7d1f3d"/><circle cx="138" cy="132" r="10" fill="#7d1f3d"/><g fill="#E88CA5"><path transform="translate(168 22)" d="M0 6C-16 -10 -9 -24 0 -15C9 -24 16 -10 0 6Z"/><path transform="translate(26 70) scale(.6)" d="M0 6C-16 -10 -9 -24 0 -15C9 -24 16 -10 0 6Z"/></g><path transform="translate(107 78) scale(.45)" d="M0 6C-16 -10 -9 -24 0 -15C9 -24 16 -10 0 6Z" fill="#C9506F"/></svg>`;
function login(){
 if(Remote.on&&!Remote.ready){$('#app').innerHTML='<div class="splash"><div class="l">Lucerito</div><p>Cargando…</p></div>';return}
 if(splash){$('#app').innerHTML=`<div class="splash"><div class="l">Lucerito</div>${CART}<button class="btn" onclick="splash=false;render()">♡ COMENZAR</button></div>`;return}
 if(authView==='reg')return regForm();
 if(authView==='forgot')return fpView();
 if(authView==='recover')return recoverView();
 const m=authMsg||(BOOTERR?'No se pudo conectar con el servidor: '+BOOTERR:'');authMsg='';
 $('#app').innerHTML=`<div class="login"><h1>LUCERITO</h1><h2>Iniciar sesión</h2>${m?`<p class="lmsg">${esc(m)}</p>`:''}${Remote.on?'':'<p class="mut">Modo local: las cuentas se guardan solo en este dispositivo. Para que todas usen las mismas cuentas hay que conectar Supabase.</p>'}<label>Correo electrónico</label><input id="lu" type="email" inputmode="email" autocapitalize="none" autocomplete="username"><label>Contraseña</label><input id="lp" type="password" autocomplete="current-password"><button class="btn" onclick="doLogin()">INGRESAR</button><p id="le" class="lmsg" style="display:none"></p><button class="lnk" onclick="authView='forgot';fpStep=1;render()">¿Olvidaste tu contraseña?</button><p>¿Todavía no tenés una cuenta?</p><button class="btn s" onclick="authView='reg';render()">CREAR MI USUARIO</button></div>`}
function regForm(){const first=!Remote.on&&!db.users.some(u=>u.admin)&&!ENV.ADMIN_EMAIL;
 $('#app').innerHTML=`<div class="login"><div class="row" style="align-items:flex-start;justify-content:space-between"><div style="flex:1"><h1>LUCERITO</h1><h2>Crear mi usuario</h2></div><div class="pimg xl" id="pv" style="margin:0 0 0 auto">📷</div></div>${first?'<p class="lmsg">Esta es la primera cuenta: va a ser la Administradora principal.</p>':''}<label>Foto de perfil (opcional)</label><input type="file" accept="image/*" onchange="pav(this)"><label>Nombre</label><input id="rn1"><label>Apellido</label><input id="rn2"><label>Nombre de usuario</label><input id="ru" autocapitalize="none"><label>Correo electrónico</label><input id="rm" type="email" inputmode="email" autocapitalize="none"><label>Contraseña</label><input id="rp" type="password" autocomplete="new-password"><label>Repetir contraseña</label><input id="rp2" type="password" autocomplete="new-password"><button class="btn" onclick="doReg()">CREAR MI USUARIO</button><p id="le" class="lmsg" style="display:none"></p><button class="btn s" onclick="authView='login';newAv=null;render()">Volver a iniciar sesión</button></div>`}
function enter(u){me=u;view='home';authView='login';u.lastAccess={d:iso(),h:hm()};startSess();Store.setSession({uid:u.id,sid});log('Ingresó','Inicio de sesión');save();render()}
async function doReg(){const n=$('#rn1').value.trim(),a=$('#rn2').value.trim(),u=$('#ru').value.trim().toLowerCase().replace(/\s+/g,''),m=$('#rm').value.trim().toLowerCase(),p=$('#rp').value;
 if(!n||!u||!m||!p)return setMsg('Completá nombre, usuario, correo y contraseña.');
 if(!EMAIL_RE.test(m))return setMsg('El correo no tiene un formato válido.');
 if(p.length<6)return setMsg('La contraseña debe tener al menos 6 caracteres.');
 if(p!==$('#rp2').value)return setMsg('Las contraseñas no coinciden.');
 if(db.users.some(x=>x.email===m))return setMsg('Ya existe una cuenta con ese correo.');
 if(db.users.some(x=>x.id===u))return setMsg('Ese nombre de usuario ya está en uso.');
 if(Remote.on)return regRemote(n,a,u,m,p);
 const adminNow=ENV.ADMIN_EMAIL?m===String(ENV.ADMIN_EMAIL).toLowerCase():!db.users.some(x=>x.admin);
 const x={id:u,email:m,name:n,last:a,on:(adminNow||!db.cfg.approve)?1:0,photo:newAv||'',...(adminNow?{admin:1}:{})};
 try{await Auth.setPassword(x,p)}catch(err){return setMsg(err.message)}
 db.users.push(x);newAv=null;save();log('Creó su cuenta',m,null,null,x);
 if(!x.on){authView='login';authMsg='Tu cuenta fue creada. La administradora tiene que activarla para que puedas ingresar.';return render()}
 enter(x)}
async function doLogin(){const m=$('#lu').value.trim().toLowerCase(),p=$('#lp').value,u=db.users.find(x=>x.email===m);
 if(!m||!p)return setMsg('Escribí tu correo y tu contraseña.');
 if(Remote.on){const r=await Remote.signIn(m,p);if(r.error)return setMsg(r.error);try{await Remote.afterAuth()}catch(e){authMsg=e.message}return render()}
 if(!u)return setMsg('Correo o contraseña incorrectos.');
 let ok=false;try{ok=await Auth.check(u,p)}catch(err){return setMsg(err.message)}
 if(!ok)return setMsg('Correo o contraseña incorrectos.');
 if(!u.on)return setMsg('Tu cuenta está desactivada o pendiente de aprobación. Hablá con la administradora.');
 enter(u)}
// ----- olvidé mi contraseña -----
function fpView(){const B=`<button class="btn s" onclick="authView='login';render()">Volver a iniciar sesión</button>`,M='<p id="le" class="lmsg" style="display:none"></p>';let h;
 if(fpStep===1)h=`<h2>Recuperar contraseña</h2><label>Ingresá tu correo electrónico</label><input id="fe" type="email" inputmode="email" autocapitalize="none"><button class="btn" onclick="fpSend()">ENVIAR CÓDIGO</button>${M}`;
 else if(fpStep===2)h=`<h2>Ingresá el código</h2>${fpDev?`<p class="lmsg">MODO PRUEBA: el correo NO se envió (no hay servicio de correo conectado). El código es: <b>${esc(fpDev)}</b></p>`:`<p>Te enviamos un código a <b>${esc(fpEmail)}</b>. Vence en 10 minutos.</p>`}<label>Ingresá el código que recibiste por correo</label><input id="fc" inputmode="numeric" maxlength="6"><button class="btn" onclick="fpCheck()">VALIDAR CÓDIGO</button>${M}`;
 else if(fpStep===3)h=`<h2>Nueva contraseña</h2><label>Nueva contraseña</label><input id="fp1" type="password" autocomplete="new-password"><label>Repetir nueva contraseña</label><input id="fp2" type="password" autocomplete="new-password"><button class="btn" onclick="fpSave()">GUARDAR CONTRASEÑA</button>${M}`;
 else if(fpStep===5)h=`<h2>Revisá tu correo</h2><p>Si <b>${esc(fpEmail)}</b> está registrado, te enviamos un correo con un enlace para crear una nueva contraseña. Abrí el enlace desde este mismo dispositivo. Si no llega, revisá la carpeta de spam.</p>`;
 else h=`<h2>Contraseña actualizada correctamente.</h2><p>Ya podés ingresar con tu correo y la nueva contraseña.</p>`;
 $('#app').innerHTML=`<div class="login"><h1>LUCERITO</h1>${h}${B}</div>`}
async function fpSend(){const m=$('#fe').value.trim().toLowerCase();if(!EMAIL_RE.test(m))return setMsg('Escribí un correo válido.');
 if(Remote.on){const r=await Remote.resetEmail(m);if(r.error)return setMsg(r.error);fpEmail=m;fpStep=5;return render()}
 let r;try{r=await Auth.requestReset(m)}catch(err){return setMsg(err.message)}
 if(r.unknown)return setMsg('No hay ninguna cuenta con ese correo (este mensaje solo aparece en modo prueba).');
 if(!r.mailed&&!r.code)return setMsg('Todavía no hay un servicio de correo conectado, por eso no se puede enviar el código. Cuando la app se conecte al servidor de correo, el código llegará a tu email.');
 fpEmail=m;fpDev=r.code;fpStep=2;render()}
async function fpCheck(){const c=$('#fc').value.trim();let v;try{v=await Auth.verifyReset(fpEmail,c)}catch(err){return setMsg(err.message)}if(!v.ok)return setMsg(v.msg);fpCode=c;fpStep=3;render()}
async function fpSave(){const a=$('#fp1').value,b=$('#fp2').value;if(a.length<6)return setMsg('La contraseña debe tener al menos 6 caracteres.');if(a!==b)return setMsg('Las contraseñas no coinciden.');
 let r;try{r=await Auth.resetPassword(fpEmail,fpCode,a)}catch(err){return setMsg(err.message)}if(!r.ok)return setMsg(r.msg);
 const u=db.users.find(x=>x.email===fpEmail);if(u){endUserSess(u.id);log('Restableció su contraseña',u.email,null,null,u)}
 fpStep=4;fpCode='';fpDev=null;render()}
function logout(){
 const fin=()=>{Store.clearSession();sid=null;me=null;view='home';menuOpen=false;newAv=null;newImg=null;q='';aq='';vt='todos';authView='login';authMsg='';fpStep=1;const s=$('#sh');if(s)s.remove();if(Remote.on)Remote.clear();render()};
 if(me){log('Cerró sesión','Cierre de sesión');if(!Remote.on)endSess(sid)}scStop();
 if(Remote.on)return Remote.flush().catch(()=>{}).then(()=>Remote.signOut()).then(fin,fin);
 fin()}
// ----- modo conectado (Supabase) -----
async function regRemote(n,a,u,m,p){const r=await Remote.signUp({email:m,password:p,username:u,first:n,last:a});if(r.error)return setMsg(r.error);
 if(!r.session){authView='login';authMsg='Te enviamos un correo para confirmar tu cuenta. Cuando la confirmes, ingresá con tu correo y contraseña.';return render()}
 PHOTO=newAv||'';newAv=null;try{await Remote.enterFrom(r.user.id)}catch(e){authMsg=e.message}render()}
function recoverView(){$('#app').innerHTML=`<div class="login"><h1>LUCERITO</h1><h2>Nueva contraseña</h2><label>Nueva contraseña</label><input id="fp1" type="password" autocomplete="new-password"><label>Repetir nueva contraseña</label><input id="fp2" type="password" autocomplete="new-password"><button class="btn" onclick="recoverSave()">GUARDAR CONTRASEÑA</button><p id="le" class="lmsg" style="display:none"></p></div>`}
async function recoverSave(){const a=$('#fp1').value,b=$('#fp2').value;if(a.length<6)return setMsg('La contraseña debe tener al menos 6 caracteres.');if(a!==b)return setMsg('Las contraseñas no coinciden.');
 const r=await Remote.updatePassword(a);if(r.error)return setMsg(r.error);
 await Remote.signOut();Remote.recovering=false;try{history.replaceState(null,'',location.pathname)}catch(e){}
 authView='login';authMsg='Contraseña actualizada correctamente. Ingresá con tu correo y la nueva contraseña.';render()}
// Al abrir la app en MODO LOCAL: si la persona no cerró sesión, vuelve a su cuenta (no pide registrarse otra vez).
function restoreLocal(){if(Remote.on)return;const s=Store.session();if(!s)return;
 const u=db.users.find(x=>x.id===s.uid&&x.on),live=loadSess().find(x=>x.id===s.sid&&x.on);
 if(!u||!live){Store.clearSession();return}
 me=u;sid=s.sid;view=(GO&&NAV.some(n=>n[0]===GO))?GO:'home';splash=false}
