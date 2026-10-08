// Notificaciones push REALES (Firebase Cloud Messaging). Necesitan Supabase + Firebase configurados (ver README).
// Muestra una notificación del sistema aunque la app esté cerrada. NO es una alerta interna disfrazada.
const FB_VER='10.12.2';
let PUSH_BOUND=false;
const Push={
 configured:()=>!!(ENV.FIREBASE_API_KEY&&ENV.FIREBASE_PROJECT_ID&&ENV.FIREBASE_MESSAGING_SENDER_ID&&ENV.FIREBASE_APP_ID&&ENV.FIREBASE_VAPID_KEY),
 async enable(){
  if(!Remote.on)throw new Error('Las notificaciones push necesitan que la app esté conectada al servidor (Supabase).');
  if(!this.configured())throw new Error('Falta configurar Firebase (variables FIREBASE_*). Ver README.');
  if(!('serviceWorker' in navigator&&typeof Notification!=='undefined'))throw new Error('Este navegador no permite notificaciones push. En iPhone hay que agregar la app a la pantalla de inicio.');
  const perm=await Notification.requestPermission();if(perm!=='granted')throw new Error('No diste permiso para recibir notificaciones.');
  if(!window.firebase||!window.firebase.messaging){await loadScript('https://www.gstatic.com/firebasejs/'+FB_VER+'/firebase-app-compat.js');await loadScript('https://www.gstatic.com/firebasejs/'+FB_VER+'/firebase-messaging-compat.js')}
  const fb=window.firebase;if(!fb.apps.length)fb.initializeApp({apiKey:ENV.FIREBASE_API_KEY,authDomain:ENV.FIREBASE_AUTH_DOMAIN||(ENV.FIREBASE_PROJECT_ID+'.firebaseapp.com'),projectId:ENV.FIREBASE_PROJECT_ID,storageBucket:ENV.FIREBASE_STORAGE_BUCKET,messagingSenderId:ENV.FIREBASE_MESSAGING_SENDER_ID,appId:ENV.FIREBASE_APP_ID});
  const reg=await navigator.serviceWorker.register('/firebase-messaging-sw.js');await navigator.serviceWorker.ready;
  const messaging=fb.messaging();
  const token=await messaging.getToken({vapidKey:ENV.FIREBASE_VAPID_KEY,serviceWorkerRegistration:reg});
  if(!token)throw new Error('No se pudo obtener el identificador de este dispositivo.');
  await Remote.registerPush(token);
  if(!PUSH_BOUND){PUSH_BOUND=true;messaging.onMessage(p=>{const d=p.data||{};reg.showNotification(d.title||'LUCERITO',{body:d.body||'',icon:'/icon-192.png',tag:d.type||'lucerito',data:{url:d.url||'/'}})})}
  return token},
 async disable(){try{await Remote.unregisterPush()}catch(e){}try{if(window.firebase&&window.firebase.apps.length)await window.firebase.messaging().deleteToken()}catch(e){}}
};
