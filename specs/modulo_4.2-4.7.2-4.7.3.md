# Spec: Clientes del taller (CLIENT) y gestión unificada de talleres y clientes (ADMIN)

**Módulos:** `modules/clients/`, `modules/admin/clients/`, `modules/admin/workshops/`
**Número de spec:** 4.2 + 4.7.2 + 4.7.3
**Estado:** Pendiente de implementación
**Fecha:** 2026-08-21

---

## 1. Objetivo y alcance

Implementar el CRUD de personas atendidas por un taller (`customers`) para el
rol `CLIENT`, y la gestión unificada de talleres y personas para el rol
`ADMIN` en una sola vista que agrupa las personas bajo cada taller.

Este spec absorbe el módulo 4.7.3 (gestión de talleres por `ADMIN`), por lo
que cubre tanto la administración de personas como la administración completa
de la cuenta y configuración del taller.

### Dentro del alcance

**Vista CLIENT (`/customers`):**

- Listar personas del taller con búsqueda por nombre, número de documento,
  teléfono o correo electrónico.
- Interruptor para mostrar/ocultar personas inactivas (por defecto solo
  activas).
- Crear persona con nombre (obligatorio), tipo + número de documento
  (opcionales pero conjuntos), teléfono, correo, dirección y notas.
- Editar persona existente.
- Desactivar y reactivar persona, ambas con doble confirmación.
- Consulta pública `searchCustomersForInvoice` para el flujo de factura (solo
  activas, buscables, limitadas a 20 resultados).

**Vista ADMIN (`/admin/workshops`):**

- Listar todos los talleres con sus personas agrupadas debajo de cada taller.
- Activar/desactivar talleres con doble confirmación.
- Editar configuración completa del taller: nombre comercial, identificación
  fiscal, teléfono, correo, dirección, prefijo de factura, siguiente número
  de factura, instrucciones de pago y logo opcional.
- Editar, desactivar y reactivar personas de cualquier taller (sin creación).
- Subida y reemplazo de logo del taller en Supabase Storage.
- Enlace a servicios del taller marcado como "Próximamente" (módulo 4.7.4 no
  implementado).

**Transversal:**

- Actualización del `AdminSidebar`: eliminar "Clientes" como ruta
  independiente; "Talleres" apunta a `/admin/workshops` habilitado.
- Actualización del estado de los módulos 4.7.2 y 4.7.3 en `docs/modules.md`.
- Notificaciones de éxito y error con `nextjs-toast-notify` en
  `position: "top-right"`.
- Server Actions que validan sesión, rol, pertenencia y datos de entrada en
  el servidor.

### Fuera del alcance

- Creación de personas por `ADMIN` (solo `CLIENT` crea personas).
- Eliminación física de personas o talleres (no disponible en el MVP).
- Gestión de servicios por `ADMIN` (módulo 4.7.4, spec separado).
- Módulo de facturas (módulo 4.5, spec separado).
- Dashboard del taller (módulo 4.6, spec separado).
- Varios usuarios dentro de un mismo taller.
- Paginación de listas (se carga todo a la vez, igual que el módulo de tipos
  de documento).

---

## 2. Actores y permisos

| Actor | Descripción | Acceso |
|---|---|---|
| `CLIENT` | Propietario de un taller. | CRUD de sus propias personas en `/customers/*`. No accede a `/admin/*`. |
| `ADMIN` | Administrador global de Confectu. | Gestiona talleres y personas de cualquier taller en `/admin/workshops/*`. No crea personas. |
| Usuario no autenticado | Sin sesión activa. | Sin acceso. Redirigido a `/login`. |

### Reglas de permisos

- El taller se resuelve en el servidor para `CLIENT` a partir del usuario
  autenticado. Nunca se acepta `workshop_id` desde el formulario del cliente.
- `ADMIN` no selecciona taller al editar una persona: el taller se determina
  por la persona existente. El `workshop_id` se obtiene del registro y se
  valida en el servidor.
- Todas las Server Actions de `modules/clients/` validan sesión activa y rol
  `CLIENT`.
- Todas las Server Actions de `modules/admin/` validan sesión activa, rol
  `ADMIN` y cuenta activa.
- La validación de rol en Server Actions complementa las políticas RLS
  existentes (defensa en profundidad).
- `CLIENT` no puede acceder a ninguna ruta bajo `/admin/*`. El middleware
  (`proxy.ts`) lo redirige a `/dashboard`.
- La lógica de negocio mantiene `workshop_id` discriminado por persona para
  futura implementación de varios talleres por usuario, aunque en el MVP una
  persona pertenece a un solo taller.

---

## 3. Flujo principal y flujos alternativos

### 3.1 Flujo: listar personas (CLIENT)

1. `CLIENT` accede a `/customers`.
2. La página (Server Component) consulta `listCustomers` con
   `includeInactive = false`, que retorna las personas activas del taller
   actual ordenadas por `name`.
3. Se renderiza la lista con cada persona mostrando nombre, documento, teléfono
   y correo.
4. Un campo de texto permite filtrar la lista por nombre, documento, teléfono o
   correo en el cliente (sin recarga).
5. Un interruptor "Mostrar inactivos" permite incluir personas desactivadas.
6. Cada persona tiene enlaces a editar (`/customers/[id]`) y un control para
   desactivar/reactivar.

### 3.2 Flujo: crear persona (CLIENT)

1. `CLIENT` accede a `/customers/new`.
2. Completa el formulario con nombre (obligatorio) y datos opcionales.
3. Si completa tipo de documento, debe completar también número de documento
   (y viceversa).
4. Al enviar, el Server Action `createCustomer` valida rol `CLIENT`, resuelve
   `workshop_id` en el servidor, valida los campos e inserta el registro.
5. Si hay errores de validación, retorna `fieldErrors` y el formulario los
   muestra bajo cada campo.
6. Si hay éxito, el componente cliente muestra `showToast.success` y redirige
   a `/customers`.
7. Si el documento (tipo+número) ya existe en el taller, retorna
   `fieldErrors.document_number` con mensaje de duplicado.

### 3.3 Flujo: editar persona (CLIENT)

1. `CLIENT` accede a `/customers/[id]`.
2. La página consulta `getCustomerById`. Si el ID no existe o no pertenece al
   taller, muestra estado "no encontrado".
3. Si existe, muestra los datos actuales y un formulario precargado.
4. Al enviar, el Server Action `updateCustomer` valida rol `CLIENT`, valida
   pertenencia al taller, valida los campos y actualiza.
5. Si hay errores, muestra `fieldErrors` bajo cada campo.
6. Si hay éxito, muestra `showToast.success` y redirige a `/customers`.

### 3.4 Flujo: desactivar persona (CLIENT, doble confirmación)

1. Desde la lista o el detalle, `CLIENT` activa el control de desactivar.
2. Se muestra el primer diálogo: "¿Estás seguro de desactivar este cliente?"
   con botones "Cancelar" y "Sí, continuar".
3. Al confirmar el primer diálogo, se muestra el segundo: "Esta acción es
   definitiva. ¿Confirmar desactivación?" con botones "Cancelar" y
   "Confirmar".
4. Al confirmar el segundo diálogo, el Server Action `toggleCustomerStatus`
   pone `is_active = false`.
5. Si hay éxito, muestra `showToast.success` y recarga la lista.

### 3.5 Flujo: reactivar persona (CLIENT, doble confirmación)

1. Desde la lista (con interruptor de inactivos activado) o el detalle,
   `CLIENT` activa el control de reactivar sobre una persona inactiva.
2. Se muestra el primer diálogo: "¿Estás seguro de reactivar este cliente?"
   con botones "Cancelar" y "Sí, continuar".
3. Al confirmar, se muestra el segundo diálogo: "¿Confirmar reactivación?"
   con botones "Cancelar" y "Confirmar".
4. Al confirmar, el Server Action `toggleCustomerStatus` pone
   `is_active = true`.
5. Si hay éxito, muestra `showToast.success` y recarga.

### 3.6 Flujo: persona inexistente (CLIENT)

1. `CLIENT` accede a `/customers/[id]` con un ID que no existe o no pertenece
   a su taller.
2. La consulta `getCustomerById` retorna `null`.
3. La página muestra un estado "no encontrado" con mensaje y enlace para
   volver a `/customers`.

### 3.7 Flujo: acceso sin permiso

1. Un `CLIENT` intenta acceder a `/admin/workshops`.
2. El middleware lo redirige a `/dashboard`.
3. Un usuario no autenticado es redirigido a `/login`.

### 3.8 Flujo: listar talleres con personas agrupadas (ADMIN)

1. `ADMIN` accede a `/admin/workshops`.
2. La página (Server Component) consulta `listWorkshopsWithCustomers` que
   retorna todos los talleres con su configuración y personas agrupadas.
3. Se renderiza la lista con cada taller como encabezado mostrando nombre
   comercial y estado (activo/inactivo).
4. Debajo de cada taller se listan sus personas con nombre, documento, teléfono
   y correo.
5. Cada taller tiene controles para activar/desactivar y un enlace a editar
   configuración (`/admin/workshops/[id]`).
6. Cada persona tiene controles para editar, desactivar y reactivar.

### 3.9 Flujo: activar/desactivar taller (ADMIN, doble confirmación)

1. Desde la lista de talleres, `ADMIN` activa el control de desactivar/reactivar
   sobre un taller.
2. Se muestra el primer diálogo de confirmación.
3. Al confirmar, se muestra el segundo diálogo de confirmación.
4. Al confirmar el segundo, el Server Action `toggleWorkshopStatus` alterna
   `is_active` del taller.
5. Si hay éxito, muestra `showToast.success` y recarga.

### 3.10 Flujo: editar configuración del taller (ADMIN)

1. `ADMIN` accede a `/admin/workshops/[id]`.
2. La página consulta `getWorkshopById`. Si el ID no existe, muestra estado
   "no encontrado".
3. Si existe, muestra el formulario de configuración precargado con todos los
   campos del taller + sección de logo.
4. Al enviar, el Server Action `updateWorkshopSettings` valida rol `ADMIN`,
   valida los campos, verifica que `next_invoice_number` no disminuya, y
   actualiza.
5. Si hay errores, muestra `fieldErrors` bajo cada campo.
6. Si hay éxito, muestra `showToast.success` y recarga.

### 3.11 Flujo: subir/reemplazar logo del taller (ADMIN)

1. En la página de edición del taller, `ADMIN` selecciona una imagen en el
   componente de logo.
2. El componente valida en cliente el tipo (PNG, JPEG, WebP) y tamaño (máx 2
   MB).
3. Al enviar, el Server Action `uploadWorkshopLogo` sube el archivo a Storage,
   actualiza `logo_path` en `workshop_settings` y retorna la nueva ruta.
4. Si hay éxito, muestra `showToast.success` y actualiza la preview.
5. Si el tipo o tamaño son inválidos, muestra `showToast.error`.

### 3.12 Flujo: editar persona (ADMIN)

1. Desde la lista de talleres, `ADMIN` activa el control de editar sobre una
   persona.
2. Se navega al formulario de edición de persona (inline o página dedicada
   dentro del detalle del taller).
3. El formulario está precargado con los datos actuales.
4. Al enviar, el Server Action `updateCustomerAsAdmin` valida rol `ADMIN`,
   obtiene `workshop_id` de la persona existente, valida los campos y
   actualiza.
5. Si hay éxito, muestra `showToast.success` y recarga.

### 3.13 Flujo: desactivar/reactivar persona (ADMIN, doble confirmación)

1. Desde la lista de talleres, `ADMIN` activa el control de desactivar o
   reactivar sobre una persona.
2. Se muestran los dos diálogos consecutivos de confirmación.
3. Al confirmar ambos, el Server Action `toggleCustomerStatusAsAdmin` alterna
   `is_active`.
4. Si hay éxito, muestra `showToast.success` y recarga.

### 3.14 Flujo: taller inexistente (ADMIN)

1. `ADMIN` accede a `/admin/workshops/[id]` con un ID que no existe.
2. La consulta `getWorkshopById` retorna `null`.
3. La página muestra un estado "no encontrado" con enlace a `/admin/workshops`.

### 3.15 Flujo: enlace a servicios del taller (ADMIN)

1. En la página de edición del taller, se muestra un enlace "Servicios del
   taller" hacia `/admin/services?workshopId=[id]`.
2. El enlace se muestra marcado como "Próximamente" y deshabilitado, ya que el
   módulo 4.7.4 no está implementado.

---

## 4. Reglas de negocio

1. **Nombre es el único campo obligatorio**: no vacío tras `trim`, máximo 255
   caracteres.
2. **Tipo y número de documento van siempre juntos**: ambos presentes o ambos
   vacíos. No se permite uno sin el otro.
3. **Unicidad de documento por taller**: dentro de un mismo taller no pueden
   existir dos personas con el mismo `(document_type_id, document_number)`.
   La misma persona puede registrarse en talleres distintos. Esta unicidad
   solo se aplica cuando ambos campos están presentes.
4. **Tipo de documento activo al asociarlo**: al crear o editar una persona, si
   se selecciona un tipo de documento, este debe estar activo en el catálogo
   global. Si el tipo asociado a una persona fue desactivado después, se sigue
   mostrando en la edición pero no aparece como opción seleccionable para
   otras personas.
5. **Sin eliminación física**: la única forma de retirar una persona es
   desactivarla (`is_active = false`). La eliminación física queda fuera del
   MVP.
6. **Personas nuevas se crean como activas**: todo nuevo registro se inserta con
   `is_active = true`.
7. **Desactivación siempre permitida**: una persona puede desactivarse aunque
   tenga facturas asociadas. La desactivación no afecta las facturas
   existentes porque estas guardan snapshots del cliente.
8. **Doble confirmación para desactivar y reactivar personas**: ambas acciones
   requieren dos confirmaciones consecutivas antes de ejecutarse.
9. **Doble confirmación para desactivar y reactivar talleres**: ambas acciones
   requieren dos confirmaciones consecutivas antes de ejecutarse.
10. **`next_invoice_number` no puede disminuir**: al editar la configuración del
    taller, el consecutivo no puede ser menor al valor actual.
11. **`invoice_prefix` mantiene `^[A-Z0-9]{1,3}$`**: 1 a 3 caracteres
    alfanuméricos en mayúscula. Se convierte a mayúsculas antes de validar y
    guardar.
12. **Logo del taller en Supabase Storage**: se gestiona en un bucket privado
    `workshop-logos` con políticas que permitan a `ADMIN` y al owner del taller
    leer y escribir.
13. **Validación de tipo y tamaño del logo**: solo imágenes PNG, JPEG o WebP,
    máximo 2 MB.
14. **`ADMIN` no crea personas**: la creación de personas la realiza únicamente
    `CLIENT` en su vista. `ADMIN` solo lista, edita, desactiva y reactiva
    personas existentes.
15. **`workshop_id` discriminado en lógica de negocio**: aunque en el MVP una
    persona pertenece a un solo taller y el frontend unifica la información,
    la lógica de negocio mantiene `workshop_id` por persona para futura
    implementación de varios talleres por usuario.
16. **Validaciones compartidas**: las validaciones de campos de persona se
    comparten entre `modules/clients/` y `modules/admin/clients/` para mantener
    consistencia. El módulo admin importa las validaciones públicas del módulo
    de clientes.
17. **`fieldErrors` por campo**: las Server Actions retornan errores de
    validación por campo en `fieldErrors: Record<string, string>`.

---

## 5. Estados y transiciones

### 5.1 Persona (customer)

```text
                    createCustomer
                          │
                          ▼
                       ┌──────┐
           ┌───────────│ activo│───────────┐
           │           └──────┘           │
           │ toggleStatus (desactivar)    │ toggleStatus (reactivar)
           │ doble confirmación           │ doble confirmación
           ▼                              │
        ┌────────┐                        │
        │inactivo│────────────────────────┘
        └────────┘
```

- **activo**: `is_active = true`. Visible en lista por defecto y en flujo de
  factura.
- **inactivo**: `is_active = false`. Visible solo con interruptor "Mostrar
  inactivos" activado.

### 5.2 Taller (workshop)

```text
                    onboarding (spec 1)
                          │
                          ▼
                       ┌──────┐
           ┌───────────│ activo│───────────┐
           │           └──────┘           │
           │ toggleWorkshopStatus         │ toggleWorkshopStatus
           │ (desactivar)                 │ (reactivar)
           │ doble confirmación           │ doble confirmación
           ▼                              │
        ┌────────┐                        │
        │inactivo│────────────────────────┘
        └────────┘
```

- **activo**: `workshops.is_active = true`. El propietario puede operar.
- **inactivo**: `workshops.is_active = false`. El propietario ve
  `/account-disabled`.

### 5.3 Transiciones permitidas

| Entidad | Origen | Acción | Destino |
|---|---|---|---|
| Persona | (nueva) | `createCustomer` | activo |
| Persona | activo | `toggleCustomerStatus` (desactivar) | inactivo |
| Persona | inactivo | `toggleCustomerStatus` (reactivar) | activo |
| Taller | activo | `toggleWorkshopStatus` (desactivar) | inactivo |
| Taller | inactivo | `toggleWorkshopStatus` (reactivar) | activo |

No existe transición a "eliminado" para personas ni talleres.

---

## 6. Modelo de datos afectado

### 6.1 Migración nueva requerida

Se requiere una migración versionada que:

1. Añada un índice único parcial en `customers` para garantizar la unicidad de
   `(workshop_id, document_type_id, document_number)` cuando ambos campos no
   sean null.
2. Configure el bucket de Storage `workshop-logos` con políticas que permitan
   a `ADMIN` y al owner del taller leer y escribir archivos.

### 6.2 Tablas existentes utilizadas

```text
customers
  id                uuid primary key default gen_random_uuid()
  workshop_id       uuid not null
  name              text not null
  document_type_id  uuid (opcional)
  document_number   text (opcional)
  phone             text (opcional)
  email             text (opcional)
  address           text (opcional)
  notes             text (opcional)
  is_active         boolean not null default true
  created_at        timestamptz not null default now()
  updated_at        timestamptz not null default now()

document_types
  id          uuid primary key default gen_random_uuid()
  code        text not null unique
  name        text not null
  is_active   boolean not null default true
  created_at  timestamptz not null default now()
  updated_at  timestamptz not null default now()

workshops
  id          uuid primary key default gen_random_uuid()
  owner_id    uuid not null unique
  is_active   boolean not null default true
  created_at  timestamptz not null default now()
  updated_at  timestamptz not null default now()

workshop_settings
  workshop_id           uuid primary key
  business_name         text not null
  tax_id                text (opcional)
  phone                 text (opcional)
  email                 text (opcional)
  address               text (opcional)
  invoice_prefix        varchar(3) not null
  next_invoice_number   bigint not null default 1
  payment_instructions  text (opcional)
  logo_path             text (opcional)
  created_at            timestamptz not null default now()
  updated_at            timestamptz not null default now()
```

### 6.3 Índice nuevo

```text
customers_workshop_document_unique_idx
  unique on public.customers (workshop_id, document_type_id, document_number)
  where document_type_id is not null and document_number is not null
```

Este índice garantiza que dentro de un mismo taller no existan dos personas
con el mismo tipo y número de documento. No afecta a personas sin documento
(ambos campos null).

### 6.4 Restricciones existentes

- `customers_name_not_empty`: `length(btrim(name)) > 0`.
- `workshop_settings_invoice_prefix_check`: `invoice_prefix ~ '^[A-Z0-9]{1,3}$'`.
- `workshop_settings_next_invoice_number_check`: `next_invoice_number >= 1`.
- Trigger `customers_set_updated_at`: actualiza `updated_at` automáticamente.
- Trigger `workshop_settings_set_updated_at`: actualiza `updated_at`
  automáticamente.
- Trigger `workshops_set_updated_at`: actualiza `updated_at` automáticamente.

### 6.5 Storage

- Bucket privado `workshop-logos` para logos del taller.
- Ruta por archivo: `{workshop_id}/logo.{ext}`.
- Políticas de Storage:
  - `select`: `ADMIN` y owner del taller pueden leer.
  - `insert`/`update`: `ADMIN` y owner del taller pueden escribir.
  - `delete`: `ADMIN` y owner del taller pueden eliminar.

---

## 7. Reglas de aislamiento multi-tenant y RLS

### 7.1 RLS existente de `customers` (no se modifica)

```sql
create policy customers_select on public.customers
  for select to authenticated
  using (workshop_id = public.current_workshop_id() or public.is_admin());

create policy customers_insert on public.customers
  for insert to authenticated
  with check (workshop_id = public.current_workshop_id() or public.is_admin());

create policy customers_update on public.customers
  for update to authenticated
  using (workshop_id = public.current_workshop_id() or public.is_admin())
  with check (workshop_id = public.current_workshop_id() or public.is_admin());

create policy customers_delete on public.customers
  for delete to authenticated
  using (workshop_id = public.current_workshop_id() or public.is_admin());
```

Estas políticas ya permiten a `ADMIN` leer y mutar personas de cualquier
taller y a `CLIENT` solo las suyas. No se modifican.

### 7.2 RLS existente de `workshops` y `workshop_settings` (no se modifica)

```sql
-- workshops: el owner gestiona su taller; ADMIN gestiona todos.
workshops_select: using (owner_id = auth.uid() or is_admin())
workshops_update: using/check (owner_id = auth.uid() or is_admin())

-- workshop_settings: el owner del taller; ADMIN gestiona todas.
workshop_settings_select: using (workshop_id = current_workshop_id() or is_admin())
workshop_settings_update: using/check (workshop_id = current_workshop_id() or is_admin())
```

Estas políticas ya permiten a `ADMIN` leer y mutar todos los talleres y
configuraciones. No se modifican.

### 7.3 Validación en Server Actions

- Server Actions de `modules/clients/`: validan sesión activa, rol `CLIENT`,
  y que el `workshop_id` se resuelva desde el usuario autenticado (nunca del
  formulario).
- Server Actions de `modules/admin/clients/`: validan sesión activa, rol
  `ADMIN` y cuenta activa. Al editar una persona, el `workshop_id` se obtiene
  del registro existente, no del formulario.
- Server Actions de `modules/admin/workshops/`: validan sesión activa, rol
  `ADMIN` y cuenta activa.
- La consulta pública `searchCustomersForInvoice` respeta RLS y devuelve solo
  personas activas del taller actual.

### 7.4 Service role key

No se usa la service role key en las Server Actions de personas ni de talleres.
Todas las operaciones usan el cliente Supabase autenticado del usuario,
respetando RLS. La subida del logo a Storage usa el cliente autenticado con
las políticas de Storage adecuadas.

---

## 8. Validaciones funcionales

### 8.1 Crear/editar persona (`createCustomer`, `updateCustomer`, `updateCustomerAsAdmin`)

| Campo | Regla |
|---|---|
| `name` | Obligatorio. No vacío tras `trim`. Máximo 255 caracteres. |
| `document_type_id` | Opcional. Si presente, `document_number` es obligatorio. Debe referenciar un tipo activo. |
| `document_number` | Opcional. Si presente, `document_type_id` es obligatorio. Máximo 50 caracteres. |
| `phone` | Opcional. Máximo 50 caracteres. |
| `email` | Opcional. Máximo 255 caracteres. Formato de correo válido si presente. |
| `address` | Opcional. Máximo 500 caracteres. |
| `notes` | Opcional. Máximo 1000 caracteres. |

### 8.2 Toggle de estado de persona (`toggleCustomerStatus`, `toggleCustomerStatusAsAdmin`)

| Campo | Regla |
|---|---|
| `id` | Obligatorio. Debe referenciar una persona existente. Si no existe, retorna error. |

### 8.3 Editar configuración del taller (`updateWorkshopSettings`)

| Campo | Regla |
|---|---|
| `workshop_id` | Obligatorio. Debe referenciar un taller existente. |
| `business_name` | Obligatorio. No vacío tras `trim`. Máximo 255 caracteres. |
| `tax_id` | Opcional. Máximo 50 caracteres. |
| `phone` | Opcional. Máximo 50 caracteres. |
| `email` | Opcional. Máximo 255 caracteres. Formato de correo válido si presente. |
| `address` | Opcional. Máximo 500 caracteres. |
| `invoice_prefix` | Obligatorio. Regex `^[A-Z0-9]{1,3}$`. Se convierte a mayúsculas antes de validar. |
| `next_invoice_number` | Obligatorio. Entero >= 1. No puede disminuir respecto al valor actual en la base de datos. |
| `payment_instructions` | Opcional. Máximo 1000 caracteres. |

### 8.4 Subida de logo (`uploadWorkshopLogo`)

| Campo | Regla |
|---|---|
| `workshop_id` | Obligatorio. Debe referenciar un taller existente. |
| `logo` (File) | Obligatorio. Tipo MIME: `image/png`, `image/jpeg` o `image/webp`. Tamaño máximo 2 MB. |

### 8.5 Toggle de estado de taller (`toggleWorkshopStatus`)

| Campo | Regla |
|---|---|
| `id` | Obligatorio. Debe referenciar un taller existente. Si no existe, retorna error. |

### 8.6 Validación de rol

| Regla | Descripción |
|---|---|
| Sesión activa | Toda Server Action verifica sesión. Si no hay, retorna error "No hay sesión activa." |
| Rol `CLIENT` | Server Actions de `modules/clients/` verifican `profiles.role = 'CLIENT'`. Si no, retorna error. |
| Rol `ADMIN` | Server Actions de `modules/admin/` verifican `profiles.role = 'ADMIN'` y `profiles.is_active = true`. Si no, retorna error "Solo los administradores pueden realizar esta acción." |

### 8.7 Validación duplicada

- **Cliente**: validación HTML5 nativa (`required`, `maxlength`, `pattern`)
  más validación manual en el componente antes de enviar.
- **Servidor**: el Server Action valida los campos con `validations.ts`. Si la
  validación pasa pero Postgres rechaza por unicidad de documento, el Server
  Action detecta el error y retorna `fieldErrors.document_number` con mensaje
  "Ya existe un cliente con este documento en el taller.".

---

## 9. Errores y estados de la interfaz

### 9.1 Lista `/customers` (CLIENT)

| Estado | Comportamiento |
|---|---|
| Loading | Spinner o esqueleto mientras carga la consulta. |
| Con datos | Lista de personas activas con búsqueda e interruptor de inactivos. Cada persona muestra nombre, documento, teléfono y correo. |
| Vacío | Mensaje "No hay clientes." con botón "Crear cliente" hacia `/customers/new`. |
| Error carga | Mensaje "No se pudieron cargar los clientes." con botón de reintentar. |
| Búsqueda sin resultados | Mensaje "No se encontraron clientes con ese filtro." |
| Interruptor inactivos activado, sin inactivos | Mensaje "No hay clientes inactivos." |
| Éxito acción | Toast `showToast.success` en `top-right` tras crear, editar, desactivar o reactivar. |

### 9.2 Formulario crear/editar persona (CLIENT)

| Estado | Comportamiento |
|---|---|
| Idle | Formulario con campos. Validación HTML5 nativa. |
| Validación inline | Errores mostrados bajo cada campo antes de enviar. |
| Loading | Botón "Crear cliente" / "Guardar cambios" muestra "Guardando..." y se deshabilita. |
| Éxito | `showToast.success("Cliente creado")` o `showToast.success("Cliente actualizado")` y redirección a `/customers`. |
| Error servidor | `fieldErrors` bajo cada campo + error general bajo el formulario. Botón habilitado para reintentar. |
| Documento duplicado | `fieldErrors.document_number` = "Ya existe un cliente con este documento en el taller." |
| Tipo/número incompleto | `fieldErrors.document_number` o `fieldErrors.document_type_id` = "Debe indicar tipo y número de documento, o dejar ambos vacíos." |

### 9.3 Desactivar/reactivar persona (doble confirmación)

| Estado | Comportamiento |
|---|---|
| Paso 1 | Botón "Desactivar" / "Reactivar" muestra primer diálogo: "¿Estás seguro de [desactivar/reactivar] este cliente?" con botones "Cancelar" y "Sí, continuar". |
| Paso 2 | Segundo diálogo: "Esta acción es definitiva. ¿Confirmar [desactivación/reactivación]?" con botones "Cancelar" y "Confirmar". |
| Loading | Botón "Confirmar" muestra "Procesando..." y se deshabilita. |
| Éxito | `showToast.success("Cliente desactivado")` o `showToast.success("Cliente reactivado")` y recarga. |
| Error | `showToast.error` con mensaje. |

### 9.4 Lista `/admin/workshops` (ADMIN)

| Estado | Comportamiento |
|---|---|
| Loading | Spinner o esqueleto mientras carga la consulta. |
| Con datos | Talleres como encabezados agrupados, personas debajo de cada uno. Cada taller muestra nombre comercial y estado. Cada persona muestra nombre, documento, teléfono y correo. |
| Vacío | Mensaje "No hay talleres." |
| Error carga | Mensaje "No se pudieron cargar los talleres." con botón de reintentar. |
| Taller sin personas | Bajo el encabezado del taller se muestra "Sin clientes." |
| Éxito acción | Toast `showToast.success` en `top-right`. |

### 9.5 Editar configuración del taller (ADMIN)

| Estado | Comportamiento |
|---|---|
| Idle | Formulario precargado con datos del taller + sección de logo. |
| Validación inline | Errores bajo cada campo. |
| Loading | Botón "Guardar cambios" muestra "Guardando..." y se deshabilita. |
| Éxito | `showToast.success("Configuración del taller actualizada")` y recarga. |
| Error servidor | `fieldErrors` + error general. Botón habilitado. |
| `next_invoice_number` disminuido | `fieldErrors.next_invoice_number` = "El número de factura no puede disminuir." |
| `invoice_prefix` inválido | `fieldErrors.invoice_prefix` = "El prefijo debe tener 1 a 3 letras o números en mayúscula." |

### 9.6 Subida de logo (ADMIN)

| Estado | Comportamiento |
|---|---|
| Idle | Preview del logo actual (si existe) + botón "Subir logo" + botón "Eliminar logo" (si existe). |
| Logo cargando | Spinner durante la subida. Botón deshabilitado. |
| Logo éxito | `showToast.success("Logo actualizado")` y actualización de la preview. |
| Logo error tipo | `showToast.error("El logo debe ser una imagen PNG, JPEG o WebP.")` |
| Logo error tamaño | `showToast.error("El logo no puede superar 2 MB.")` |
| Logo eliminado | `showToast.success("Logo eliminado")` y preview vacía. |

### 9.7 Desactivar/reactivar taller (doble confirmación)

| Estado | Comportamiento |
|---|---|
| Paso 1 | Botón muestra primer diálogo: "¿Estás seguro de [desactivar/reactivar] este taller?" con "Cancelar" y "Sí, continuar". |
| Paso 2 | Segundo diálogo: "Esta acción afectará el acceso del propietario. ¿Confirmar?" con "Cancelar" y "Confirmar". |
| Loading | Botón "Confirmar" muestra "Procesando..." y se deshabilita. |
| Éxito | `showToast.success("Taller desactivado")` o `showToast.success("Taller reactivado")` y recarga. |
| Error | `showToast.error` con mensaje. |

### 9.8 Errores de permisos

| Estado | Comportamiento |
|---|---|
| `CLIENT` accede a `/admin/*` | Redirección silenciosa a `/dashboard` (gestionada por middleware). |
| Sin sesión | Redirección a `/login` (gestionada por middleware). |

---

## 10. Rutas y pantallas afectadas

| Ruta | Archivo | Descripción |
|---|---|---|
| `/customers` | `app/(private)/customers/page.tsx` (modifica) | Lista de personas con búsqueda e interruptor de inactivos. |
| `/customers/new` | `app/(private)/customers/new/page.tsx` (nuevo) | Formulario de creación de persona. |
| `/customers/[id]` | `app/(private)/customers/[id]/page.tsx` (nuevo) | Detalle/edición de persona. |
| `/admin/workshops` | `app/(admin)/admin/workshops/page.tsx` (nuevo) | Lista unificada de talleres con personas agrupadas. |
| `/admin/workshops/[id]` | `app/(admin)/admin/workshops/[id]/page.tsx` (nuevo) | Edición de configuración del taller + gestión de personas del taller. |
| `AdminSidebar` | `modules/admin/components/AdminSidebar.tsx` (modifica) | Eliminar entrada "Clientes"; "Talleres" apunta a `/admin/workshops` habilitado. |
| `docs/modules.md` | `docs/modules.md` (modifica) | Actualizar estado de 4.7.2 y 4.7.3. |

### Notas sobre la organización de rutas

- La ruta `/admin/clients` no existe por separado; se elimina del menú lateral.
  La gestión de personas por `ADMIN` se realiza desde `/admin/workshops` y
  `/admin/workshops/[id]`.
- El middleware (`proxy.ts`) ya cubre `/customers` como ruta privada y
  `/admin/workshops` como ruta admin (empieza con `/admin`). No requiere
  cambios.
- `/customers/new` y `/customers/[id]` son rutas anidadas bajo `customers/`.
- `/admin/workshops/[id]` es una ruta anidada bajo `workshops/`.

---

## 11. Server Actions necesarias

### 11.1 `createCustomer(formData)`

- **Módulo**: `modules/clients/actions.ts`
- **Propósito**: crear una nueva persona activa para el taller del usuario
  autenticado.
- **Entrada (FormData)**:
  - `name` (obligatorio): nombre de la persona, max 255.
  - `document_type_id` (opcional): UUID del tipo de documento.
  - `document_number` (opcional): número de documento, max 50.
  - `phone` (opcional): teléfono, max 50.
  - `email` (opcional): correo, max 255.
  - `address` (opcional): dirección, max 500.
  - `notes` (opcional): notas, max 1000.
- **Salida**: objeto `CustomerActionResult` con `{ success: true }` o
  `{ success: false, error?: string, fieldErrors?: Record<string, string> }`.
- **Validaciones**:
  - Sesión activa.
  - Rol `CLIENT`.
  - `workshop_id` se resuelve desde el usuario autenticado (no del formulario).
  - Campos validados con `validateCustomerInput`.
  - `document_type_id` y `document_number` ambos presentes o ambos ausentes.
  - Si `document_type_id` presente, debe referenciar un tipo activo.
- **Comportamiento**:
  - Inserta en `customers` con `workshop_id` resuelto, `is_active = true`.
  - Si Postgres rechaza por unicidad de documento, retorna
    `fieldErrors.document_number` = "Ya existe un cliente con este documento
    en el taller.".
  - Si hay error inesperado, retorna `error` con mensaje genérico.

### 11.2 `updateCustomer(formData)`

- **Módulo**: `modules/clients/actions.ts`
- **Propósito**: actualizar los datos de una persona existente del taller
  actual.
- **Entrada (FormData)**:
  - `id` (obligatorio): UUID de la persona a actualizar.
  - `name`, `document_type_id`, `document_number`, `phone`, `email`,
    `address`, `notes` (mismas reglas que `createCustomer`).
- **Salida**: `CustomerActionResult`.
- **Validaciones**:
  - Sesión activa.
  - Rol `CLIENT`.
  - `id` debe referenciar una persona existente que pertenezca al taller del
    usuario. Si no, retorna error.
  - Campos validados con `validateCustomerInput`.
  - `document_type_id` y `document_number` ambos presentes o ambos ausentes.
  - Si `document_type_id` presente, debe referenciar un tipo activo.
- **Comportamiento**:
  - Actualiza los campos en `customers`. `updated_at` se actualiza por trigger.
  - No modifica `is_active` (el estado se maneja con `toggleCustomerStatus`).
  - No modifica `workshop_id` (no se permite cambiar de taller).
  - Si el documento colisiona con otra persona del mismo taller, retorna
    `fieldErrors.document_number`.

### 11.3 `toggleCustomerStatus(formData)`

- **Módulo**: `modules/clients/actions.ts`
- **Propósito**: alternar `is_active` de una persona existente (desactivar o
  reactivar).
- **Entrada (FormData)**:
  - `id` (obligatorio): UUID de la persona.
- **Salida**: `CustomerActionResult`.
- **Validaciones**:
  - Sesión activa.
  - Rol `CLIENT`.
  - `id` debe referenciar una persona existente del taller actual.
- **Comportamiento**:
  - Consulta el estado actual de `is_active`.
  - Si está activo, lo desactiva (`is_active = false`).
  - Si está inactivo, lo reactiva (`is_active = true`).
  - Retorna `{ success: true }`.

### 11.4 `updateCustomerAsAdmin(formData)`

- **Módulo**: `modules/admin/clients/actions.ts`
- **Propósito**: actualizar los datos de una persona de cualquier taller.
- **Entrada (FormData)**:
  - `id` (obligatorio): UUID de la persona a actualizar.
  - `name`, `document_type_id`, `document_number`, `phone`, `email`,
    `address`, `notes` (mismas reglas que `createCustomer`).
- **Salida**: `CustomerActionResult`.
- **Validaciones**:
  - Sesión activa.
  - Rol `ADMIN` y cuenta activa.
  - `id` debe referenciar una persona existente. Si no, retorna error.
  - `workshop_id` se obtiene de la persona existente, no del formulario.
  - Campos validados con `validateCustomerInput` (compartido con
    `modules/clients/`).
  - `document_type_id` y `document_number` ambos presentes o ambos ausentes.
  - Si `document_type_id` presente, debe referenciar un tipo activo.
- **Comportamiento**:
  - Actualiza los campos en `customers`. No modifica `workshop_id` ni
    `is_active`.
  - Si el documento colisiona con otra persona del mismo taller, retorna
    `fieldErrors.document_number`.

### 11.5 `toggleCustomerStatusAsAdmin(formData)`

- **Módulo**: `modules/admin/clients/actions.ts`
- **Propósito**: alternar `is_active` de una persona de cualquier taller.
- **Entrada (FormData)**:
  - `id` (obligatorio): UUID de la persona.
- **Salida**: `CustomerActionResult`.
- **Validaciones**:
  - Sesión activa.
  - Rol `ADMIN` y cuenta activa.
  - `id` debe referenciar una persona existente.
- **Comportamiento**:
  - Consulta el estado actual de `is_active`.
  - Alterna el estado.
  - Retorna `{ success: true }`.

### 11.6 `toggleWorkshopStatus(formData)`

- **Módulo**: `modules/admin/workshops/actions.ts`
- **Propósito**: alternar `is_active` de un taller existente (desactivar o
  reactivar).
- **Entrada (FormData)**:
  - `id` (obligatorio): UUID del taller.
- **Salida**: `WorkshopActionResult`.
- **Validaciones**:
  - Sesión activa.
  - Rol `ADMIN` y cuenta activa.
  - `id` debe referenciar un taller existente.
- **Comportamiento**:
  - Consulta el estado actual de `is_active`.
  - Alterna el estado.
  - Retorna `{ success: true }`.

### 11.7 `updateWorkshopSettings(formData)`

- **Módulo**: `modules/admin/workshops/actions.ts`
- **Propósito**: actualizar la configuración de un taller existente.
- **Entrada (FormData)**:
  - `workshop_id` (obligatorio): UUID del taller.
  - `business_name` (obligatorio): nombre comercial, max 255.
  - `tax_id` (opcional): identificación fiscal, max 50.
  - `phone` (opcional): teléfono, max 50.
  - `email` (opcional): correo, max 255.
  - `address` (opcional): dirección, max 500.
  - `invoice_prefix` (obligatorio): prefijo, regex `^[A-Z0-9]{1,3}$`.
  - `next_invoice_number` (obligatorio): entero >= 1, no puede disminuir.
  - `payment_instructions` (opcional): instrucciones, max 1000.
- **Salida**: `WorkshopActionResult`.
- **Validaciones**:
  - Sesión activa.
  - Rol `ADMIN` y cuenta activa.
  - `workshop_id` debe referenciar un taller existente.
  - Campos validados con `validateWorkshopSettingsInput`.
  - `next_invoice_number` se compara con el valor actual en la base de datos;
    si es menor, retorna `fieldErrors.next_invoice_number`.
- **Comportamiento**:
  - Actualiza `workshop_settings`. `updated_at` se actualiza por trigger.
  - No modifica `logo_path` (se gestiona con `uploadWorkshopLogo`).

### 11.8 `uploadWorkshopLogo(formData)`

- **Módulo**: `modules/admin/workshops/actions.ts`
- **Propósito**: subir o reemplazar el logo del taller en Supabase Storage y
  actualizar `logo_path`.
- **Entrada (FormData)**:
  - `workshop_id` (obligatorio): UUID del taller.
  - `logo` (obligatorio): `File` con la imagen.
- **Salida**: `WorkshopActionResult`.
- **Validaciones**:
  - Sesión activa.
  - Rol `ADMIN` y cuenta activa.
  - `workshop_id` debe referenciar un taller existente.
  - `logo` debe ser tipo `image/png`, `image/jpeg` o `image/webp`.
  - `logo` tamaño máximo 2 MB.
- **Comportamiento**:
  - Si existe un logo anterior, lo elimina de Storage.
  - Sube el archivo a `workshop-logos/{workshop_id}/logo.{ext}`.
  - Actualiza `workshop_settings.logo_path` con la ruta del archivo.
  - Retorna `{ success: true }`.
  - Si el tipo o tamaño son inválidos, retorna `error` con mensaje específico.

### 11.9 `removeWorkshopLogo(formData)`

- **Módulo**: `modules/admin/workshops/actions.ts`
- **Propósito**: eliminar el logo del taller de Storage y limpiar `logo_path`.
- **Entrada (FormData)**:
  - `workshop_id` (obligatorio): UUID del taller.
- **Salida**: `WorkshopActionResult`.
- **Validaciones**:
  - Sesión activa.
  - Rol `ADMIN` y cuenta activa.
  - `workshop_id` debe referenciar un taller existente.
- **Comportamiento**:
  - Si `logo_path` no es null, elimina el archivo de Storage.
  - Actualiza `workshop_settings.logo_path = null`.
  - Retorna `{ success: true }`.

---

## 12. Estructuras de `FormData` y tipos de datos

### 12.1 FormData de Server Actions

```text
createCustomer:
  name: string              (obligatorio, no vacío tras trim, max 255)
  document_type_id: string  (opcional, UUID)
  document_number: string   (opcional, max 50; obligatorio si document_type_id presente)
  phone: string             (opcional, max 50)
  email: string             (opcional, max 255, formato correo)
  address: string           (opcional, max 500)
  notes: string             (opcional, max 1000)

updateCustomer:
  id: string                (obligatorio, UUID)
  + mismos campos que createCustomer

toggleCustomerStatus:
  id: string                (obligatorio, UUID)

updateCustomerAsAdmin:
  id: string                (obligatorio, UUID)
  + mismos campos que createCustomer (sin workshop_id)

toggleCustomerStatusAsAdmin:
  id: string                (obligatorio, UUID)

toggleWorkshopStatus:
  id: string                (obligatorio, UUID)

updateWorkshopSettings:
  workshop_id: string         (obligatorio, UUID)
  business_name: string       (obligatorio, max 255)
  tax_id: string              (opcional, max 50)
  phone: string               (opcional, max 50)
  email: string               (opcional, max 255, formato correo)
  address: string             (opcional, max 500)
  invoice_prefix: string      (obligatorio, regex ^[A-Z0-9]{1,3}$)
  next_invoice_number: string (obligatorio, entero >= 1)
  payment_instructions: string (opcional, max 1000)

uploadWorkshopLogo:
  workshop_id: string        (obligatorio, UUID)
  logo: File                 (obligatorio, PNG/JPEG/WebP, max 2MB)

removeWorkshopLogo:
  workshop_id: string        (obligatorio, UUID)
```

### 12.2 Tipos en `modules/clients/types.ts`

```text
Customer
  id: string
  workshopId: string
  name: string
  documentTypeId: string | null
  documentTypeName: string | null
  documentNumber: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string

CustomerInput
  name: string
  documentTypeId: string | null
  documentNumber: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null

CustomerActionResult
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
```

### 12.3 Tipos en `modules/admin/workshops/types.ts`

```text
Workshop
  id: string
  ownerId: string
  isActive: boolean
  createdAt: string
  updatedAt: string

WorkshopSettings
  workshopId: string
  businessName: string
  taxId: string | null
  phone: string | null
  email: string | null
  address: string | null
  invoicePrefix: string
  nextInvoiceNumber: number
  paymentInstructions: string | null
  logoPath: string | null
  createdAt: string
  updatedAt: string

WorkshopWithSettings
  workshop: Workshop
  settings: WorkshopSettings | null

WorkshopWithCustomers
  workshop: Workshop
  settings: WorkshopSettings | null
  customers: Customer[]

WorkshopActionResult
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
```

### 12.4 Tipos en `modules/admin/clients/types.ts`

```text
Re-exporta Customer, CustomerInput y CustomerActionResult de
modules/clients/types.ts para mantener consistencia.
```

### 12.5 Funciones de query en `modules/clients/queries.ts`

```text
listCustomers(supabase, options?): Promise<Customer[]>
  - Recibe el cliente Supabase autenticado.
  - options.includeInactive: boolean (default false).
  - Si includeInactive es false, filtra por is_active = true.
  - Consulta customers del taller actual (RLS filtra automáticamente).
  - Join con document_types para obtener documentTypeName.
  - Ordena por name ascendente.
  - Retorna array de Customer (vacío si no hay).

getCustomerById(supabase, id): Promise<Customer | null>
  - Consulta customer por id del taller actual (RLS filtra).
  - Join con document_types para obtener documentTypeName.
  - Retorna la persona o null si no existe o no pertenece al taller.

searchCustomersForInvoice(supabase, query): Promise<Customer[]>
  - Función PÚBLICA: diseñada para ser importada por modules/invoices/.
  - Solo personas activas del taller actual.
  - Filtra por name o document_number (ilike, sin distinguir mayúsculas).
  - Limita a 20 resultados.
  - Ordena por name ascendente.
  - Retorna array de Customer activas.
```

### 12.6 Funciones de query en `modules/admin/workshops/queries.ts`

```text
listWorkshopsWithCustomers(supabase): Promise<WorkshopWithCustomers[]>
  - Consulta todos los talleres con su settings y personas agrupadas.
  - RLS permite a ADMIN ver todos los talleres.
  - Join con workshop_settings para obtener business_name y datos.
  - Para cada taller, consulta sus customers (RLS permite a ADMIN ver todos).
  - Ordena talleres por business_name ascendente.
  - Personas ordenadas por name ascendente.
  - Retorna array de WorkshopWithCustomers.

getWorkshopById(supabase, id): Promise<WorkshopWithSettings | null>
  - Consulta taller + settings por id.
  - RLS permite a ADMIN ver cualquier taller.
  - Retorna el taller con su configuración o null si no existe.

listWorkshops(supabase): Promise<Workshop[]>
  - Consulta todos los talleres.
  - Ordena por created_at descendente.
  - Retorna array de Workshop.
```

### 12.7 Funciones de query en `modules/admin/clients/queries.ts`

```text
getCustomerByIdAsAdmin(supabase, id): Promise<Customer | null>
  - Consulta customer por id sin restricción de taller (RLS permite a ADMIN).
  - Join con document_types para obtener documentTypeName.
  - Retorna la persona o null si no existe.

listCustomersByWorkshop(supabase, workshopId): Promise<Customer[]>
  - Consulta customers de un taller específico.
  - RLS permite a ADMIN ver personas de cualquier taller.
  - Ordena por name ascendente.
  - Retorna array de Customer.
```

### 12.8 Validaciones en `modules/clients/validations.ts`

```text
validateCustomerInput(input: CustomerInput):
  | { valid: true }
  | { valid: false; result: CustomerActionResult }

  - name: trim.
    - Si vacío: fieldErrors.name = "El nombre es obligatorio."
    - Si > 255: fieldErrors.name = "El nombre debe tener máximo 255 caracteres."
  - documentTypeId y documentNumber: ambos o ninguno.
    - Si uno presente y otro no:
      fieldErrors.document_number = "Debe indicar tipo y número de documento, o dejar ambos vacíos."
  - documentNumber: si presente, max 50.
    - Si > 50: fieldErrors.document_number = "El número de documento debe tener máximo 50 caracteres."
  - phone: si presente, max 50.
    - Si > 50: fieldErrors.phone = "El teléfono debe tener máximo 50 caracteres."
  - email: si presente, formato correo válido, max 255.
    - Si formato inválido: fieldErrors.email = "El correo no es válido."
    - Si > 255: fieldErrors.email = "El correo debe tener máximo 255 caracteres."
  - address: si presente, max 500.
    - Si > 500: fieldErrors.address = "La dirección debe tener máximo 500 caracteres."
  - notes: si presente, max 1000.
    - Si > 1000: fieldErrors.notes = "Las notas deben tener máximo 1000 caracteres."
```

### 12.9 Validaciones en `modules/admin/workshops/validations.ts`

```text
validateWorkshopSettingsInput(input, currentNextInvoiceNumber):
  | { valid: true }
  | { valid: false; result: WorkshopActionResult }

  - business_name: trim.
    - Si vacío: fieldErrors.business_name = "El nombre comercial es obligatorio."
    - Si > 255: fieldErrors.business_name = "El nombre comercial debe tener máximo 255 caracteres."
  - tax_id: si presente, max 50.
  - phone: si presente, max 50.
  - email: si presente, formato correo válido, max 255.
  - address: si presente, max 500.
  - invoice_prefix: convertir a mayúsculas, trim.
    - Si vacío: fieldErrors.invoice_prefix = "El prefijo es obligatorio."
    - Si no cumple ^[A-Z0-9]{1,3}$: fieldErrors.invoice_prefix = "El prefijo debe tener 1 a 3 letras o números en mayúscula."
  - next_invoice_number: entero >= 1.
    - Si < 1: fieldErrors.next_invoice_number = "El número de factura debe ser mayor o igual a 1."
    - Si < currentNextInvoiceNumber: fieldErrors.next_invoice_number = "El número de factura no puede disminuir."
  - payment_instructions: si presente, max 1000.
```

---

## 13. Componentes de UI necesarios

### 13.1 `CustomerList`

- **Ubicación**: `modules/clients/components/CustomerList.tsx`
- **Tipo**: client component (para búsqueda e interruptor en vivo).
- **Responsabilidad**: renderizar la lista de personas con búsqueda e
  interruptor de inactivos.
- **Props**: `customers: Customer[]`.
- **Contenido**:
  - Campo de texto para filtrar por nombre, documento, teléfono o correo.
  - Interruptor "Mostrar inactivos" que alterna entre personas activas y
    activas + inactivas.
  - Lista de personas: cada fila muestra nombre, documento, teléfono, correo,
    badge de estado (activo/inactivo), enlace a editar y control de
    desactivar/reactivar.
  - Botón "Crear cliente" hacia `/customers/new`.
- **Requisitos**:
  - Filtro en cliente: filtra el array recibido sin recarga.
  - Interruptor en cliente: muestra/oculta inactivos sin recarga.
  - Estados: vacío (mensaje + botón crear), búsqueda sin resultados.
  - Mobile-first: lista vertical a ancho completo.
  - Touch targets mínimo 44x44px.

### 13.2 `CustomerForm`

- **Ubicación**: `modules/clients/components/CustomerForm.tsx`
- **Tipo**: client component.
- **Responsabilidad**: formulario nativo para crear o editar una persona.
  Invoca `createCustomer` o `updateCustomer` según el modo.
- **Props**:
  - `mode: "create" | "edit"`.
  - `customer?: Customer` (solo en modo edit, para precargar).
  - `documentTypes: DocumentType[]` (tipos activos para el select).
  - `action: (formData: FormData) => Promise<CustomerActionResult>`
    (Server Action a invocar).
- **Campos**:
  - `name`: `<input type="text" required maxlength={255}>`.
  - `document_type_id`: `<select>` con opción vacía "Sin documento" y los
    tipos activos. En modo edit, si el tipo asociado está inactivo, se muestra
    como opción deshabilitada con etiqueta "(inactivo)".
  - `document_number`: `<input type="text" maxlength={50}>`. Se deshabilita
    si no hay tipo seleccionado.
  - `phone`: `<input type="tel" maxlength={50}>`.
  - `email`: `<input type="email" maxlength={255}>`.
  - `address`: `<input type="text" maxlength={500}>`.
  - `notes`: `<textarea maxlength={1000}>`.
  - En modo edit, `<input type="hidden" name="id" value={customer.id}>`.
- **Requisitos**:
  - Validación HTML5 nativa + validación manual en cliente.
  - El campo `document_number` se habilita/deshabilita según si hay tipo
    seleccionado.
  - Estado loading: botón muestra "Guardando..." + `disabled` vía
    `useFormStatus`.
  - Muestra `fieldErrors` del Server Action bajo cada campo.
  - Muestra error general bajo el formulario.
  - Al éxito (`success: true`), muestra `showToast.success` y redirige a
    `/customers` con `useRouter().push`.
  - Importa `showToast` de `nextjs-toast-notify` y usa
    `position: "top-right"`.
  - Mobile-first: campos a ancho completo, labels visibles.

### 13.3 `CustomerStatusToggle`

- **Ubicación**: `modules/clients/components/CustomerStatusToggle.tsx`
- **Tipo**: client component.
- **Responsabilidad**: control de doble confirmación para desactivar o
  reactivar una persona.
- **Props**:
  - `customer: Customer`.
  - `action: (formData: FormData) => Promise<CustomerActionResult>`
    (Server Action a invocar).
- **Comportamiento**:
  - Si la persona está activa, muestra botón "Desactivar".
  - Si la persona está inactiva, muestra botón "Reactivar".
  - Al tocar, muestra el primer diálogo de confirmación.
  - Al confirmar el primero, muestra el segundo diálogo de confirmación.
  - Al confirmar el segundo, invoca el Server Action mediante
    `<form action>` con `<input type="hidden" name="id">`.
  - Estado loading: botón "Confirmar" muestra "Procesando..." + `disabled`.
  - Al éxito, `showToast.success` y `router.refresh()`.
  - Al error, `showToast.error`.
  - Importa `showToast` de `nextjs-toast-notify`, `position: "top-right"`.
- **Requisitos**:
  - Touch targets mínimo 44x44px.
  - Accesible: botones con `aria-label` descriptivo.
  - Diálogos con `role="dialog"`, `aria-modal="true"`.

### 13.4 `NotFoundNotice` (clients)

- **Ubicación**: `modules/clients/components/NotFoundNotice.tsx`
- **Tipo**: server component o componente simple.
- **Responsabilidad**: estado "no encontrado" para una persona inexistente.
- **Contenido**:
  - Mensaje: "Cliente no encontrado."
  - Enlace "Volver a la lista" hacia `/customers`.
- **Requisitos**:
  - Mobile-first, centrado.
  - Touch target mínimo 44x44px.

### 13.5 `WorkshopList`

- **Ubicación**: `modules/admin/workshops/components/WorkshopList.tsx`
- **Tipo**: client component (para búsqueda y expansión/colapso de grupos).
- **Responsabilidad**: renderizar los talleres como encabezados agrupados con
  sus personas debajo.
- **Props**: `workshops: WorkshopWithCustomers[]`.
- **Contenido**:
  - Campo de texto para filtrar talleres por nombre comercial.
  - Cada taller se muestra como un encabezado con:
    - Nombre comercial.
    - Badge de estado (activo/inactivo).
    - Controles: enlace a editar configuración, control de
      activar/desactivar.
  - Debajo de cada taller, lista de personas con:
    - Nombre, documento, teléfono, correo.
    - Badge de estado.
    - Controles: editar, desactivar/reactivar.
  - Si un taller no tiene personas, se muestra "Sin clientes."
  - Cada grupo de taller puede expandirse/colapsarse en móvil.
- **Requisitos**:
  - Filtro en cliente: filtra talleres por nombre sin recarga.
  - Mobile-first: grupos colapsables en móvil, expandidos en desktop.
  - Touch targets mínimo 44x44px.

### 13.6 `WorkshopStatusToggle`

- **Ubicación**: `modules/admin/workshops/components/WorkshopStatusToggle.tsx`
- **Tipo**: client component.
- **Responsabilidad**: control de doble confirmación para activar o desactivar
  un taller.
- **Props**:
  - `workshop: Workshop`.
  - `action: (formData: FormData) => Promise<WorkshopActionResult>`.
- **Comportamiento**:
  - Si el taller está activo, muestra botón "Desactivar".
  - Si está inactivo, muestra botón "Reactivar".
  - Doble confirmación igual que `CustomerStatusToggle`.
  - El segundo diálogo advierte: "Esta acción afectará el acceso del
    propietario."
  - Al éxito, `showToast.success` y `router.refresh()`.
  - Al error, `showToast.error`.
- **Requisitos**:
  - Touch targets mínimo 44x44px.
  - Accesible: `aria-label`, `role="dialog"`, `aria-modal="true"`.

### 13.7 `WorkshopSettingsForm`

- **Ubicación**: `modules/admin/workshops/components/WorkshopSettingsForm.tsx`
- **Tipo**: client component.
- **Responsabilidad**: formulario nativo para editar la configuración del
  taller.
- **Props**:
  - `workshop: WorkshopWithSettings`.
  - `action: (formData: FormData) => Promise<WorkshopActionResult>`.
- **Campos**:
  - `business_name`: `<input type="text" required maxlength={255}>`.
  - `tax_id`: `<input type="text" maxlength={50}>`.
  - `phone`: `<input type="tel" maxlength={50}>`.
  - `email`: `<input type="email" maxlength={255}>`.
  - `address`: `<input type="text" maxlength={500}>`.
  - `invoice_prefix`: `<input type="text" required pattern="^[A-Z0-9]{1,3}$"
    maxlength={3}>` con instrucción "1-3 letras o números en mayúscula".
    Convierte a mayúsculas al escribir.
  - `next_invoice_number`: `<input type="number" required min={1}>`.
  - `payment_instructions`: `<textarea maxlength={1000}>`.
  - `<input type="hidden" name="workshop_id" value={workshop.workshop.id}>`.
- **Requisitos**:
  - Validación HTML5 nativa + validación manual en cliente.
  - `invoice_prefix` convierte a mayúsculas al escribir (`onChange`).
  - Estado loading: botón "Guardar cambios" muestra "Guardando..." + `disabled`.
  - Muestra `fieldErrors` bajo cada campo.
  - Muestra error general bajo el formulario.
  - Al éxito, `showToast.success` y `router.refresh()`.
  - Importa `showToast` de `nextjs-toast-notify`, `position: "top-right"`.
  - Mobile-first: campos a ancho completo, labels visibles.

### 13.8 `WorkshopLogoUploader`

- **Ubicación**: `modules/admin/workshops/components/WorkshopLogoUploader.tsx`
- **Tipo**: client component.
- **Responsabilidad**: subida, reemplazo y eliminación del logo del taller.
- **Props**:
  - `workshopId: string`.
  - `currentLogoPath: string | null`.
- **Contenido**:
  - Preview del logo actual (si existe) o placeholder "Sin logo".
  - Botón "Subir logo" que abre un `<input type="file" accept="image/png,image/jpeg,image/webp">`.
  - Botón "Eliminar logo" (si existe logo actual).
  - Validación en cliente de tipo y tamaño antes de enviar.
- **Requisitos**:
  - Validación de tipo: solo PNG, JPEG, WebP.
  - Validación de tamaño: máximo 2 MB.
  - Estado loading: spinner durante la subida.
  - Al éxito, `showToast.success` y `router.refresh()`.
  - Al error de tipo: `showToast.error("El logo debe ser una imagen PNG, JPEG o WebP.")`.
  - Al error de tamaño: `showToast.error("El logo no puede superar 2 MB.")`.
  - Importa `showToast` de `nextjs-toast-notify`, `position: "top-right"`.
  - Mobile-first: preview y controles a ancho completo.
  - Touch targets mínimo 44x44px.

### 13.9 `AdminCustomerForm`

- **Ubicación**: `modules/admin/clients/components/AdminCustomerForm.tsx`
- **Tipo**: client component.
- **Responsabilidad**: formulario nativo para editar una persona desde la
  vista admin (sin creación).
- **Props**:
  - `customer: Customer`.
  - `documentTypes: DocumentType[]`.
  - `action: (formData: FormData) => Promise<CustomerActionResult>`.
- **Campos**: mismos que `CustomerForm` en modo edit.
- **Requisitos**: mismos que `CustomerForm`, pero redirige/recarga según el
  contexto admin. No incluye campo de taller (se determina por la persona).
- **Nota**: puede reutilizar `CustomerForm` con `mode="edit"` y un `action`
  distinto, o ser un componente separado si la lógica de redirección difiere.

### 13.10 `AdminCustomerStatusToggle`

- **Ubicación**: `modules/admin/clients/components/AdminCustomerStatusToggle.tsx`
- **Tipo**: client component.
- **Responsabilidad**: control de doble confirmación para desactivar o
  reactivar una persona desde la vista admin.
- **Props**:
  - `customer: Customer`.
  - `action: (formData: FormData) => Promise<CustomerActionResult>`.
- **Comportamiento**: igual que `CustomerStatusToggle`, pero invoca
  `toggleCustomerStatusAsAdmin`.
- **Nota**: puede reutilizar `CustomerStatusToggle` con un `action` distinto,
  o ser un componente separado.

### 13.11 `NotFoundNotice` (admin workshops)

- **Ubicación**: `modules/admin/workshops/components/NotFoundNotice.tsx`
- **Tipo**: server component o componente simple.
- **Responsabilidad**: estado "no encontrado" para un taller inexistente.
- **Contenido**:
  - Mensaje: "Taller no encontrado."
  - Enlace "Volver a la lista" hacia `/admin/workshops`.
- **Requisitos**:
  - Mobile-first, centrado.
  - Touch target mínimo 44x44px.

### 13.12 `AdminSidebar` (modifica)

- **Ubicación**: `modules/admin/components/AdminSidebar.tsx`
- **Tipo**: client component (sin cambios de tipo).
- **Modificación**:
  - Eliminar la entrada "Clientes" del menú.
  - "Talleres" apunta a `/admin/workshops` sin marca "Próximamente"
    (habilitado).
  - "Servicios" mantiene su marca "Próximamente" (módulo 4.7.4 no
    implementado).

---

## 14. Criterios de aceptación verificables

1. Un `CLIENT` accede a `/customers` y ve la lista de personas activas de su
   taller.
2. Si no hay personas, la lista muestra estado vacío con botón "Crear cliente".
3. La búsqueda filtra por nombre, documento, teléfono o correo sin recarga.
4. El interruptor "Mostrar inactivos" muestra/oculta personas desactivadas.
5. Un `CLIENT` crea una persona con solo nombre; al enviar ve toast de éxito y
   es redirigido a la lista con la nueva persona visible.
6. Un `CLIENT` crea una persona con tipo y número de documento; al enviar ve
   toast de éxito.
7. Si se completa tipo pero no número (o viceversa), el formulario muestra
   error: "Debe indicar tipo y número de documento, o dejar ambos vacíos."
8. Si se intenta crear una persona con tipo+número ya existente en el taller,
   el formulario muestra `fieldErrors.document_number` = "Ya existe un cliente
   con este documento en el taller."
9. Un `CLIENT` edita una persona existente y ve toast de éxito.
10. Al desactivar una persona, se muestran dos confirmaciones consecutivas
    antes de ejecutar; al confirmar, la persona pasa a inactiva y se muestra
    toast de éxito.
11. Al reactivar una persona, se muestran dos confirmaciones consecutivas
    antes de ejecutar; al confirmar, la persona pasa a activa y se muestra
    toast de éxito.
12. Si el ID no existe, la página de detalle muestra "Cliente no encontrado."
    con enlace a la lista.
13. Un `CLIENT` que intenta acceder a `/admin/workshops` es redirigido a
    `/dashboard`.
14. Un `ADMIN` accede a `/admin/workshops` y ve los talleres agrupados con sus
    personas debajo.
15. Si un taller no tiene personas, se muestra "Sin clientes." bajo su
    encabezado.
16. Un `ADMIN` desactiva un taller con doble confirmación; al confirmar, el
    taller pasa a inactivo y se muestra toast de éxito.
17. Un `ADMIN` reactiva un taller inactivo con doble confirmación; al
    confirmar, el taller pasa a activo y se muestra toast de éxito.
18. Un `ADMIN` accede a `/admin/workshops/[id]` y ve el formulario de
    configuración del taller precargado.
19. Al editar y guardar la configuración, ve toast de éxito.
20. Si `ADMIN` intenta disminuir `next_invoice_number`, el formulario muestra
    `fieldErrors.next_invoice_number` = "El número de factura no puede
    disminuir."
21. Si `ADMIN` ingresa un `invoice_prefix` inválido, el formulario muestra
    error bajo el campo.
22. El campo `invoice_prefix` convierte a mayúsculas al escribir.
23. Un `ADMIN` sube un logo PNG/JPEG/WebP válido y ve toast de éxito; la
    preview se actualiza.
24. Si `ADMIN` sube un archivo que no es imagen, ve toast de error "El logo
    debe ser una imagen PNG, JPEG o WebP."
25. Si `ADMIN` sube una imagen mayor a 2 MB, ve toast de error "El logo no
    puede superar 2 MB."
26. Un `ADMIN` elimina el logo del taller y ve toast de éxito; la preview
    queda vacía.
27. Un `ADMIN` edita una persona de cualquier taller y ve toast de éxito.
28. Un `ADMIN` desactiva una persona con doble confirmación y ve toast de
    éxito.
29. Un `ADMIN` reactiva una persona con doble confirmación y ve toast de
    éxito.
30. El `AdminSidebar` no muestra "Clientes" como ruta independiente; "Talleres"
    apunta a `/admin/workshops` habilitado.
31. El enlace a servicios del taller se muestra marcado como "Próximamente".
32. La consulta pública `searchCustomersForInvoice` retorna solo personas
    activas del taller actual, limitadas a 20.
33. Las notificaciones aparecen siempre en `top-right`.
34. `pnpm lint` pasa sin errores.
35. `pnpm build` compila sin errores.

---

## 15. Estrategia de pruebas

### 15.1 Verificación manual con `pnpm dev`

- Login como `CLIENT` y acceso a `/customers`.
- Verificar lista de personas activas.
- Crear persona con solo nombre (debe funcionar).
- Crear persona con tipo+número (debe funcionar).
- Intentar crear persona con tipo sin número (debe mostrar error).
- Intentar crear persona con número sin tipo (debe mostrar error).
- Intentar crear persona con documento duplicado en el mismo taller (debe
  mostrar error).
- Editar persona existente y verificar cambios.
- Desactivar persona: verificar doble confirmación + toast.
- Reactivar persona: verificar doble confirmación + toast.
- Activar interruptor "Mostrar inactivos" y verificar lista.
- Usar búsqueda por nombre, documento, teléfono y correo.
- Verificar estado vacío cuando no hay personas.
- Acceder a un ID inexistente y verificar estado "no encontrado".
- Login como `ADMIN` y acceso a `/admin/workshops`.
- Verificar talleres agrupados con personas.
- Verificar taller sin personas muestra "Sin clientes."
- Activar/desactivar taller con doble confirmación.
- Reactivar taller inactivo con doble confirmación.
- Editar configuración del taller.
- Intentar disminuir `next_invoice_number` (debe mostrar error).
- Ingresar `invoice_prefix` inválido (debe mostrar error).
- Verificar que `invoice_prefix` convierte a mayúsculas al escribir.
- Subir logo válido y verificar actualización de preview.
- Subir archivo no imagen (debe mostrar error).
- Subir imagen > 2 MB (debe mostrar error).
- Eliminar logo y verificar preview vacía.
- Editar persona desde vista admin.
- Desactivar/reactivar persona desde vista admin con doble confirmación.
- Verificar que `CLIENT` no puede acceder a `/admin/workshops`.
- Verificar que `searchCustomersForInvoice` retorna solo activos.
- Verificar `AdminSidebar` sin entrada "Clientes" y "Talleres" habilitado.

### 15.2 Verificación de compilación

- `pnpm lint` sin errores.
- `pnpm build` sin errores de tipos ni rutas.

### 15.3 Verificación de RLS

- Un `CLIENT` no puede leer personas de otro taller (RLS `customers_select`).
- Un `CLIENT` no puede insertar personas en otro taller (RLS
  `customers_insert` con `workshop_id` check).
- Un `CLIENT` no puede editar personas de otro taller (RLS
  `customers_update`).
- Un `ADMIN` puede leer y mutar personas de cualquier taller.
- Un `ADMIN` puede leer y mutar talleres y configuraciones.
- La unicidad de documento por taller se cumple a nivel de índice.

### 15.4 Verificación de concurrencia

- Dos talleres distintos pueden tener personas con el mismo documento
  (unicidad es por taller).
- Dos intentos simultáneos de crear la misma persona con mismo documento en
  el mismo taller: el segundo recibe `fieldErrors.document_number`.

### 15.5 Verificación de migración

- La migración del índice único parcial se aplica sin error.
- El índice no afecta a personas sin documento (ambos campos null).
- El bucket de Storage `workshop-logos` se crea con políticas correctas.
- `ADMIN` y owner del taller pueden leer y escribir en el bucket.
- Otros usuarios no pueden acceder al bucket de logos ajenos.

### 15.6 Verificación de Storage

- Subir logo a `workshop-logos/{workshop_id}/logo.png` funciona.
- Reemplazar logo elimina el archivo anterior y sube el nuevo.
- Eliminar logo borra el archivo de Storage y limpia `logo_path`.
- URL firmada del logo es accesible por el owner y `ADMIN`.

---

## 16. Estructura final de archivos

```text
confectu/
├── app/
│   ├── (private)/
│   │   ├── customers/
│   │   │   ├── page.tsx                              (modifica)
│   │   │   ├── new/
│   │   │   │   └── page.tsx                          (nuevo)
│   │   │   └── [id]/
│   │   │       └── page.tsx                          (nuevo)
│   │   └── ...
│   └── (admin)/
│       └── admin/
│           └── workshops/
│               ├── page.tsx                          (nuevo)
│               └── [id]/
│                   └── page.tsx                      (nuevo)
│
├── modules/
│   ├── clients/
│   │   ├── components/
│   │   │   ├── CustomerList.tsx                      (nuevo)
│   │   │   ├── CustomerForm.tsx                      (nuevo)
│   │   │   ├── CustomerStatusToggle.tsx              (nuevo)
│   │   │   └── NotFoundNotice.tsx                    (nuevo)
│   │   ├── actions.ts                                (nuevo)
│   │   ├── queries.ts                                (nuevo)
│   │   ├── types.ts                                  (nuevo)
│   │   └── validations.ts                            (nuevo)
│   │
│   └── admin/
│       ├── components/
│       │   └── AdminSidebar.tsx                      (modifica)
│       ├── clients/
│       │   ├── components/
│       │   │   ├── AdminCustomerForm.tsx             (nuevo)
│       │   │   ├── AdminCustomerStatusToggle.tsx     (nuevo)
│       │   │   └── NotFoundNotice.tsx                (nuevo)
│       │   ├── actions.ts                            (nuevo)
│       │   ├── queries.ts                            (nuevo)
│       │   ├── types.ts                              (nuevo)
│       │   └── validations.ts                        (nuevo)
│       └── workshops/
│           ├── components/
│           │   ├── WorkshopList.tsx                  (nuevo)
│           │   ├── WorkshopStatusToggle.tsx          (nuevo)
│           │   ├── WorkshopSettingsForm.tsx          (nuevo)
│           │   ├── WorkshopLogoUploader.tsx          (nuevo)
│           │   └── NotFoundNotice.tsx                (nuevo)
│           ├── actions.ts                            (nuevo)
│           ├── queries.ts                            (nuevo)
│           ├── types.ts                              (nuevo)
│           └── validations.ts                        (nuevo)
│
├── supabase/
│   └── migrations/
│       └── {timestamp}_customers_document_unique_storage.sql  (nuevo)
│
└── docs/
    └── modules.md                                    (modifica)
```

### Notas sobre la estructura

- `modules/clients/` contiene toda la lógica específica del CRUD de personas
  para `CLIENT`, siguiendo la estructura esperada definida en
  `docs/modules.md` sección 4.2.
- `modules/admin/clients/` contiene la lógica de edición y toggle de personas
  para `ADMIN`. No incluye creación. Reutiliza las validaciones de
  `modules/clients/validations.ts`.
- `modules/admin/workshops/` contiene la lógica de gestión de talleres y su
  configuración para `ADMIN`, incluyendo la lista unificada con personas
  agrupadas. Este submódulo absorbe el spec 4.7.3.
- `modules/admin/components/AdminSidebar.tsx` se modifica para eliminar
  "Clientes" y habilitar "Talleres" hacia `/admin/workshops`.
- La migración `{timestamp}_customers_document_unique_storage.sql` añade el
  índice único parcial en `customers` y configura el bucket de Storage.

---

## 17. Dependencias

### Nuevas

Ninguna.

### Existentes

- `@supabase/ssr` — manejo de sesión SSR con cookies.
- `@supabase/supabase-js` — cliente Supabase.
- `next` 16.3.0 — App Router, Server Actions.
- `react` 19.2.8 — `useFormStatus`, `useRouter`.
- `nextjs-toast-notify` 1.62.0 — notificaciones toast. Ya instalada en el
  proyecto. Se importa `showToast` en componentes cliente y se usa
  `position: "top-right"` en todas las llamadas.

No se añaden librerías de formularios, validación ni UI. Se usan formularios
nativos, validación HTML5 y validación manual con TypeScript.

---

## 18. Observaciones

- La unicidad de documento es por taller, no global. La misma persona puede
  existir en talleres distintos. El índice único parcial solo aplica cuando
  `document_type_id` y `document_number` son ambos no nulos.
- La lógica de negocio mantiene `workshop_id` discriminado por persona para
  futura implementación de varios talleres por usuario, aunque en el MVP una
  persona pertenece a un solo taller.
- La vista admin unifica talleres y personas en `/admin/workshops`. La ruta
  `/admin/clients` no existe por separado.
- La creación de personas por `ADMIN` queda fuera del MVP; solo `CLIENT` crea
  personas.
- La doble confirmación aplica tanto para desactivar como para reactivar
  personas y talleres.
- El logo del taller se gestiona en Supabase Storage con bucket privado
  `workshop-logos`. La ruta por archivo es `{workshop_id}/logo.{ext}`.
- El enlace a servicios del taller se muestra marcado como "Próximamente"
  hasta que se implemente el spec 4.7.4.
- Este spec absorbe el módulo 4.7.3 (gestión de talleres por `ADMIN`); el
  estado de 4.7.2 y 4.7.3 en `docs/modules.md` se actualiza a "IMPLEMENTADO"
  tras la implementación.
- Las validaciones de campos de persona se comparten entre `modules/clients/`
  y `modules/admin/clients/` para mantener consistencia. El módulo admin
  importa `validateCustomerInput` desde `modules/clients/validations.ts`.
- Las políticas RLS existentes de `customers`, `workshops` y
  `workshop_settings` ya permiten a `ADMIN` leer y mutar cualquier fila. No
  se modifican estas políticas en este spec.
- La consulta pública `searchCustomersForInvoice` está diseñada para ser
  importada por `modules/invoices/` en su spec correspondiente. Respeta RLS
  y devuelve solo personas activas del taller actual.
- El middleware (`proxy.ts`) ya cubre `/customers` como ruta privada y
  `/admin/workshops` como ruta admin. No requiere cambios.
- Se recomienda evaluar en una migración futura una restricción `CHECK` a
  nivel de base de datos para validar el formato de `email` en `customers` y
  `workshop_settings`, complementando la validación de aplicación.
