// POST /api/notify — la app avisa "pasó algo" (stock agotado, aumento, mercadería, pedido nuevo).
// Seguridad: exige el token de sesión de una cuenta ACTIVA de Supabase. Nunca recibe claves del navegador.
const { sb, sendToUsers, TYPES, clip, safeUrl } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usar POST' });
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Falta iniciar sesión' });
    const s = sb();
    const { data: u, error } = await s.auth.getUser(token);
    if (error || !u || !u.user) return res.status(401).json({ error: 'Sesión inválida' });
    const { data: p } = await s.from('profiles').select('active').eq('id', u.user.id).single();
    if (!p || !p.active) return res.status(403).json({ error: 'Cuenta no activa' });
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (!TYPES.includes(b.type)) return res.status(400).json({ error: 'Tipo de aviso inválido' });
    const r = await sendToUsers({ type: b.type, title: clip(b.title, 80), body: clip(b.body, 200), url: safeUrl(b.url), excludeUid: u.user.id });
    return res.status(200).json(r);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
