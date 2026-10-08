// Prueba de MODO CONECTADO con dos "celulares" (A y B) que comparten un Supabase simulado.
// Comprueba la lógica de sincronización, cuentas, papelera compartida, sesiones y avisos. No usa servicios reales.
const fs=require('fs'),path=require('path');
const {Server,client}=require('./fake-supabase');
const ORDER=JSON.parse(fs.readFileSync(path.join(__dirname,'order.json'),'utf8'));
const APP=ORDER.map(n=>fs.readFileSync(path.join(__dirname,'..','src','js',n+'.js'),'utf8')).join('\n');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
global.scrollTo=()=>{};
function makeApp(server){
 const vals={},fetched=[];
 const mk=v=>({innerHTML:'',value:v,textContent:'',style:{},remove(){},set onclick(x){},set oninput(x){}});
 const doc={querySelector:s=>vals[s]!==undefined?mk(vals[s]):mk('1'),createElement:()=>({...mk(''),getContext:()=>({drawImage(){}}),toDataURL:()=>''}),body:{appendChild(){}},head:{appendChild(){}}};
 const st={},ls={getItem:k=>st[k]??null,setItem:(k,v)=>{st[k]=v},removeItem:k=>{delete st[k]}};
 const win={crypto:globalThis.crypto,supabase:{createClient:()=>client(server)}};win.top=win.self=win;
 const loc={hash:'',search:'',href:'http://x/',origin:'http://x',pathname:'/'};
 const env='const ENV={STORAGE_KEY:"t",ADMIN_EMAIL:"",DEV_SHOW_CODE:false,SUPABASE_URL:"http://fake",SUPABASE_ANON_KEY:"k",FIREBASE_API_KEY:""};\n';
 const fn=new Function('document','localStorage','window','navigator','screen','location','fetch','history','vals','fetched',env+APP+'\nreturn {run:c=>eval(c),vals,fetched,toasts:TOASTS};');
 return fn(doc,ls,win,{userAgent:'Android'},{width:360,height:800},loc,async(u,o)=>{fetched.push({u,o});return {ok:true}},{replaceState(){}},vals,fetched);
}
const ok=(c,m)=>{if(!c)throw new Error(m)};
(async()=>{
 const server=new Server(),A=makeApp(server),B=makeApp(server);
 for(const H of [A,B]){while(!H.run('Remote.ready'))await sleep(5);H.run('splash=false')}
 const reg=async(H,o)=>{H.run('authView="reg"');Object.assign(H.vals,{'#rn1':o.n,'#rn2':'X','#ru':o.u,'#rm':o.m,'#rp':o.p,'#rp2':o.p});await H.run('doReg()')};
 const settle=async H=>{await H.run('Remote.flush()');await sleep(30)};
 // --- cuentas reales: la primera es administradora, la segunda es usuaria ---
 await reg(A,{n:'Gabi',u:'gabi',m:'gabi@email.com',p:'clave123'});
 ok(A.run('me&&me.admin&&me.email')==='gabi@email.com','A: primera cuenta administradora');
 await reg(B,{n:'Cami',u:'cami',m:'cami@email.com',p:'cami1234'});
 ok(B.run('!!me&&!me.admin&&me.on===1'),'B: segunda cuenta usuaria');
 await reg(B,{n:'Otra',u:'gabi',m:'otra@email.com',p:'abcdef'});ok(server.users.length===2,'usuario repetido no crea cuenta');
 await sleep(30);
 ok(A.run('db.users.length')===2,'A ve a Cami en Usuarios sin recargar');
 // --- Gabi guarda un producto -> Cami lo ve ---
 const prod=(H,o)=>{Object.assign(H.vals,{'#f_name':o.name,'#f_barcode':o.code||'','#f_cat':'','#f_sup':'','#f_price':String(o.price),'#f_unit':'','#f_disc':'0','#f_stock':String(o.stock||0),'#f_min':String(o.min||0),'#f_venc':'','#f_emoji':''});H.run('saveProd(0)')};
 prod(A,{name:'Lechuga',price:3000,stock:5,min:3,code:'7791234567890'});await settle(A);
 ok(B.run('db.prod.length')===1&&B.run('db.prod[0].name')==='Lechuga'&&B.run('db.prod[0].price')===3000,'Cami ve la Lechuga de Gabi');
 ok(server.table('products').length===1,'está en la base central');
 // --- Cami modifica el stock -> Gabi lo ve; historial con quién ---
 B.run('stockMove(db.prod[0],15,"Ajuste manual")');await settle(B);
 ok(A.run('db.prod[0].stock')===15,'Gabi ve stock 15');
 ok(A.run('db.log.some(l=>l.act==="Modificó stock"&&l.u==="Cami"&&l.old===5&&l.nw===15)'),'historial compartido: Cami 5 → 15');
 // --- aviso push al pasar a 0 ---
 B.fetched.length=0;B.run('stockMove(db.prod[0],0,"Salida: Merma")');await settle(B);
 ok(B.fetched.some(f=>f.u==='/api/notify'&&JSON.parse(f.o.body).type==='sin_stock'&&/Bearer tok-/.test(f.o.headers.Authorization)),'pide aviso push de stock agotado con la sesión de Cami');
 // --- aumento compartido ---
 Object.assign(A.vals,{'#aq':'Papa','#aold':'2000','#anw':'2500','#aun':'/kg'});A.run('saveAum()');await settle(A);
 ok(B.run('aumentosHoy().some(a=>a.name==="Papa"&&a.nw===2500)'),'Cami ve el aumento de Gabi');
 ok(A.fetched.some(f=>f.u==='/api/notify'&&JSON.parse(f.o.body).type==='aumentos'),'aviso de aumento');
 // --- pedido y nota compartidos ---
 Object.assign(B.vals,{'#f_sup':'__new__','#f_supnew':'Arcor','#f_date':'2030-01-02','#f_amt':'1000','#f_st':'En camino','#f_note':''});B.run('saveCol("ped",0)');await settle(B);
 ok(A.run('db.ped.length')===1&&A.run('db.sup.some(s=>s.name==="Arcor")'),'pedido y proveedor nuevo llegan a Gabi');
 Object.assign(A.vals,{'#f_txt':'Llamar al proveedor'});A.run('saveCol("notas",0)');await settle(A);
 ok(B.run('db.notas.length')===1,'nota compartida');
 // --- conflicto: dos personas editan el mismo producto a la vez ---
 Object.assign(A.vals,{'#f_name':'Lechuga','#f_barcode':'7791234567890','#f_price':'100','#f_stock':'0','#f_min':'3'});A.run('saveProd(db.prod[0].id)');
 Object.assign(B.vals,{'#f_name':'Lechuga','#f_barcode':'7791234567890','#f_price':'200','#f_stock':'0','#f_min':'3'});B.run('saveProd(db.prod[0].id)');
 await settle(B);await settle(A);await sleep(30);
 ok(A.run('db.prod[0].price')===200&&B.run('db.prod[0].price')===200,'gana el primero que llegó y el otro ve su versión');
 ok(A.toasts.some(t=>t.includes('Otra persona modificó')),'se avisa del conflicto');
 // --- papelera central ---
 const pid=B.run('db.prod[0].id');B.run('delProd('+pid+')');B.run('askYes()');await settle(B);
 ok(A.run('db.prod.length')===0&&A.run('trashActive().length')>=1,'Gabi ve el producto en la papelera');
 const tid=A.run('trashActive().find(t=>t.coll==="prod").tid');A.run('restoreT('+tid+')');await settle(A);
 ok(B.run('db.prod.some(p=>p.id==='+pid+')'),'al restaurar vuelve para todas');
 B.run('delProd('+pid+')');B.run('askYes()');await settle(B);
 const tid2=B.run('trashActive().find(t=>t.coll==="prod").tid');B.run('purge('+tid2+')');await settle(B);
 ok(server.table('trash_items').some(r=>r.id===tid2),'una usuaria NO elimina definitivamente');
 A.run('purge('+tid2+')');await settle(A);
 ok(!server.table('trash_items').some(r=>r.id===tid2),'la administradora sí elimina definitivamente');
 ok(A.run('db.log.some(l=>l.act==="Eliminó definitivamente producto")'),'queda en la auditoría');
 // --- sesiones de cuentas reales ---
 const sess=await A.run('Remote.sessions()');ok(sess.some(s=>s.name.startsWith('Cami')&&s.on),'Gabi ve la sesión de Cami');
 const cs=sess.find(s=>s.name.startsWith('Cami')).id;A.run('killSess("'+cs+'")');await sleep(60);
 ok(B.run('Remote.revoked')===true||B.run('me')===null,'Cami queda desconectada al cerrarle la sesión');
 // --- recuperación de contraseña por correo ---
 await sleep(40);H=B;
 H.run('authView="forgot";fpStep=1');H.vals['#fe']='cami@email.com';await H.run('fpSend()');
 ok(server.resets.includes('cami@email.com')&&H.run('fpStep')===5,'se pide el correo de recuperación a Supabase');
 H.run('Remote.sb.auth.signInWithPassword({email:"cami@email.com",password:"cami1234"})');await sleep(10);
 H.run('authView="recover"');Object.assign(H.vals,{'#fp1':'nueva1234','#fp2':'nueva1234'});await H.run('recoverSave()');
 ok(server.users.find(u=>u.email==='cami@email.com').password==='nueva1234','contraseña actualizada en el sistema de autenticación');
 H.vals['#lu']='cami@email.com';H.vals['#lp']='nueva1234';await H.run('doLogin()');await sleep(30);ok(H.run('me&&me.email')==='cami@email.com','entra con la contraseña nueva');
 // --- push: sin Firebase configurado falla con un mensaje claro ---
 let err='';try{await H.run('Push.enable()')}catch(e){err=e.message}ok(/Firebase/.test(err),'push sin configurar da un mensaje claro');
 // --- avisos diarios del servidor (lógica pura) ---
 const {computeAlerts}=require('../api/_alerts.js');
 const r=computeAlerts({products:[{stock:0},{stock:2,min:5},{stock:9,min:5,venc:'2030-01-05'}],orders:[{st:'En camino',date:'2030-01-02'},{st:'Recibido',date:'2030-01-02'},{st:'En camino',date:'2030-01-03'}],offerDays:10,now:new Date('2030-01-02T15:00:00Z'),tz:'America/Argentina/Mendoza'});
 ok(r.sin.length===1&&r.bajo.length===1&&r.venc.length===1&&r.pedHoy.length===1&&r.pedMan.length===1,'cálculo de avisos diarios');
 console.log('Prueba conectada OK');process.exit(0);
})().catch(e=>{console.error('FALLÓ:',e.stack||e.message);process.exit(1)});
