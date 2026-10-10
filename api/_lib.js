// Utilidades de servidor (Vercel Functions). Usan claves PRIVADAS que viven solo en las variables de entorno de Vercel.
// NUNCA se importan desde el frontend.
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');

function sb() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Vercel.');
  }
  return createClient(String(process.env.SUPABASE_URL).trim().replace(/\/+$/, '').replace(/\/(rest|auth|realtime|storage)\/v1$/i, ''), process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

function fcm() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT en las variables de entorno de Vercel.');
    const json = raw.trim().startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.credential.cert(json) });
  }
  return admin.messaging();
}

const TYPES = ['vencimientos', 'stock_bajo', 'sin_stock', 'aumentos', 'pedidos', 'mercaderia', 'otros'];
const clip = (s, n) => String(s || '').slice(0, n);
const safeUrl = (u) => (typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') ? u.slice(0, 200) : '/');

// Envía una notificación a los celulares de las personas ACTIVAS que tengan activado ese tipo de aviso.
async function sendToUsers({ type, title, body, url, excludeUid }) {
  const s = sb();
  const { data: devs, error: e1 } = await s.from('push_devices').select('token,user_id');
  if (e1) throw e1;
  const { data: profs, error: e2 } = await s.from('profiles').select('id,active,notif_prefs');
  if (e2) throw e2;
  const ok = new Map(profs.filter((p) => p.active && (p.notif_prefs || {})[type] !== false).map((p) => [p.id, true]));
  const tokens = [...new Set(devs.filter((d) => ok.has(d.user_id) && d.user_id !== excludeUid).map((d) => d.token))];
  if (!tokens.length) return { sent: 0, failed: 0, devices: 0 };
  const messaging = fcm();
  let sent = 0, failed = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    // Solo "data": la notificación la muestra el service worker (firebase-messaging-sw.js), así no se duplica.
    const r = await messaging.sendEachForMulticast({ tokens: chunk, data: { title, body, url, type }, webpush: { headers: { Urgency: 'high' } } });
    sent += r.successCount; failed += r.failureCount;
    const dead = [];
    r.responses.forEach((x, idx) => {
      const c = x.error && x.error.code;
      if (c === 'messaging/registration-token-not-registered' || c === 'messaging/invalid-registration-token') dead.push(chunk[idx]);
    });
    if (dead.length) await s.from('push_devices').delete().in('token', dead);
  }
  return { sent, failed, devices: tokens.length };
}

module.exports = { sb, fcm, sendToUsers, TYPES, clip, safeUrl };
