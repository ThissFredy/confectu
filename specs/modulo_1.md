# Spec: Autenticación, onboarding y protección de rutas

**Módulo:** `modules/auth/`
**Número de spec:** 1
**Estado:** Pendiente de implementación
**Fecha:** 2026-08-18

---

## 1. Objetivo y alcance

Implementar la autenticación con Google OAuth mediante Supabase Auth, el
onboarding de taller para nuevos usuarios `CLIENT`, la protección de rutas
privadas, la resolución de roles en el servidor y los layouts privados para
`CLIENT` y `ADMIN`.

### Dentro del alcance

- Componente de login con Google.
- Ruta pública de login.
- Route handler de callback OAuth que intercambia el código por sesión.
- Manejo de sesión JWT en cookies y refresh en middleware.
- Resolución de rol (`ADMIN` / `CLIENT`) en el servidor.
- Onboarding de taller en el primer inicio de sesión **solo para `CLIENT`**,
  con modal de confirmación "Taller configurado" antes de redirigir a
  `/dashboard`.
- Restricción de un solo taller por usuario mediante flag
  `workshop_setup_completed`.
- Protección de rutas privadas y restricción por rol.
- Layout privado con header, navegación y logout para `CLIENT`.
- Layout admin con header mínimo y logout para `ADMIN`.
- Landing pública mínima en `/` con botón hacia `/login`.
- Pantalla de cuenta desactivada con botón de contacto (sin funcionalidad) y
  botón "Volver al inicio".
- Server Action de logout.

### Fuera del alcance

- Contenido de marketing de la landing `/`.
- CRUD de clientes, servicios y facturas.
- Panel admin de gestión de cuentas (activar/desactivar talleres).
- Asignación del rol `ADMIN` por UI (se hace manualmente en la base de datos).
- Subida de imagen del taller en onboarding (documentada como feature futuro
  en `docs/modules.md`, sección 4.4).
- Gestión del logo del taller en Supabase Storage.

---

## 2. Actores y permisos

| Actor | Descripción | Acceso |
|---|---|---|
| Usuario no autenticado | Sin sesión activa. | Solo `/` y `/login`. |
| `CLIENT` | Propietario de un taller. | Rutas del taller bajo `(private)/`. Si no tiene taller, completa onboarding. |
| `ADMIN` | Administrador global de Confectu. | Solo rutas bajo `(admin)/admin/`. Sin onboarding. |
| Cuenta inactiva | `profiles.is_active = false` o `workshops.is_active = false`. | Pantalla `/account-disabled`. |

### Reglas de permisos

- El rol no se recibe desde formularios. Se resuelve en el servidor leyendo
  `profiles.role`.
- El rol `ADMIN` se asigna manualmente en la base de datos; no existe flujo de
  UI para asignarlo.
- `ADMIN` no pasa por onboarding.
- `CLIENT` no puede acceder a `/admin/*`.
- `ADMIN` no puede acceder a rutas del taller (`/dashboard`, `/customers`,
  `/services`, `/invoices`, `/settings`, `/onboarding`).

---

## 3. Flujo principal y flujos alternativos

### 3.1 Flujo principal: login

1. Usuario no autenticado visita `/login`.
2. Clic en "Continuar con Google".
3. Server Action `signInWithGoogle` inicia OAuth con `redirectTo` apuntando a
   `/auth/callback`.
4. Redirección a Google → pantalla de consentimiento.
5. Google redirige a Supabase Auth → Supabase redirige a `/auth/callback` con
   un `code` en la query string.
6. El route handler `/auth/callback` intercambia el `code` por una sesión,
   establece las cookies JWT y resuelve el estado del usuario.
7. Redirección según estado (ver sección 3.5).

### 3.2 Flujo alternativo: primer login de CLIENT (onboarding)

1. Tras el callback, si el usuario es `CLIENT` y
   `workshop_setup_completed = false`.
2. Redirección a `/onboarding`.
3. Usuario completa formulario (nombre comercial, prefijo de factura).
4. Server Action `completeWorkshopSetup` valida datos, crea `workshops` +
   `workshop_settings` y marca `workshop_setup_completed = true`.
5. Se muestra modal "Taller configurado".
6. Tras cerrar el modal o automáticamente, redirección a `/dashboard`.

### 3.3 Flujo alternativo: login de ADMIN

1. Tras el callback, si el usuario es `ADMIN`.
2. Redirección directa a `/admin`. Sin onboarding.

### 3.4 Flujo alternativo: cuenta inactiva

1. Tras el callback, si `profiles.is_active = false` o (si es `CLIENT`)
   `workshops.is_active = false`.
2. Redirección a `/account-disabled`.
3. Pantalla muestra mensaje de cuenta desactivada, botón "Contacto" (sin
   funcionalidad) y botón "Volver al inicio" que redirige a `/`.

### 3.5 Tabla de redirecciones tras callback

| Condición | Destino |
|---|---|
| `CLIENT` con `workshop_setup_completed = false` | `/onboarding` |
| `CLIENT` con `workshop_setup_completed = true` y cuenta activa | `/dashboard` |
| `ADMIN` con cuenta activa | `/admin` |
| Cuenta inactiva (`profiles.is_active = false`) | `/account-disabled` |
| `CLIENT` con `workshops.is_active = false` | `/account-disabled` |
| Error en intercambio de código | `/login` con mensaje de error |

### 3.6 Flujo: logout

1. Usuario clic en "Cerrar sesión" (en `PrivateHeader` o `AdminHeader`).
2. Server Action `signOut` elimina la sesión y limpia cookies.
3. Redirección a `/`.

### 3.7 Flujo: error de OAuth

1. Si Google o Supabase devuelven un error durante OAuth.
2. Redirección a `/login` con mensaje genérico "No se pudo iniciar sesión con
   Google. Intenta de nuevo."

---

## 4. Reglas de negocio

1. **Un taller por usuario**: un usuario `CLIENT` puede crear un solo taller.
   El flag `workshop_setup_completed` en `profiles` impide creaciones
   duplicadas. Una vez en `true`, el Server Action `completeWorkshopSetup`
   rechaza nuevas solicitudes.
2. **Rol no editable desde formularios**: el rol se resuelve leyendo
   `profiles.role` en el servidor. Nunca se acepta desde el cliente.
3. **ADMIN sin onboarding**: el flujo de onboarding aplica exclusivamente a
   `CLIENT`. `ADMIN` se redirige directamente a `/admin`.
4. **Campos obligatorios del onboarding**: `business_name` y `invoice_prefix`
   son obligatorios. Se capturan en el onboarding y se persisten en
   `workshop_settings`.
5. **Validación de prefijo**: `invoice_prefix` debe ser de 1 a 3 caracteres
   alfanuméricos en mayúscula. Validación duplicada en Server Action y
   restricción `CHECK` de la base de datos.
6. **Cuenta inactiva**: si `profiles.is_active = false` o
   `workshops.is_active = false`, el usuario puede autenticarse con Google
   pero no accede a rutas privadas. Ve `/account-disabled`.
7. **Reserva de consecutivo**: `workshop_settings.next_invoice_number` se
   inicializa en `1` al crear el taller. La reserva segura al emitir facturas
   se implementa en el spec del módulo de facturas.

---

## 5. Estados y transiciones

### 5.1 Sesión

```text
no autenticado ──login──> autenticado ──logout──> no autenticado
                              │
                              ├── onboarding (CLIENT sin taller)
                              ├── activo (CLIENT con taller o ADMIN)
                              └── inactivo (cuenta desactivada)
```

### 5.2 Onboarding (solo CLIENT)

```text
pendiente (workshop_setup_completed = false)
   │
   ├── completeWorkshopSetup exitoso
   │     └── completado (workshop_setup_completed = true)
   │           └── modal "Taller configurado" ──> /dashboard
   │
   └── error de validación
         └── permanece en /onboarding con mensaje
```

### 5.3 Cuenta

```text
activa ──ADMIN desactiva──> inactiva ──> /account-disabled
```

La transición activa → inactiva la gestiona `ADMIN` fuera de este spec.

---

## 6. Modelo de datos afectado

### 6.1 Migración nueva

Se crea una migración versionada que añade una columna a `public.profiles`:

- **Columna**: `workshop_setup_completed`
- **Tipo**: `boolean not null default false`
- **Propósito**: indicar si el usuario `CLIENT` ya creó su taller. Impide
  creaciones duplicadas.

La migración no modifica las políticas RLS existentes de `profiles`. El
usuario ya puede hacer `update` de su propia fila (política
`profiles_update`), por lo que el Server Action puede marcar el flag a
`true`.

### 6.2 Tablas existentes utilizadas

- `profiles`: lectura de rol, `is_active` y `workshop_setup_completed`.
- `workshops`: inserción del taller del usuario.
- `workshop_settings`: inserción de la configuración inicial del taller.

### 6.3 Creación del taller

La creación de `workshops` + `workshop_settings` se hace vía Server Action
con el cliente Supabase autenticado. RLS ya permite:

- `workshops_insert`: `with check (owner_id = auth.uid())`.
- `workshop_settings_insert`: `with check (workshop_id = current_workshop_id()
  or is_admin())`.

La operación debe ser atómica: si falla la inserción de `workshop_settings`,
no debe quedar un `workshops` huérfano. Se recomienda usar una función SQL
`security definer` o ejecutar ambas inserciones en una transacción
controlada desde el Server Action.

### 6.4 Valores por defecto del taller inicial

| Campo | Valor inicial |
|---|---|
| `workshops.owner_id` | `auth.uid()` del usuario. |
| `workshops.is_active` | `true` (default de la tabla). |
| `workshop_settings.business_name` | Valor ingresado en el onboarding. |
| `workshop_settings.invoice_prefix` | Valor ingresado en el onboarding. |
| `workshop_settings.next_invoice_number` | `1` (default de la tabla). |
| `workshop_settings.tax_id`, `phone`, `email`, `address` | `null` (opcionales). |
| `workshop_settings.payment_instructions` | `null` (opcional). |
| `workshop_settings.logo_path` | `null` (opcional; feature futuro). |

---

## 7. Reglas de aislamiento multi-tenant y RLS

1. **Middleware refresca sesión**: en cada request, el middleware invoca
   `supabase.auth.getUser()` y `supabase.auth.setSession()` para mantener las
   cookies JWT vigentes.
2. **Resolución server-side**: el rol, el estado de la cuenta y el estado de
   onboarding se resuelven en el servidor (Server Components, Server Actions
   y route handler) usando el cliente Supabase autenticado. Nunca se confía
   en datos del cliente.
3. **Validación en Server Actions**: toda Server Action valida sesión activa
   antes de ejecutar lógica. Si no hay sesión, retorna error.
4. **RLS existente no se relaja**: las políticas de `profiles`, `workshops` y
   `workshop_settings` ya garantizan que un usuario solo puede leer y
   modificar sus propios datos. No se añaden políticas que permitan acceso
   cruzado entre talleres.
5. **Service role key**: no se expone en componentes cliente. Solo se usa en
   el servidor si es estrictamente necesario.

---

## 8. Validaciones funcionales

### 8.1 Onboarding (`completeWorkshopSetup`)

| Campo | Regla |
|---|---|
| `business_name` | No vacío tras `trim`. Máximo 255 caracteres. |
| `invoice_prefix` | 1 a 3 caracteres alfanuméricos en mayúscula. Regex: `^[A-Z0-9]{1,3}$`. |

### 8.2 Callback (`/auth/callback`)

| Campo | Regla |
|---|---|
| `code` | Debe estar presente en la query string. Si falta, redirige a `/login` con error. |
| `next` | Si está presente, debe ser una ruta interna relativa (no URL externa). Se sanitiza antes de redirigir. |

### 8.3 Logout (`signOut`)

| Regla | Descripción |
|---|---|
| Sesión activa | El Server Action verifica que exista una sesión antes de intentar cerrarla. Si no hay sesión, redirige a `/` de todas formas. |

### 8.4 Middleware

| Regla | Descripción |
|---|---|
| Rutas públicas | `/`, `/login`, `/auth/callback`, `/account-disabled` no requieren sesión. |
| Rutas privadas | `(private)/*` requiere sesión + rol `CLIENT` + cuenta activa + onboarding completado. |
| Rutas admin | `(admin)/admin/*` requiere sesión + rol `ADMIN` + cuenta activa. |
| Onboarding | Si `CLIENT` con `workshop_setup_completed = false` accede a cualquier ruta privada que no sea `/onboarding`, se redirige a `/onboarding`. |

---

## 9. Errores y estados de la interfaz

### 9.1 Login (`/login`)

| Estado | Comportamiento |
|---|---|
| Idle | Botón "Continuar con Google" habilitado. |
| Loading | Botón muestra "Redirigiendo..." y se deshabilita durante la redirección a Google. |
| Error OAuth | Mensaje genérico "No se pudo iniciar sesión con Google. Intenta de nuevo." Botón habilitado para reintentar. |

### 9.2 Onboarding (`/onboarding`)

| Estado | Comportamiento |
|---|---|
| Idle | Formulario con campos `business_name` y `invoice_prefix`. Validación HTML5 nativa. |
| Validación inline | Errores mostrados bajo cada campo antes de enviar. |
| Loading | Botón "Crear taller" muestra "Configurando..." y se deshabilita. |
| Éxito | Modal "Taller configurado" con botón "Continuar" que redirige a `/dashboard`. |
| Error servidor | Mensaje de error bajo el formulario. Botón habilitado para reintentar. |

### 9.3 Cuenta desactivada (`/account-disabled`)

| Estado | Comportamiento |
|---|---|
| Default | Mensaje "Tu cuenta está desactivada. Contacta al administrador para reactivarla." Botón "Contacto" (sin funcionalidad, muestra tooltip o no-op). Botón "Volver al inicio" redirige a `/`. |

### 9.4 Ruta no autorizada

| Estado | Comportamiento |
|---|---|
| Sin permiso | Redirección silenciosa al home del rol (`/dashboard` para CLIENT, `/admin` para ADMIN). |

### 9.5 Placeholders de rutas futuras

| Ruta | Comportamiento |
|---|---|
| `/dashboard`, `/customers`, `/services`, `/invoices`, `/settings` | Página con texto "Próximamente" y el header del layout privado. |
| `/admin` | Página con texto "Próximamente" y el header del layout admin. |

---

## 10. Rutas y pantallas afectadas

| Ruta | Archivo | Descripción |
|---|---|---|
| `/` | `app/page.tsx` | Landing pública mínima con botón "Iniciar sesión" hacia `/login`. |
| `/login` | `app/(public)/login/page.tsx` | Página de login con botón "Continuar con Google". |
| `/auth/callback` | `app/auth/callback/route.ts` | Route handler que intercambia el código OAuth por sesión, establece cookies JWT y redirige según estado. |
| `/onboarding` | `app/(private)/onboarding/page.tsx` | Formulario de onboarding para CLIENT sin taller. |
| `/dashboard` | `app/(private)/dashboard/page.tsx` | Placeholder "próximamente". |
| `/customers` | `app/(private)/customers/page.tsx` | Placeholder "próximamente". |
| `/services` | `app/(private)/services/page.tsx` | Placeholder "próximamente". |
| `/invoices` | `app/(private)/invoices/page.tsx` | Placeholder "próximamente". |
| `/settings` | `app/(private)/settings/page.tsx` | Placeholder "próximamente". |
| `/account-disabled` | `app/account-disabled/page.tsx` | Pantalla de cuenta desactivada con botón "Contacto" y "Volver al inicio". |
| `/admin` | `app/(admin)/admin/page.tsx` | Placeholder "próximamente". |
| Layout CLIENT | `app/(private)/layout.tsx` | Layout con `PrivateHeader` (navegación de taller + logout). |
| Layout ADMIN | `app/(admin)/admin/layout.tsx` | Layout con `AdminHeader` (solo logout). |
| Middleware | `middleware.ts` | Protección de rutas, refresh de sesión, redirecciones por rol y estado. |
| Root layout | `app/layout.tsx` | Se actualiza metadata del proyecto (título y descripción). |

### Notas sobre la organización de rutas

- `app/page.tsx` queda en la raíz de `app/` como landing pública. No entra en
  ningún grupo de rutas.
- `app/(public)/` agrupa solo `/login`. No requiere layout propio; hereda el
  root layout.
- `app/auth/callback/route.ts` queda fuera de los grupos `(public)`,
  `(private)` y `(admin)` para que el middleware no lo trate como ruta
  privada ni admin.
- `app/account-disabled/` es una ruta standalone: requiere sesión (el
  usuario está autenticado pero inactivo), pero no pertenece al layout
  privado ni al admin.
- `app/(private)/` tiene su propio `layout.tsx` con `PrivateHeader`. Todas
  las rutas internas heredan ese header.
- `app/(admin)/admin/` tiene su propio `layout.tsx` con `AdminHeader`.

---

## 11. Server Actions necesarias

### 11.1 `signInWithGoogle(formData)`

- **Módulo**: `modules/auth/actions.ts`
- **Propósito**: iniciar el flujo OAuth con Google.
- **Entrada (FormData)**:
  - `next` (opcional): ruta interna a la que redirigir tras login exitoso.
    Default: `null` (el callback decide según estado).
- **Salida**: redirección (`redirect()`) a la URL de autorización de Google
  generada por `supabase.auth.signInWithIdp({ provider: 'google', options: {
  redirectTo } })`.
- **Validaciones**:
  - `next` si está presente debe ser una ruta relativa que empiece con `/`
    y no contenga `//` ni protocolo. Se sanitiza.
- **Errores**: si Supabase no devuelve una URL válida, lanza error que el
  componente captura y muestra mensaje genérico.

### 11.2 `signOut()`

- **Módulo**: `modules/auth/actions.ts`
- **Propósito**: cerrar la sesión del usuario.
- **Entrada**: ninguna.
- **Salida**: redirección a `/`.
- **Comportamiento**:
  - Llama `supabase.auth.signOut()`.
  - Independientemente del resultado, redirige a `/`.

### 11.3 `completeWorkshopSetup(formData)`

- **Módulo**: `modules/auth/actions.ts`
- **Propósito**: crear el taller y su configuración inicial, y marcar
  `workshop_setup_completed = true`.
- **Entrada (FormData)**:
  - `business_name` (obligatorio): nombre comercial del taller.
  - `invoice_prefix` (obligatorio): prefijo de factura, 1-3 caracteres
    alfanuméricos en mayúscula.
- **Salida**: objeto `AuthActionResult` con `{ success: true }` o
  `{ success: false, error: string, fieldErrors?: Record<string, string> }`.
- **Validaciones**:
  - Sesión activa (si no, retorna error).
  - Rol `CLIENT` (si es `ADMIN`, retorna error).
  - `workshop_setup_completed` debe ser `false` (si ya es `true`, retorna
    error "Ya configuraste tu taller").
  - `business_name`: no vacío tras trim, máximo 255 caracteres.
  - `invoice_prefix`: regex `^[A-Z0-9]{1,3}$`.
- **Operación atómica**:
  - Inserta `workshops` con `owner_id = auth.uid()`.
  - Inserta `workshop_settings` con `workshop_id` del taller recién creado,
    `business_name`, `invoice_prefix`, `next_invoice_number = 1`.
  - Actualiza `profiles.workshop_setup_completed = true`.
  - Si cualquier paso falla, revierte los anteriores.

---

## 12. Estructuras de `FormData` y tipos de datos

### 12.1 FormData de Server Actions

```text
signInWithGoogle:
  next?: string  (ruta interna relativa, opcional)

signOut:
  (sin campos)

completeWorkshopSetup:
  business_name: string   (obligatorio, no vacío tras trim, max 255)
  invoice_prefix: string   (obligatorio, regex ^[A-Z0-9]{1,3}$)
```

### 12.2 Tipos en `modules/auth/types.ts`

```text
AuthUser
  id: string
  email: string | null
  name: string | null
  avatarUrl: string | null

Profile
  id: string
  role: 'ADMIN' | 'CLIENT'
  isActive: boolean
  workshopSetupCompleted: boolean
  createdAt: string
  updatedAt: string

AuthState
  user: AuthUser | null
  profile: Profile | null
  status: 'unauthenticated' | 'needs_onboarding' | 'active' | 'inactive'

WorkshopSetupInput
  businessName: string
  invoicePrefix: string

AuthActionResult
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
```

### 12.3 Funciones de query en `modules/auth/queries.ts`

```text
getProfile(supabase): Promise<Profile | null>
  - Recibe el cliente Supabase autenticado.
  - Consulta profiles donde id = auth.uid().
  - Retorna el perfil o null.

resolveAuthState(supabase): Promise<AuthState>
  - Obtiene el usuario con supabase.auth.getUser().
  - Obtiene el perfil con getProfile().
  - Si no hay usuario: status = 'unauthenticated'.
  - Si hay usuario pero no perfil: status = 'unauthenticated' (caso edge).
  - Si profile.isActive = false: status = 'inactive'.
  - Si role = 'CLIENT' y workshopSetupCompleted = false: status = 'needs_onboarding'.
  - En caso contrario: status = 'active'.
```

---

## 13. Componentes de UI necesarios

### 13.1 `GoogleSignInButton`

- **Ubicación**: `modules/auth/components/GoogleSignInButton.tsx`
- **Tipo**: client component.
- **Responsabilidad**: botón "Continuar con Google" que invoca el Server
  Action `signInWithGoogle` mediante un `<form action={signInWithGoogle}>`.
- **Requisitos**:
  - Mínimo 44x44px de área táctil.
  - Estado loading: texto "Redirigiendo..." + `disabled`.
  - Usa `useFormStatus` para detectar pending.
  - Accesible: `<button type="submit">` con `aria-label` descriptivo.
  - Opcional: ícono de Google (SVG inline, sin dependencias externas).

### 13.2 `OnboardingForm`

- **Ubicación**: `modules/auth/components/OnboardingForm.tsx`
- **Tipo**: client component.
- **Responsabilidad**: formulario nativo que invoca
  `completeWorkshopSetup` mediante `<form action={completeWorkshopSetup}>`.
- **Campos**:
  - `business_name`: `<input type="text" required maxlength={255}>`.
  - `invoice_prefix`: `<input type="text" required pattern="^[A-Z0-9]{1,3}$"
    maxlength={3}>` con instrucción visible "1-3 letras o números en
    mayúscula".
- **Requisitos**:
  - Validación HTML5 nativa + validación manual en cliente antes de enviar.
  - Estado loading: botón "Crear taller" muestra "Configurando...".
  - Muestra `fieldErrors` del Server Action bajo cada campo.
  - Muestra error general del Server Action bajo el formulario.
  - Al éxito (`success: true`), muestra `WorkshopSetupSuccessModal`.
  - Mobile-first: campos a ancho completo, labels visibles.

### 13.3 `WorkshopSetupSuccessModal`

- **Ubicación**: `modules/auth/components/WorkshopSetupSuccessModal.tsx`
- **Tipo**: client component.
- **Responsabilidad**: modal de confirmación "Taller configurado" que se
  muestra tras crear el taller exitosamente.
- **Contenido**:
  - Título: "Taller configurado".
  - Mensaje: "Tu taller está listo para empezar a usar Confectu."
  - Botón "Continuar" que redirige a `/dashboard` mediante `useRouter().push`.
- **Requisitos**:
  - Overlay semitransparente que cubre la pantalla.
  - Cierre por clic en "Continuar" (no se puede cerrar con clic fuera ni
    Escape; el usuario debe confirmar).
  - Accesible: `role="dialog"`, `aria-modal="true"`, foco en el botón.
  - Mobile-first: modal a ancho completo en móvil, centrado en desktop.

### 13.4 `PrivateHeader`

- **Ubicación**: `modules/auth/components/PrivateHeader.tsx`
- **Tipo**: server component (o client si necesita interactividad de menú).
- **Responsabilidad**: header del layout privado para `CLIENT`.
- **Contenido**:
  - Nombre del taller (leído de `workshop_settings.business_name`).
  - Navegación con enlaces: `Dashboard` (`/dashboard`), `Clientes`
    (`/customers`), `Servicios` (`/services`), `Facturas` (`/invoices`),
    `Configuración` (`/settings`).
  - Componente `LogoutButton`.
- **Requisitos**:
  - Mobile-first: navegación colapsable o en barra inferior fija en móvil.
  - Enlace activo destacado según la ruta actual.
  - Touch targets mínimo 44x44px.

### 13.5 `AdminHeader`

- **Ubicación**: `modules/auth/components/AdminHeader.tsx`
- **Tipo**: server component (o client si necesita interactividad).
- **Responsabilidad**: header del layout admin para `ADMIN`.
- **Contenido**:
  - Texto "Administración" o "Confectu Admin".
  - Componente `LogoutButton`.
- **Requisitos**:
  - Mobile-first.
  - Touch targets mínimo 44x44px.

### 13.6 `LogoutButton`

- **Ubicación**: `modules/auth/components/LogoutButton.tsx`
- **Tipo**: client component.
- **Responsabilidad**: botón que invoca el Server Action `signOut` mediante
  `<form action={signOut}>`.
- **Requisitos**:
  - Mínimo 44x44px.
  - Estado loading: "Cerrando sesión..." + `disabled`.
  - Usa `useFormStatus` para detectar pending.
  - Accesible: `<button type="submit">`.

### 13.7 `AccountDisabledNotice`

- **Ubicación**: `modules/auth/components/AccountDisabledNotice.tsx`
- **Tipo**: server component o component simple.
- **Responsabilidad**: pantalla de cuenta desactivada.
- **Contenido**:
  - Mensaje: "Tu cuenta está desactivada. Contacta al administrador para
    reactivarla."
  - Botón "Contacto": sin funcionalidad por ahora. Puede mostrar un
    `mailto:` o un tooltip "Próximamente". No abre ninguna ruta.
  - Botón "Volver al inicio": enlace `<a href="/">` que redirige a la
    landing.
- **Requisitos**:
  - Mobile-first, centrado verticalmente.
  - Touch targets mínimo 44x44px.

---

## 14. Criterios de aceptación verificables

1. Un usuario puede iniciar sesión con Google desde `/login`.
2. Tras el primer login, un `CLIENT` es redirigido a `/onboarding`.
3. El `CLIENT` completa el formulario con nombre comercial y prefijo, y al
   enviar ve el modal "Taller configurado".
4. Tras cerrar el modal, el `CLIENT` es redirigido a `/dashboard`.
5. Un `CLIENT` que ya tiene `workshop_setup_completed = true` no puede
   volver a `/onboarding`; es redirigido a `/dashboard`.
6. El Server Action `completeWorkshopSetup` rechaza un segundo intento de
   creación de taller.
7. Un `ADMIN` es redirigido a `/admin` al login, sin pasar por onboarding.
8. Un `CLIENT` que intenta acceder a `/admin/*` es redirigido a
   `/dashboard`.
9. Un `ADMIN` que intenta acceder a rutas del taller es redirigido a
   `/admin`.
10. Un usuario con `profiles.is_active = false` ve `/account-disabled` con
    botón "Contacto" y botón "Volver al inicio".
11. El botón "Volver al inicio" en `/account-disabled` redirige a `/`.
12. El logout redirige a `/`.
13. Un usuario no autenticado que accede a una ruta privada es redirigido a
    `/login`.
14. Un usuario autenticado que accede a `/login` es redirigido a su home
    según rol y estado.
15. El middleware refresca la sesión JWT en cada request.
16. La landing `/` muestra un botón "Iniciar sesión" que lleva a `/login`.
17. El layout privado muestra la navegación con todos los enlaces
    (`Dashboard`, `Clientes`, `Servicios`, `Facturas`, `Configuración`) y
    el botón de cerrar sesión.
18. El layout admin muestra solo el botón de cerrar sesión.
19. Las rutas placeholder muestran "Próximamente".
20. `pnpm lint` pasa sin errores.
21. `pnpm build` compila sin errores.

---

## 15. Estrategia de pruebas

### 15.1 Verificación manual con `pnpm dev`

- Flujo completo de login con Google OAuth.
- Onboarding de `CLIENT` con modal de confirmación.
- Intento de crear un segundo taller (debe fallar).
- Login de `ADMIN` y redirección a `/admin`.
- Acceso de `CLIENT` a `/admin` (redirige a `/dashboard`).
- Acceso de `ADMIN` a `/dashboard` (redirige a `/admin`).
- Cuenta desactivada: cambiar `profiles.is_active = false` en la base de
  datos y verificar que el usuario ve `/account-disabled`.
- Logout y redirección a `/`.
- Acceso a ruta privada sin sesión (redirige a `/login`).
- Acceso a `/login` con sesión activa (redirige al home del rol).
- Refresh de sesión: navegar entre páginas y verificar que la sesión
  persiste.

### 15.2 Verificación de compilación

- `pnpm lint` sin errores.
- `pnpm build` sin errores de tipos ni rutas.

### 15.3 Verificación de RLS

- Un usuario no puede insertar un `workshops` con `owner_id` ajeno (RLS
  `workshops_insert` lo impide).
- Un usuario no puede leer perfiles de otros usuarios (RLS `profiles_select`
  lo impide, excepto `ADMIN`).
- Un `CLIENT` no puede leer `workshop_settings` de otro taller (RLS
  `workshop_settings_select` lo impide).

### 15.4 Verificación de migración

- La migración añade `workshop_setup_completed` con default `false`.
- Los usuarios existentes (si los hay) quedan con `false`.
- El trigger `handle_new_user` no se ve afectado.

---

## 16. Estructura final de archivos

```text
confectu/
├── app/
│   ├── layout.tsx                          (modifica)
│   ├── page.tsx                            (modifica)
│   ├── globals.css
│   ├── favicon.ico
│   │
│   ├── (public)/
│   │   └── login/
│   │       └── page.tsx                    (nuevo)
│   │
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts                    (nuevo)
│   │
│   ├── account-disabled/
│   │   └── page.tsx                        (nuevo)
│   │
│   ├── (private)/
│   │   ├── layout.tsx                      (nuevo)
│   │   ├── onboarding/
│   │   │   └── page.tsx                    (nuevo)
│   │   ├── dashboard/
│   │   │   └── page.tsx                    (nuevo)
│   │   ├── customers/
│   │   │   └── page.tsx                    (nuevo)
│   │   ├── services/
│   │   │   └── page.tsx                    (nuevo)
│   │   ├── invoices/
│   │   │   └── page.tsx                    (nuevo)
│   │   └── settings/
│   │       └── page.tsx                    (nuevo)
│   │
│   └── (admin)/
│       └── admin/
│           ├── layout.tsx                  (nuevo)
│           └── page.tsx                    (nuevo)
│
├── modules/
│   └── auth/
│       ├── components/
│       │   ├── GoogleSignInButton.tsx      (nuevo)
│       │   ├── OnboardingForm.tsx          (nuevo)
│       │   ├── WorkshopSetupSuccessModal.tsx (nuevo)
│       │   ├── PrivateHeader.tsx           (nuevo)
│       │   ├── AdminHeader.tsx             (nuevo)
│       │   ├── LogoutButton.tsx            (nuevo)
│       │   └── AccountDisabledNotice.tsx   (nuevo)
│       ├── actions.ts                      (nuevo)
│       ├── queries.ts                      (nuevo)
│       ├── types.ts                        (nuevo)
│       └── validations.ts                  (nuevo)
│
├── lib/
│   └── supabase/
│       ├── client.ts                       (sin cambios)
│       └── server.ts                       (sin cambios)
│
├── middleware.ts                           (nuevo)
│
├── supabase/
│   └── migrations/
│       ├── 20260818012245_init_schema.sql  (sin cambios)
│       └── {timestamp}_add_workshop_setup_completed.sql  (nuevo)
│
└── docs/
    └── modules.md                          (modifica)
```

---

## 17. Dependencias

No se añaden nuevas dependencias. El proyecto ya incluye:

- `@supabase/ssr` — manejo de sesión SSR con cookies.
- `@supabase/supabase-js` — cliente Supabase.
- `next` 16.3.0 — App Router, Server Actions, middleware, route handlers.
- `react` 19.2.8 — `useFormStatus`, `useRouter`.

No se añaden librerías de formularios, validación ni UI. Se usan formularios
nativos, validación HTML5 y validación manual con TypeScript.

---

## 18. Observaciones

- El trigger `handle_new_user()` ya crea un perfil `CLIENT` automáticamente
  al registrar un usuario en `auth.users`. Este spec no modifica ese
  trigger.
- La columna `workshop_setup_completed` se añade con default `false`, por lo
  que los perfiles existentes quedan con `false` automáticamente.
- La creación del taller debe ser atómica. Se recomienda evaluar una función
  SQL `security definer` que reciba `business_name` e `invoice_prefix` y
  cree `workshops` + `workshop_settings` + actualice el flag en una sola
  transacción, o manejar la transacción desde el Server Action con rollback
  manual.
- El feature de subida de imagen del taller en onboarding se documenta como
  feature futuro en `docs/modules.md` (sección 4.4) y no se implementa en
  este spec.
- El botón "Contacto" en `/account-disabled` no tiene funcionalidad en este
  spec. Se deja como placeholder para futuro.
