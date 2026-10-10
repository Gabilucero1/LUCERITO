// Vencimientos por lote: un producto puede tener VARIAS fechas (distintos lotes). Se guardan dentro del producto (p.lots),
// por eso no hace falta cambiar la base de datos. p.venc queda siempre con la fecha MÁS PRÓXIMA: así las alertas, Inicio y los avisos siguen igual.
const lotList=p=>Array.isArray(p.lots)&&p.lots.length?p.lots:(p.venc?[{id:-1,venc:p.venc,qty:'',note:''}]:[]);
function lotOwn(p){if(!Array.isArray(p.lots)||!p.lots.length)p.lots=p.venc?[{id:nid(),venc:p.venc,qty:'',note:''}]:[];return p.lots}
const syncVenc=p=>{const l=Array.isArray(p.lots)?p.lots.filter(x=>x.venc).map(x=>x.venc).sort():[];p.venc=l.length?l[0]:''};
const lotQty=l=>l.qty!==''&&l.qty!=null?' · '+l.qty+' u.':'';
// El campo "Fecha de vencimiento" de la ficha del producto edita la fecha más próxima.
function applyVencEdit(p,oldV,newV){oldV=oldV||'';newV=newV||'';if(oldV===newV)return;
 const L=lotOwn(p),i=oldV?L.findIndex(x=>x.venc===oldV):-1;
 if(!newV){if(i>=0)L.splice(i,1)}else if(i>=0)L[i].venc=newV;else L.push({id:nid(),venc:newV,qty:'',note:'',u:me.name,d:iso()});
 syncVenc(p)}
const vencRows=()=>db.prod.flatMap(p=>lotList(p).filter(l=>l.venc).map(l=>({p,l}))).sort((a,b)=>a.l.venc<b.l.venc?-1:a.l.venc>b.l.venc?1:0);
const lotCard=(p,l)=>{const hasQ=l.qty!==''&&l.qty!=null;
 return pcard(p,`<div class="mut">Vence: ${fd(l.venc)}</div><div class="mut">${hasQ?'Lote: '+esc(l.qty)+' unidades · Stock total: '+p.stock:'Quedan: '+p.stock+' unidades'}</div>${l.note?`<div class="mut">${esc(l.note)}</div>`:''}${bd({venc:l.venc})}`,'lotOpen').replace(`onclick="lotOpen(${p.id})"`,`onclick="lotSheet(${p.id},${l.id})"`)};
function vencPage(){let r=vencRows();
 if(vt==='por')r=r.filter(x=>{const d=days(x.l.venc);return d>=0&&d<=30});
 if(vt==='venc')r=r.filter(x=>days(x.l.venc)<0);
 return `<h2>⏰ Vencimientos</h2><div class="tabs">${[['todos','Todos'],['por','Por vencer'],['venc','Vencidos']].map(t=>`<button class="${vt===t[0]?'on':''}" onclick="vt='${t[0]}';render()">${t[1]}</button>`).join('')}</div><button class="btn" onclick="addVenc()">+ Agregar vencimiento</button>${r.map(x=>lotCard(x.p,x.l)).join('')||'<div class="empty">No hay vencimientos en esta lista.</div>'}`}
let vpq='';
const vpList=()=>db.prod.filter(p=>matchP(p,vpq)).map(p=>`<button class="card t" onclick="lotSheet(${p.id},0)">${esc(p.emoji||emojiFor(p.name))} ${esc(p.name)}</button>`).join('')||'<div class="empty">No hay productos con ese nombre. Cargalo primero en Productos.</div>';
function addVenc(){vpq='';sheet(`<h2>Elegí el producto</h2><input class="bigin" id="vpq" placeholder="🔍 Buscar producto o código" oninput="vpq=this.value;$('#vpl').innerHTML=vpList()"><div id="vpl">${vpList()}</div><button class="btn s" onclick="closeSheet()">Cancelar</button>`)}
function lotSheet(pid,lid){const p=db.prod.find(x=>x.id===pid);if(!p)return;
 const l=lid?lotList(p).find(x=>x.id===lid):{venc:'',qty:'',note:''};if(!l)return;const d=l.venc?days(l.venc):null;
 sheet(`<div class="row">${pimgH(p)}<div class="big">${esc(p.name)}</div></div><h2>${lid?'Editar vencimiento':'Nuevo vencimiento'}</h2>${lid&&l.venc?`<div class="card" style="background:${vstate(l).c};color:#fff;text-align:center;font-weight:bold">${d<0?'Vencido':d===0?'¡Vence hoy!':'Faltan '+d+' días'}</div>`:''}<label>Fecha de vencimiento</label><input id="lv_d" type="date" value="${esc(l.venc)}"><label>Cantidad de este lote (opcional)</label><input id="lv_q" type="number" inputmode="decimal" value="${esc(l.qty)}"><label>Nota o lote (opcional)</label><input id="lv_n" value="${esc(l.note||'')}"><button class="btn" onclick="saveLot(${pid},${lid},false)">GUARDAR</button>${lid?'':`<button class="btn s" onclick="saveLot(${pid},0,true)">GUARDAR Y AGREGAR OTRO</button>`}${lid&&p.venc?`<button class="btn s" onclick="openAlert(${pid})">🏷️ Oferta y seguimiento</button>`:''}${lid&&can('del')?`<button class="btn d" onclick="delLot(${pid},${lid})">🗑️ ELIMINAR VENCIMIENTO</button>`:''}${lid&&!can('del')?'<button class="btn s" onclick="reqSheet(\'del\')">🔒 SOLICITAR PERMISO para eliminar</button>':''}<button class="btn s" onclick="closeSheet()">Cancelar</button>`)}
function saveLot(pid,lid,more){const p=db.prod.find(x=>x.id===pid);if(!p)return;
 const v=$('#lv_d').value.trim(),qS=String($('#lv_q').value).trim(),n=$('#lv_n').value.trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return toast('Elegí la fecha de vencimiento');
 if(qS!==''&&!(Number(qS)>=0))return toast('La cantidad no es válida');
 const q=qS===''?'':Number(qS),L=lotOwn(p);
 if(lid){const l=lid===-1?L[0]:L.find(x=>x.id===lid);if(!l)return;const old=fd(l.venc)+lotQty(l);l.venc=v;l.qty=q;l.note=n;log('Modificó vencimiento',p.name,old,fd(v)+lotQty(l))}
 else{L.push({id:nid(),venc:v,qty:q,note:n,u:me.name,d:iso()});log('Agregó vencimiento',p.name,null,fd(v)+(q!==''?' · '+q+' u.':''))}
 syncVenc(p);save();
 if(more){toast('Guardado. Podés cargar otro vencimiento de '+p.name);lotSheet(pid,0)}else closeSheet()}
function delLot(pid,lid){const p=db.prod.find(x=>x.id===pid);if(!p)return;
 ask('¿Eliminar este vencimiento? Queda en el historial.',()=>{const L=lotOwn(p),i=lid===-1?0:L.findIndex(x=>x.id===lid);if(i<0)return;const l=L.splice(i,1)[0];syncVenc(p);log('Eliminó vencimiento',p.name,fd(l.venc)+lotQty(l),null);save();closeSheet()})}
