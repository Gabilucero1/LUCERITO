// Pedidos: el estado cambia solo según la fecha de llegada (no hace falta tocar nada).
// "Agregado" (anotado, todavía no llega) → "En camino" cuando llega la fecha de llegada → "Recibido" lo marcan ellas.
// El estado automático se CALCULA al mostrar (no se guarda), así no se pisan los cambios entre usuarias.
let ptab='pend',PENDM=0;
const pedEff=x=>x.st==='Recibido'?'Recibido':x.st==='En camino'?'En camino':(x.date&&x.date<=iso()?'En camino':'Agregado');
const pedBadge=x=>{const e=pedEff(x);return e==='Recibido'?'🟢 Recibido':e==='En camino'?'🟡 En camino':(x.cd===iso()?'🔵 Agregado hoy':'🔵 Agregado')};
function pedTabs(){const n=db.ped.filter(x=>x.st!=='Recibido').length,m=db.ped.length-n;
 return `<div class="tabs">${[['pend','Pendientes ('+n+')'],['rec','Recibidos ('+m+')']].map(t=>`<button class="${ptab===t[0]?'on':''}" onclick="ptab='${t[0]}';render()">${t[1]}</button>`).join('')}</div>${ptab==='rec'?'<div class="mut" style="margin-bottom:8px">Estos pedidos ya pasaron a Mercadería recibida.</div><button class="btn s" onclick="go(\'merc\')">Ver Mercadería recibida</button>':''}`}
