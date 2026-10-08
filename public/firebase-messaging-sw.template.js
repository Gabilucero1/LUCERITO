// Service worker de notificaciones push. Lo GENERA scripts/build.js: la configuración PÚBLICA de Firebase se inserta al compilar.
// Recibe los avisos aunque LUCERITO esté cerrada (cuando el navegador y el sistema lo permiten).
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
const cfg = __FIREBASE_CONFIG__;
if (cfg && cfg.apiKey) {
  firebase.initializeApp(cfg);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((p) => {
    const d = p.data || {};
    self.registration.showNotification(d.title || 'LUCERITO', {
      body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: d.type || 'lucerito', data: { url: d.url || '/' },
    });
  });
}
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) { c.navigate(url); return c.focus(); }
    return clients.openWindow(url);
  }));
});
