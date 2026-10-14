// Lector de códigos de barras con la cámara del celular. NUNCA simula una lectura.
// Camino 1: BarcodeDetector nativo (Chrome/Edge en Android y PC). Camino 2: librería ZXing cargada desde CDN
// (Safari/iPhone, Firefox): PREPARADO pero SIN PROBAR en este entorno (no hay cámara). Siempre existe la entrada manual.
// La cámara solo funciona con https (Vercel lo da) y si el navegador/host la permite.
const norm=c=>{c=String(c||'').trim();return /^\d+$/.test(c)?c.replace(/^0+/,''):c.toUpperCase()};
const findByCode=c=>c?db.prod.find(p=>p.barcode&&norm(p.barcode)===norm(c)):null;
let EDP=0;
const SC={stream:null,timer:0,cb:null,done:true,reader:null,ctl:null};
const FORMATS=['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf'];
function scStop(){SC.done=true;clearTimeout(SC.timer);try{SC.ctl&&SC.ctl.stop()}catch(e){}try{SC.reader&&SC.reader.reset&&SC.reader.reset()}catch(e){}SC.ctl=null;SC.reader=null;if(SC.stream){SC.stream.getTracks().forEach(t=>t.stop());SC.stream=null}const o=$('#scs');if(o)o.remove()}
function scFinish(code){if(SC.done)return;const cb=SC.cb;scStop();code=String(code).trim().replace(/[^\w.\-]/g,'');if(cb&&code)cb(code)}
const scMsg=t=>{const e=$('#scm');if(e)e.textContent=t};
function scanBarcode(cb){scStop();SC.cb=cb;SC.done=false;
 const o=document.createElement('div');o.id='scs';o.className='sheet';o.style.zIndex=12;
 o.innerHTML=`<div><h2>📷 Escanear código de barras</h2><video id="scv" playsinline muted style="width:100%;max-height:45vh;border-radius:16px;background:#000;object-fit:cover"></video><p class="mut" id="scm">Pidiendo acceso a la cámara…</p><button class="btn s" id="scnew" style="display:none" onclick="window.open(location.href,'_blank')">Abrir la app en una pestaña nueva</button><label>O escribí el código</label><input id="scman" class="bigin" inputmode="numeric" placeholder="Ej: 7791234567890"><button class="btn" onclick="scManual()">Usar este código</button><button class="btn s" onclick="scStop()">Volver</button></div>`;
 document.body.appendChild(o);scStart()}
function scManual(){const c=$('#scman').value.trim();if(c.length<4)return scMsg('Escribí un código válido (mínimo 4 caracteres).');scFinish(c)}
async function scStart(){
 try{
  if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia))throw new Error('Este navegador no permite usar la cámara (hace falta https).');
  SC.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  if(SC.done){scStop();return}
  const v=$('#scv');
  if('BarcodeDetector' in window){
   v.srcObject=SC.stream;await v.play();scMsg('Apuntá la cámara al código de barras.');
   const det=new BarcodeDetector({formats:FORMATS});
   const tick=async()=>{if(SC.done)return;try{const r=await det.detect(v);if(r.length)return scFinish(r[0].rawValue)}catch(e){}SC.timer=setTimeout(tick,200)};tick();
  }else{SC.stream.getTracks().forEach(t=>t.stop());SC.stream=null;scMsg('Preparando lector…');await scZxing(v)}
 }catch(e){scMsg(scErr(e));const b=$('#scnew');if(b&&b.style&&window.top!==window.self)b.style.display='block'}
}
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('No se pudo cargar el lector alternativo.'));document.head.appendChild(s)})}
async function scZxing(v){
 if(!window.ZXing)await loadScript('https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js');
 const Z=window.ZXing,h=new Map();h.set(Z.DecodeHintType.POSSIBLE_FORMATS,[Z.BarcodeFormat.EAN_13,Z.BarcodeFormat.EAN_8,Z.BarcodeFormat.UPC_A,Z.BarcodeFormat.UPC_E,Z.BarcodeFormat.CODE_128,Z.BarcodeFormat.CODE_39]);
 SC.reader=new Z.BrowserMultiFormatReader(h);
 SC.ctl=await SC.reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'}}},v,res=>{if(res)scFinish(res.getText())});
 scMsg('Apuntá la cámara al código de barras.');
}
// Escaneo desde la ficha del producto: rellena el campo y evita duplicados.
function scanForForm(){scanBarcode(code=>{const inp=$('#f_barcode'),m=$('#bcm'),ex=findByCode(code);if(inp)inp.value=code;
 if(ex&&ex.id!==EDP){if(m)m.innerHTML='⚠️ Ese código ya está registrado en <b>'+esc(ex.name)+'</b>. <button class="btn s" onclick="editProd('+ex.id+')">Abrir ese producto</button>';return}
 if(EDP){const p=db.prod.find(x=>x.id===EDP);if(p&&p.barcode!==code){log('Asoció código de barras',p.name,p.barcode||'—',code);p.barcode=code;save()}}
 if(m)m.textContent=EDP?'✅ Código guardado en la ficha.':'✅ Código leído. Completá la ficha y tocá Guardar.'})}
// Escaneo desde Productos: abre la ficha o ofrece crear el producto.
function scanProducts(){scanBarcode(code=>{const p=findByCode(code);if(p)return stockQuick(p.id);
 sheet(`<h2>Producto no encontrado</h2><div class="card">Código detectado: <b>${esc(code)}</b><div class="mut">Todavía no hay un producto con este código.</div></div><button class="btn big" onclick="editProd(0,false,'${esc(code)}')">CREAR NUEVO PRODUCTO</button><button class="btn s" onclick="closeSheet()">Volver</button>`)})}
function scErr(e){const n=e&&e.name,fr=window.top!==window.self;
 if(n==='NotAllowedError'||n==='SecurityError')return 'No hay permiso para usar la cámara. Puede ser que no lo hayas permitido (tocá el candado o los ajustes del navegador junto a la dirección → Cámara → Permitir y volvé a tocar ESCANEAR)'+(fr?', o que la app esté abierta dentro de otra página (como Claude), que bloquea la cámara: abrila en su propia pestaña.':'.')+' Mientras tanto podés escribir el código abajo.';
 if(n==='NotFoundError'||n==='OverconstrainedError')return 'Este dispositivo no tiene una cámara disponible. Escribí el código abajo.';
 if(n==='NotReadableError')return 'La cámara está siendo usada por otra aplicación. Cerrala y probá de nuevo, o escribí el código abajo.';
 return (e&&e.message?e.message:'No se pudo usar la cámara.')+' Podés escribir el código abajo.'}
