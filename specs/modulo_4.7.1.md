# Spec: Catálogo global de tipos de documento (Admin)

**Módulo:** `modules/admin/document-types/`
**Número de spec:** 4.7.1
**Estado:** Pendiente de implementación
**Fecha:** 2026-08-20

---

## 1. Objetivo y alcance

Implementar el CRUD del catálogo global de tipos de documento
(`document_types`) administrado exclusivamente por `ADMIN`, junto con la
página de inicio de administración que sirve como punto de entrada a los
submódulos de `modules/admin/`.

### Dentro del alcance

- Listar, crear, editar y activar o desactivar tipos de documento.
- Filtro de texto en la lista por `code` o `name`.
- Página de creación dedicada.
- Página de detalle/edición por ID.
- Confirmación antes de desactivar un tipo.
- Reactivación de tipos inactivos.
- Consulta pública `getActiveDocumentTypes` para que `modules/clients/`
  obtenga los tipos activos sin duplicar lógica ni acceder a archivos
  internos de este submódulo.
- Página de inicio `/admin` con menú desplegable lateral izquierdo de
  submódulos y dashboard central con conteos en vivo de clientes, talleres,
  facturas y servicios.
- Actualización del `AdminHeader` con enlace de regreso a `/admin`.
- Notificaciones de éxito y error con `nextjs-toast-notify` en
  `position: "top-right"`.
- Server Actions que validan rol `ADMIN` y devuelven `fieldErrors` por campo.

### Fuera del alcance

- Eliminación física de tipos de documento (no disponible en el MVP).
- CRUD de clientes, talleres y servicios gestionados por `ADMIN` (otros
  submódulos de `modules/admin/`, specs 4.7.2, 4.7.3 y 4.7.4).
- Migración de esquema: la tabla `document_types` y sus políticas RLS ya
  existen en la migración inicial `20260818012245_init_schema.sql`.
- Implementación de los módulos de negocio (`modules/clients/`,
  `modules/services/`, `modules/invoices/`). Los conteos del dashboard
  reflejarán `0` mientras estos módulos no tengan datos.
- Tabla pre-calculada `admin_dashboard` con triggers. Los conteos se
  calculan en vivo con `COUNT` directo. Se documenta la evolución futura a
  `MATERIALIZED VIEW` si el volumen de datos crece significativamente.

---

## 2. Actores y permisos

| Actor | Descripción | Acceso |
|---|---|---|
| `ADMIN` | Administrador global de Confectu. | Mutar y leer `document_types` (activos e inactivos). Acceder a `/admin/*`. |
| `CLIENT` | Propietario de un taller. | Solo consultar tipos activos vía la función pública `getActiveDocumentTypes`. No puede acceder a `/admin/*`. |
| Usuario no autenticado | Sin sesión activa. | Sin acceso. Redirigido a `/login`. |

### Reglas de permisos

- Todas las Server Actions de este submódulo validan que el usuario
  autenticado tenga rol `ADMIN` y cuenta activa. Si no, retornan error.
- El rol se resuelve en el servidor leyendo `profiles.role`; nunca se acepta
  desde el cliente.
- La validación de rol en Server Actions complementa las políticas RLS
  existentes (defensa en profundidad).
- `CLIENT` no puede acceder a ninguna ruta bajo `/admin/*`. El middleware
  (`proxy.ts`) lo redirige a `/dashboard`.

---

## 3. Flujo principal y flujos alternativos

### 3.1 Flujo principal: listar tipos de documento

1. `ADMIN` accede a `/admin/document-types`.
2. La página (Server Component) consulta `listDocumentTypes` que retorna
   todos los tipos (activos e inactivos) ordenados alfabéticamente por
   `code`.
3. Se renderiza la lista con cada tipo mostrando `code`, `name` y estado
   (activo/inactivo).
4. Un campo de texto permite filtrar la lista por `code` o `name` en el
   cliente (sin recarga).
5. Cada fila tiene enlaces a editar (`/admin/document-types/[id]`) y un
   control para activar/desactivar.

### 3.2 Flujo: crear tipo de documento

1. `ADMIN` accede a `/admin/document-types/new`.
2. Completa el formulario con `code` y `name`.
3. Al enviar, el Server Action `createDocumentType` valida rol `ADMIN`,
   valida los campos y inserta el registro.
4. Si hay errores de validación, retorna `fieldErrors` y el formulario los
   muestra bajo cada campo.
5. Si hay éxito, el componente cliente muestra `showToast.success` y
   redirige a `/admin/document-types`.
6. Si el `code` ya existe (conflicto de unicidad), retorna
   `fieldErrors.code` con mensaje "Este código ya existe.".

### 3.3 Flujo: editar tipo de documento

1. `ADMIN` accede a `/admin/document-types/[id]`.
2. La página consulta `getDocumentTypeById`. Si el ID no existe, muestra
   estado "no encontrado" con enlace a la lista.
3. Si existe, muestra los datos actuales y un formulario precargado con
   `code` y `name`.
4. Al enviar, el Server Action `updateDocumentType` valida rol `ADMIN`,
   valida el ID existe, valida los campos y actualiza.
5. Si hay errores, muestra `fieldErrors` bajo cada campo.
6. Si hay éxito, muestra `showToast.success` y redirige a
   `/admin/document-types`.
7. Si el nuevo `code` colisiona con otro tipo, retorna `fieldErrors.code`.

### 3.4 Flujo: desactivar tipo de documento

1. Desde la lista o el detalle, `ADMIN` activa el control de desactivar.
2. Se muestra una confirmación ("¿Desactivar este tipo de documento? Los
   clientes que lo referencian conservarán la referencia.").
3. Al confirmar, el Server Action `toggleDocumentTypeStatus` pone
   `is_active = false`.
4. Si hay éxito, muestra `showToast.success` y redirige/recarga la lista.

### 3.5 Flujo: reactivar tipo de documento

1. Desde la lista o el detalle, `ADMIN` activa el control de reactivar sobre
   un tipo inactivo.
2. No requiere confirmación (reactivar no tiene riesgo de romper
   referencias).
3. El Server Action `toggleDocumentTypeStatus` pone `is_active = true`.
4. Si hay éxito, muestra `showToast.success`.

### 3.6 Flujo alternativo: tipo inexistente

1. `ADMIN` accede a `/admin/document-types/[id]` con un ID que no existe.
2. La consulta `getDocumentTypeById` retorna `null`.
3. La página muestra un estado "no encontrado" con mensaje y un enlace para
   volver a `/admin/document-types`.

### 3.7 Flujo alternativo: acceso sin permiso

1. Un `CLIENT` intenta acceder a `/admin/document-types`.
2. El middleware lo redirige a `/dashboard`.
3. Un usuario no autenticado es redirigido a `/login`.

### 3.8 Flujo: dashboard de administración

1. `ADMIN` accede a `/admin`.
2. La página consulta los conteos en vivo: cantidad de clientes, talleres,
   facturas y servicios.
3. Se renderiza el dashboard con las cuatro cifras.
4. El menú lateral izquierdo muestra los submódulos: "Tipos de documento"
   (habilitado), "Clientes", "Talleres", "Servicios" (marcados como
   "Próximamente").

---

## 4. Reglas de negocio

1. **`code` obligatorio y único globalmente**: cada tipo de documento tiene
   un código único. No pueden existir dos tipos con el mismo `code`.
2. **Formato de `code`**: solo letras mayúsculas (sin números ni símbolos),
   máximo 5 caracteres. Regex: `^[A-Z]{1,5}$`. El valor se convierte
   automáticamente a mayúsculas antes de validar y guardar (ej: "CC",
   "NIT", "CE").
3. **`code` editable**: el código puede modificarse después de creado. Si el
   nuevo valor ya existe en otro tipo, se rechaza con `fieldErrors.code`.
4. **`name` obligatorio**: no vacío tras `trim`, máximo 255 caracteres.
5. **Sin eliminación física**: la única forma de retirar un tipo es
   desactivarlo (`is_active = false`). La eliminación física queda fuera del
   MVP.
6. **Estado inicial de nuevos tipos**: los nuevos tipos se crean como
   activos (`is_active = true`).
7. **Desactivación con referencias**: se permite desactivar un tipo aunque
   existan clientes que lo referencien. Los clientes conservan la
   referencia. La interfaz pide confirmación antes de desactivar.
8. **Reactivación**: un tipo inactivo puede reactivarse en cualquier momento
   sin restricciones.
9. **Validación de rol `ADMIN`**: todas las Server Actions validan que el
   usuario tenga rol `ADMIN` y cuenta activa antes de ejecutar lógica.
10. **`fieldErrors` por campo**: las Server Actions retornan errores de
    validación por campo en `fieldErrors: Record<string, string>`.
11. **Conteos en vivo**: el dashboard calcula los conteos con `COUNT`
    directo sobre las tablas existentes. No se usa tabla pre-calculada ni
    triggers en este spec.

---

## 5. Estados y transiciones

### 5.1 Tipo de documento

```text
                   createDocumentType
                         │
                         ▼
                      ┌──────┐
          ┌───────────│ activo│───────────┐
          │           └──────┘           │
          │ toggleStatus (desactivar)    │ toggleStatus (reactivar)
          │ con confirmación             │ sin confirmación
          ▼                              │
       ┌────────┐                        │
       │inactivo│────────────────────────┘
       └────────┘
```

- **activo**: `is_active = true`. Visible para talleres en consultas.
- **inactivo**: `is_active = false`. No visible para talleres. Solo `ADMIN`
  lo ve en la lista admin.

### 5.2 Transiciones permitidas

| Origen | Acción | Destino |
|---|---|---|
| (nuevo) | `createDocumentType` | activo |
| activo | `toggleDocumentTypeStatus` (desactivar) | inactivo |
| inactivo | `toggleDocumentTypeStatus` (reactivar) | activo |

No existe transición a "eliminado".

---

## 6. Modelo de datos afectado

### 6.1 Migración nueva

**No se requiere migración nueva.** La tabla `document_types` y sus
políticas RLS ya existen en la migración inicial
`20260818012245_init_schema.sql`.

### 6.2 Tabla existente utilizada

```text
document_types
  id          uuid primary key default gen_random_uuid()
  code        text not null unique
  name        text not null
  is_active   boolean not null default true
  created_at  timestamptz not null default now()
  updated_at  timestamptz not null default now()
```

### 6.3 Restricciones existentes

- `code text not null unique`: unicidad global del código.
- `name text not null`: nombre obligatorio.
- Trigger `document_types_set_updated_at`: actualiza `updated_at`
  automáticamente en cada `update`.

### 6.4 Validación de formato de `code` en aplicación

La validación de formato de `code` (solo mayúsculas, máximo 5) se realiza en
la capa de aplicación (`validations.ts` y Server Action). No se añade una
restricción `CHECK` nueva en la base de datos en este spec para no alterar
la migración existente.

> **Recomendación futura**: evaluar añadir una restricción
> `CHECK (code ~ '^[A-Z]{1,5}$')` en una migración posterior para
> garantizar el formato también a nivel de base de datos.

### 6.5 Tablas consultadas por el dashboard

El dashboard de `/admin` consulta conteos en vivo sobre las siguientes
tablas existentes (sin requerir que sus módulos de aplicación estén
implementados):

| Conteo | Tabla | Consulta |
|---|---|---|
| Clientes | `customers` | `SELECT count(*) FROM customers` |
| Talleres | `workshops` | `SELECT count(*) FROM workshops` |
| Facturas | `invoices` | `SELECT count(*) FROM invoices` |
| Servicios | `services` | `SELECT count(*) FROM services` |

Estas consultas respetan las políticas RLS existentes: `ADMIN` puede leer
todas las filas de `customers` y `workshops` (políticas incluyen
`public.is_admin()`). Para `invoices` y `services`, las políticas actuales
**solo permiten al owner del taller**; por tanto, el conteo de facturas y
servicios en el dashboard requiere que `ADMIN` tenga permiso de lectura.

> **Nota de RLS**: las políticas `invoices_select` y `services_select`
> actualmente restringen a `workshop_id = current_workshop_id()` sin
> incluir `is_admin()`. Para que el dashboard muestre conteos globales de
> facturas y servicios, se debe ajustar estas políticas para permitir a
> `ADMIN` leer todas las filas. Esto se documenta como requisito de este
> spec (ver sección 7).

---

## 7. Reglas de aislamiento multi-tenant y RLS

### 7.1 RLS existente de `document_types`

```sql
-- Cualquier autenticado lee activos; ADMIN lee todos.
create policy document_types_select on public.document_types
  for select to authenticated
  using (is_active = true or public.is_admin());

-- Solo ADMIN inserta.
create policy document_types_insert on public.document_types
  for insert to authenticated
  with check (public.is_admin());

-- Solo ADMIN actualiza.
create policy document_types_update on public.document_types
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Solo ADMIN elimina.
create policy document_types_delete on public.document_types
  for delete to authenticated
  using (public.is_admin());
```

Estas políticas ya están creadas y son suficientes para este spec. No se
modifican.

### 7.2 Ajuste de RLS requerido para el dashboard

Para que `ADMIN` pueda ver conteos globales de facturas y servicios en el
dashboard, se requiere una **migración nueva** que ajuste las políticas
`invoices_select` y `services_select` para incluir `public.is_admin()`:

```sql
-- services_select: permitir a ADMIN leer todos los servicios.
drop policy services_select on public.services;
create policy services_select on public.services
  for select to authenticated
  using (workshop_id = public.current_workshop_id() or public.is_admin());

-- invoices_select: permitir a ADMIN leer todas las facturas.
drop policy invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select to authenticated
  using (workshop_id = public.current_workshop_id() or public.is_admin());
```

> **Importante**: este ajuste solo añade permiso de **lectura** (`select`)
> para `ADMIN`. No se modifican las políticas de `insert`, `update` ni
> `delete` de `services` ni `invoices`. La mutación de servicios por
> `ADMIN` se trata en el spec 4.7.4; la mutación de facturas por `ADMIN`
> queda fuera del alcance del MVP.

### 7.3 Validación en Server Actions

- Toda Server Action de este submódulo valida sesión activa y rol `ADMIN`
  antes de ejecutar lógica.
- La consulta pública `getActiveDocumentTypes` no requiere rol `ADMIN`:
  respeta RLS y devuelve solo tipos activos a cualquier usuario
  autenticado.
- Las consultas del dashboard (`getAdminCounts`) se ejecutan con el cliente
  Supabase autenticado del `ADMIN`; RLS permite leer todas las filas tras
  el ajuste de la sección 7.2.

### 7.4 Service role key

No se usa la service role key en este spec. Todas las operaciones se
realizan con el cliente Supabase autenticado del usuario, respetando RLS.

---

## 8. Validaciones funcionales

### 8.1 Crear y editar (`createDocumentType`, `updateDocumentType`)

| Campo | Regla |
|---|---|
| `code` | Obligatorio. Solo letras mayúsculas, máximo 5. Regex: `^[A-Z]{1,5}$`. Se convierte a mayúsculas antes de validar. Único globalmente. |
| `name` | Obligatorio. No vacío tras `trim`. Máximo 255 caracteres. |

### 8.2 Toggle de estado (`toggleDocumentTypeStatus`)

| Campo | Regla |
|---|---|
| `id` | Obligatorio. Debe referenciar un tipo existente. Si no existe, retorna error. |

### 8.3 Validación duplicada

- **Cliente**: validación HTML5 nativa (`required`, `pattern`, `maxlength`)
  más validación manual en el componente antes de enviar.
- **Servidor**: el Server Action valida los campos con `validations.ts`. Si
  la validación pasa pero Postgres rechaza por unicidad de `code`, el
  Server Action detecta el error y retorna `fieldErrors.code` con mensaje
  "Este código ya existe.".

### 8.4 Validación de rol

| Regla | Descripción |
|---|---|
| Sesión activa | Toda Server Action verifica sesión. Si no hay, retorna error "No hay sesión activa." |
| Rol `ADMIN` | Toda Server Action verifica `profiles.role = 'ADMIN'`. Si no, retorna error "Solo los administradores pueden realizar esta acción." |
| Cuenta activa | Toda Server Action verifica `profiles.is_active = true`. Si no, retorna error. |

---

## 9. Errores y estados de la interfaz

### 9.1 Lista `/admin/document-types`

| Estado | Comportamiento |
|---|---|
| Loading | Spinner o esqueleto mientras carga la consulta. |
| Con datos | Lista de tipos ordenados por `code`. Cada fila muestra `code`, `name`, estado y controles. |
| Vacío | Mensaje "No hay tipos de documento." con botón "Crear tipo" hacia `/admin/document-types/new`. |
| Error carga | Mensaje "No se pudieron cargar los tipos de documento." con botón de reintentar. |
| Filtro sin resultados | Mensaje "No se encontraron tipos con ese filtro." |
| Éxito acción | Toast `showToast.success` en `top-right` tras crear, editar, activar o desactivar. |

### 9.2 Formulario crear `/admin/document-types/new`

| Estado | Comportamiento |
|---|---|
| Idle | Formulario con campos `code` y `name`. Validación HTML5 nativa. |
| Validación inline | Errores mostrados bajo cada campo antes de enviar. |
| Loading | Botón "Crear tipo" muestra "Guardando..." y se deshabilita. |
| Éxito | `showToast.success("Tipo de documento creado")` y redirección a `/admin/document-types`. |
| Error servidor | `fieldErrors` bajo cada campo + error general bajo el formulario. Botón habilitado para reintentar. |
| `code` duplicado | `fieldErrors.code` = "Este código ya existe." |

### 9.3 Detalle/edición `/admin/document-types/[id]`

| Estado | Comportamiento |
|---|---|
| Loading | Spinner mientras carga el tipo. |
| Encontrado | Datos actuales + formulario precargado con `code` y `name`. Controles de activar/desactivar. |
| No encontrado | Mensaje "Tipo de documento no encontrado." con enlace a `/admin/document-types`. |
| Validación inline | Errores bajo cada campo. |
| Loading edición | Botón "Guardar cambios" muestra "Guardando..." y se deshabilita. |
| Éxito edición | `showToast.success("Tipo de documento actualizado")` y redirección a la lista. |
| Error edición | `fieldErrors` + error general. Botón habilitado. |

### 9.4 Desactivar tipo

| Estado | Comportamiento |
|---|---|
| Confirmación | Diálogo o mensaje inline: "¿Desactivar este tipo de documento? Los clientes que lo referencian conservarán la referencia." con botones "Cancelar" y "Desactivar". |
| Loading | Botón "Desactivar" muestra "Procesando..." y se deshabilita. |
| Éxito | `showToast.success("Tipo de documento desactivado")` y redirección/recarga. |
| Error | `showToast.error` con mensaje. |

### 9.5 Reactivar tipo

| Estado | Comportamiento |
|---|---|
| Sin confirmación | Botón "Reactivar" ejecuta directamente. |
| Loading | Botón muestra "Procesando..." y se deshabilita. |
| Éxito | `showToast.success("Tipo de documento reactivado")`. |
| Error | `showToast.error` con mensaje. |

### 9.6 Dashboard `/admin`

| Estado | Comportamiento |
|---|---|
| Loading | Spinner mientras cargan los conteos. |
| Con datos | Cuatro tarjetas con cifras: Clientes, Talleres, Facturas, Servicios. |
| Error carga | Mensaje "No se pudieron cargar las estadísticas." con botón de reintentar. |

### 9.7 Errores de permisos

| Estado | Comportamiento |
|---|---|
| `CLIENT` accede a `/admin/*` | Redirección silenciosa a `/dashboard` (gestionada por middleware). |
| Sin sesión | Redirección a `/login` (gestionada por middleware). |

---

## 10. Rutas y pantallas afectadas

| Ruta | Archivo | Descripción |
|---|---|---|
| `/admin` | `app/(admin)/admin/page.tsx` (modifica) | Dashboard con conteos en vivo + menú lateral de submódulos. |
| `/admin/document-types` | `app/(admin)/admin/document-types/page.tsx` (nuevo) | Lista de tipos con filtro. |
| `/admin/document-types/new` | `app/(admin)/admin/document-types/new/page.tsx` (nuevo) | Formulario de creación. |
| `/admin/document-types/[id]` | `app/(admin)/admin/document-types/[id]/page.tsx` (nuevo) | Detalle/edición del tipo. |
| Layout admin | `app/(admin)/admin/layout.tsx` (modifica) | Incluye `AdminSidebar` además de `AdminHeader`. |
| `AdminHeader` | `modules/auth/components/AdminHeader.tsx` (modifica) | Añade enlace a `/admin`. |

### Notas sobre la organización de rutas

- Las rutas bajo `(admin)/admin/` heredan el layout admin con `AdminHeader`
  y `AdminSidebar`.
- `/admin/document-types/new` y `/admin/document-types/[id]` son rutas
  anidadas bajo `document-types/`.
- El middleware (`proxy.ts`) ya redirige a `CLIENT` fuera de `/admin/*`; no
  requiere cambios.

---

## 11. Server Actions necesarias

### 11.1 `createDocumentType(formData)`

- **Módulo**: `modules/admin/document-types/actions.ts`
- **Propósito**: crear un nuevo tipo de documento activo.
- **Entrada (FormData)**:
  - `code` (obligatorio): código del tipo, solo mayúsculas, max 5.
  - `name` (obligatorio): nombre del tipo, max 255.
- **Salida**: objeto `DocumentTypeActionResult` con `{ success: true }` o
  `{ success: false, error?: string, fieldErrors?: Record<string, string> }`.
- **Validaciones**:
  - Sesión activa.
  - Rol `ADMIN` y cuenta activa.
  - `code`: convertir a mayúsculas, regex `^[A-Z]{1,5}$`, obligatorio.
  - `name`: no vacío tras trim, max 255, obligatorio.
- **Comportamiento**:
  - Inserta en `document_types` con `is_active = true`.
  - Si Postgres rechaza por unicidad de `code`, retorna
    `fieldErrors.code` = "Este código ya existe.".
  - Si hay error inesperado, retorna `error` con mensaje genérico.

### 11.2 `updateDocumentType(formData)`

- **Módulo**: `modules/admin/document-types/actions.ts`
- **Propósito**: actualizar `code` y `name` de un tipo existente.
- **Entrada (FormData)**:
  - `id` (obligatorio): UUID del tipo a actualizar.
  - `code` (obligatorio): nuevo código, solo mayúsculas, max 5.
  - `name` (obligatorio): nuevo nombre, max 255.
- **Salida**: `DocumentTypeActionResult`.
- **Validaciones**:
  - Sesión activa.
  - Rol `ADMIN` y cuenta activa.
  - `id` debe referenciar un tipo existente. Si no, retorna error.
  - `code`: convertir a mayúsculas, regex `^[A-Z]{1,5}$`, obligatorio.
  - `name`: no vacío tras trim, max 255, obligatorio.
- **Comportamiento**:
  - Actualiza `code` y `name` en `document_types`. `updated_at` se
    actualiza automáticamente por trigger.
  - Si el nuevo `code` colisiona con otro tipo, retorna
    `fieldErrors.code` = "Este código ya existe.".
  - No modifica `is_active` (el estado se maneja con
    `toggleDocumentTypeStatus`).

### 11.3 `toggleDocumentTypeStatus(formData)`

- **Módulo**: `modules/admin/document-types/actions.ts`
- **Propósito**: alternar `is_active` de un tipo existente (desactivar o
  reactivar).
- **Entrada (FormData)**:
  - `id` (obligatorio): UUID del tipo.
- **Salida**: `DocumentTypeActionResult`.
- **Validaciones**:
  - Sesión activa.
  - Rol `ADMIN` y cuenta activa.
  - `id` debe referenciar un tipo existente. Si no, retorna error.
- **Comportamiento**:
  - Consulta el estado actual de `is_active`.
  - Si está activo, lo desactiva (`is_active = false`).
  - Si está inactivo, lo reactiva (`is_active = true`).
  - Retorna `{ success: true }`.

---

## 12. Estructuras de `FormData` y tipos de datos

### 12.1 FormData de Server Actions

```text
createDocumentType:
  code: string   (obligatorio, regex ^[A-Z]{1,5}$, se convierte a mayúsculas)
  name: string   (obligatorio, no vacío tras trim, max 255)

updateDocumentType:
  id: string     (obligatorio, UUID del tipo)
  code: string   (obligatorio, regex ^[A-Z]{1,5}$, se convierte a mayúsculas)
  name: string   (obligatorio, no vacío tras trim, max 255)

toggleDocumentTypeStatus:
  id: string     (obligatorio, UUID del tipo)
```

### 12.2 Tipos en `modules/admin/document-types/types.ts`

```text
DocumentType
  id: string
  code: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string

DocumentTypeInput
  code: string
  name: string

DocumentTypeActionResult
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>

AdminCounts
  customers: number
  workshops: number
  invoices: number
  services: number
```

### 12.3 Funciones de query en `modules/admin/document-types/queries.ts`

```text
listDocumentTypes(supabase): Promise<DocumentType[]>
  - Recibe el cliente Supabase autenticado.
  - Consulta todos los document_types ordenados por code ascendente.
  - RLS permite a ADMIN ver activos e inactivos.
  - Retorna array de DocumentType (vacío si no hay).

getDocumentTypeById(supabase, id): Promise<DocumentType | null>
  - Consulta document_types donde id = id.
  - Retorna el tipo o null si no existe.

getActiveDocumentTypes(supabase): Promise<DocumentType[]>
  - Consulta document_types donde is_active = true, ordenados por name.
  - Función PÚBLICA: diseñada para ser importada por modules/clients/.
  - RLS devuelve solo activos a cualquier autenticado.
  - Retorna array de DocumentType activos.

getAdminCounts(supabase): Promise<AdminCounts>
  - Ejecuta cuatro COUNT sobre customers, workshops, invoices, services.
  - RLS (tras ajuste de sección 7.2) permite a ADMIN ver todas las filas.
  - Retorna objeto AdminCounts.
```

### 12.4 Validaciones en `modules/admin/document-types/validations.ts`

```text
validateDocumentTypeInput(input: DocumentTypeInput):
  | { valid: true }
  | { valid: false; result: DocumentTypeActionResult }

  - code: convertir a mayúsculas, trim.
    - Si vacío: fieldErrors.code = "El código es obligatorio."
    - Si no cumple ^[A-Z]{1,5}$: fieldErrors.code =
      "El código debe tener 1 a 5 letras en mayúscula."
  - name: trim.
    - Si vacío: fieldErrors.name = "El nombre es obligatorio."
    - Si > 255: fieldErrors.name =
      "El nombre debe tener máximo 255 caracteres."
```

---

## 13. Componentes de UI necesarios

### 13.1 `AdminSidebar`

- **Ubicación**: `modules/admin/components/AdminSidebar.tsx`
- **Tipo**: client component (para colapsar/desplegar el menú en móvil).
- **Responsabilidad**: menú desplegable lateral izquierdo con enlaces a los
  submódulos de administración.
- **Contenido**:
  - Enlace "Inicio" hacia `/admin`.
  - Enlace "Tipos de documento" hacia `/admin/document-types` (habilitado).
  - Enlaces "Clientes", "Talleres", "Servicios" marcados como
    "Próximamente" (deshabilitados).
- **Requisitos**:
  - Mobile-first: en móvil el menú se colapsa tras un botón hamburguesa
    y se despliega al tocarlo; en desktop se muestra fijo a la izquierda.
  - Enlace activo destacado según la ruta actual.
  - Touch targets mínimo 44x44px.
  - Accesible: `nav` con `aria-label`, botón hamburguesa con
    `aria-expanded`.

### 13.2 `AdminDashboard`

- **Ubicación**: `modules/admin/components/AdminDashboard.tsx`
- **Tipo**: server component (recibe los conteos como props).
- **Responsabilidad**: panel central del dashboard con los conteos en vivo.
- **Props**: `counts: AdminCounts`.
- **Contenido**:
  - Cuatro tarjetas: Clientes, Talleres, Facturas, Servicios. Cada una
    muestra la cifra correspondiente.
- **Requisitos**:
  - Mobile-first: tarjetas en una columna en móvil, cuadrícula en
    desktop.
  - Estados: loading (esqueleto), error (mensaje + reintentar).

### 13.3 `DocumentTypeList`

- **Ubicación**: `modules/admin/document-types/components/DocumentTypeList.tsx`
- **Tipo**: client component (para el filtro de texto en vivo).
- **Responsabilidad**: renderizar la lista de tipos con filtro.
- **Props**: `documentTypes: DocumentType[]`.
- **Contenido**:
  - Campo de texto para filtrar por `code` o `name`.
  - Lista de tipos: cada fila muestra `code`, `name`, badge de estado
    (activo/inactivo), enlace a editar y control de activar/desactivar.
  - Botón "Crear tipo" hacia `/admin/document-types/new`.
- **Requisitos**:
  - Filtro en cliente: filtra el array recibido sin recarga.
  - Estados: vacío (mensaje + botón crear), filtro sin resultados.
  - Mobile-first: lista vertical a ancho completo.
  - Touch targets mínimo 44x44px.

### 13.4 `DocumentTypeForm`

- **Ubicación**: `modules/admin/document-types/components/DocumentTypeForm.tsx`
- **Tipo**: client component.
- **Responsabilidad**: formulario nativo para crear o editar un tipo.
  Invoca `createDocumentType` o `updateDocumentType` según el modo.
- **Props**:
  - `mode: "create" | "edit"`.
  - `documentType?: DocumentType` (solo en modo edit, para precargar).
  - `action: (formData: FormData) => Promise<DocumentTypeActionResult>`
    (Server Action a invocar).
- **Campos**:
  - `code`: `<input type="text" required pattern="^[A-Z]{1,5}$"
    maxlength={5}>` con instrucción visible "1 a 5 letras en mayúscula".
    En modo edit, precargado con el valor actual.
  - `name`: `<input type="text" required maxlength={255}>`. En modo edit,
    precargado.
  - En modo edit, `<input type="hidden" name="id" value={documentType.id}>`.
- **Requisitos**:
  - Validación HTML5 nativa + validación manual en cliente.
  - El campo `code` convierte a mayúsculas al escribir (`onChange`).
  - Estado loading: botón muestra "Guardando..." + `disabled` vía
    `useFormStatus`.
  - Muestra `fieldErrors` del Server Action bajo cada campo.
  - Muestra error general bajo el formulario.
  - Al éxito (`success: true`), muestra `showToast.success` y redirige a
    `/admin/document-types` con `useRouter().push`.
  - Importa `showToast` de `nextjs-toast-notify` y usa
    `position: "top-right"`.
  - Mobile-first: campos a ancho completo, labels visibles.

### 13.5 `DocumentTypeStatusToggle`

- **Ubicación**: `modules/admin/document-types/components/DocumentTypeStatusToggle.tsx`
- **Tipo**: client component.
- **Responsabilidad**: control para activar o desactivar un tipo.
- **Props**:
  - `documentType: DocumentType`.
- **Comportamiento**:
  - Si el tipo está activo, muestra botón "Desactivar". Al tocar, muestra
    confirmación inline: "¿Desactivar este tipo de documento? Los clientes
    que lo referencian conservarán la referencia." con botones "Cancelar"
    y "Desactivar".
  - Si el tipo está inactivo, muestra botón "Reactivar" sin confirmación.
  - Al confirmar, invoca `toggleDocumentTypeStatus` mediante
    `<form action={toggleDocumentTypeStatus}>` con un `<input type="hidden"
    name="id">`.
  - Estado loading: botón muestra "Procesando..." + `disabled`.
  - Al éxito, `showToast.success` y recarga la lista
    (`router.refresh()`).
  - Al error, `showToast.error`.
  - Importa `showToast` de `nextjs-toast-notify`, `position: "top-right"`.
- **Requisitos**:
  - Touch targets mínimo 44x44px.
  - Accesible: botones con `aria-label` descriptivo.

### 13.6 `NotFoundNotice`

- **Ubicación**: `modules/admin/document-types/components/NotFoundNotice.tsx`
- **Tipo**: server component o componente simple.
- **Responsabilidad**: estado "no encontrado" para un ID inexistente.
- **Contenido**:
  - Mensaje: "Tipo de documento no encontrado."
  - Enlace "Volver a la lista" hacia `/admin/document-types`.
- **Requisitos**:
  - Mobile-first, centrado.
  - Touch target mínimo 44x44px.

---

## 14. Criterios de aceptación verificables

1. Un `ADMIN` autenticado accede a `/admin` y ve el menú lateral con
   "Tipos de documento" habilitado y "Clientes", "Talleres", "Servicios"
   marcados como "Próximamente".
2. El dashboard de `/admin` muestra cuatro tarjetas con los conteos de
   clientes, talleres, facturas y servicios (inicialmente `0`).
3. Un `ADMIN` accede a `/admin/document-types` y ve la lista de tipos
   ordenados por `code`.
4. Si no hay tipos, la lista muestra el estado vacío con botón "Crear tipo".
5. El filtro de texto filtra la lista por `code` o `name` sin recarga.
6. Un `ADMIN` accede a `/admin/document-types/new`, completa `code` y
   `name`, y al enviar ve un toast de éxito y es redirigido a la lista con
   el nuevo tipo visible.
7. El campo `code` convierte a mayúsculas al escribir.
8. Si el `code` no cumple `^[A-Z]{1,5}$`, el formulario muestra error bajo
   el campo.
9. Si el `name` está vacío, el formulario muestra error bajo el campo.
10. Si se intenta crear un `code` que ya existe, el formulario muestra
    `fieldErrors.code` = "Este código ya existe.".
11. Un `ADMIN` accede a `/admin/document-types/[id]` y ve los datos del
    tipo en un formulario precargado.
12. Al editar y guardar, ve un toast de éxito y es redirigido a la lista.
13. Si el ID no existe, la página muestra "Tipo de documento no encontrado."
    con enlace a la lista.
14. Un `ADMIN` desactiva un tipo activo: se muestra confirmación; al
    confirmar, el tipo pasa a inactivo y se muestra toast de éxito.
15. Un `ADMIN` reactiva un tipo inactivo: sin confirmación, el tipo pasa a
    activo y se muestra toast de éxito.
16. Un `CLIENT` que intenta acceder a `/admin/document-types` es
    redirigido a `/dashboard`.
17. Un usuario no autenticado es redirigido a `/login`.
18. La consulta pública `getActiveDocumentTypes` retorna solo tipos
    activos a un `CLIENT`.
19. El `AdminHeader` incluye un enlace a `/admin`.
20. Las notificaciones aparecen siempre en `top-right`.
21. `pnpm lint` pasa sin errores.
22. `pnpm build` compila sin errores.

---

## 15. Estrategia de pruebas

### 15.1 Verificación manual con `pnpm dev`

- Login como `ADMIN` y acceso a `/admin`.
- Verificar dashboard con conteos (inicialmente `0`).
- Verificar menú lateral con submódulos.
- Crear un tipo de documento con `code` válido y `name`.
- Verificar toast de éxito y redirección a la lista.
- Intentar crear un tipo con `code` duplicado (debe mostrar error de
  campo).
- Intentar crear un tipo con `code` inválido (números, símbolos, más de 5
  caracteres) (debe mostrar error de validación).
- Editar un tipo existente y verificar cambios.
- Acceder a un ID inexistente y verificar estado "no encontrado".
- Desactivar un tipo activo y verificar confirmación + toast.
- Reactivar un tipo inactivo y verificar toast.
- Usar el filtro de texto en la lista.
- Verificar estado vacío cuando no hay tipos.
- Login como `CLIENT` e intentar acceder a `/admin/document-types` (debe
  redirigir a `/dashboard`).
- Verificar que `getActiveDocumentTypes` retorna solo activos.

### 15.2 Verificación de compilación

- `pnpm lint` sin errores.
- `pnpm build` sin errores de tipos ni rutas.

### 15.3 Verificación de RLS

- Un `CLIENT` no puede insertar en `document_types` (RLS
  `document_types_insert` lo impide con `with check (public.is_admin())`).
- Un `CLIENT` no puede actualizar `document_types` (RLS
  `document_types_update` lo impide).
- Un `CLIENT` solo lee tipos activos (RLS `document_types_select`).
- Un `ADMIN` lee activos e inactivos y puede mutar.
- Tras el ajuste de RLS, un `ADMIN` puede leer todas las facturas y
  servicios para los conteos del dashboard.

### 15.4 Verificación de concurrencia

- Dos administradores intentan crear el mismo `code` simultáneamente: el
  segundo recibe `fieldErrors.code` = "Este código ya existe.".

### 15.5 Verificación de migración

- La migración de ajuste de RLS (`invoices_select` y `services_select`)
  se aplica sin error.
- Las políticas existentes de `insert`, `update` y `delete` de `invoices`
  y `services` no se ven afectadas.

---

## 16. Estructura final de archivos

```text
confectu/
├── app/
│   └── (admin)/
│       └── admin/
│           ├── layout.tsx                              (modifica)
│           ├── page.tsx                                (modifica)
│           └── document-types/
│               ├── page.tsx                            (nuevo)
│               ├── new/
│               │   └── page.tsx                        (nuevo)
│               └── [id]/
│                   └── page.tsx                        (nuevo)
│
├── modules/
│   ├── auth/
│   │   └── components/
│   │       └── AdminHeader.tsx                         (modifica)
│   └── admin/
│       ├── components/
│       │   └── AdminSidebar.tsx                        (nuevo)
│       └── document-types/
│           ├── components/
│           │   ├── DocumentTypeList.tsx                (nuevo)
│           │   ├── DocumentTypeForm.tsx                (nuevo)
│           │   ├── DocumentTypeStatusToggle.tsx        (nuevo)
│           │   └── NotFoundNotice.tsx                  (nuevo)
│           ├── actions.ts                              (nuevo)
│           ├── queries.ts                              (nuevo)
│           ├── types.ts                                (nuevo)
│           └── validations.ts                          (nuevo)
│
├── supabase/
│   └── migrations/
│       └── {timestamp}_admin_read_invoices_services.sql (nuevo)
│
└── specs/
    └── modulo_4.7.1.md                                 (este archivo)
```

### Notas sobre la estructura

- `modules/admin/components/AdminSidebar.tsx` se coloca fuera del
  submódulo `document-types/` porque es un componente de navegación
  transversal a todo `modules/admin/`, no específico de tipos de
  documento.
- `modules/admin/document-types/` contiene toda la lógica específica del
  CRUD de tipos de documento, siguiendo la estructura esperada definida en
  `docs/modules.md` sección 4.7.
- La migración `{timestamp}_admin_read_invoices_services.sql` ajusta las
  políticas RLS de `invoices_select` y `services_select` para permitir a
  `ADMIN` leer todas las filas (necesario para los conteos del dashboard).

---

## 17. Dependencias

### Nuevas

- `nextjs-toast-notify` 1.62.0 — notificaciones toast. Ya instalada en el
  proyecto. Se importa `showToast` en componentes cliente y se usa
  `position: "top-right"` en todas las llamadas.

### Existentes

- `@supabase/ssr` — manejo de sesión SSR con cookies.
- `@supabase/supabase-js` — cliente Supabase.
- `next` 16.3.0 — App Router, Server Actions.
- `react` 19.2.8 — `useFormStatus`, `useRouter`.

No se añaden librerías de formularios, validación ni UI. Se usan formularios
nativos, validación HTML5 y validación manual con TypeScript.

---

## 18. Observaciones

- La tabla `document_types` y sus políticas RLS ya existen en la migración
  inicial. Este spec no crea la tabla; solo añade la lógica de aplicación.
- La única migración nueva ajusta `invoices_select` y `services_select`
  para permitir a `ADMIN` leer todas las filas, habilitando los conteos
  globales del dashboard. Este ajuste no modifica las políticas de mutación
  de `invoices` ni `services`.
- El dashboard usa `COUNT` en vivo sobre las tablas existentes. No se
  introduce una tabla pre-calculada con triggers. Se documenta como
  evolución futura una `MATERIALIZED VIEW` refrescada periódicamente con
  `pg_cron` si el volumen de datos crece a cientos de miles o millones de
  registros.
- La consulta pública `getActiveDocumentTypes` está diseñada para ser
  importada por `modules/clients/` en su spec correspondiente. Respeta RLS
  y devuelve solo tipos activos a cualquier usuario autenticado.
- El formato de `code` (solo mayúsculas, max 5) se valida en aplicación.
  Se recomienda evaluar en una migración futura una restricción
  `CHECK (code ~ '^[A-Z]{1,5}$')` para garantizar el formato también a
  nivel de base de datos.
- Las notificaciones con `nextjs-toast-notify` se usan en todos los
  componentes cliente que ejecutan acciones (crear, editar, activar,
  desactivar), siempre con `position: "top-right"`, conforme a la regla
  añadida en `AGENTS.md`.
- El menú lateral `AdminSidebar` es transversal a `modules/admin/` y se
  colocará en `modules/admin/components/`. Los futuros submódulos
  (4.7.2, 4.7.3, 4.7.4) añadirán sus enlaces a este menú al
  implementarse.
