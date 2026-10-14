// Calculadora del día (en Pedidos). SUMA SOLA el importe de los pedidos que se anotaron ese día: no hay que cargar nada a mano.
// Opcional: importes sueltos (tabla calc_entries), ligados a la fecha de la jornada, que se suman al total.
const moneyC=money;
let calcDay=null;
const calcDate=()=>calcDay||iso();
const calcItems=()=>db.calc.filter(x=>x.date===calcDate()).sort((a,b)=>a.id-b.id);
const calcExtras=()=>calcItems().reduce((s,x)=>s+Math.round(x.amt*100),0)/100;
// Pedidos del día = los que se anotaron ese día (si es un pedido viejo sin fecha de alta, cuenta su fecha de llegada).
const pedDay=x=>x.cd||x.date||'';
const calcPeds=()=>db.ped.filter(x=>pedDay(x)===calcDate()).sort((a,b)=>a.id-b.id);
const calcPedTotal=()=>calcPeds().reduce((s,x)=>s+Math.round(Number(x.amt||0)*100),0)/100;
const calcTotal=()=>Math.round((calcPedTotal()+calcExtras())*100)/100;
function calcCard(){const L=calcItems(),P=calcPeds(),d=calcDate(),X=db.ped.filter(x=>x.date===d);
 const row=x=>`<div class="row" style="padding:8px 0;border-top:1px solid var(--p1);cursor:pointer" onclick="editCol('ped',${x.id})"><div class="grow"><b>${esc(x.sup)}</b><div class="mut" style="font-size:12px">${esc(pedBadge(x))}${x.date?' · llega '+fd(x.date):''}</div></div><div class="big">${Number(x.amt)?moneyC(x.amt):'<span class="mut">sin importe</span>'}</div></div>`;
 const miss=Remote.on&&Remote.missing&&Remote.missing.calc_entries;
 return `<div class="card" id="calc"><div class="ba-t" style="margin-bottom:6px">🧮 CALCULADORA DEL DÍA</div>
 <div class="row"><div class="grow"><div class="mut">${d===iso()?'Hoy':'Otro día'} — ${fd(d)}</div></div><input type="date" style="width:auto" value="${d}" onchange="calcDay=this.value||null;render()" aria-label="Día"></div>
 <div style="text-align:center;padding:14px 0 10px"><div class="mut">TOTAL DEL DÍA</div><div class="big" style="font-size:38px" id="ctot">${moneyC(calcTotal())}</div><div class="mut">${P.length} ${P.length===1?'pedido anotado':'pedidos anotados'}${L.length?' + '+L.length+' importes sueltos':''}</div>${X.length?`<div class="mut" style="font-size:12px">Llegan este día: ${X.length} · ${moneyC(X.reduce((s,x)=>s+Math.round(Number(x.amt||0)*100),0)/100)}</div>`:''}</div>
 ${P.map(row).join('')||'<div class="mut" style="margin:8px 0;text-align:center">Todavía no hay pedidos anotados este día.</div>'}
 <div class="mut" style="margin-top:6px;font-size:12px">Se suma solo al agregar un pedido con su importe. Tocá un pedido para corregirlo.</div>
 <details style="margin-top:12px"${L.length?' open':''}><summary class="mut" style="cursor:pointer">➕ Importes sueltos (opcional)</summary>
 ${miss?'<div class="mut" style="margin:8px 0">⚠️ Para guardar importes sueltos la administradora debe ejecutar la migración db/migrations/001_calc_entries.sql en Supabase. Los pedidos se suman igual.</div>':''}
 <div class="row" style="margin-top:8px"><input id="cin" class="bigin grow" inputmode="decimal" placeholder="Importe en $ (ej: 1500 o 1.500,50)" onkeydown="if(event.key==='Enter')calcAdd()"><button class="btn" style="width:auto;margin:0;min-width:96px" onclick="calcAdd()">+ SUMAR</button></div>${L.map((x,i)=>`<div class="row" style="padding:8px 0;border-top:1px solid var(--p1)"><div class="grow"><b>${i+1}. ${moneyC(x.amt)}</b><div class="mut" style="font-size:12px">${esc(x.h||'')} · ${esc(x.u||'')}</div></div><button class="btn s" style="width:auto;margin:0;min-height:44px" onclick="calcEdit(${x.id})" aria-label="Corregir importe">✏️</button><button class="btn s" style="width:auto;margin:0;min-height:44px" onclick="calcDel(${x.id})" aria-label="Eliminar importe">🗑️</button></div>`).join('')}${L.length?'<button class="btn d" onclick="calcClearAsk()">LIMPIAR IMPORTES SUELTOS</button>':''}</details></div>`}
function calcAdd(){const e=$('#cin');if(!e)return;const a=parseAR(e.value);if(!(a>0))return toast('Escribí un importe válido en pesos');
 db.calc.push({id:nid(),date:calcDate(),amt:a,u:me.name,h:hm()});log('Sumó un importe en la calculadora',moneyC(a),null,'Total del '+fd(calcDate())+': '+moneyC(calcTotal()));save();render();const n=$('#cin');if(n&&n.focus)n.focus()}
function calcEdit(id){const x=db.calc.find(y=>y.id===id);if(!x)return;sheet(`<h2>🧮 Corregir importe</h2><label>Importe en $</label><input id="ce" class="bigin" inputmode="decimal" value="${String(x.amt).replace('.',',')}"><button class="btn" onclick="calcSaveEdit(${id})">GUARDAR</button><button class="btn s" onclick="closeSheet()">Cancelar</button>`)}
function calcSaveEdit(id){const x=db.calc.find(y=>y.id===id),a=parseAR($('#ce').value);if(!x)return;if(!(a>0))return toast('Escribí un importe válido en pesos');
 if(a!==x.amt){log('Corrigió un importe de la calculadora',fd(x.date),moneyC(x.amt),moneyC(a));x.amt=a;save()}closeSheet()}
function calcDel(id){ask('¿Eliminar este importe? Va a la papelera y queda en el historial.',()=>{softDelete('calc',id);render()})}
function calcClearAsk(){const L=calcItems();ask('¿Limpiar los importes sueltos del '+fd(calcDate())+'? Suman '+moneyC(calcExtras())+' en '+L.length+(L.length===1?' importe':' importes')+'. Se mueven a la papelera y se pueden restaurar.',calcClear,'Sí, limpiar y empezar de nuevo')}
function calcClear(){const d=calcDate(),L=calcItems();if(!L.length)return;const tot=calcExtras();
 L.forEach(r=>{db.calc=db.calc.filter(x=>x.id!==r.id);const t={tid:0,coll:'calc',rec:r,by:me.name,uid:me.id,d:iso(),h:hm()};t.tid=t.id=nid();db.trash.unshift(t)});
 log('Reinició los importes sueltos de la calculadora',fd(d),moneyC(tot)+' en '+L.length+(L.length===1?' importe':' importes'),null);save();render()}
