# LUCERITO — gestión interna del negocio familiar

Aplicación para usar desde el celular y la computadora: productos con código de barras, stock, vencimientos, aumentos del día, proveedores, pedidos, mercadería recibida, pagos diarios, notas, calculadora del día, historial, papelera y usuarios. Varias personas trabajan a la vez con sus propias cuentas y ven los mismos datos.

## 1. Qué es cada cosa (no son lo mismo)

| # | Concepto | Qué es | Quién lo maneja |
|---|---|---|---|
| 1 | **Código fuente** | Los archivos de este proyecto | Quien administra el código |
| 2 | **GitHub** | Donde se guarda el código (repositorio privado) | Quien administra el código |
| 3 | **Vercel** | Donde se publica la app y corren los avisos automáticos | Quien administra el código |
| 4 | **Artifact de Claude** | Una vista de prueba dentro de Claude. Funciona en MODO LOCAL | Quien lo creó |
| 5 | **Aplicación LUCERITO** | El enlace que usa el equipo (el que da Vercel) | Todas las personas autorizadas |
| 6 | **Autenticación** | "¿Quién es esta persona?" (correo + contraseña). Lo hace **Supabase Auth** | Supabase |
| 7 | **Permisos internos** | "¿Qué puede hacer?" (administradora o usuaria). Los aplica la base de datos | Gabi |
| 8 | **Base de datos** | Donde viven todos los datos compartidos (**Supabase / PostgreSQL**) | Supabase |
| 9 | **Servicio de email** | Envía el correo de recuperación de contraseña (SMTP de Supabase) | Supabase + tu proveedor |
| 10 | **Servicio de notificaciones** | Envía avisos al celular (**Firebase Cloud Messaging**) | Firebase |

Usar la app NO da acceso al código, a GitHub, a Vercel, a Supabase ni a Firebase.

## 2. Arquitectura

```
Celulares / computadoras (LUCERITO, frontend)
        │  correo + contraseña            ┌── Supabase Auth (cuentas, recuperación por correo)
        ├────────────────────────────────►│
        │  datos + tiempo real (RLS)      ├── Supabase PostgreSQL (UNA sola fuente de datos)
        ├────────────────────────────────►│        productos, stock, pedidos, historial, papelera, perfiles…
        │  "pasó algo" (con su sesión)    └──────────────────────────┐
        ▼                                                            │
Vercel Functions (api/)  ── clave privada ──► Firebase Cloud Messaging ──► celulares
   · /api/notify       avisos al momento (stock agotado, aumento, mercadería, pedido)
   · /api/cron-alerts  avisos diarios (vencimientos, pedidos de hoy y mañana, stock)
```

- **Fuente de verdad:** la base central. El navegador solo guarda la sesión; los datos no se guardan en `localStorage` en modo conectado.
- **Tiempo real:** si Cami cambia el stock, Gabi lo ve sin recargar (Supabase Realtime).
- **Identidad:** depende de la cuenta, no del dispositivo.
- **Autenticación y permisos están separados:** `src/js/auth.js` + `remote.js` (quién es) y `src/js/permissions.js` + reglas RLS de `db/schema.sql` (qué puede hacer).

### Modo local y modo conectado
- **Sin** `SUPABASE_URL` y `SUPABASE_ANON_KEY`: **MODO LOCAL** (demostración). Todo funciona pero los datos quedan en ese dispositivo y NO se comparten. La app lo avisa en Inicio. Es lo que muestra el Artifact de Claude.
- **Con** las variables: **MODO CONECTADO**. Cuentas reales, datos compartidos y tiempo real.

## 3. Qué hace la base de datos (`db/schema.sql`)
- `profiles` (cuenta: usuario, nombre, foto, rol, activa, preferencias de avisos), `app_settings`, y una tabla por tipo de dato: `products`, `suppliers`, `orders`, `receipts`, `payments`, `expenses`, `notes`, `price_changes`, `trash_items`, `permission_requests`, `audit_log`, más `app_sessions` y `push_devices`.
- Cada tabla de datos tiene `id`, `version`, fechas y quién, y un campo `data` (JSON) con el resto. Es una estructura mixta, simple de mantener. Los códigos de barras y los proveedores no se pueden repetir (índices únicos).
- **Reglas RLS (permisos reales en la base):**
  - Solo cuentas **activas** leen y escriben datos del negocio.
  - Solo la **administradora** cambia roles y estados, ve todas las sesiones, cambia la configuración y **elimina definitivamente** de la papelera.
  - El **historial** solo permite agregar y leer: nadie lo modifica ni lo borra desde la app.
  - Una usuaria no puede cambiarse el rol ni el estado.
- **Cambios al mismo tiempo:** cada registro tiene `version`. Si dos personas editan lo mismo a la vez, gana la primera en llegar y la otra ve su versión con un aviso. El historial no se pierde.
- La **primera cuenta** que se crea queda como administradora (que sea Gabi). Las siguientes quedan **pendientes** hasta que Gabi las active en Usuarios (`approve = true` por defecto).

## 4. Puesta en marcha, paso a paso

### 4.1 Supabase (base + cuentas + correo)
1. Creá una cuenta en supabase.com → **New project** (elegí una región cercana, anotá la contraseña de la base).
2. **SQL Editor → New query**: pegá TODO `db/schema.sql` y tocá **Run**. Debe terminar sin errores.
3. **Project Settings → API**: copiá **Project URL** (→ `SUPABASE_URL`), **anon public** (→ `SUPABASE_ANON_KEY`) y **service_role** (→ `SUPABASE_SERVICE_ROLE_KEY`, SECRETA, solo para Vercel).
4. **Authentication → URL Configuration**: en *Site URL* poné el enlace de la app en Vercel y agregalo también en *Redirect URLs* (si no, el enlace del correo de recuperación no funciona).
5. **Authentication → Providers → Email**: dejá activado el correo. Si activás "Confirm email", cada persona deberá confirmar su correo al registrarse.
6. **Correo (recuperación de contraseña):** el correo de prueba de Supabase tiene límites muy bajos. Para uso real: **Project Settings → Authentication → SMTP Settings** y cargá un proveedor (Resend, Brevo, SendGrid, Gmail con contraseña de aplicación…). Sin SMTP propio, el correo de recuperación puede no llegar.
7. Registrá primero la cuenta de **Gabi** (será la administradora). Después el resto se registra y Gabi las activa.
8. Cuando todas tengan cuenta, podés cerrar los registros nuevos: **Authentication → Sign In / Providers → desactivar "Allow new users to sign up"**.

### 4.2 Firebase (notificaciones push)
1. console.firebase.google.com → **Add project**.
2. **Project settings → General → Your apps → Web (</>)**: registrá una app web. Copiá `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` (son públicos) → variables `FIREBASE_*`.
3. **Project settings → Cloud Messaging → Web Push certificates → Generate key pair**: copiá la clave → `FIREBASE_VAPID_KEY`.
4. **Project settings → Service accounts → Generate new private key**: baja un archivo JSON. Su contenido (todo el texto) va en `FIREBASE_SERVICE_ACCOUNT`, solo en Vercel. **Nunca lo subas a GitHub.**

### 4.3 GitHub
```bash
git init && git add . && git commit -m "Lucerito"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/lucerito.git
git push -u origin main
```
Creá antes el repositorio **privado** y vacío. `.env` y `dist` ya están ignorados. **Subí todo el proyecto, incluido `api/`, `db/` y `public/`.**

### 4.4 Vercel
1. vercel.com → **Add New → Project** → elegí el repositorio.
2. **Environment Variables**: cargá todas las de la tabla de abajo.
3. **Deploy**. Cada `git push` vuelve a publicar.
4. Copiá el enlace que da Vercel y ponelo en Supabase (paso 4.1.4).
5. Los avisos diarios corren solos (**Cron**, 11:00 UTC = 08:00 en Argentina). Hace falta `CRON_SECRET`.

### 4.5 Variables de entorno
| Variable | Dónde | Pública | Para qué |
|---|---|---|---|
| `SUPABASE_URL` | Vercel (build y servidor) | sí | Conectar con la base |
| `SUPABASE_ANON_KEY` | Vercel (build) | sí | Clave pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | **NO** | El servidor lee los celulares registrados |
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` | Vercel (build) | sí | Configuración web de Firebase |
| `FIREBASE_VAPID_KEY` | Vercel (build) | sí | Clave web push |
| `FIREBASE_SERVICE_ACCOUNT` | Vercel | **NO** | El servidor envía las notificaciones |
| `CRON_SECRET` | Vercel | **NO** | Protege el aviso diario (inventá una clave larga) |
| `APP_TIMEZONE` | Vercel | no | Zona horaria (por defecto `America/Argentina/Mendoza`) |

## 4.6 Si una cuenta "no se reconoce" (guía rápida)
Las cuentas son permanentes: se crean una sola vez y quedan guardadas. Si la app vuelve a pedir crear una cuenta, revisá:
1. **¿Está en MODO CONECTADO?** En modo local, la pantalla de ingreso muestra "Modo local: las cuentas se guardan solo en este dispositivo". Si lo ves en la app publicada en Vercel, es que **faltaron `SUPABASE_URL` y `SUPABASE_ANON_KEY` al compilar**. Cargalas en Vercel (Settings → Environment Variables) y volvé a desplegar (**Deployments → ⋯ → Redeploy**): se compilan dentro de la app, no alcanza con guardarlas.
2. **¿Se ejecutó `db/schema.sql`?** Sin eso las cuentas existen pero no tienen perfil, y la app lo avisa.
3. **¿Está activado "Confirm email"?** Si sí, cada persona debe abrir el correo de confirmación antes de ingresar.
4. **¿La cuenta está pendiente?** Las cuentas nuevas esperan que Gabi las active en Usuarios.
5. **¿Es el mismo navegador?** En modo local, cada navegador/dispositivo tiene sus propias cuentas. En modo conectado, no.
6. **¿Navegación privada o almacenamiento bloqueado?** Ahí no se puede recordar la sesión: la app avisa "Los datos NO se están guardando" y hay que ingresar cada vez.

**Cómo se conserva la sesión:** en modo conectado la recuerda **Supabase Auth** (queda en el navegador hasta que la persona toca CERRAR SESIÓN o la administradora se la cierra). En modo local la app recuerda la sesión del dispositivo de la misma manera. Los usuarios locales y los de Supabase **nunca se mezclan**.

## 5. Recuperación de contraseña
En modo conectado usa **Supabase Auth**: la persona toca "¿Olvidaste tu contraseña?", escribe su correo, Supabase envía un **enlace seguro y temporal**, lo abre en la app, escribe y repite la nueva contraseña y vuelve al ingreso. La app **no** dice que se envió un correo si Supabase devolvió un error: muestra el error. Requiere SMTP (paso 4.1.6).
En modo local solo existe una prueba (código en pantalla con `DEV_SHOW_CODE=true`), que no es seguridad real.

## 6. Notificaciones push
- En **Configuración → Notificaciones** cada persona activa su celular (pide permiso, registra el dispositivo y lo asocia a su cuenta) y elige qué tipos de aviso quiere: vencimientos, stock bajo, sin stock, aumentos, pedidos, mercadería, otros.
- **Al momento:** cuando alguien deja un producto en 0, registra un aumento, recibe mercadería o crea un pedido, la app avisa a `/api/notify` con su sesión y el servidor envía a las demás personas.
- **Todos los días:** `/api/cron-alerts` avisa de productos por vencer, pedidos que llegan hoy y mañana, y stock agotado o bajo.
- Son notificaciones del sistema (service worker `firebase-messaging-sw.js`) y llegan con la app cerrada. Al tocarlas abren la pantalla correspondiente.
- **iPhone:** hay que agregar LUCERITO a la pantalla de inicio (Compartir → Agregar a inicio) y activar los avisos desde ahí.
- La clave privada de Firebase solo vive en Vercel; en el navegador solo hay datos públicos.

## 7. Estado de lo implementado y probado
| Parte | Estado |
|---|---|
| Pantallas y lógica (todas las secciones) | Probado con la prueba automática |
| Sincronización entre dos dispositivos, conflictos, papelera central, sesiones, recuperación, aviso diario (cálculo) | Probado contra un **Supabase simulado** (`scripts/fake-supabase.js`) |
| `db/schema.sql` y reglas RLS | **No probado** contra un Supabase real |
| Conexión real a Supabase, correo SMTP, Firebase, Vercel Cron, cámara | **No probado** (hace falta tu cuenta) |

Probalo en este orden con tu proyecto real: registrarte → crear un producto → abrirlo desde otro celular → recuperar contraseña → activar avisos.

## 8. Límites conocidos
- **Sesiones:** al cerrar la sesión de otra persona, su app se desconecta enseguida, pero el acceso técnico de Supabase sigue válido hasta que vence. Para bloquear por completo, **desactivala** en Usuarios.
- **Eliminar una cuenta para siempre** se hace en Supabase → Authentication (desde la app solo se desactiva).
- **Stock simultáneo:** si dos personas cambian el mismo producto en el mismo instante, una ve el aviso de conflicto y repite. No hay ventas conectadas, así que el stock no baja solo.
- **Fotos de perfil:** se guardan chicas (160 px) dentro del perfil.
- **Librerías de internet:** la app carga `supabase-js` (jsDelivr) y Firebase (gstatic). Para máxima estabilidad conviene incluirlas con npm en el build.
- **Sin conexión:** en modo conectado no se pueden guardar cambios sin internet.
- **Cámara de códigos de barras:** usa el lector del navegador (Chrome) o ZXing en Safari; hace falta https y permiso. Sin probar con cámara real.

## 9. Estructura del proyecto
```
src/js/services.js     modo local: Store/Auth/Mailer (demo)
src/js/remote.js       modo conectado: Supabase (cuentas, datos, tiempo real, sesiones)
src/js/push.js         notificaciones push (Firebase)
src/js/auth.js         ingreso, registro, recuperación (autenticación)
src/js/permissions.js  permisos (autorización)
src/js/…               datos, historial, páginas, formularios, stock, papelera, usuarios, perfil, configuración
api/notify.js          aviso al momento (servidor)
api/cron-alerts.js     aviso diario (servidor)
api/_lib.js, _alerts.js  utilidades del servidor
db/schema.sql          tablas, relaciones, reglas de seguridad y tiempo real
public/                service worker, manifiesto e íconos (reemplazá los íconos por tu logo)
scripts/               build y pruebas (npm test)
```

## 10. Comandos
```bash
npm install     # instala las dependencias del servidor (api/)
npm run dev     # http://localhost:3000 (la cámara funciona en localhost)
npm run build   # arma dist/
npm test        # pruebas automáticas
```

## Migraciones de la base de datos (Supabase)
`db/schema.sql` se ejecuta UNA sola vez en un proyecto nuevo. Los cambios posteriores van en `db/migrations/`, son **solo aditivos** (no borran ni modifican datos) y se pueden ejecutar más de una vez sin problema.

| Archivo | Para qué sirve | ¿Obligatoria? |
|---|---|---|
| `db/migrations/001_calc_entries.sql` | Crea la tabla `calc_entries` donde se guardan, de forma compartida, los importes de la **calculadora del día** (sección Pedidos). | Sí, para que la calculadora guarde. Mientras no se ejecute, la app funciona igual y la calculadora muestra un aviso. |

Cómo ejecutarla: Supabase → **SQL Editor** → **New query** → pegar el contenido del archivo → **Run**.

## Notas de esta versión
- **Pagos diarios**: la sección antes llamada "Pagos" ahora se llama "Pagos diarios". No cambian sus datos.
- **Gastos**: ya no aparece en el menú, Inicio, Jornada ni "Agregar rápido". La tabla `expenses` y todos sus registros siguen en Supabase y en la papelera; solo se ocultó la pantalla.
- **Vencimientos por lote**: cada producto puede tener varias fechas. Se guardan dentro del producto (no requiere migración) y `venc` del producto sigue siendo la fecha más próxima, por eso las alertas no cambian.
- **Cerrar sesión**: cierra solo el dispositivo donde se toca el botón (`signOut` con alcance `local`); no cierra las demás sesiones de esa cuenta ni las de otras usuarias.
- **Pedidos con estado automático**: un pedido nuevo queda "Agregado" (se muestra "Agregado hoy" el día que se anota). Al llegar su fecha de llegada pasa solo a "En camino" y ellas lo marcan "Recibido". El estado automático se calcula al mostrar (no se guarda), así no se pisan los cambios entre usuarias. La fecha de llegada puede quedar vacía.
- **Calculadora que suma sola**: en Pedidos, el total del día suma el importe de los pedidos que se anotaron ese día. Los "importes sueltos" siguen disponibles (opcional) y se suman al total.
- **Pedido recibido → Mercadería recibida**: al marcar un pedido "Recibido" pasa a Mercadería recibida y se abre la ficha para cargar qué llegó: buscar o escanear cada producto (o crearlo en el momento con su código), cantidad, foto chica y vencimiento. Suma stock y carga el vencimiento en el producto, así la app avisa. No requiere migración de base de datos.

## Cambios: stock rápido, menú e importes
- **Stock rápido** (`src/js/stock.js`): al escanear un producto existente o abrir su ficha aparece el stock actual grande con **➖ SALIDA** / **ENTRADA ➕** (cantidad por toque editable, 1 por defecto). Usa `stockMove`: queda en el historial, se sincroniza por Supabase (mismos datos del producto, sin tablas nuevas) y el aviso **🔴 STOCK BAJO** / **🚨 SIN STOCK** aparece al instante (stock ≤ mínimo; 0 = sin stock). Con ENTRADA por encima del mínimo, el aviso desaparece. La ficha completa del producto sigue igual.
- **Menú**: "Pagos diarios" e "Historial & Memoria" ya no están en el menú; siguen funcionando desde las tarjetas de Inicio y no se borró ningún dato.
- **Importes** (`src/js/data.js`): `money()` muestra `$14.000` / `$14.500,50`; `parseAR()` entiende `14000`, `14.000`, `14,000` (catorce mil), `14.500,50`. Los campos de importe ahora son de texto decimal (antes `type=number`, que dependía del idioma del teléfono).
- **Migración 001_calc_entries.sql**: la calculadora ya suma sola desde los pedidos; la tabla solo sirve para "importes sueltos" opcionales. No es necesaria para el funcionamiento normal (no se eliminó). No hay migraciones nuevas.
