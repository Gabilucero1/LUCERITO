// Permisos. AVISO: solo controlan la pantalla. Un permiso real se verifica en el servidor (ver README).
// Las usuarias tienen permisos operativos amplios. Solo la administradora gestiona cuentas, permisos y seguridad.
const RQ={users:'Administrar usuarios o permisos',otro:'Otra acción',del:'Eliminar un registro',date:'Cambiar la fecha de un registro',cig:'Anotar o editar el conteo de cigarrillos (por hoy)'};
const RQ_OPT=['users','cig','otro'];
const ADMIN_ONLY=['users','perms','sessions','purge','config'];
const can=a=>!!me&&(!!me.admin||!ADMIN_ONLY.includes(a)||!!(me.grants&&me.grants[a]>0));
const useGrant=a=>{if(!me||me.admin||!me.grants)return;if(me.grants[a]>0){me.grants[a]--;save()}};

// Cigarrillos: anota y edita la administradora. Otra usuaria solo si la administradora le aprobó la solicitud, y vale solo el día de la aprobación.
const cigCan=()=>!!me&&(!!me.admin||db.reqs.some(r=>r.uid===me.id&&r.k==='cig'&&r.st==='Aprobada'&&r.ad===iso()));
