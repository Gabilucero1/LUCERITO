// Cálculo de avisos (función pura, sin dependencias: se puede probar sin Supabase ni Firebase).
function ymd(d, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function computeAlerts({ products, orders, offerDays, now, tz }) {
  const today = ymd(now, tz), tomorrow = ymd(new Date(now.getTime() + 864e5), tz);
  const days = (s) => Math.round((Date.parse(s + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 864e5);
  const pending = orders.filter((o) => o.st !== 'Recibido');
  return {
    venc: products.filter((p) => p.venc && days(p.venc) <= offerDays),
    sin: products.filter((p) => Number(p.stock) <= 0),
    bajo: products.filter((p) => Number(p.stock) > 0 && Number(p.min) > 0 && Number(p.stock) <= Number(p.min)),
    pedHoy: pending.filter((o) => o.date === today),
    pedMan: pending.filter((o) => o.date === tomorrow),
  };
}
module.exports = { computeAlerts, ymd };
