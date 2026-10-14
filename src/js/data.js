const $=s=>document.querySelector(s);
const KEY=(typeof ENV!=='undefined'&&ENV.STORAGE_KEY)||'lucerito_v1';
const seed=()=>({users:[],prod:[],sup:[],ped:[],merc:[],pagos:[],gastos:[],calc:[],notas:[],alerts:[],trash:[],resets:[],log:[],n:10});
let db,me=null,view='home',menuOpen=false;
db=Store.load();
if(!db)db=seed();
db.cfg=Object.assign({offerDays:10,notif:false,notifAum:true},db.cfg||{});db.reqs=db.reqs||[];db.calc=db.calc||[];db.users=(db.users||[]).filter(u=>u.email&&u.hash);db.trash=db.trash||[];db.resets=db.resets||[];db.alerts=db.alerts||[];

const save=()=>Store.save(db);
const iso=(d=new Date())=>{const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())};
const fd=s=>s?s.split('-').reverse().join('/'):'—';
const hm=()=>new Date().toTimeString().slice(0,5);
// Dinero argentino. money() muestra $14.000 / $14.500,50. parseAR() entiende lo que escribe la persona:
// 14000 · 14.000 · 14,000 (catorce mil) · 14.500,50 · 1500,5 · 0,125. Nunca agrega ceros delante.
const money=n=>'$'+Number(n||0).toLocaleString('es-AR',{maximumFractionDigits:2,useGrouping:'always'});
const parseAR=s=>{s=String(s==null?'':s).replace(/[\s$]/g,'');if(!s)return NaN;
 if(s.includes(',')&&s.includes('.')){s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'')}
 else if(s.includes(',')){s=/^[1-9]\d{0,2}(,\d{3})+$/.test(s)?s.replace(/,/g,''):s.replace(',','.')}
 else if(/^[1-9]\d{0,2}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
 return /^\d+(\.\d+)?$/.test(s)?Math.round(Number(s)*100)/100:NaN};
const numVal=s=>{const n=parseAR(s);return isNaN(n)?0:n};
const numIn=v=>v==null||v===''?'':String(v).replace('.',',');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dev=()=>{const u=navigator.userAgent;return (/iPhone|iPad/.test(u)?'iOS':/Android/.test(u)?'Android':'PC')+' · '+(screen.width+'x'+screen.height)};
let _lastId=0;
// ids únicos entre dispositivos (no un contador local): hora + azar
const nid=()=>{let v=Date.now()*1000+Math.floor(Math.random()*1000);if(v<=_lastId)v=_lastId+1;_lastId=v;return v};
const days=s=>Math.round((new Date(s+'T00:00:00')-new Date(iso()+'T00:00:00'))/864e5);
const vstate=p=>{if(!p.venc)return null;const d=days(p.venc);return d<0?{t:'VENCIDO',c:'var(--warn)'}:d<=7?{t:d===0?'VENCE HOY':'VENCE EN '+d+' DÍAS',c:'var(--y)'}:{t:'EN FECHA',c:'var(--ok)'}};
const soon=()=>db.prod.filter(p=>p.venc&&days(p.venc)<=db.cfg.offerDays).sort((a,b)=>a.venc<b.venc?-1:1);
const todayPrice=()=>db.alerts.filter(a=>a.d===iso());
const aumentosHoy=()=>db.alerts.filter(a=>a.d===iso()&&a.nw>a.old);
db.alerts.forEach(a=>{if(!a.id)a.id=nid()});db.log.forEach(l=>{if(!l.id)l.id=nid()});db.trash.forEach(t=>{if(!t.id)t.id=t.tid||nid()});
