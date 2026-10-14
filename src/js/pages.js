function page(){
 if(view==='home')return home();
 if(view==='jornada')return jornada();
 if(view==='config')return cfgPage();
 if(view==='perfil')return perfilPage();
 if(view==='stock')return stockPage();
 if(view==='trash')return trashPage();
 if(view==='prod')return prodPage();
 if(view==='venc')return vencPage();
 if(view==='alert')return alertPage();
 if(view==='hist')return histPage();
 if(view==='users')return usersPage()+perms();
 return colPage(view);
}
function home(){
 const t=iso(),s=soon(),au=aumentosHoy();
 const cnt=k=>db[k].filter(x=>x.date===t).length;
 const venc=s.length?`<div class="card big-alert"><div class="ba-h">⚠️ ATENCIÓN</div><div class="ba-t">PRODUCTOS POR VENCER</div>${s.slice(0,4).map(p=>`<div class="ba-row"><div class="pimg lg">${p.img?`<img src="${p.img}" alt="">`:esc(p.emoji||'🏷️')}</div><div class="grow"><div class="big">${esc(p.name)}</div><div>📅 Vence: ${fd(p.venc)}</div><div>⏳ ${days(p.venc)<0?'Vencido':days(p.venc)===0?'Vence hoy':'Faltan '+days(p.venc)+' días'}</div>${!p.disc&&days(p.venc)>=0?'<span class="tag" style="background:var(--y)">🏷️ Falta definir oferta</span>':''}</div></div><button class="btn s" onclick="vt='todos';go('venc')">→ VER DETALLES</button>`).join('')}${s.length>4?`<div class="mut">y ${s.length-4} más…</div>`:''}</div>`:`<div class="card ok-alert"><div style="font-size:34px">✅</div><div class="big">Sin vencimientos cercanos</div><div class="mut">No hay productos por vencer en los próximos ${db.cfg.offerDays} días.</div></div>`;
 const stk=stockHome()+pedHome();
 const aum=`<div class="card aum"><div class="ba-t" style="margin-bottom:6px">📈 AUMENTOS DEL DÍA</div><input class="bigin" placeholder="🔍 Buscar producto..." oninput="aq=this.value;$('#aul').innerHTML=aumList()" value="${esc(aq)}"><div id="aul">${aumList()}</div><button class="btn" onclick="addAum()">+ Registrar aumento</button></div>`;
 return `<h2>Hoy — ${fd(t)}</h2>${venc}${stk}${aum}
 <div class="grid">
 ${[['📦','Mercadería recibida',cnt('merc'),'merc'],['🚚','Proveedores',db.sup.length,'sup'],['📋','Pedidos en camino',db.ped.filter(x=>pedEff(x)==='En camino').length,'ped'],['💳','Pagos diarios hoy',cnt('pagos'),'pagos'],['📝','Notas',db.notas.length,'notas'],['🧠','Historial',db.log.filter(l=>l.d===t).length+' hoy','hist']].map(c=>`<button class="card t" onclick="go('${c[3]}')"><div style="font-size:26px">${c[0]}</div><div class="big">${c[2]}</div><div class="mut">${c[1]}</div></button>`).join('')}
 </div>
 <h2 class="ar" style="margin-top:22px">Actividad reciente</h2>
 ${db.log.filter(l=>!SESION.includes(l.act)).slice(0,5).map(l=>`<div class="card hist"><b>${esc(l.u)}</b> ${esc(l.act.toLowerCase())}: ${esc(l.detail)}<div class="mut">${fd(l.d)} — ${l.h}</div></div>`).join('')||'<div class="empty">Todavía no hay movimientos hoy.</div>'}`;
}
function alertPage(){const all=db.alerts.filter(a=>a.d===iso()),s=soon();return `<h2>🔔 Alertas</h2><p class="sub">Hoy — ${fd(iso())}</p>${pedHome()}${stockAlerts().length?`<h2>📦 Stock</h2>${stockAlerts().map(stockCard).join('')}`:''}${s.length?`<h2>⏰ Por vencer</h2>${s.map(p=>pcard(p,bd(p),'openAlert')).join('')}`:''}<h2>📈 Cambios de precio de hoy</h2>${all.map(priceCard).join('')||'<div class="empty">No hubo cambios de precio hoy.</div>'}`}
let vt='todos';
const CK=['Oferta publicada','Cartel colocado','Producto ubicado adelante'];
const offerBlock=(p,d)=>d>=0&&d<=db.cfg.offerDays?`<div class="card" style="border-left:6px solid var(--y)"><div class="big">⚠️ ATENCIÓN</div><b>🏷️ SUGERENCIA DE OFERTA</b><div class="mut">A partir de hoy faltan ${d} días.</div><div class="tabs" style="flex-wrap:wrap;margin-top:10px">${[10,20,30,40,50].map(x=>`<button class="${p.disc===x?'on':''}" style="min-width:30%" onclick="setDisc(${p.id},${x})">${x} %<br><small>${money(Math.round(p.price*(1-x/100)))}</small></button>`).join('')}</div><label>Otro porcentaje</label><input id="cust" type="number" min="0" max="100" inputmode="decimal" placeholder="Ej: 35"><button class="btn s" onclick="setDisc(${p.id},Number($('#cust').value))">Aplicar porcentaje</button></div>`:'';
function setDisc(id,x){const p=db.prod.find(y=>y.id===id);if(!(x>=0&&x<=100))return toast('Escribí un porcentaje entre 0 y 100');log('Estableció oferta',p.name,(p.disc||0)+'%',x+'%');p.disc=x;save();openAlert(id)}
function openAlert(id){const p=db.prod.find(x=>x.id===id),v=vstate(p),d=days(p.venc);p.chk=p.chk||[0,0,0];
 sheet(`<div class="row">${pimgH(p)}<div class="big">${esc(p.name)}</div></div><div class="card" style="background:${v.c};color:#fff;text-align:center;font-weight:bold;font-size:20px;margin-top:12px">${d<0?'Vencido':d===0?'¡Vence hoy!':'¡Se vence en '+d+' días!'}</div><div class="card">Vencimiento: <b>${fd(p.venc)}</b><br>Stock actual: <b>${p.stock} unidades</b></div>${offerBlock(p,d)}<div class="row"><div class="card grow">Precio normal<br><b>${p.disc?`<s>${money(p.price)}</s>`:money(p.price)}</b></div><div class="card grow" style="background:var(--p1)">Precio oferta<br><b>${money(offer(p))}</b></div></div><button class="btn" onclick="editProd(${id})">Editar producto</button>${CK.map((t,i)=>`<label style="display:flex;gap:10px;align-items:center;min-height:44px"><input type="checkbox" style="width:26px;min-height:26px" ${p.chk[i]?'checked':''} onchange="chk(${id},${i},this.checked)">${t}</label>`).join('')}<button class="btn s" onclick="closeSheet()">Volver</button>`)}
function chk(id,i,c){const p=db.prod.find(x=>x.id===id);p.chk[i]=c?1:0;log('Actualizó seguimiento de oferta',p.name+' — '+CK[i],null,c?'Sí':'No')}
function changePrice(p,nw,act,oldOv){const old=oldOv!=null?oldOv:p.price;p.hist.push({d:iso(),h:hm(),old,nw,u:me.name});db.alerts.unshift({id:nid(),d:iso(),h:hm(),u:me.name,pid:p.id,name:p.name,emoji:p.emoji||emojiFor(p.name),old,nw,unit:p.unit||''});p.price=nw;log(act,p.name,money(old)+(p.unit||''),money(nw)+(p.unit||''));if(nw>old){notify(p.name+': antes '+money(old)+', nuevo '+money(nw));Remote.notify('aumentos','📈 AUMENTO',p.name+': ahora '+money(nw)+(p.unit||''),'home')}}
const findProdName=n=>{n=String(n||'').trim().toLowerCase();return n?db.prod.find(p=>p.name.trim().toLowerCase()===n):null};
function aumSel(){const n=$('#aq').value.trim(),p=findProdName(n),im=$('#apimg'),m=$('#apmsg');if(im)im.innerHTML=prodImg(p||{name:n});if(p){$('#aold').value=p.price;if($('#aun'))$('#aun').value=p.unit||'';if(m)m.textContent='Producto cargado: precio actual '+money(p.price)+(p.unit||'')}else if(m)m.textContent=n?'Producto nuevo: se guarda con el nombre que escribiste.':'Podés escribir cualquier producto.'}
function addAum(){sheet(`<h2>📈 Registrar aumento</h2><label>Producto</label><input id="aq" class="bigin" list="apl" placeholder="Escribí o elegí un producto" oninput="aumSel()" autocomplete="off"><datalist id="apl">${db.prod.map(p=>`<option value="${esc(p.name)}">`).join('')}</datalist><div class="row" style="margin-bottom:6px"><div class="pimg" id="apimg">🏷️</div><div class="mut grow" id="apmsg">Podés escribir cualquier producto.</div></div><label>Antes</label><input id="aold" class="bigin" type="text" inputmode="decimal"><label>Nuevo precio</label><input id="anw" class="bigin" type="text" inputmode="decimal"><label>Unidad (opcional, ej: /kg)</label><input id="aun" class="bigin"><button class="btn" onclick="saveAum()">Guardar aumento</button><button class="btn s" onclick="closeSheet()">Volver</button>`)}
function saveAum(){const name=$('#aq').value.trim(),oldS=String($('#aold').value).trim(),nw=numVal($('#anw').value),p=findProdName(name);
 if(!name)return toast('Escribí el producto');
 const old=oldS!==''?parseAR(oldS):(p?p.price:NaN);
 if(!(old>=0))return toast('Escribí el precio de antes');
 if(!(nw>0))return toast('Escribí el nuevo precio');
 if(nw===old)return toast('El precio nuevo es igual al anterior');
 const unit=String($('#aun').value||'').trim();
 if(p){if(unit&&!p.unit)p.unit=unit;changePrice(p,nw,'Registró aumento',old)}
 else{db.alerts.unshift({id:nid(),d:iso(),h:hm(),u:me.name,pid:null,name,emoji:emojiFor(name),old,nw,unit});log('Registró aumento',name,money(old)+unit,money(nw)+unit);if(nw>old){notify(name+': antes '+money(old)+', nuevo '+money(nw));Remote.notify('aumentos','📈 AUMENTO',name+': ahora '+money(nw)+unit,'home')}}
 save();closeSheet()}
function editAum(id){const a=db.alerts.find(x=>x.id===id);if(!a)return;sheet(`<h2>📈 ${esc(a.name)}</h2><div class="card"><div class="mut">ANTES</div><div class="old">${money(a.old)}${esc(a.unit||'')}</div></div><label>NUEVO precio</label><input id="anw" class="bigin" type="text" inputmode="decimal" value="${numIn(a.nw)}"><button class="btn" onclick="saveEditAum(${id})">Guardar</button><button class="btn d" onclick="delAum(${id})">🗑️ ELIMINAR</button><button class="btn s" onclick="closeSheet()">Volver</button>`)}
function saveEditAum(id){const a=db.alerts.find(x=>x.id===id),nw=numVal($('#anw').value);if(!nw||nw<=0)return toast('Escribí el precio nuevo');if(nw!==a.nw){const p=db.prod.find(x=>x.id===a.pid);log('Corrigió aumento',a.name,money(a.nw)+(a.unit||''),money(nw)+(a.unit||''));a.nw=nw;a.u=me.name;a.h=hm();if(p){p.price=nw;p.hist.push({d:iso(),h:hm(),old:a.old,nw,u:me.name})}save()}closeSheet()}
function delAum(id){ask('¿Eliminar este aumento? Sale de la lista, va a la papelera y queda en el historial.',()=>{softDelete('alerts',id);closeSheet()})}
const supCard=x=>`<div class="card t"><div onclick="editCol('sup',${x.id})" style="cursor:pointer"><div class="row"><div class="big grow">${esc(x.name)}</div>${x.visit?`<span class="tag" style="background:var(--p2);color:#fff">${esc(x.visit)}</span>`:''}</div><div class="mut" style="font-size:12px;margin-top:6px">Productos que vende</div><div style="font-size:13px">${esc(x.prods||'—')}</div>${x.contact?`<div class="mut" style="font-size:13px">📞 ${esc(x.contact)}</div>`:''}</div><div class="row" style="margin-top:8px"><button class="btn s" style="min-height:44px;margin:0" onclick="editCol('sup',${x.id})">✏️ Editar</button><button class="btn s" style="min-height:44px;margin:0" onclick="delCol('sup',${x.id})">🗑️ Eliminar</button></div></div>`;
function prodPage(){return `<h2>🏷️ Productos</h2><button class="btn big" onclick="scanProducts()">📷 ESCANEAR CÓDIGO DE BARRAS</button><input class="bigin" placeholder="🔍 Buscar producto por nombre o código" oninput="q=this.value;$('#pl').innerHTML=plist()" value="${esc(q)}"><button class="btn" style="margin-top:12px" onclick="editProd(0)">AGREGAR PRODUCTO MANUALMENTE</button><div id="pl">${plist()}</div>`}
let q='',aq='';
const matchP=(p,t)=>{t=t.trim().toLowerCase();return !t||[p.name,p.brand].some(x=>String(x||'').toLowerCase().includes(t))||String(p.barcode||'').includes(t)};
const plist=()=>String(q||'').trim()?(db.prod.filter(p=>matchP(p,q)).map(p=>pcard(p)).join('')||'<div class="empty">Sin resultados.</div>'):psec===null?secList():secView();
function aumList(){const t=aq.trim().toLowerCase();
 if(!t){const au=aumentosHoy();return (au.slice(0,5).map(priceCard).join('')||'<div class="mut" style="margin:8px 0">Hoy no se registraron aumentos.</div>')+(au.length>5?`<button class="btn s" onclick="go('alert')">Ver los ${au.length} aumentos</button>`:'')}
 return db.alerts.filter(a=>a.nw>a.old).filter(a=>{const p=prodOf(a);return [a.name,p.brand].some(x=>String(x||'').toLowerCase().includes(t))||String(p.barcode||'').includes(t)}).map(priceCard).join('')||'<div class="mut" style="margin:8px 0">No hay aumentos para esa búsqueda.</div>'}
const DIAS=['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
const dayHead=d=>d?DIAS[new Date(d+'T00:00:00').getDay()]+' '+fd(d).slice(0,5):'SIN FECHA';
function colPage(k){const c=COL[k];let l=db[k].slice();if(k==='ped')l=l.filter(x=>(x.st==='Recibido')===(ptab==='rec'));if(c.sort)l.sort((a,b)=>a[c.sort]<b[c.sort]?-1:1);let last='';
 return `<h2>${c.i} ${c.t}</h2><button class="btn" onclick="editCol('${k}',0)">+ Agregar</button>${k==='ped'?calcCard()+pedTabs():''}${l.map(x=>{const ln=c.line(x);let hd='';if(k==='ped'&&x.date!==last){last=x.date;hd=`<h2 style="font-size:18px;margin-top:16px">${dayHead(x.date)}</h2>`}if(k==='sup')return supCard(x);return hd+`<button class="card t" onclick="editCol('${k}',${x.id})"><div class="big">${esc(ln[0])}</div><div class="mut">${esc(ln[1])}</div>${c.st&&c.st(x)?`<div style="margin-top:6px"><b>${c.st(x)}</b></div>`:''}</button>${k==='ped'&&x.st!=='Recibido'?`<button class="btn s" style="margin-top:-4px" onclick="recibirPed(${x.id})">🟢 MARCAR RECIBIDO</button>`:''}`}).join('')||'<div class="empty">Todavía no hay registros. Tocá “Agregar”.</div>'}`}
function recibirPed(id){const x=db.ped.find(y=>y.id===id);x.st='Recibido';log('Marcó pedido como recibido',x.sup+' — '+money(x.amt));let mid=0;if(!db.merc.some(m=>m.ped===id)){mid=nid();db.merc.push({id:mid,ped:id,sup:x.sup,date:iso(),amt:x.amt,prods:'',qty:'',note:'Desde pedido',u:me.name,h:hm()});log('Registró mercadería recibida',x.sup+' '+money(x.amt))}save();render();if(mid){toast('Pasó a Mercadería recibida: cargá qué llegó.');mercForm(mid)}}
