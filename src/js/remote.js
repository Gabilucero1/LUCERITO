// Conexión REAL a Supabase: autenticación, base de datos central compartida y tiempo real.
// Solo se activa si hay SUPABASE_URL y SUPABASE_ANON_KEY (ver .env.example). Sin eso la app funciona en MODO LOCAL (demostración).
// La clave "anon" es pública por diseño: la seguridad real la dan las reglas RLS de db/schema.sql, no el navegador.
// En modo conectado la FUENTE DE VERDAD es la base de datos; el navegador solo guarda la sesión de Supabase.
// La URL base de Supabase debe ser SOLO https://<proyecto>.supabase.co. Si se pegó con /rest/v1 (la "Data API URL"), la autenticación iría a /rest/v1/auth/v1/... y daría 404.
const cleanSbUrl=u=>String(u||'').trim().replace(/\/+$/,'').replace(/\/(rest|auth|realtime|storage)\/v1$/i,'').replace(/\/+$/,'');
// Tabla que puede faltar si todavía no se ejecutó la migración: la app sigue funcionando y avisa.
const isMissingTable=e=>!!e&&(e.code==='PGRST205'||e.code==='42P01'||/schema cache|does not exist/i.test(e.message||''));
const SDK_URL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js';
const SYNC=[{k:'prod',t:'products'},{k:'sup',t:'suppliers'},{k:'ped',t:'orders'},{k:'merc',t:'receipts'},{k:'pagos',t:'payments'},{k:'gastos',t:'expenses'},{k:'notas',t:'notes'},{k:'calc',t:'calc_entries',opt:true},{k:'alerts',t:'price_changes'},{k:'trash',t:'trash_items'},{k:'reqs',t:'permission_requests'},{k:'log',t:'audit_log',append:true}];
const TBL=Object.fromEntries(SYNC.map(s=>[s.t,s.k]));
let BOOTERR='',PHOTO='',FORCING=false;
const stable=o=>JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((a,x)=>(a[x]=v[x],a),{}):v);
const mapProfile=r=>({id:r.username,uid:r.id,email:r.email,name:r.first_name,last:r.last_name,photo:r.photo||'',admin:r.role==='admin'?1:0,on:r.active?1:0,prefs:r.notif_prefs||{},lastSeen:r.last_seen||null,lastAccess:r.last_access?{d:iso(new Date(r.last_access)),h:new Date(r.last_access).toTimeString().slice(0,5)}:null});
const Remote={
 on:REMOTE_ON,ready:!REMOTE_ON,sb:null,uid:null,sid:null,revoked:false,recovering:false,SNAP:{},VER:{},missing:{},cfgSnap:'',pushing:false,dirty:false,lastSess:[],
 // ---------- arranque ----------
 async init(){
  try{
   if(!window.supabase)await loadScript(SDK_URL);
   this.sb=window.supabase.createClient(cleanSbUrl(ENV.SUPABASE_URL),String(ENV.SUPABASE_ANON_KEY).trim(),{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
   this.recovering=/type=recovery/.test(location.hash||'');
   this.sb.auth.onAuthStateChange((ev)=>{if(ev==='PASSWORD_RECOVERY'){this.recovering=true;authView='recover';if(!me)render()}else if(ev==='SIGNED_OUT'&&me&&!this.leaving&&!FORCING)this.sessionEnded()});
   if(this.recovering)authView='recover';
   else{const {data,error}=await this.sb.auth.getSession();if(error)throw error;if(data&&data.session){const uid=data.session.user.id;for(let i=0;;i++){try{await this.enterFrom(uid);break}catch(e){if(i>=2)throw e;await new Promise(r=>setTimeout(r,1500*(i+1)))}}}}
  }catch(e){BOOTERR=e.message||String(e)}
  this.ready=true},
  // ---------- autenticación (¿quién es esta persona?) ----------
 msg(e){const m=String((e&&e.message)||e);if(/invalid login/i.test(m))return 'Correo o contraseña incorrectos.';if(/not confirmed/i.test(m))return 'Tenés que confirmar tu correo antes de ingresar. Revisá tu bandeja de entrada.';if(/already registered/i.test(m))return 'Ya existe una cuenta con ese correo.';if(/rate limit|too many/i.test(m))return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';if(/password/i.test(m)&&/(6|short|weak)/i.test(m))return 'La contraseña es demasiado corta o débil.';return m},
 async signUp({email,password,username,first,last}){
  const ok=await this.sb.rpc('username_available',{u:username});if(ok.error)return {error:this.msg(ok.error)};if(ok.data===false)return {error:'Ese nombre de usuario ya está en uso.'};
  const {data,error}=await this.sb.auth.signUp({email,password,options:{data:{username,first_name:first,last_name:last},emailRedirectTo:location.origin+location.pathname}});
  if(error)return {error:this.msg(error)};
  if(data.user&&data.user.identities&&data.user.identities.length===0)return {error:'Ya existe una cuenta con ese correo.'};
  return {session:data.session,user:data.user}},
 async signIn(email,password){const {data,error}=await this.sb.auth.signInWithPassword({email,password});if(error)return {error:this.msg(error)};return {session:data.session,user:data.user}},
 async resetEmail(email){const {error}=await this.sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});return error?{error:this.msg(error)}:{ok:true}},
 async updatePassword(pw){const {error}=await this.sb.auth.updateUser({password:pw});return error?{error:this.msg(error)}:{ok:true}},
 async signOut(){this.leaving=true;try{if(this.sid)await this.sb.from('app_sessions').update({ended_at:new Date().toISOString()}).eq('id',this.sid)}catch(e){}
  clearInterval(this.hb);try{await this.unregisterPush()}catch(e){}
  try{await this.sb.auth.signOut({scope:'local'})}catch(e){}
  if(this.ch){try{this.sb.removeChannel(this.ch)}catch(e){}this.ch=null}this.sid=null;this.uid=null;this.leaving=false},
 // Entrar con una sesión de Supabase ya existente: recupera usuario + perfil. Nunca crea cuentas.
 async enterFrom(uid){if(this.entering)return !!me;this.entering=true;try{return await this._enter(uid)}finally{this.entering=false}},
 sessionEnded(){clearInterval(this.hb);me=null;sid=null;view='home';const s=$('#sh');if(s)s.remove();authMsg='Tu sesión terminó. Ingresá de nuevo con tu correo y contraseña.';this.sid=null;this.uid=null;this.clear();render()},
 async _enter(uid){
  const {data,error}=await this.sb.from('profiles').select('*').eq('id',uid);const row=data&&data[0];
  if(error)throw new Error('No se pudo leer tu perfil ('+error.message+'). ¿Se ejecutó db/schema.sql en Supabase?');
  if(!row){await this.sb.auth.signOut({scope:'local'});authMsg='Tu cuenta no tiene perfil. Avisale a la administradora.';return false}
  if(!row.active){if(PHOTO){await this.sb.from('profiles').update({photo:PHOTO}).eq('id',uid);PHOTO=''}await this.sb.auth.signOut({scope:'local'});authMsg='Tu cuenta está pendiente de aprobación o desactivada. Hablá con la administradora.';return false}
  this.uid=uid;this.revoked=false;await this.loadAll();this.subscribe();
  me=db.users.find(u=>u.uid===uid)||mapProfile(row);
  view=(typeof GO!=='undefined'&&GO&&NAV.some(n=>n[0]===GO))?GO:'home';authView='login';
  await this.startSession();
  const now=new Date().toISOString();await this.sb.from('profiles').update({last_access:now,last_seen:now}).eq('id',uid);me.lastAccess={d:iso(),h:hm()};
  if(PHOTO){me.photo=PHOTO;PHOTO='';await this.saveProfile()}
  log('Ingresó','Inicio de sesión');
  if(Push.configured()&&typeof Notification!=='undefined'&&Notification.permission==='granted')Push.enable().catch(()=>{});
  return true},
 async afterAuth(){const {data}=await this.sb.auth.getSession();const uid=data&&data.session&&data.session.user.id;if(!uid)return false;return this.enterFrom(uid)},
 // ---------- carga de datos centrales ----------
 async fetchAll(t){const out=[];for(let from=0;;from+=1000){const {data,error}=await this.sb.from(t).select('id,data,version').order('id',{ascending:true}).range(from,from+999);if(error)throw error;out.push(...data);if(data.length<1000)break}return out},
 async fetchLog(){const {data,error}=await this.sb.from('audit_log').select('id,data,version').order('id',{ascending:false}).limit(500);if(error)throw error;return data},
 async loadAll(){
  for(const {k,t,opt} of SYNC){let rows;try{rows=t==='audit_log'?await this.fetchLog():await this.fetchAll(t)}catch(e){if(opt&&isMissingTable(e)){this.missing[t]=true;db[k]=db[k]||[];this.SNAP[t]={};this.VER[t]={};continue}throw e}delete this.missing[t];this.SNAP[t]={};this.VER[t]={};
   db[k]=rows.map(r=>{const rec={...r.data,id:r.id};this.SNAP[t][r.id]=stable(rec);this.VER[t][r.id]=r.version;return rec})}
  db.log.sort((a,b)=>b.id-a.id);
  const s=await this.sb.from('app_settings').select('data').eq('id',1);db.cfg=Object.assign({offerDays:10,approve:true},(s.data&&s.data[0]&&s.data[0].data)||{});this.cfgSnap=stable(db.cfg);
  const p=await this.sb.from('profiles').select('*');if(p.error)throw p.error;db.users=p.data.map(mapProfile)},
 clear(){for(const {k} of SYNC)db[k]=[];db.users=[];this.SNAP={};this.VER={}},
 // ---------- guardar cambios (diferencias) ----------
 schedule(){if(!this.on||!me||!this.sb)return;clearTimeout(this._t);this._t=setTimeout(()=>this.push(),120)},
 async flush(){clearTimeout(this._t);while(this.pushing)await new Promise(r=>setTimeout(r,5));if(this.on&&this.sb&&this.uid)await this.push()},
 async push(){if(this.pushing){this.dirty=true;return}this.pushing=true;
  try{do{this.dirty=false;for(const s of SYNC)await this.pushUpserts(s);for(const s of SYNC)await this.pushDeletes(s);await this.pushCfg()}while(this.dirty)}
  catch(e){toast('No se pudo guardar en el servidor: '+(e.message||e))}finally{this.pushing=false}},
 async pushUpserts({k,t,append}){if(this.missing[t])return;const snap=this.SNAP[t]||(this.SNAP[t]={}),ver=this.VER[t]||(this.VER[t]={});
  for(const rec of db[k].slice()){const id=rec.id,js=stable(rec);
   if(!(id in snap)){const {error}=await this.sb.from(t).insert({id,data:rec,version:1});
    if(error){if(error.code==='23505'){db[k]=db[k].filter(r=>r!==rec);toast(t==='products'?'Ese código de barras ya está registrado en otro producto.':t==='suppliers'?'Ya existe un proveedor con ese nombre.':'Ese registro ya existe.');render();continue}throw error}
    snap[id]=js;ver[id]=1}
   else if(!append&&snap[id]!==js){const v=ver[id];const {data,error}=await this.sb.from(t).update({data:rec,version:v+1}).eq('id',id).eq('version',v).select('id');
    if(error)throw error;if(!data||!data.length){await this.resolveConflict({k,t},id);continue}snap[id]=js;ver[id]=v+1}}},
 async pushDeletes({k,t,append}){if(append||this.missing[t])return;const snap=this.SNAP[t]||{},ver=this.VER[t]||{},cur=new Set(db[k].map(r=>String(r.id)));
  for(const id of Object.keys(snap)){if(!cur.has(id)){const {error}=await this.sb.from(t).delete().eq('id',Number(id));if(error)throw error;delete snap[id];delete ver[id]}}},
 async pushCfg(){if(!me||!me.admin)return;if(stable(db.cfg)!==this.cfgSnap){const {error}=await this.sb.from('app_settings').update({data:db.cfg,updated_at:new Date().toISOString()}).eq('id',1);if(error)throw error;this.cfgSnap=stable(db.cfg)}},
 async resolveConflict({k,t},id){const {data}=await this.sb.from(t).select('id,data,version').eq('id',id);const row=data&&data[0],i=db[k].findIndex(r=>r.id===id);
  if(!row){if(i>=0)db[k].splice(i,1);delete this.SNAP[t][id];delete this.VER[t][id];toast('Otra persona eliminó ese registro.')}
  else{const rec={...row.data,id:row.id};if(i>=0)db[k][i]=rec;this.SNAP[t][id]=stable(rec);this.VER[t][id]=row.version;toast('Otra persona modificó ese registro al mismo tiempo. Te mostré su versión: revisá y repetí tu cambio si hace falta.')}
  render()},
 // ---------- tiempo real ----------
 subscribe(){if(this.ch){try{this.sb.removeChannel(this.ch)}catch(e){}}
  let ch=this.sb.channel('lucerito');
  for(const {t} of SYNC)if(!this.missing[t])ch=ch.on('postgres_changes',{event:'*',schema:'public',table:t},p=>this.onRow(t,p));
  ch=ch.on('postgres_changes',{event:'*',schema:'public',table:'profiles'},p=>this.onProfile(p)).on('postgres_changes',{event:'*',schema:'public',table:'app_settings'},p=>this.onCfg(p)).on('postgres_changes',{event:'*',schema:'public',table:'app_sessions'},p=>this.onSess(p));
  this.ch=ch.subscribe()},
 isDirty(t,id){const rec=db[TBL[t]].find(r=>r.id===id);return !!rec&&stable(rec)!==this.SNAP[t][id]},
 onRow(t,p){if(!me)return;const k=TBL[t],arr=db[k];
  if(p.eventType==='DELETE'){const id=p.old.id,i=arr.findIndex(r=>r.id===id);if(i>=0&&!this.isDirty(t,id))arr.splice(i,1);delete this.SNAP[t][id];delete this.VER[t][id]}
  else{const row=p.new,rec={...row.data,id:row.id},i=arr.findIndex(r=>r.id===row.id);
   if(i>=0){if(this.isDirty(t,row.id))return;arr[i]=rec}else arr.push(rec);
   this.SNAP[t][row.id]=stable(rec);this.VER[t][row.id]=row.version}
  if(t==='audit_log')arr.sort((a,b)=>b.id-a.id);
  this.refresh()},
 onProfile(p){if(!me)return;
  if(p.eventType==='DELETE'){db.users=db.users.filter(u=>u.uid!==p.old.id);return this.refresh()}
  const n=mapProfile(p.new),i=db.users.findIndex(u=>u.uid===n.uid),cur=i>=0?db.users[i]:null;
  if(cur)for(const [col,key] of [['active','on'],['role','admin'],['photo','photo'],['notif_prefs','prefs'],['first_name','name'],['last_name','last'],['last_seen','lastSeen'],['last_access','lastAccess']])if(!(col in p.new)&&key in cur)n[key]=cur[key];
  if(n.uid===me.uid){Object.assign(me,n);if(i>=0)db.users[i]=me;else db.users.push(me);if(!me.on)forceOut()}
  else if(i>=0)db.users[i]=n;else db.users.push(n);
  this.refresh()},
 onCfg(p){if(!me)return;db.cfg=Object.assign({offerDays:10,approve:true},p.new.data||{});this.cfgSnap=stable(db.cfg);this.refresh()},
 onSess(p){if(p.new&&p.new.id===this.sid&&p.new.revoked_at){this.revoked=true;forceOut()}},
 refresh(){clearTimeout(this._r);this._r=setTimeout(()=>{const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.closest&&a.closest('#app'))return;if(me)render()},250)},
 // ---------- sesiones (ligadas a la cuenta, no al dispositivo) ----------
 async startSession(){const {data,error}=await this.sb.from('app_sessions').insert({user_id:this.uid,device:deviceKind()+' · '+((String(navigator.userAgent).match(/(Edg|Chrome|Firefox|Safari)\//)||[0,'Navegador'])[1])}).select('id');
  if(!error&&data&&data[0]){this.sid=data[0].id;sid=this.sid}
  clearInterval(this.hb);this.hb=setInterval(()=>this.heartbeat(),60000)},
 async heartbeat(){if(!this.sid||!this.uid)return;try{const {data}=await this.sb.from('app_sessions').select('revoked_at').eq('id',this.sid);
  if(data&&data[0]&&data[0].revoked_at){this.revoked=true;forceOut();return}
  const now=new Date().toISOString();await this.sb.from('app_sessions').update({last_seen:now}).eq('id',this.sid);await this.sb.from('profiles').update({last_seen:now}).eq('id',this.uid)}catch(e){}},
 async sessions(){const {data}=await this.sb.from('app_sessions').select('*').order('started_at',{ascending:false}).limit(30);
  this.lastSess=(data||[]).map(r=>{const u=db.users.find(x=>x.uid===r.user_id);return {id:r.id,uid:r.user_id,name:u?uName(u):'?',dev:r.device||'—',start:Date.parse(r.started_at),last:Date.parse(r.last_seen),on:!r.revoked_at&&!r.ended_at&&Date.now()-Date.parse(r.last_seen)<150000}});return this.lastSess},
 async endSession(id){await this.sb.from('app_sessions').update({revoked_at:new Date().toISOString(),revoked_by:this.uid}).eq('id',id)},
 async revokeUser(uid){await this.sb.from('app_sessions').update({revoked_at:new Date().toISOString(),revoked_by:this.uid}).eq('user_id',uid).is('revoked_at',null)},
 // ---------- perfil ----------
 async saveProfile(){try{const {error}=await this.sb.from('profiles').update({first_name:me.name,last_name:me.last||'',photo:me.photo||'',notif_prefs:me.prefs||{}}).eq('id',me.uid);if(error)throw error;return true}catch(e){toast('No se pudo guardar tu perfil: '+(e.message||e));return false}},
 async setActive(u){await this.sb.from('profiles').update({active:!!u.on}).eq('id',u.uid)},
 // ---------- notificaciones push (el envío lo hace el servidor: api/notify.js) ----------
 async registerPush(token){await this.sb.rpc('register_push_token',{p_token:token,p_device:deviceKind()});try{localStorage.setItem(KEY+'_push',token)}catch(e){}},
 async unregisterPush(){let t=null;try{t=localStorage.getItem(KEY+'_push');localStorage.removeItem(KEY+'_push')}catch(e){}if(t&&this.sb)await this.sb.from('push_devices').delete().eq('token',t)},
 async notify(type,title,body,go){if(!this.on||!this.sb)return;
  try{const {data}=await this.sb.auth.getSession();const tk=data&&data.session&&data.session.access_token;if(!tk)return;
   await fetch('/api/notify',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tk},body:JSON.stringify({type,title,body,url:go?'/?go='+go:'/'})})}catch(e){}}
};
