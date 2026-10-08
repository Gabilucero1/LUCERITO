// GET /api/cron-alerts — lo ejecuta Vercel Cron todos los días (ver vercel.json).
// Avisa de vencimientos, pedidos que llegan hoy/mañana y stock agotado/bajo, aunque nadie tenga la app abierta.
// Seguridad: Vercel envía "Authorization: Bearer <CRON_SECRET>". Sin CRON_SECRET configurado, no corre.
const { sb, sendToUsers } = require('./_lib');
const { computeAlerts } = require('./_alerts');

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) return res.status(401).json({ error: 'No autorizado' });
  try {
    const s = sb();
    const [pr, or, st] = await Promise.all([
      s.from('products').select('data').range(0, 4999),
      s.from('orders').select('data').range(0, 4999),
      s.from('app_settings').select('data').eq('id', 1),
    ]);
    if (pr.error) throw pr.error;
    if (or.error) throw or.error;
    const offerDays = Number(((st.data && st.data[0] && st.data[0].data) || {}).offerDays) || 10;
    const a = computeAlerts({ products: pr.data.map((r) => r.data), orders: or.data.map((r) => r.data), offerDays, now: new Date(), tz: process.env.APP_TIMEZONE || 'America/Argentina/Mendoza' });
    const out = [];
    const plural = (n, a1, a2) => (n === 1 ? a1 : a2);
    const jobs = [
      [a.venc.length, 'vencimientos', '⚠️ PRODUCTOS POR VENCER', `Tenés ${a.venc.length} ${plural(a.venc.length, 'producto', 'productos')} por vencer.`, '/?go=venc'],
      [a.pedMan.length, 'pedidos', '📦 PEDIDOS QUE LLEGAN MAÑANA', `Hay ${a.pedMan.length} ${plural(a.pedMan.length, 'pedido previsto', 'pedidos previstos')} para mañana.`, '/?go=ped'],
      [a.pedHoy.length, 'pedidos', '📦 PEDIDOS QUE LLEGAN HOY', `Hay ${a.pedHoy.length} ${plural(a.pedHoy.length, 'pedido previsto', 'pedidos previstos')} para hoy.`, '/?go=ped'],
      [a.sin.length, 'sin_stock', '🔴 SIN STOCK', `${a.sin.length} ${plural(a.sin.length, 'producto sin stock', 'productos sin stock')}.`, '/?go=stock'],
      [a.bajo.length, 'stock_bajo', '⚠️ STOCK BAJO', `${a.bajo.length} ${plural(a.bajo.length, 'producto con stock bajo', 'productos con stock bajo')}.`, '/?go=stock'],
    ];
    for (const [n, type, title, body, url] of jobs) if (n > 0) out.push({ type, ...(await sendToUsers({ type, title, body, url })) });
    return res.status(200).json({ ok: true, sent: out });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
