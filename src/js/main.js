Store.probe();
const GO=(()=>{try{return new URLSearchParams(location.search).get('go')}catch(e){return null}})();
if(Remote.on){render();Remote.init().then(()=>render())}else{restoreLocal();render()}
if(typeof setInterval!=='undefined')setInterval(()=>{if(me&&!sessAlive())forceOut()},5000);
// Si la app vuelve al primer plano y hay una sesión de Supabase guardada que todavía no entró (por ejemplo, falló la red al abrir), se reintenta sin pedir contraseña.
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Remote.on&&Remote.ready&&!me&&!Remote.entering)Remote.afterAuth().then(ok=>{if(ok)render()}).catch(()=>{})});
