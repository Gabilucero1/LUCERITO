// Papelera general: toda eliminación va acá, queda en el Historial y se puede restaurar.
// Solo la administradora elimina definitivamente (y antes queda constancia en el historial).
const TL={alerts:'Aumento',sup:'Proveedor',ped:'Pedido',merc:'Mercadería recibida',prod:'Producto',notas:'Nota',pagos:'Pago diario',gastos:'Gasto',calc:'Importe de la calculadora',users:'Usuario'};
const describe=(c,r)=>c==='alerts'?r.name+' · '+money(r.old)+' → '+money(r.nw):c==='sup'?r.name:c==='ped'?r.sup+' · '+money(r.amt)+' · llega '+fd(r.date):c==='merc'?r.sup+' · '+money(r.amt)+' · '+fd(r.date):c==='prod'?r.name:c==='notas'?String(r.txt||'').slice(0,60):c==='pagos'?r.sup+' · '+money(r.amt):c==='gastos'?(r.con||'')+' · '+money(r.amt):c==='calc'?moneyC(r.amt)+' · '+fd(r.date)+(r.u?' · '+r.u:''):c==='users'?(r.name+' '+(r.last||'')).trim()+' ('+r.email+')':'';
const snap=r=>Object.entries(r).filter(([k,v])=>!['img','hist','smov','items','id','chk','hash','salt','grants'].includes(k)&&v!==''&&v!=null&&typeof v!=='object').map(([k,v])=>k+': '+v).join(' · ');
function softDelete(c,id){const r=db[c].find(x=>x.id===id);if(!r)return false;db[c]=db[c].filter(x=>x.id!==id);db.trash.unshift({tid:0,coll:c,rec:r,by:me.name,uid:me.id,d:iso(),h:hm()});db.trash[0].tid=db.trash[0].id=nid();log('Eliminó '+TL[c].toLowerCase(),describe(c,r),snap(r),null);save();return true}
const trashActive=()=>db.trash.filter(t=>!t.restored);
function restoreT(tid){const t=db.trash.find(x=>x.tid===tid);if(!t||t.restored)return;
 if(db[t.coll].some(x=>x.id===t.rec.id))return toast('Ese registro ya existe.');
 if(t.coll==='prod'&&t.rec.barcode&&findByCode(t.rec.barcode))return toast('Ya hay otro producto con ese código de barras.');
 if(t.coll==='users'&&db.users.some(u=>u.email===t.rec.email))return toast('Ya existe una cuenta con ese correo.');
 db[t.coll].push(t.rec);t.restored={by:me.name,d:iso(),h:hm()};log('Restauró '+TL[t.coll].toLowerCase(),describe(t.coll,t.rec));save();toast('Restaurado.');render()}
function purgeAsk(tid){ask('¿Eliminar para siempre? No se puede deshacer. Queda constancia en el historial.',()=>purge(tid),'Sí, eliminar para siempre')}
function purge(tid){if(!can('purge'))return;const t=db.trash.find(x=>x.tid===tid);if(!t)return;
 log('Eliminó definitivamente '+TL[t.coll].toLowerCase(),describe(t.coll,t.rec),snap(t.rec)+' · eliminado antes por '+t.by+' el '+fd(t.d)+' '+t.h,null);
 db.trash=db.trash.filter(x=>x!==t);save();render()}
function trashPage(){return `<h2>🗑️ Papelera</h2><p class="sub">Lo que se elimina queda acá y en el historial. Se puede restaurar.</p>${trashActive().map(t=>`<div class="card"><div class="mut">${esc(TL[t.coll]||t.coll)}</div><div class="big">${esc(describe(t.coll,t.rec))}</div><div class="mut">Eliminó ${esc(t.by)} · ${fd(t.d)} ${t.h}</div><button class="btn" onclick="restoreT(${t.tid})">♻️ RESTAURAR</button>${can('purge')?`<button class="btn d" onclick="purgeAsk(${t.tid})">🗑️ ELIMINAR PERMANENTEMENTE</button>`:''}</div>`).join('')||'<div class="empty">La papelera está vacía.</div>'}`}
