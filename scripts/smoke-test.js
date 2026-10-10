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
const mkP=o=>{Object.assign(vals,{'#f_name':o.name,'#f_barcode':o.code||'','#f_cat':'','#f_sup':o.sup||'','#f_price':String(o.price||100),'#f_unit':'','#f_disc':'0','#f_stock':String(o.stock||0),'#f_min':String(o.min||0),'#f_venc':o.venc||'','#f_emoji':''});saveProd(0)};
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
ok(NAV.some(n=>n[2]==='Pagos diarios')&&!NAV.some(n=>n[2]==='Pagos'||n[0]==='gastos'||n[2]==='Gastos'),'menú: Pagos diarios y sin Gastos');
view='home';ok(!/Gastos/.test(home())&&home().includes('Pagos diarios hoy'),'Inicio sin Gastos');ok(!/Gastos/.test(jornada())&&jornada().includes('Pagos diarios'),'Jornada sin Gastos');
view='pagos';ok(page().includes('Pagos diarios'),'título Pagos diarios');ok(COL.gastos&&Array.isArray(db.gastos),'los datos de Gastos se conservan');
ok(parseAR('1.500,50')===1500.5&&parseAR('1.500')===1500&&parseAR('1500,5')===1500.5&&parseAR('1500')===1500&&isNaN(parseAR('abc'))&&isNaN(parseAR('-5')),'importes en formato argentino');
calcDay=null;vals['#cin']='1.500,50';calcAdd();vals['#cin']='2.000';calcAdd();ok(calcTotal()===3500.5&&db.calc.length===2,'la calculadora suma');
view='ped';ok(colPage('ped').includes('$3.500,50')&&colPage('ped').includes('LIMPIAR'),'el total se muestra en Pedidos');
vals['#cin']='abc';calcAdd();ok(db.calc.length===2,'importe inválido no se guarda');
vals['#ce']='3.000';calcSaveEdit(db.calc[0].id);ok(calcTotal()===5000,'corregir un importe');
calcDel(db.calc[0].id);askYes();ok(calcTotal()===2000&&db.trash.some(t=>t.coll==='calc'),'eliminar un importe (va a la papelera)');
calcDay='2020-01-01';vals['#cin']='500';calcAdd();ok(calcTotal()===500,'otro día tiene su propio total');calcDay=null;ok(calcTotal()===2000,'el total de hoy no se mezcla');
calcClearAsk();askYes();ok(calcItems().length===0&&db.trash.filter(t=>t.coll==='calc').length>=2,'limpiar pide confirmación y manda a la papelera');
restoreT(db.trash.find(t=>t.coll==='calc').tid);ok(calcTotal()>0,'restaurar un importe');
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
// --- todas las pantallas, perfil y configuración ---
for(const n of NAV){view=n[0];ok(typeof page()==='string','pantalla '+n[0])}
['perfil','notif','venc','aum','perms','solic','ses','fecha','gen'].forEach(cfgOpen);
me=db.users.find(u=>u.id==='cami');view='perfil';h=page();ok((h.match(/CERRAR SESIÓN/g)||[]).length===1&&h.includes('cami@email.com'),'perfil');
Object.assign(vals,{'#pn':'Cami','#pl':'Z'});saveMe();ok(me.last==='Z','editar perfil propio');
Object.assign(vals,{'#rq':'users','#rn':'x'});sendReq();me=db.users.find(u=>u.admin);resReq(db.reqs[0].id,1);ok(db.reqs[0].st==='Aprobada','solicitud de permiso');
// --- login y registro se dibujan ---
logout();splash=true;login();splash=false;authView='reg';login();authView='forgot';fpStep=1;login();authView='login';login();
// --- persistencia: recargar = leer lo guardado ---
const re=Store.load();ok(re.prod.length===4&&re.users.length===2&&re.log.length>20,'los datos sobreviven a recargar');
`;
new Function('return (async()=>{'+js+'\n'+test+'})()')().then(()=>{console.log('Prueba OK');process.exit(0)}).catch(e=>{console.error('FALLÓ:',e.message);process.exit(1)});
