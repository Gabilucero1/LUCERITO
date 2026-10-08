// Historial & Memoria: nada se borra; cada acción guarda quién, cuándo, antes y después.
// AVISO: hoy vive en localStorage (borrable desde el navegador). Real = tabla de solo agregado en el servidor.
const SESION=['Ingresó','Cerró sesión'];
function log(act,detail,old,nw,who){who=who||me;db.log.unshift({id:nid(),u:who.name,uid:who.id,auid:who.uid||null,d:iso(),h:hm(),act,detail,old,nw,dev:dev()});save()}
function histPage(){return `<h2>🧠 Historial & Memoria</h2><p class="sub">Todo lo que pasó en el negocio. Nada se pierde.</p>${db.log.map(l=>`<div class="card hist"><b>${esc(l.u)}</b><div class="mut">${fd(l.d)} — ${l.h}</div><div style="margin-top:6px">${esc(l.act)}: <b>${esc(l.detail)}</b></div>${l.old!=null?`<div>Antes: ${esc(l.old)}</div>`:''}${l.nw!=null?`<div>Nuevo: ${esc(l.nw)}</div>`:''}<div class="mut" style="font-size:12px">Usuario: ${esc(l.u)} · ${esc(l.dev)}</div></div>`).join('')||'<div class="empty">Sin movimientos.</div>'}`}
