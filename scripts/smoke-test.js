// Prueba rápida con DOM simulado: cuentas, recuperación, papelera, proveedores, pedidos, stock, códigos y permisos.
// No prueba la cámara real (no hay cámara acá): solo el camino manual y la lógica.
const fs=require('fs'),path=require('path');
const ORDER=JSON.parse(fs.readFileSync(path.join(__dirname,'order.json'),'utf8'));
const js='const ENV={STORAGE_KEY:"test",ADMIN_EMAIL:"",DEV_SHOW_CODE:true};\n'+ORDER.map(n=>fs.readFileSync(path.join(__dirname,'..','src','js',n+'.js'),'utf8')).join('\n');
global.vals={};const vals=global.vals;
const mk=v=>({innerHTML:'',value:v,textContent:'',style:{},remove(){},set onclick(x){},set oninput(x){}});
const dflt=mk('1');
global.window=global;
global.document={querySelector:s=>vals[s]!==undefined?mk(vals[s]):dflt,createElement:()=>({...mk(''),getContext:()=>({drawImage(){}}),toDataURL:()=>''}),body:{appendChild(){}},head:{appendChild(){}}};
const st={};global.localStorage={getItem:k=>st[k]??null,setItem:(k,v)=>{st[k]=v},removeItem:k=>{delete st[k]}};
Object.defineProperty(global,'navigator',{value:{userAgent:'Android'},configurable:true});
global.screen={width:360,height:800};global.scrollTo=()=>{};
const test=`
const ok=(c,m)=>{if(!c)throw new Error(m)};
Store.probe();ok(Store.ok,'almacenamiento');
const reg=async o=>{authView='reg';Object.assign(vals,{'#rn1':o.n,'#rn2':o.a||'','#ru':o.u,'#rm':o.m,'#rp':o.p,'#rp2':o.p2||o.p});await doReg()};
splash=false;
// --- cuentas dinámicas, correo único, usuario único ---
ok(db.users.length===0,'sin usuarios escritos en el código');
await reg({n:'Gabi',a:'R',u:'gabi',m:'gabi@email.com',p:'clave123'});
ok(me&&me.admin&&me.email==='gabi@email.com','primera cuenta = administradora');ok(!JSON.stringify(db).includes('clave123'),'contraseña en texto plano');
logout();ok(me===null&&db.log[0].act==='Cerró sesión','cerrar sesión');
await reg({n:'Cami',a:'L',u:'cami',m:'cami@email.com',p:'cami1234'});ok(me&&!me.admin,'segunda cuenta');logout();
const nU=db.users.length;
await reg({n:'X',u:'cami2',m:'CAMI@email.com',p:'abcdef'});ok(db.users.length===nU,'correo repetido');
await reg({n:'X',u:'cami',m:'otro@email.com',p:'abcdef'});ok(db.users.length===nU,'usuario repetido');
await reg({n:'X',u:'xx',m:'mal-correo',p:'abcdef'});ok(db.users.length===nU,'correo inválido');
await reg({n:'X',u:'xx',m:'x@email.com',p:'abcdef',p2:'zzzzzz'});ok(db.users.length===nU,'contraseñas distintas');
// --- ingreso con correo ---
Object.assign(vals,{'#lu':'cami@email.com','#lp':'mala'});await doLogin();ok(me===null,'clave mala');
vals['#lu']='cami';vals['#lp']='cami1234';await doLogin();ok(me===null,'el usuario no sirve para entrar');
vals['#lu']='cami@email.com';await doLogin();ok(me&&me.id==='cami'&&me.lastAccess,'ingreso con correo');logout();
// --- recuperar contraseña ---
authView='forgot';fpStep=1;vals['#fe']='cami@email.com';await fpSend();ok(fpStep===2&&/^\\d{6}$/.test(fpDev),'código generado');
vals['#fc']=fpDev==='111111'?'222222':'111111';await fpCheck();ok(fpStep===2,'código incorrecto');
vals['#fc']=fpDev;await fpCheck();ok(fpStep===3,'código correcto');
Object.assign(vals,{'#fp1':'nueva1234','#fp2':'nueva1234'});await fpSave();ok(fpStep===4&&db.resets.length===0,'nueva contraseña y código de un solo uso');
vals['#lu']='cami@email.com';vals['#lp']='cami1234';await doLogin();ok(me===null,'contraseña vieja');
vals['#lp']='nueva1234';await doLogin();ok(me&&me.id==='cami','contraseña nueva');
await Auth.requestReset('cami@email.com');db.resets[0].exp=1;ok(!(await Auth.verifyReset('cami@email.com','123456')).ok,'código vencido');
// --- permisos ---
ok(!can('users')&&!can('purge')&&can('del')&&can('date'),'permisos usuaria');
view='users';ok(page().includes('Solo la administradora'),'usuarias no administran usuarios');
// --- productos: guardar, persistir, duplicados ---
const mkP=o=>{Object.assign(vals,{'#f_name':o.name,'#f_barcode':o.code||'','#f_cat':o.cat||'','#f_sup':o.sup||'','#f_price':String(o.price||100),'#f_unit':'','#f_disc':'0','#f_stock':String(o.stock||0),'#f_min':String(o.min||0),'#f_venc':o.venc||'','#f_emoji':''});saveProd(0)};
mkP({name:'Papa',price:2000,stock:40,code:'7791234567890'});mkP({name:'Salchichas',price:3000,stock:3,min:5});mkP({name:'Yogur',price:1200,stock:0,venc:iso(new Date(Date.now()+5*864e5))});
ok(db.prod.length===3&&Store.load().prod.length===3,'productos guardados y persistentes');ok(db.prod[0].emoji==='🥔','imagen por nombre');
mkP({name:'Otro',code:'7791234567890'});ok(db.prod.length===3&&TOASTS.some(t=>t.includes('ya está registrado')),'código duplicado');
mkP({name:'Cuarto',price:5});ok(db.prod.length===4,'agregar de a poco');
ok(!Object.keys(db.prod[0]).includes('brand'),'sin marca');
// --- stock y alertas automáticas ---
ok(stockState(db.prod[1])==='bajo'&&stockState(db.prod[2])==='sin','alertas de stock');
view='home';let h=home();ok(h.includes('SIN STOCK')&&h.includes('STOCK BAJO')&&h.includes('Buscar producto...')&&h.includes('PRODUCTOS POR VENCER'),'inicio');
view='prod';h=page();ok(h.includes('ESCANEAR CÓDIGO DE BARRAS')&&h.includes('AGREGAR PRODUCTO MANUALMENTE'),'productos');
// --- aumentos: producto libre, imagen, eliminar, papelera ---
Object.assign(vals,{'#aq':'Lechuga','#aold':'2000','#anw':'3000','#aun':''});saveAum();
const A=db.alerts.find(a=>a.name==='Lechuga');ok(A&&A.old===2000&&A.nw===3000&&A.emoji==='🥬','aumento de producto libre');
ok(aumentosHoy().some(a=>a.name==='Lechuga')&&priceCard(A).includes('🥬'),'visible con imagen');
Object.assign(vals,{'#aq':'Producto sin imagen','#aold':'10','#anw':'20'});saveAum();ok(db.alerts.some(a=>a.name==='Producto sin imagen'),'sin imagen igual guarda');
Object.assign(vals,{'#aq':'Papa','#aold':'2000','#anw':'2500'});saveAum();ok(db.prod[0].price===2500,'actualiza producto cargado');
aq='lech';ok(aumList().includes('Lechuga')&&!aumList().includes('Papa'),'buscar aumento');aq='7791';ok(aumList().includes('Papa'),'buscar por código');aq='';
delAum(A.id);askYes();ok(!db.alerts.some(a=>a.id===A.id)&&db.trash.some(t=>t.coll==='alerts'),'aumento a la papelera');
ok(db.log.some(l=>l.act==='Eliminó aumento'&&l.u==='Cami'&&l.old.includes('Lechuga')),'historial de eliminación');
let T1=db.trash.find(t=>t.coll==='alerts');restoreT(T1.tid);ok(db.alerts.some(a=>a.id===A.id)&&trashActive().length===0,'restaurar');
delAum(A.id);askYes();T1=trashActive()[0];purge(T1.tid);ok(trashActive().length===1,'usuaria no elimina definitivamente');
const keep=me;me=db.users.find(u=>u.admin);purge(T1.tid);ok(trashActive().length===0&&!db.alerts.some(a=>a.id===A.id),'admin elimina definitivamente');
ok(db.log.some(l=>l.act==='Eliminó definitivamente aumento'&&l.old.includes('Lechuga')),'auditoría de eliminación definitiva');me=keep;
// --- proveedores como base central ---
const d1=iso(new Date(Date.now()+864e5)),d3=iso(new Date(Date.now()+3*864e5));
const ped=(sup,d,extra)=>{Object.assign(vals,{'#f_sup':sup,'#f_supnew':extra||'','#f_date':d,'#f_amt':'1000','#f_st':'En camino','#f_note':''});saveCol('ped',0)};
ped('__new__',d1,'Arcor');ok(db.sup.some(s=>s.name==='Arcor'),'proveedor nuevo desde pedido');
ped('Arcor',d1);ped('__new__',d1,'Terrabusi');ped('__new__',d3,'Distribuidora');
ok(db.sup.length===3&&db.ped.length===4,'proveedores reutilizados');
ok((colPage('ped').match(/margin-top:16px">/g)||[]).length===2,'pedidos agrupados por fecha');
ok(pedAlerts().man.length===3&&home().includes('PEDIDOS QUE LLEGAN MAÑANA'),'alerta de pedidos');
Object.assign(vals,{'#f_name':'Juan','#f_contact':'123','#f_prods':'Bebidas','#f_visit':'MIÉRCOLES','#f_note':''});saveCol('sup',0);
ok(colPage('sup').includes('MIÉRCOLES')&&colPage('sup').includes('Productos que vende'),'presentación de proveedor');
const S1=db.sup.find(s=>s.name==='Arcor');delCol('sup',S1.id);askYes();ok(!db.sup.some(s=>s.id===S1.id)&&db.ped.some(p=>p.sup==='Arcor'),'eliminar proveedor conserva historial');
restoreT(db.trash.find(t=>t.coll==='sup').tid);ok(db.sup.some(s=>s.name==='Arcor'),'restaurar proveedor');
const P1=db.ped[0];delCol('ped',P1.id);askYes();ok(!db.ped.some(p=>p.id===P1.id),'eliminar pedido');
// --- mercadería: pedido opcional, stock automático, eliminar ---
const pap=db.prod[0],b=pap.stock;MI=[{pid:pap.id,qty:10}];
Object.assign(vals,{'#f_sup':'Arcor','#f_ped':'0','#f_date':iso(),'#f_amt':'5000','#f_note':''});saveMerc(0);
ok(pap.stock===b+10&&db.merc.length===1,'mercadería sin pedido suma stock');ok(pap.smov[0].mov===10&&pap.smov[0].before===b&&pap.smov[0].motivo==='Mercadería recibida','movimiento automático');
ok(db.log.some(l=>l.act==='Modificó stock'&&l.detail.includes('Proveedor: Arcor')&&l.old===b&&l.nw===b+10),'historial de stock');
const M=db.merc[0];mercForm(M.id);delCol('merc',M.id);askYes();ok(db.merc.length===0&&db.trash.some(t=>t.coll==='merc')&&!colPage('merc').includes('Arcor'),'mercadería eliminada de la lista');
ok(db.log.some(l=>l.act==='Eliminó mercadería recibida'),'queda en historial');
// --- salidas y códigos de barras ---
Object.assign(vals,{'#sq':'2','#sm':'Merma'});const b2=pap.stock;saveSalida(pap.id);ok(pap.stock===b2-2,'salida manual');
let got=null;scanBarcode(c=>got=c);vals['#scman']='7791234567890';scManual();ok(got==='7791234567890'&&findByCode('07791234567890'),'código manual');
EDP=0;editProd(0,false,'12345678');q='7791';ok(plist().includes('Papa'),'buscar por código');q='';
delProd(pap.id);askYes();ok(!db.prod.some(p=>p.id===pap.id),'producto eliminado');restoreT(db.trash.find(t=>t.coll==='prod').tid);ok(db.prod.some(p=>p.id===pap.id&&p.smov.length),'producto restaurado con historial');
// --- usuarios dinámicos, sesiones, eliminar usuario ---
me=db.users.find(u=>u.id==='cami');startSess();const cs=sid;sid=null;me=db.users.find(u=>u.admin);startSess();
h=usersPage();ok(h.includes('cami@email.com')&&h.includes('Último acceso')&&h.includes('Sesión activa'),'usuarios dinámicos');
sesSheet();killSess(cs);sid=cs;ok(!sessAlive(),'cerrar sesión ajena');sid=null;
delUser('cami');askYes();ok(!db.users.some(u=>u.id==='cami')&&db.trash.some(t=>t.coll==='users'),'eliminar usuario');
restoreT(db.trash.find(t=>t.coll==='users').tid);ok(db.users.some(u=>u.id==='cami'),'restaurar usuario');
// --- calculadora del día, vencimientos por lote y nombres del menú ---
ok(!NAV.some(n=>n[2]==='Pagos diarios')&&!NAV.some(n=>n[2]==='Pagos'||n[0]==='gastos'||n[2]==='Gastos'),'menú: sin Pagos diarios ni Gastos');
view='home';ok(!/Gastos/.test(home())&&home().includes('Pagos diarios hoy'),'Inicio sin Gastos');ok(!/Gastos/.test(jornada())&&jornada().includes('Pagos diarios'),'Jornada sin Gastos');
view='pagos';ok(page().includes('Pagos diarios'),'título Pagos diarios');ok(COL.gastos&&Array.isArray(db.gastos),'los datos de Gastos se conservan');
ok(parseAR('1.500,50')===1500.5&&parseAR('1.500')===1500&&parseAR('1500,5')===1500.5&&parseAR('1500')===1500&&isNaN(parseAR('abc'))&&isNaN(parseAR('-5')),'importes en formato argentino');
calcDay=null;vals['#cin']='1.500,50';calcAdd();vals['#cin']='2.000';calcAdd();ok(calcExtras()===3500.5&&db.calc.length===2,'la calculadora suma');
view='ped';ok(colPage('ped').includes('CALCULADORA DEL DÍA')&&colPage('ped').includes('LIMPIAR'),'la calculadora se muestra en Pedidos');
vals['#cin']='abc';calcAdd();ok(db.calc.length===2,'importe inválido no se guarda');
vals['#ce']='3.000';calcSaveEdit(db.calc[0].id);ok(calcExtras()===5000,'corregir un importe');
calcDel(db.calc[0].id);askYes();ok(calcExtras()===2000&&db.trash.some(t=>t.coll==='calc'),'eliminar un importe (va a la papelera)');
calcDay='2020-01-01';vals['#cin']='500';calcAdd();ok(calcExtras()===500,'otro día tiene su propio total');calcDay=null;ok(calcExtras()===2000,'el total de hoy no se mezcla');
calcClearAsk();askYes();ok(calcItems().length===0&&db.trash.filter(t=>t.coll==='calc').length>=2,'limpiar pide confirmación y manda a la papelera');
restoreT(db.trash.find(t=>t.coll==='calc').tid);ok(calcExtras()>0,'restaurar un importe');
Object.assign(vals,{'#lv_d':'2030-03-10','#lv_q':'4','#lv_n':'A'});saveLot(pap.id,0,false);
Object.assign(vals,{'#lv_d':'2030-02-01','#lv_q':'','#lv_n':'B'});saveLot(pap.id,0,true);
ok(pap.lots.length===2&&pap.venc==='2030-02-01','varios vencimientos del mismo producto (venc = el más próximo)');
view='venc';ok(page().includes('Lote: 4 unidades')&&vencRows().filter(r=>r.p===pap).length===2,'el listado muestra cada lote');
const l0=pap.lots[0].id;Object.assign(vals,{'#lv_d':'2030-01-20','#lv_q':'4','#lv_n':'A'});saveLot(pap.id,l0,false);ok(pap.venc==='2030-01-20','editar un vencimiento');
delLot(pap.id,l0);askYes();ok(pap.lots.length===1&&pap.venc==='2030-02-01'&&db.log.some(l=>l.act==='Eliminó vencimiento'),'eliminar un vencimiento');
const lg=db.prod.find(p=>p!==pap);lg.venc='2030-05-05';delete lg.lots;ok(lotList(lg).length===1&&lotList(lg)[0].id===-1,'producto viejo con una sola fecha se ve como lote');
Object.assign(vals,{'#lv_d':'2030-06-06','#lv_q':'','#lv_n':''});saveLot(lg.id,-1,false);ok(lg.lots.length===1&&lg.venc==='2030-06-06','editar el vencimiento de un producto viejo');
Object.assign(vals,{'#f_name':pap.name,'#f_barcode':pap.barcode||'','#f_cat':pap.cat||'','#f_sup':pap.sup||'','#f_price':String(pap.price),'#f_unit':'','#f_disc':'0','#f_stock':String(pap.stock),'#f_min':String(pap.min||0),'#f_venc':'2030-01-15','#f_emoji':pap.emoji||''});saveProd(pap.id);
ok(pap.venc==='2030-01-15'&&pap.lots.some(l=>l.venc==='2030-01-15')&&pap.lots.length===1,'la ficha del producto edita la fecha más próxima');
ok(soon().length>=0&&vstate(pap)&&typeof home()==='string','las alertas de vencimiento siguen funcionando');
// --- pedidos: estados automáticos, calculadora que suma sola, mercadería que carga productos y vencimientos ---
{const T=iso(),M=tomorrow(),Yd=(()=>{const d=new Date();d.setDate(d.getDate()-1);return iso(d)})(),D5=(()=>{const d=new Date();d.setDate(d.getDate()+5);return iso(d)})();
const mkPed=o=>{Object.assign(vals,{'#f_sup':'__new__','#f_supnew':o.sup,'#f_date':o.date||'','#f_amt':String(o.amt),'#f_st':o.st||'Agregado','#f_note':''});saveCol('ped',0);return db.ped[db.ped.length-1]};
calcDay=null;const before=calcPedTotal();
const p1=mkPed({sup:'Prov Uno',date:M,amt:1000}),p2=mkPed({sup:'Prov Dos',date:T,amt:2500.5}),p3=mkPed({sup:'Prov Tres',date:'',amt:300});
ok(p1.cd===T&&p3.date==='','el pedido guarda el día en que se anotó y puede quedar sin fecha');
ok(pedEff(p1)==='Agregado'&&pedBadge(p1).includes('Agregado hoy'),'pedido con llegada futura = Agregado hoy');
ok(pedEff(p2)==='En camino'&&pedBadge(p2).includes('En camino')&&pedEff(p3)==='Agregado','al llegar la fecha de llegada pasa solo a En camino');
ok(pedEff({st:'Agregado',date:Yd})==='En camino'&&pedEff({st:'Recibido',date:Yd})==='Recibido','un pedido atrasado sigue En camino hasta que lo marcan Recibido');
ok(calcPedTotal()===Math.round((before+3800.5)*100)/100,'la calculadora suma sola los pedidos anotados hoy');
view='ped';ptab='pend';ok(colPage('ped').includes('Prov Dos')&&colPage('ped').includes('Agregado hoy')&&colPage('ped').includes(moneyC(calcTotal())),'Pedidos muestra los estados y el total automático');
calcDay=Yd;ok(calcPedTotal()===db.ped.filter(x=>(x.cd||x.date)===Yd).reduce((s,x)=>s+x.amt,0),'otro día no se mezcla');calcDay=null;
// recibir un pedido: pasa a Mercadería recibida y se carga qué llegó
const sb=pap.stock;recibirPed(p2.id);const m2=db.merc.find(m=>m.ped===p2.id);
ok(p2.st==='Recibido'&&m2&&!(m2.items&&m2.items.length),'recibir un pedido lo pasa a Mercadería recibida');
ok(colPage('merc').includes('Falta cargar qué llegó'),'avisa que falta cargar qué llegó');
const lst=()=>colPage('ped').split('Pendientes (')[1];ptab='pend';ok(!lst().includes('Prov Dos'),'el pedido recibido sale de Pendientes');ptab='rec';ok(lst().includes('Prov Dos'),'y aparece en Recibidos');ptab='pend';
mercForm(m2.id);MI=[{pid:pap.id,qty:3,venc:'2031-01-01'}];
Object.assign(vals,{'#f_sup':'Prov Dos','#f_date':T,'#f_amt':'2500.5','#f_note':'','#f_ped':String(p2.id)});saveMerc(m2.id);
ok(pap.stock===sb+3&&m2.items.length===1&&m2.items[0].venc==='2031-01-01','lo que llegó suma stock en Productos');
ok(pap.lots.some(l=>l.venc==='2031-01-01'&&l.qty===3),'y el vencimiento queda cargado en el producto');
ok(!colPage('merc').split('Prov Dos')[1].slice(0,200).includes('Falta cargar'),'ya no figura como pendiente de detalle');
// producto que no existe: se crea al recibir (nombre + código), con cantidad y un vencimiento próximo que dispara la alerta
recibirPed(p1.id);const m1=db.merc.find(m=>m.ped===p1.id);mercForm(m1.id);
Object.assign(vals,{'#mq':'7791234500011','#mnn':'Galletitas Nuevas'});mSearch();mNew();
const gn=db.prod.find(p=>p.name==='Galletitas Nuevas');ok(gn&&gn.barcode==='7791234500011'&&MI.length===1&&MI[0].pid===gn.id,'se crea el producto nuevo con su código y se agrega a lo recibido');
MI[0].qty=5;MI[0].venc=D5;Object.assign(vals,{'#f_sup':'Prov Uno','#f_date':T,'#f_amt':'1000','#f_note':'','#f_ped':String(p1.id)});saveMerc(m1.id);
ok(gn.stock===5&&gn.venc===D5&&soon().some(p=>p.id===gn.id),'el vencimiento cargado al recibir dispara la alerta de productos por vencer');
// cambiar el estado a Recibido desde la ficha del pedido también lo pasa a Mercadería
Object.assign(vals,{'#f_sup':'Prov Tres','#f_date':'','#f_amt':'300','#f_st':'Recibido','#f_note':''});saveCol('ped',p3.id);
ok(db.merc.some(m=>m.ped===p3.id)&&PENDM===0,'marcar Recibido desde la ficha también pasa a Mercadería');
}
// --- todas las pantallas, perfil y configuración ---
for(const n of NAV){view=n[0];ok(typeof page()==='string','pantalla '+n[0])}
['perfil','notif','venc','aum','perms','solic','ses','fecha','gen'].forEach(cfgOpen);
me=db.users.find(u=>u.id==='cami');view='perfil';h=page();ok((h.match(/CERRAR SESIÓN/g)||[]).length===1&&h.includes('cami@email.com'),'perfil');
Object.assign(vals,{'#pn':'Cami','#pl':'Z'});saveMe();ok(me.last==='Z','editar perfil propio');
Object.assign(vals,{'#rq':'users','#rn':'x'});sendReq();me=db.users.find(u=>u.admin);resReq(db.reqs[0].id,1);ok(db.reqs[0].st==='Aprobada','solicitud de permiso');
// --- login y registro se dibujan ---
// --- formato de importes argentino ---
ok(parseAR('14000')===14000&&parseAR('14.000')===14000&&parseAR('14,000')===14000&&parseAR('14.500,50')===14500.5&&parseAR('014000')===14000&&parseAR('1,5')===1.5&&parseAR('14,50')===14.5&&parseAR('0,125')===0.13&&parseAR('1.234.567')===1234567,'parseAR: 14000 · 14.000 · 14,000 · 14.500,50');
ok(money(14000)==='$14.000'&&money(1500)==='$1.500'&&money(14500.5)==='$14.500,5'&&money(0)==='$0'&&!money(14000).includes('014'),'money: formato argentino sin ceros delante');
ok(numIn(14500.5)==='14500,5'&&numVal('14,000')===14000&&numVal('')===0,'campos de importe');
Object.assign(vals,{'#f_price':'14,000','#f_disc':'0'});ok(val(['price','Precio','num'])===14000,'el campo de precio entiende 14,000');
// --- control rápido de stock: SALIDA/ENTRADA, aviso inmediato, escaneo ---
mkP({name:'Coca Cola 2,25 L',price:3500,stock:6,min:4,code:'7790001112223'});
const coca=db.prod.find(x=>x.name==='Coca Cola 2,25 L');vals['#sqc']='1';
qmove(coca.id,-1);ok(coca.stock===5&&stockState(coca)==='ok'&&!stockAlerts().includes(coca),'6 → 5 sigue normal');
qmove(coca.id,-1);ok(coca.stock===4&&stockState(coca)==='bajo'&&stockAlerts().includes(coca)&&stockTag(coca).includes('STOCK BAJO'),'al llegar al mínimo avisa 🔴 STOCK BAJO enseguida');
stab='bajo';ok(stockHome().includes('CON STOCK BAJO')&&stockPage().includes('Coca Cola'),'aparece en las alertas de reponer');
qmove(coca.id,-1);qmove(coca.id,-1);qmove(coca.id,-1);ok(coca.stock===1,'baja de a una unidad');qmove(coca.id,-1);ok(coca.stock===0&&stockState(coca)==='sin'&&stockTag(coca).includes('SIN STOCK'),'0 → 🚨 SIN STOCK');
qmove(coca.id,-1);ok(coca.stock===0,'no baja de 0');
vals['#sqc']='12';qmove(coca.id,1);ok(coca.stock===12&&stockState(coca)==='ok'&&!stockAlerts().includes(coca),'ENTRADA +12 y desaparece el aviso');
ok(coca.smov[0].motivo==='Entrada rápida'&&db.log.some(l=>l.act==='Modificó stock'&&l.detail.includes('Entrada rápida')),'los movimientos quedan en el historial');
delete vals['#sqc'];
{const sbo=scanBarcode,sho=sheet;let last='';sheet=h=>{last=h};scanBarcode=cb=>cb('7790001112223');scanProducts();
 ok(last.includes('STOCK ACTUAL')&&last.includes('Coca Cola')&&last.includes('➖ SALIDA')&&last.includes('ENTRADA ➕'),'escanear un producto existente muestra stock y SALIDA/ENTRADA');
 scanBarcode=cb=>cb('999999999');scanProducts();ok(last.includes('CREAR NUEVO PRODUCTO'),'código nuevo: sigue ofreciendo crear el producto');
 editProd(coca.id);ok(last.includes('STOCK ACTUAL')&&last.includes('id="f_name"')&&last.includes('GUARDAR'),'la ficha completa sigue y suma el control rápido');
 scanBarcode=sbo;sheet=sho}
// --- menú: Pagos diarios / Historial & Memoria fuera del menú, datos y pantallas intactos ---
{const m=menu();ok(!m.includes('Pagos diarios')&&!m.includes('Historial')&&!m.includes('Memoria')&&m.includes('Pedidos')&&m.includes('Productos'),'menú sin Pagos diarios, Historial ni Memoria');
 const h=home();ok(h.includes('Pagos diarios hoy')&&h.includes('Historial'),'Inicio conserva sus resúmenes');
 ok(histPage().includes('Historial')&&db.log.length>20&&Array.isArray(db.pagos),'historial y pagos siguen funcionando y guardando');
 ok(colPage('pagos').includes('Pagos diarios'),'la pantalla de Pagos diarios sigue existiendo')}
// --- calculadora: total derivado de los pedidos ---
{calcDay=null;const t0=calcPedTotal(),a={id:nid(),sup:'Prov A',amt:15000,date:'',st:'Agregado',cd:iso(),u:'x',h:'00:00'},b2={id:nid(),sup:'Prov B',amt:8500,date:'',st:'Agregado',cd:iso(),u:'x',h:'00:00'},o={id:nid(),sup:'Prov C',amt:5000,date:'',st:'Agregado',cd:'2020-01-01',u:'x',h:'00:00'};
 db.ped.push(a,b2,o);ok(Math.round(calcPedTotal()*100)===Math.round((t0+23500)*100),'total = suma de los pedidos del día (otras fechas no se mezclan)');
 b2.amt=9500;ok(Math.round(calcPedTotal()*100)===Math.round((t0+24500)*100),'si se modifica un pedido, el total se actualiza');
 softDelete('ped',a.id);ok(Math.round(calcPedTotal()*100)===Math.round((t0+9500)*100)&&db.trash.some(t=>t.coll==='ped'),'un pedido en papelera deja de sumar');
 ok(calcCard().includes('TOTAL DEL DÍA'),'la calculadora muestra el total')}
// --- el precio nuevo no arranca con un 0 delante ---
{const f=field(['price','Precio normal','num'],0);ok(f.includes('value=""')&&f.includes('placeholder="0"'),'un precio vacío no muestra 0');
 const g=field(['price','Precio normal','num'],14500.5);ok(g.includes('value="14500,5"'),'un precio cargado se muestra tal cual');
 Object.assign(vals,{'#f_price':'14000'});ok(val(['price','Precio','num'])===14000,'14000 se guarda como 14000 (sin 0 delante)')}
// --- productos por sectores ---
{q='';psec=null;mkP({name:'Fideos Tallarín',price:900,stock:10,cat:'Fideos'});
 mkP({name:'Fideos Moñitos',price:950,stock:8,cat:'fideos'});
 Object.assign(vals,{'#f_name':'Harina 000','#f_barcode':'','#f_cat':'Harina','#f_sup':'','#f_price':'800','#f_unit':'','#f_disc':'0','#f_stock':'5','#f_min':'0','#f_venc':'','#f_emoji':''});saveProd(0);
 const S=sectores(),fi=S.find(x=>x.key==='fideos');ok(fi&&fi.items.length===2&&S.some(x=>x.key==='harina')&&S.some(x=>x.key===''),'agrupa los productos por sector (sin importar mayúsculas)');
 const g=prodPage();ok(g.includes('NUEVO SECTOR')&&g.includes('Fideos')&&g.includes('2 productos')&&g.includes('Harina')&&!g.includes('Fideos Tallarín'),'Productos muestra primero los sectores con su cantidad');
 openSec(encodeURIComponent('fideos'));const v=prodPage();ok(v.includes('Fideos Tallarín')&&v.includes('Fideos Moñitos')&&!v.includes('Harina 000')&&v.includes('AGREGAR PRODUCTO A ESTE SECTOR'),'dentro del sector se ven solo sus productos');
 {const sho=sheet;let last='';sheet=h=>{last=h};editProd(0,false,'','Fideos');ok(last.includes('value="Fideos"'),'agregar dentro de un sector lo deja preseleccionado');
  newSecForm();ok(last.includes('Nuevo sector'),'formulario de nuevo sector');sheet=sho}
 q='tall';ok(plist().includes('Fideos Tallarín')&&!plist().includes('📂'),'la búsqueda sigue funcionando en toda la lista');q='';
 vals['#sn']='Pastas';renSec();ok(db.prod.filter(p=>p.cat==='Pastas').length===2&&psec==='pastas'&&!db.prod.some(p=>p.cat==='fideos'||p.cat==='Fideos'),'cambiar nombre del sector lo cambia en sus productos');
 psec=null}
// --- cigarrillos: conteo diario ---
{ok(NAV.some(n=>n[2]==='Cigarrillos'&&n[0]==='cig')&&menu().includes('Cigarrillos'),'Cigarrillos está en el menú');
 ok(cigPage().includes('Para qué sirve esta sección')&&cigPage().includes('AGREGAR MARCA'),'la sección explica para qué sirve');
 Object.assign(vals,{'#cn':'Marlboro Box','#cp':'3.000','#ci':'20'});cigAdd();Object.assign(vals,{'#cn':'Lucky','#cp':'2500','#ci':'10'});cigAdd();Object.assign(vals,{'#cn':'lucky','#cp':'1','#ci':''});cigAdd();
 const ma=db.prod.find(x=>x.name==='Marlboro Box'),lu=db.prod.find(x=>x.name==='Lucky');
 ok(cigList().length===2&&ma.stock===20&&lu.stock===10&&ma.cat==='Cigarrillos'&&ma.price===3000,'se cargan las marcas con su stock y precio (sin repetir)');
 ok(cigPage().includes('Hay en la app: <b>20</b>')&&cigPage().includes('Marlboro Box'),'el conteo muestra el número esperado');
 stockMove(ma,30,'Mercadería recibida','Prov');
 CQ={};CQ[ma.id]='25';CQ[lu.id]='8';CAP='15.000';cigSave();
 ok(ma.stock===25&&lu.stock===8&&ma.conteos[0].vend===5&&lu.conteos[0].vend===2,'vendidos = esperado − contado (considera la mercadería que entró)');
 {const t=cigTot(cigSes()[0]);ok(t.vend===7&&t.esp===20000&&t.res===-5000,'total vendido, plata que debería haber y diferencia con lo apartado');
  ok(cigSum(cigSes()[0],true).includes('Faltan')&&cigSum(cigSes()[0],true).includes('$20.000'),'avisa cuánto falta')}
 CQ={};CQ[lu.id]='12';CAP='';cigSave();ok(lu.stock===12&&lu.conteos[0].vend===0&&lu.conteos[0].dif===4&&cigSum(cigSes()[0],true).includes('más de lo esperado'),'si contás de más, no inventa ventas y avisa');
 CQ={};cigSave();ok(true,'conteo vacío no rompe');
 ok(db.log.some(l=>l.act==='Conteo de cigarrillos')&&ma.smov.some(m=>m.motivo==='Conteo de cigarrillos'),'queda en el historial');
 ok(cigPage().includes('Último conteo')&&cigPage().includes('Conteos anteriores'),'muestra el último conteo y los anteriores')}
logout();splash=true;login();splash=false;authView='reg';login();authView='forgot';fpStep=1;login();authView='login';login();
// --- persistencia: recargar = leer lo guardado ---
const re=Store.load();ok(re.prod.length===11&&re.users.length===2&&re.log.length>20,'los datos sobreviven a recargar');
`;
new Function('return (async()=>{'+js+'\n'+test+'})()')().then(()=>{console.log('Prueba OK');process.exit(0)}).catch(e=>{console.error('FALLÓ:',e.message,process.env.DBG?e.stack:'');process.exit(1)});
