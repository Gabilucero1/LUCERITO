Store.probe();
const GO=(()=>{try{return new URLSearchParams(location.search).get('go')}catch(e){return null}})();
if(Remote.on){render();Remote.init().then(()=>render())}else{restoreLocal();render()}
if(typeof setInterval!=='undefined')setInterval(()=>{if(me&&!sessAlive())forceOut()},5000);
// Si la app vuelve al primer plano y hay una sesión de Supabase guardada que todavía no entró (por ejemplo, falló la red al abrir), se reintenta sin pedir contraseña.
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Remote.on&&Remote.ready&&!me&&!Remote.entering)Remote.afterAuth().then(ok=>{if(ok)render()}).catch(()=>{})});

// Que las usuarias vean los cambios de las demás sin cerrar la app: respaldo del tiempo real.
// Cada 20 s (si la app está a la vista), y al volver al primer plano, recuperar la señal o enfocar la ventana.
if(typeof setInterval!=='undefined')setInterval(()=>{if(Remote.on&&me&&!(typeof document!=='undefined'&&document.hidden))Remote.live(false).catch(()=>{})},20000);
if(typeof document!=='undefined'&&document.addEventListener){
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Remote.on&&me)Remote.live(true).catch(()=>{})});
 document.addEventListener('focusout',()=>{if(Remote._pend)setTimeout(()=>Remote.refresh(),50)});
}
if(typeof window!=='undefined'&&window.addEventListener){window.addEventListener('online',()=>{if(Remote.on&&me)Remote.live(true).catch(()=>{})});window.addEventListener('pageshow',e=>{if(e&&e.persisted&&Remote.on&&me)Remote.live(true).catch(()=>{})})}
