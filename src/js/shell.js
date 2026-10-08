function go(v){view=v;menuOpen=false;render();scrollTo(0,0)}
function render(){
 if(me&&!touchSess())return forceOut();
 if(!me)return login();
 const cur=NAV.find(n=>n[0]===view);
 $('#app').innerHTML=`<header><button class="ib" onclick="menuOpen=true;render()" aria-label="Menú">☰</button><h1>LUCERITO<small>ALMACÉN &amp; MÁS</small></h1><button class="ib av" onclick="go('perfil')" aria-label="Mi perfil">${avatar(me)}</button></header><main>${Store.ok===false?'<div class="card" style="border-left:6px solid var(--warn)"><b>⚠️ Los datos NO se están guardando</b><div class="mut">Este navegador bloquea el almacenamiento. Abrí la app en su propio enlace o pestaña.</div></div>':''}${view==='home'&&!Remote.on?LOCALBN:''}${page()}</main>${bnav()}${menuOpen?menu():''}`;
}
function menu(){return `<div class="sheet" onclick="menuOpen=false;render()"><div class="menu" onclick="event.stopPropagation()"><h2>Menú</h2>${NAV.filter(n=>n[0]!=='users'||me.admin).map(n=>`<button class="${view===n[0]?'on':''}" onclick="go('${n[0]}')">${n[1]}  ${n[2]}</button>`).join('')}</div></div>`}
