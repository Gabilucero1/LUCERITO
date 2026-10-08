// Simulador mínimo de Supabase SOLO PARA PRUEBAS (no se usa en la app). Sirve para comprobar la lógica de
// sincronización entre dos dispositivos. NO reemplaza probar contra un Supabase real ni las reglas RLS del SQL.
let seq=0;const uid=()=>'u'+(++seq);const cp=o=>JSON.parse(JSON.stringify(o));
class Server{
 constructor(){this.users=[];this.t={};this.clients=[];this.settings={approve:false};this.resets=[]}
 table(n){return this.t[n]||(this.t[n]=[])}
 emit(table,eventType,nw,old){for(const c of this.clients)for(const l of c.listeners)if(l.table===table)setTimeout(()=>l.cb({eventType,new:cp(nw||{}),old:cp(old||{})}),0)}
}
function client(server,storage){
 const me={session:null},c={listeners:[],authCbs:[]};server.clients.push(c);
 // como supabase-js real: la sesión se guarda en el almacenamiento del navegador y se recupera al reabrir
 const SK='sb-fake-auth';
 try{const s0=storage&&JSON.parse(storage.getItem(SK));if(s0&&server.users.some(u=>u.id===s0.user.id))me.session=s0}catch(e){}
 const keep=()=>{try{if(storage){me.session?storage.setItem(SK,JSON.stringify(me.session)):storage.removeItem(SK)}}catch(e){}};
 const auth={
  async signUp({email,password,options}){email=email.toLowerCase();
   if(server.users.some(u=>u.email===email))return {data:{user:{identities:[]},session:null},error:null};
   if(password.length<6)return {data:{},error:{message:'Password should be at least 6 characters'}};
   const id=uid();server.users.push({id,email,password});
   const first=!server.table('profiles').some(p=>p.role==='admin');
   const row={id,email,username:(options.data.username||'').toLowerCase(),first_name:options.data.first_name||'',last_name:options.data.last_name||'',photo:'',role:first?'admin':'user',active:first||!server.settings.approve,notif_prefs:{},last_access:null,last_seen:null};
   server.table('profiles').push(row);server.emit('profiles','INSERT',cp(row));
   me.session={user:{id,email},access_token:'tok-'+id};keep();return {data:{user:{id,identities:[1]},session:me.session},error:null}},
  async signInWithPassword({email,password}){const u=server.users.find(x=>x.email===email.toLowerCase()&&x.password===password);
   if(!u)return {data:{},error:{message:'Invalid login credentials'}};me.session={user:{id:u.id,email:u.email},access_token:'tok-'+u.id};keep();return {data:{user:me.session.user,session:me.session},error:null}},
  async signOut(){me.session=null;keep();c.authCbs.forEach(cb=>cb('SIGNED_OUT',null));return {error:null}},
  async getSession(){return {data:{session:me.session}}},
  onAuthStateChange(cb){c.authCbs.push(cb);return {data:{subscription:{unsubscribe(){}}}}},
  async resetPasswordForEmail(email){server.resets.push(email.toLowerCase());return {error:null}},
  async updateUser({password}){if(!me.session)return {error:{message:'Auth session missing'}};server.users.find(u=>u.id===me.session.user.id).password=password;return {error:null}}
 };
 const q=tname=>{const st={op:'select',filters:[],order:null,rng:null,lim:null,vals:null,sel:false};
  const api={select(){st.sel=true;return api},insert(v){st.op='insert';st.vals=v;return api},update(v){st.op='update';st.vals=v;return api},delete(){st.op='delete';return api},
   eq(k,v){st.filters.push(r=>r[k]===v);return api},is(k,v){st.filters.push(r=>(r[k]??null)===v);return api},
   order(k,o){st.order=[k,!(o&&o.ascending===false)];return api},range(a,b){st.rng=[a,b];return api},limit(n){st.lim=n;return api},
   then(res,rej){return run().then(res,rej)}};
  const run=async()=>{if(!me.session)return {data:null,error:{message:'JWT required',code:'401'}};const rows=server.table(tname),match=r=>st.filters.every(f=>f(r));
   if(st.op==='insert'){const list=Array.isArray(st.vals)?st.vals:[st.vals],out=[];
    for(const v of list){
     if(v.id!==undefined&&rows.some(r=>r.id===v.id))return {data:null,error:{code:'23505',message:'duplicate key'}};
     if(tname==='products'&&v.data.barcode&&rows.some(r=>r.data.barcode===v.data.barcode))return {data:null,error:{code:'23505',message:'products_barcode_uq'}};
     if(tname==='suppliers'&&rows.some(r=>String(r.data.name).toLowerCase()===String(v.data.name).toLowerCase()))return {data:null,error:{code:'23505',message:'suppliers_name_uq'}};
     const row={...cp(v),id:v.id??uid()};
     if(tname==='app_sessions'){if(!v.user_id)return {data:null,error:{code:'23502',message:'null value in column "user_id" violates not-null constraint'}};if(v.user_id!==me.session.user.id)return {data:null,error:{code:'42501',message:'RLS'}};row.started_at=row.last_seen=new Date().toISOString();row.revoked_at=null;row.ended_at=null}
     rows.push(row);server.emit(tname,'INSERT',cp(row));out.push(cp(row))}
    return {data:st.sel?out:null,error:null}}
   if(st.op==='update'){const out=[];for(const r of rows.filter(match)){const old=cp(r);Object.assign(r,cp(st.vals));server.emit(tname,'UPDATE',cp(r),old);out.push(cp(r))}return {data:st.sel?out:null,error:null}}
   if(st.op==='delete'){for(const r of rows.filter(match)){rows.splice(rows.indexOf(r),1);server.emit(tname,'DELETE',null,{id:r.id})}return {data:null,error:null}}
   let out=rows.filter(match);if(st.order)out=out.slice().sort((a,b)=>(a[st.order[0]]>b[st.order[0]]?1:-1)*(st.order[1]?1:-1));
   if(st.rng)out=out.slice(st.rng[0],st.rng[1]+1);if(st.lim)out=out.slice(0,st.lim);return {data:cp(out),error:null}};
  return api};
 return {auth,from:q,
  async rpc(name,args){
   if(name==='username_available')return {data:!server.table('profiles').some(p=>p.username===String(args.u).toLowerCase()),error:null};
   if(name==='register_push_token'){const r=server.table('push_devices'),e=r.find(x=>x.token===args.p_token);if(e)e.user_id=me.session.user.id;else r.push({id:uid(),token:args.p_token,user_id:me.session.user.id});return {data:null,error:null}}
   return {data:null,error:{message:'rpc desconocida'}}},
  channel(){const ch={on(t,f,cb){c.listeners.push({table:f.table,cb});return ch},subscribe(){return ch}};return ch},
  removeChannel(){c.listeners.length=0}};
}
module.exports={Server,client};
