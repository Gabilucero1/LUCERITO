/* Formularios */
function field(f,v){const [k,l,t,o]=f;let h=`<label>${l}</label>`;
 if(t==='area')h+=`<textarea id="f_${k}" rows="3">${esc(v)}</textarea>`;
 else if(t==='sel')h+=`<select id="f_${k}">${o.map(x=>`<option ${x===v?'selected':''}>${x}</option>`).join('')}</select>`;
 else if(t==='barcode')h+=`<button type="button" class="btn big" onclick="scanForForm()">📷 ESCANEAR CÓDIGO DE BARRAS</button><input id="f_barcode" class="bigin" inputmode="numeric" placeholder="O escribí el código" value="${esc(v)}"><div id="bcm" class="mut"></div>`;
 else if(t==='pedsel')h+=`<select id="f_ped"><option value="0">Sin pedido</option>${db.ped.filter(x=>x.st!=='Recibido'||x.id===Number(v)).map(x=>`<option value="${x.id}" ${x.id===Number(v)?'selected':''}>${esc(x.sup)} — ${fd(x.date)} — ${money(x.amt)}</option>`).join('')}</select>`;
 else if(t==='sup'){const L=db.sup.map(s=>s.name);if(v&&!L.some(n=>n.toLowerCase()===String(v).toLowerCase()))L.push(v);h+=`<select id="f_${k}" onchange="supSel(this)"><option value="">— Elegí un proveedor —</option>${L.map(n=>`<option value="${esc(n)}" ${n===v?'selected':''}>${esc(n)}</option>`).join('')}<option value="__new__">+ Agregar nuevo proveedor</option></select><input id="f_${k}new" class="bigin" style="display:none" placeholder="Nombre del nuevo proveedor">`}
 else h+=`<input ${t==='date'&&ED&&!can('date')?'disabled title="Solo la administradora puede cambiar la fecha"':''} id="f_${k}" type="${t==='num'?'number':t==='date'?'date':'text'}" ${t==='num'?'inputmode="decimal"':''} value="${esc(v)}">`;
 if(t==='date'&&ED&&!can('date'))h+='<button type="button" class="btn s" onclick="reqSheet(\'date\')">🔒 SOLICITAR PERMISO para cambiar la fecha</button>';
 return h}
const val=(f)=>{if(f[2]==='sup')return supName(f[0]);const e=$('#f_'+f[0]);return f[2]==='num'||f[2]==='pedsel'?Number(e.value||0):e.value.trim()};
let ED=false;function editCol(k,id,pre){if(k==='merc')return mercForm(id);ED=!!id;const c=COL[k];const x=id?db[k].find(y=>y.id===id):{date:iso(),st:'En camino',met:'Efectivo',...(pre||{})};
 sheet(`<h2>${c.i} ${id?'Editar':'Nuevo'}</h2>${c.f.map(f=>field(f,x[f[0]]??'')).join('')}${k==='sup'&&id?supHist(x.name):''}<button class="btn" onclick="saveCol('${k}',${id})">Guardar</button>${id&&!can('del')?'<button class="btn s" onclick="reqSheet(\'del\')">🔒 SOLICITAR PERMISO para eliminar</button>':''}${id&&can('del')?`<button class="btn d" onclick="delCol('${k}',${id})">🗑️ ELIMINAR</button>`:''}<button class="btn s" onclick="closeSheet()">Cancelar</button>`)}
function saveCol(k,id){const c=COL[k];const vals={};c.f.forEach(f=>vals[f[0]]=val(f));
 if(k==='ped'&&!vals.sup)return toast('Elegí el proveedor');
 if(id){const x=db[k].find(y=>y.id===id);const ch=c.f.filter(f=>String(x[f[0]]??'')!==String(vals[f[0]])).map(f=>f[1]+': '+(x[f[0]]??'—')+' → '+vals[f[0]]);
  if(!me.admin&&ch.some(z=>z.startsWith('Fecha')))useGrant('date');Object.assign(x,vals);log('Modificó '+c.t.toLowerCase(),c.line(x)[0],null,ch.join(' | '));const fc=ch.filter(z=>z.startsWith('Fecha'));if(fc.length)log('Cambió fecha manualmente',c.line(x)[0],null,fc.join(' | '));
  if(k==='ped'&&vals.st==='Recibido'&&!db.merc.some(m=>m.ped===id)){const m={id:nid(),ped:id,sup:x.sup,date:iso(),amt:x.amt,note:'Desde pedido',u:me.name,h:hm()};db.merc.push(m);log('Registró mercadería recibida',x.sup+' '+money(x.amt))}}
 else{const x={id:nid(),...vals,u:me.name,h:hm()};if(!x.date&&k!=='sup')x.date=iso();db[k].push(x);log('Agregó '+c.t.toLowerCase().replace(/s$/,''),c.line(x)[0]);if(k==='ped')Remote.notify('pedidos','📋 NUEVO PEDIDO',x.sup+' llega el '+fd(x.date),'ped');if(k==='merc'&&x.ped){const o=db.ped.find(y=>y.id===x.ped);if(o&&o.st!=='Recibido'){o.st='Recibido';log('Marcó pedido como recibido',o.sup+' — '+money(o.amt))}}}
 save();closeSheet()}
function delCol(k,id){ask('¿Eliminar este registro? Va a la papelera y queda en el historial.',()=>{softDelete(k,id);closeSheet()})}

const PF=[['name','Nombre'],['barcode','Código de barras','barcode'],['cat','Categoría'],['sup','Proveedor','sup'],['price','Precio normal','num'],['unit','Unidad del precio (ej: /kg)'],['disc','Descuento / oferta (%)','num'],['stock','Stock actual','num'],['min','Stock mínimo','num'],['venc','Fecha de vencimiento','date'],['emoji','Emoji']];
function editProd(id,pick,pre){ED=false;EDP=id||0;
 if(pick&&!id){sheet(`<h2>Elegí el producto</h2>${db.prod.map(p=>`<button class="card t" onclick="editProd(${p.id})">${esc(p.emoji)} ${esc(p.name)}</button>`).join('')}<button class="btn s" onclick="closeSheet()">Cancelar</button>`);return}
 const p=id?db.prod.find(x=>x.id===id):{price:0,disc:0,stock:0,min:0,emoji:'🏷️',barcode:pre||''};
 sheet(`<h2>${id?esc(p.name):'Producto nuevo'}</h2>${!id&&pre?`<div class="card">Código detectado: <b>${esc(pre)}</b></div>`:''}${PF.map(f=>field(f,p[f[0]]??'')).join('')}<div class="card" style="margin-top:12px">Precio oferta: <b id="po">${money(offer(p))}</b></div>
 ${id?stockHist(p):''}
 ${id&&p.hist.length?`<label>Historial de precios</label>${p.hist.slice().reverse().map(h=>`<div class="mut">${fd(h.d)} ${h.h} · ${money(h.old)} → ${money(h.nw)} (${esc(h.u)})</div>`).join('')}`:''}
 <button class="btn" onclick="saveProd(${id})">${id?'GUARDAR':'GUARDAR PRODUCTO'}</button>${id&&!can('del')?'<button class="btn s" onclick="reqSheet(\'del\')">🔒 SOLICITAR PERMISO para eliminar</button>':''}${id&&can('del')?`<button class="btn d" onclick="delProd(${id})">🗑️ ELIMINAR PRODUCTO</button>`:''}<button class="btn s" onclick="closeSheet()">Cancelar</button>`);
 ['f_price','f_disc'].forEach(i=>$('#'+i).oninput=()=>$('#po').textContent=money(Math.round(Number($('#f_price').value||0)*(1-Number($('#f_disc').value||0)/100))));
}
let newImg=null;
function pimg(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=120;const x=c.getContext('2d');const s=Math.min(im.width,im.height);x.drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,120,120);newImg=c.toDataURL('image/jpeg',.7)};im.src=r.result};r.readAsDataURL(f)}
function saveProd(id){const v={};PF.forEach(f=>v[f[0]]=val(f));if(!v.name)return toast('Escribí el nombre');v.disc=Math.min(100,Math.max(0,v.disc));v.barcode=(v.barcode||'').trim();const dup=v.barcode&&db.prod.find(x=>x.id!==id&&norm(x.barcode)===norm(v.barcode));if(dup)return toast('Ese código ya está registrado en: '+dup.name);
 if(!v.emoji||v.emoji==='🏷️')v.emoji=emojiFor(v.name);if(newImg){v.img=newImg;newImg=null}
 if(id){const p=db.prod.find(x=>x.id===id);
  if(p.price!==v.price){changePrice(p,v.price,'Modificó precio')}
  if(p.stock!==v.stock)stockMove(p,v.stock,'Ajuste manual');
  if(p.venc!==v.venc)log(p.venc?'Modificó vencimiento':'Agregó vencimiento',p.name,p.venc?fd(p.venc):null,fd(v.venc));
  if(p.disc!==v.disc)log('Modificó oferta',p.name,p.disc+'%',v.disc+'%');
  if(p.name!==v.name||p.cat!==v.cat||p.sup!==v.sup)log('Modificó producto',p.name,p.name+' / '+p.cat+' / '+p.sup,v.name+' / '+v.cat+' / '+v.sup);
  Object.assign(p,v)}
 else{const np={id:nid(),hist:[],smov:[],...v,stock:0};db.prod.push(np);log('Agregó producto',v.name,null,money(v.price)+' · stock '+v.stock);if(v.stock>0)stockMove(np,v.stock,'Stock inicial')}
 save();closeSheet()}
function delProd(id){ask('¿Eliminar el producto? Va a la papelera; su historial se conserva.',()=>{softDelete('prod',id);closeSheet()})}

const supHist=n=>{const P=db.ped.filter(x=>x.sup===n),Q=db.pagos.filter(x=>x.sup===n);return `<h2 style="font-size:18px;margin-top:16px">Historial de pedidos</h2>${P.map(x=>`<div class="mut">${fd(x.date)} · ${money(x.amt)} · ${x.st}</div>`).join('')||'<div class="mut">Sin pedidos.</div>'}<h2 style="font-size:18px;margin-top:16px">Historial de pagos</h2>${Q.map(x=>`<div class="mut">${fd(x.date)} · ${money(x.amt)} · ${esc(x.met)}</div>`).join('')||'<div class="mut">Sin pagos.</div>'}`};

function supName(k){const e=$('#f_'+k);if(!e)return '';if(e.value==='__new__'){const n=String($('#f_'+k+'new').value||'').trim();if(n)ensureSup(n);return n}return String(e.value||'').trim()}
function ensureSup(n){if(db.sup.some(s=>s.name.trim().toLowerCase()===n.toLowerCase()))return;db.sup.push({id:nid(),name:n,contact:'',prods:'',visit:'',note:'',u:me.name,h:hm(),date:iso()});log('Agregó proveedor',n);save()}
function supSel(sel){const e=$('#'+sel.id+'new');if(e&&e.style)e.style.display=sel.value==='__new__'?'block':'none'}
