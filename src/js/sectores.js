// Productos por sectores (Fideos, Harina, Gaseosas…). El sector es el campo "cat" que ya tiene cada producto: no hay tablas nuevas ni migración.
// Un sector existe mientras tenga productos. Se crea al agregar su primer producto.
let psec=null; // null = lista de sectores · texto = sector abierto ('' = productos sin sector)
const secKey=c=>String(c||'').trim().toLowerCase();
const SEC0='Sin sector';
function sectores(){const m=new Map();db.prod.forEach(p=>{const k=secKey(p.cat);if(!m.has(k))m.set(k,{key:k,name:k?String(p.cat).trim():SEC0,items:[]});m.get(k).items.push(p)});
 return [...m.values()].sort((a,b)=>a.key===''?1:b.key===''?-1:a.name.localeCompare(b.name,'es'))}
const secAlerts=it=>({stock:it.filter(p=>stockState(p)!=='ok').length,venc:it.filter(p=>p.venc&&days(p.venc)<=db.cfg.offerDays).length});
function secCard(s){const a=secAlerts(s.items);return `<button class="card t" onclick="openSec('${encodeURIComponent(s.key)}')"><div class="row"><div style="font-size:30px">📂</div><div class="grow"><div class="big">${esc(s.name)}</div><div class="mut">${s.items.length} ${s.items.length===1?'producto':'productos'}</div></div><div style="text-align:right">${a.stock?`<div class="tag" style="background:var(--y)">🔴 ${a.stock} stock</div>`:''}${a.venc?`<div class="tag" style="background:var(--y)">⏰ ${a.venc} vence</div>`:''}</div></div></button>`}
function openSec(k){psec=decodeURIComponent(k);render();scrollTo(0,0)}
function secList(){const L=sectores();
 return `<button class="btn" onclick="newSecForm()">➕ NUEVO SECTOR</button>${L.map(secCard).join('')||'<div class="empty">Todavía no hay productos. Creá un sector para empezar.</div>'}`}
function secView(){const s=sectores().find(x=>x.key===psec);if(!s){psec=null;return secList()}
 return `<button class="btn s" onclick="psec=null;render();scrollTo(0,0)">← VOLVER A LOS SECTORES</button><h2 style="margin-top:12px">📂 ${esc(s.name)} <span class="mut" style="font-size:15px">· ${s.items.length} ${s.items.length===1?'producto':'productos'}</span></h2><button class="btn" onclick="editProd(0,false,'',${JSON.stringify(s.key?s.name:'').replace(/"/g,'&quot;')})">➕ AGREGAR PRODUCTO A ESTE SECTOR</button>${s.items.slice().sort((a,b)=>a.name.localeCompare(b.name,'es')).map(p=>pcard(p)).join('')}${s.key?'<button class="btn s" onclick="renSecForm()">✏️ CAMBIAR NOMBRE DEL SECTOR</button>':''}`}
function newSecForm(){sheet(`<h2>➕ Nuevo sector</h2><label>Nombre del sector (ej: Fideos, Harina, Gaseosas)</label><input id="sn" class="bigin" placeholder="Nombre del sector"><p class="mut">El sector aparece en la lista cuando cargás su primer producto.</p><button class="btn" onclick="newSec()">SEGUIR: AGREGAR PRODUCTO</button><button class="btn s" onclick="closeSheet()">Cancelar</button>`)}
function newSec(){const n=String($('#sn').value||'').trim();if(!n)return toast('Escribí el nombre del sector');
 const ex=sectores().find(s=>s.key===secKey(n));if(ex){psec=ex.key;closeSheet();return toast('Ese sector ya existe: '+ex.name)}
 psec=secKey(n);editProd(0,false,'',n)}
function renSecForm(){const s=sectores().find(x=>x.key===psec);if(!s)return;sheet(`<h2>✏️ Cambiar nombre del sector</h2><label>Nombre nuevo</label><input id="sn" class="bigin" value="${esc(s.name)}"><p class="mut">Se cambia en los ${s.items.length} productos de este sector.</p><button class="btn" onclick="renSec()">GUARDAR</button><button class="btn s" onclick="closeSheet()">Cancelar</button>`)}
function renSec(){const n=String($('#sn').value||'').trim(),s=sectores().find(x=>x.key===psec);if(!n||!s)return toast('Escribí el nombre del sector');
 if(secKey(n)!==s.key&&sectores().some(x=>x.key===secKey(n)))return toast('Ya existe un sector con ese nombre');
 s.items.forEach(p=>{p.cat=n});log('Cambió el nombre de un sector',s.name,s.name,n);psec=secKey(n);save();closeSheet()}
