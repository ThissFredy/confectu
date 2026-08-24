# Spec: Catálogo de servicios del taller (CLIENT) y vista de solo lectura de servicios por taller (ADMIN)

**Módulos:** `modules/services/`, porción de solo lectura de `modules/admin/workshops/`
**Número de spec:** 4.3 + 4.7.4 (solo lectura)
**Estado:** Pendiente de implementación
**Fecha:** 2026-08-24

---

## 1. Objetivo y alcance

Implementar el CRUD de servicios o prendas reutilizables (`services`) para el
rol `CLIENT`, y una vista de **solo lectura** de los servicios de un taller
para el rol `ADMIN`, integrada dentro del detalle del taller existente.

Este spec absorbe la porción de solo lectura del módulo 4.7.4. `ADMIN` no
crea, no edita, no desactiva y no elimina servicios; únicamente los consulta
agrupados bajo el taller al que pertenecen.

### Dentro del alcance

**Vista CLIENT (`/services`):**

- Listar servicios del taller (solo activos por defecto) con búsqueda por
  **nombre** e interruptor para mostrar/ocultar inactivos.
- Crear servicio con nombre (obligatorio), descripción opcional, categoría
  opcional y precio base en COP.
- Editar servicio existente.
- Desactivar y reactivar servicio, ambas con doble confirmación.
- Eliminar físicamente un servicio con doble confirmación; la eliminación se
  bloquea si el servicio está referenciado por líneas de factura.
- Consulta pública `listActiveServices` para el futuro flujo de factura
  (módulo 4.5), que devuelve únicamente los servicios activos del taller.

**Vista ADMIN (`/admin/workshops/[id]`):**

- Bloque "Servicios" dentro del detalle del taller que lista los servicios
  del taller en modo solo lectura (nombre, categoría, precio base y estado).
- Sin acciones de creación, edición, desactivación ni eliminación.
- Sin rutas `/admin/services/*` independientes.

**Transversal:**

- Componentes reutilizables en `modules/services/components/` que el módulo
  admin consume en modo solo lectura, siguiendo el patrón de
  `modules/clients/` y `modules/admin/clients/`.
- Añadir "Servicios" a la navegación del `PrivateHeader` del `CLIENT`.
- Reemplazar el enlace "Próximamente" de servicios en el detalle del taller
  de `ADMIN` por el bloque de solo lectura.
- Notificaciones de éxito y error con `nextjs-toast-notify` en
  `position: "top-right"`.
- Server Actions que validan sesión, rol, pertenencia al taller y datos de
  entrada en el servidor.

### Fuera del alcance

- Creación, edición, desactivación o eliminación de servicios por `ADMIN`.
- Ruta `/admin/services` independiente (lista global de servicios).
- Catálogo de categorías o lista seleccionable separada (la categoría es
  texto libre).
- Módulo de facturas (módulo 4.5, spec separado). La consulta pública
  `listActiveServices` se expone ahora para que el módulo de facturas la
  consuma después.
- Dashboard del taller (módulo 4.6, spec separado).
- Paginación de listas (se carga todo a la vez, igual que `clients` y
  `document-types`).
- Eliminación física de servicios referenciados por facturas (bloqueada por
  `ON DELETE RESTRICT`).

---

## 2. Actores y permisos

| Actor | Descripción | Acceso |
|---|---|---|
| `CLIENT` | Propietario de un taller. | CRUD de sus propios servicios en `/services/*`. No accede a `/admin/*`. |
| `ADMIN` | Administrador global de Confectu. | Solo lectura de servicios de cualquier taller, dentro de `/admin/workshops/[id]`. No muta servicios. |
| Usuario no autenticado | Sin sesión activa. | Sin acceso. Redirigido a `/login`. |

### Reglas de permisos

- El taller se resuelve en el servidor para `CLIENT` a partir del usuario
  autenticado (`workshops.owner_id = auth.uid()`); nunca se toma del
  formulario.
- `ADMIN` no necesita resolver `workshop_id` propio; accede a los servicios
  vía el `workshop_id` de la URL, validado contra un taller existente.
- Todas las Server Actions de `services` validan sesión activa y rol
  `CLIENT`; las consultas de admin validan rol `ADMIN`.
- Las políticas RLS existentes cubren todos los casos:
  - `CLIENT`: `workshop_id = current_workshop_id()` para select/insert/update/delete.
  - `ADMIN`: `services_select` permite lectura vía `is_admin()` (migración
    `20260820`). No se requieren políticas de mutación para `ADMIN`.

---

## 3. Flujo principal — CLIENT

### 3.1 Listar servicios

1. El usuario accede a `/services`.
2. La página (server component) resuelve la sesión y el `workshop_id`.
3. Consulta `listServices(supabase, { includeInactive: false })`.
4. Renderiza `ServiceList` con los servicios activos.
5. El usuario puede:
   - Escribir en el campo de búsqueda para filtrar por nombre (cliente).
   - Activar el interruptor "Mostrar inactivos" para ver todos.
   - Pulsar "Crear servicio" para ir a `/services/new`.
   - Pulsar "Editar" en un servicio para ir a `/services/[id]`.
   - Pulsar "Desactivar"/"Reactivar" con doble confirmación.
   - Pulsar "Eliminar" con doble confirmación.

### 3.2 Crear servicio

1. El usuario accede a `/services/new`.
2. La página renderiza `ServiceForm` en modo `create`.
3. El usuario completa nombre (obligatorio), descripción, categoría y precio
   base COP.
4. Al enviar, el formulario valida en el cliente y llama a la Server Action
   `createService`.
5. El servidor valida sesión, rol, `workshop_id`, campos y precio.
6. Si hay errores de campo, devuelve `fieldErrors` y se muestran inline.
7. Si hay error de servidor, muestra toast `error`.
8. Si éxito, muestra toast `success` y redirige a `/services`.

### 3.3 Editar servicio

1. El usuario accede a `/services/[id]`.
2. La página consulta `getServiceById`. Si no existe o no pertenece al taller,
   renderiza `NotFoundNotice`.
3. Renderiza `ServiceForm` en modo `edit` con los datos cargados.
4. Al enviar, llama a `updateService`.
5. El servidor valida `id`, pertenencia al taller, campos y precio.
6. Mismos flujos de error/éxito que la creación; redirige a `/services`.

### 3.4 Desactivar / reactivar

1. En la lista, el usuario pulsa "Desactivar" (o "Reactivar").
2. Aparece la primera confirmación: "¿Estás seguro de desactivar este
   servicio?".
3. Si confirma, aparece la segunda: "Esta acción es definitiva. ¿Confirmar
   desactivación?".
4. Al confirmar, se llama a `toggleServiceStatus`.
5. El servidor valida `id` y pertenencia, invierte `is_active`.
6. Toast `success` y `router.refresh()`.

### 3.5 Eliminar físicamente

1. En la lista, el usuario pulsa "Eliminar".
2. Aparece la primera confirmación: "¿Estás seguro de eliminar este
   servicio? Esta acción es irreversible.".
3. Si confirma, aparece la segunda: "Esta acción es definitiva. ¿Confirmar
   eliminación?".
4. Al confirmar, se llama a `deleteService`.
5. El servidor valida `id` y pertenencia, intenta `delete`.
6. Si hay error de FK (`invoice_lines.service_id` `ON DELETE RESTRICT`),
   devuelve error con mensaje que sugiere desactivar el servicio en su lugar.
7. Si éxito, toast `success` y `router.refresh()`.

---

## 4. Flujo alternativo — ADMIN (solo lectura)

### 4.1 Ver servicios de un taller

1. `ADMIN` accede a `/admin/workshops/[id]` (página existente).
2. La página consulta `getWorkshopById` y, además, `listServicesByWorkshop`.
3. Renderiza el bloque "Servicios" con `AdminServiceReadOnlyList`, que
   envuelve `ServiceReadOnlyList`.
4. La lista muestra cada servicio con nombre, categoría (o "Sin categoría"),
  precio base formateado en COP y badge de estado (Activo/Inactivo).
5. No hay botones de acción. No hay enlaces a edición.
6. Si el taller no tiene servicios, se muestra un mensaje "Sin servicios.".
7. Si el taller no existe, la página ya renderiza su `NotFoundNotice`
   existente.

---

## 5. Reglas de negocio

- El **nombre** del servicio **no es único** por taller; se permiten
  duplicados (el esquema no tiene restricción de unicidad).
- La **categoría** es texto libre opcional; no hay catálogo ni lista
  seleccionable.
- El **precio base** admite hasta 2 decimales (la columna es
  `numeric(12,2)`), aunque COP no usa centavos en la práctica cotidiana.
- Los precios se muestran con **separadores de miles** en formato `es-CO`
  (`Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })`).
- La eliminación física está bloqueada si el servicio está referenciado por
  `invoice_lines.service_id` (`ON DELETE RESTRICT`); en ese caso se sugiere
  desactivar el servicio.
- Los servicios se ordenan por **nombre ascendente**.
- **Sin paginación**: las listas cargan todos los servicios a la vez.

---

## 6. Estados y transiciones

### `is_active`

- `true` → `false`: desactivación mediante `toggleServiceStatus` con doble
  confirmación. Reversible.
- `false` → `true`: reactivación mediante `toggleServiceStatus` con doble
  confirmación. Reversible.

### Eliminación física

- Estado: existe → eliminado. Irreversible. Doble confirmación. Bloqueada si
  referenciada por `invoice_lines`.

---

## 7. Modelo de datos afectado

### Tabla `services` (ya existe en migración inicial)

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | uuid PK | `default gen_random_uuid()` |
| `workshop_id` | uuid | NOT NULL, FK → `workshops(id)` `ON DELETE RESTRICT` |
| `name` | text | NOT NULL, `length(btrim(name)) > 0` |
| `description` | text | nullable |
| `category` | text | nullable |
| `default_price_cop` | numeric(12,2) | NOT NULL, `>= 0` |
| `is_active` | boolean | NOT NULL, `default true` |
| `created_at` | timestamptz | NOT NULL, `default now()` |
| `updated_at` | timestamptz | NOT NULL, `default now()` |

### Migraciones

- **No se requieren nuevas migraciones de esquema.** La tabla `services`,
  sus índices, restricciones y políticas RLS ya están definidas en la
  migración inicial `20260818012245_init_schema.sql`.
- **No se requieren nuevas migraciones de RLS.** La política `services_select`
  ya permite a `ADMIN` leer vía `is_admin()` (migración
  `20260820230732_admin_read_invoices_services.sql`). Las políticas de
  insert/update/delete siguen limitadas a `current_workshop_id()`, lo cual es
  correcto porque `ADMIN` no muta servicios.

---

## 8. Relaciones

- `services.workshop_id` → `workshops.id` (`ON DELETE RESTRICT`): un servicio
  pertenece a un único taller.
- `invoice_lines.service_id` → `services.id` (`ON DELETE RESTRICT`): una
  línea de factura puede referenciar un servicio; esta relación **bloquea la
  eliminación física** del servicio. La línea guarda su propia
  `description_snapshot` y `unit_price_cop`, por lo que no depende del
  servicio para conservar sus datos.
- `services` no tiene relación directa con `customers` ni `invoices` más allá
  de las líneas.

---

## 9. Aislamiento multi-tenant y RLS

### Políticas existentes (no requieren cambios)

```sql
-- services_select (migración 20260820): ADMIN puede leer
create policy services_select on public.services
  for select to authenticated
  using (workshop_id = public.current_workshop_id() or public.is_admin());

-- services_insert: solo el owner del taller
create policy services_insert on public.services
  for insert to authenticated
  with check (workshop_id = public.current_workshop_id());

-- services_update: solo el owner del taller
create policy services_update on public.services
  for update to authenticated
  using (workshop_id = public.current_workshop_id())
  with check (workshop_id = public.current_workshop_id());

-- services_delete: solo el owner del taller
create policy services_delete on public.services
  for delete to authenticated
  using (workshop_id = public.current_workshop_id());
```

### Validación server-side

- Todas las Server Actions de `modules/services/actions.ts` validan:
  1. Sesión activa (`resolveAuthState`).
  2. Rol `CLIENT`.
  3. `workshop_id` resuelto desde el usuario (no desde el formulario).
  4. En edición/toggle/eliminación: que el servicio exista y su
     `workshop_id` coincida con el taller del usuario.
- Las consultas de admin en `modules/admin/workshops/queries.ts` validan rol
  `ADMIN` en la página server antes de llamar a `listServicesByWorkshop`.

---

## 10. Validaciones funcionales

### `modules/services/validations.ts`

Función `validateServiceInput(input: ServiceInput)`:

| Campo | Regla |
|---|---|
| `name` | Obligatorio. `trim()`. 1–255 caracteres. |
| `description` | Opcional. Si se envía, `trim()` y máx. 1000 caracteres. |
| `category` | Opcional. Si se envía, `trim()` y máx. 100 caracteres. |
| `defaultPriceCop` | Obligatorio. Debe ser un número válido. `>= 0` y `<= 9999999999.99`. Hasta 2 decimales. |

### Validación de `id` en mutaciones

- `updateService`, `toggleServiceStatus`, `deleteService`: `id` obligatorio,
  no vacío tras `trim()`.

### Validación de precio en el cliente

- El `ServiceForm` valida que el precio sea un número finito, `>= 0` y con no
  más de 2 decimales antes de enviar el `FormData`.
- El campo usa `type="number"`, `min="0"`, `step="0.01"` y
  `inputMode="decimal"` para ayudar al teclado móvil.

---

## 11. Errores y estados de la interfaz

| Estado | Comportamiento |
|---|---|
| **Carga (lista)** | La página server espera las consultas; el `layout` privado puede mostrar un skeleton. |
| **Carga (formulario)** | El botón de envío muestra "Guardando..." y se deshabilita (`useFormStatus`). |
| **Carga (toggle/eliminar)** | El botón muestra "Procesando..." y se deshabilita. |
| **Vacío (sin servicios)** | Mensaje "No hay servicios." + botón "Crear servicio" que enlaza a `/services/new`. |
| **Vacío (sin resultados de búsqueda)** | Mensaje "No se encontraron servicios con ese filtro." o "No hay servicios inactivos." según el toggle. |
| **Vacío (admin, taller sin servicios)** | Mensaje "Sin servicios." dentro del bloque. |
| **No encontrado** | `NotFoundNotice` con enlace "Volver a la lista" (`/services`). |
| **Error de campo** | Mensaje inline bajo el campo correspondiente, con `aria-invalid`. |
| **Error de servidor** | Toast `error` con el mensaje devuelto por la Server Action. |
| **Error de eliminación bloqueada** | Toast `error`: "No se puede eliminar el servicio porque está referenciado por facturas. Considera desactivarlo." |
| **Éxito (crear/editar)** | Toast `success` ("Servicio creado" / "Servicio actualizado") + redirección a `/services`. |
| **Éxito (toggle)** | Toast `success` ("Servicio desactivado" / "Servicio reactivado") + `router.refresh()`. |
| **Éxito (eliminar)** | Toast `success` ("Servicio eliminado") + `router.refresh()`. |

---

## 12. Rutas y pantallas afectadas

### Rutas CLIENT (nuevas o reemplazadas)

| Ruta | Tipo | Descripción |
|---|---|---|
| `/services` | Server component | Lista de servicios del taller. Reemplaza el placeholder "Próximamente". |
| `/services/new` | Server component | Formulario de creación. Renderiza `ServiceForm` modo `create`. |
| `/services/[id]` | Server component | Formulario de edición. Renderiza `ServiceForm` modo `edit` o `NotFoundNotice`. |

### Rutas ADMIN (modificadas)

| Ruta | Cambio |
|---|---|
| `/admin/workshops/[id]` | Añade el bloque "Servicios" de solo lectura. Reemplaza el enlace "Próximamente" actual. |

### Navegación

- `PrivateHeader` (CLIENT): añadir enlace "Servicios" → `/services`.
- `AdminSidebar`: **sin cambios**. No se añade "Servicios" porque la vista
  está dentro del detalle del taller.

---

## 13. Server Actions necesarias

### `modules/services/actions.ts`

#### `createService(formData: FormData): Promise<ServiceActionResult>`

**Entrada (FormData):**
- `name`: string
- `description`: string (opcional)
- `category`: string (opcional)
- `default_price_cop`: string (número)

**Lógica:**
1. `requireClient()` valida sesión, rol `CLIENT` y resuelve `workshopId`.
2. `parseServiceInput(formData)` extrae y normaliza los campos.
3. `validateServiceInput(input)` valida campos.
4. Si hay errores, devuelve `{ success: false, fieldErrors }`.
5. Inserta en `services` con `workshop_id = workshopId`, `is_active = true`.
6. Si error de BBDD, devuelve `{ success: false, error }`.
7. `revalidatePath("/services")`.
8. Devuelve `{ success: true }`.

**Salida:** `ServiceActionResult`

#### `updateService(formData: FormData): Promise<ServiceActionResult>`

**Entrada (FormData):**
- `id`: string
- `name`, `description`, `category`, `default_price_cop`: igual que creación.

**Lógica:**
1. `requireClient()` valida sesión y rol.
2. Valida `id` no vacío.
3. Consulta el servicio existente; si no existe o `workshop_id` no coincide
   con el taller del usuario, devuelve error.
4. `parseServiceInput` + `validateServiceInput`.
5. Actualiza `name`, `description`, `category`, `default_price_cop`.
6. `revalidatePath("/services")` y `revalidatePath("/services/[id]")`.
7. Devuelve `{ success: true }`.

**Salida:** `ServiceActionResult`

#### `toggleServiceStatus(formData: FormData): Promise<ServiceActionResult>`

**Entrada (FormData):**
- `id`: string

**Lógica:**
1. `requireClient()`.
2. Valida `id`.
3. Consulta `id`, `is_active`, `workshop_id`; valida pertenencia.
4. Actualiza `is_active = !existing.is_active`.
5. `revalidatePath("/services")` y `revalidatePath("/services/[id]")`.
6. Devuelve `{ success: true }`.

**Salida:** `ServiceActionResult`

#### `deleteService(formData: FormData): Promise<ServiceActionResult>`

**Entrada (FormData):**
- `id`: string

**Lógica:**
1. `requireClient()`.
2. Valida `id`.
3. Consulta `id`, `workshop_id`; valida pertenencia.
4. Intenta `delete` de la fila.
5. Si error con código `23503` (foreign_key_violation) u otro error de FK,
   devuelve `{ success: false, error: "No se puede eliminar el servicio porque está referenciado por facturas. Considera desactivarlo." }`.
6. Si otro error de BBDD, devuelve error genérico.
7. `revalidatePath("/services")`.
8. Devuelve `{ success: true }`.

**Salida:** `ServiceActionResult`

### Patrón `requireClient`

Reutiliza el mismo patrón de `modules/clients/actions.ts`:
- `resolveAuthState(supabase)` para sesión.
- Validar `status === "active"`.
- Validar `profile.role === "CLIENT"`.
- Resolver `workshopId` desde `workshops.owner_id = profile.id`.

---

## 14. Estructuras de FormData y tipos esperados

### `modules/services/types.ts`

```typescript
export interface Service {
  id: string;
  workshopId: string;
  name: string;
  description: string | null;
  category: string | null;
  defaultPriceCop: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceInput {
  name: string;
  description: string | null;
  category: string | null;
  defaultPriceCop: number;
}

export interface ServiceActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}
```

### Campos de FormData

| Campo | Nombre en FormData | Tipo | Notas |
|---|---|---|---|
| ID | `id` | string | Solo en edición/toggle/eliminación. |
| Nombre | `name` | string | Obligatorio. |
| Descripción | `description` | string | Opcional; cadena vacía se trata como `null`. |
| Categoría | `category` | string | Opcional; cadena vacía se trata como `null`. |
| Precio base | `default_price_cop` | string | Número como texto; el servidor lo parsea. |

### `modules/admin/workshops/types.ts` (extensión)

`WorkshopWithSettings` se extiende para incluir servicios en la página de
detalle, o bien la página consulta `listServicesByWorkshop` por separado y
pasa los servicios como prop al componente. Se prefiere la consulta separada
para mantener `getWorkshopById` enfocado en taller + configuración.

---

## 15. Consultas (modules/services/queries.ts)

### `listServices(supabase, options?): Promise<Service[]>`

- `options.includeInactive` (default `false`).
- Selecciona todas las columnas.
- Si `!includeInactive`, filtra `is_active = true`.
- Ordena por `name` ascendente.
- RLS limita automáticamente al taller del usuario.

### `getServiceById(supabase, id): Promise<Service | null>`

- Selecciona por `id`.
- RLS garantiza que solo devuelve filas del taller del usuario.
- Devuelve `null` si no existe o no pertenece al taller.

### `listActiveServices(supabase): Promise<Service[]>`

- **Consulta pública** para el futuro flujo de factura (módulo 4.5).
- Filtra `is_active = true`.
- Ordena por `name` ascendente.
- RLS limita al taller del usuario.

### `listServicesByWorkshop(supabase, workshopId): Promise<Service[]>`

- Filtra por `workshop_id = workshopId`.
- Ordena por `name` ascendente.
- Usada por la vista admin de solo lectura. RLS permite a `ADMIN` leer
  cualquier taller vía `is_admin()`.

### Mapeo de filas

Función `mapService(row: DbService): Service` que convierte `snake_case` a
`camelCase` y `default_price_cop` a `number`.

---

## 16. Componentes de UI y responsabilidades

### `modules/services/components/ServiceForm.tsx` (client)

- **Props:** `mode: "create" | "edit"`, `service?: Service`, `action:
  (formData: FormData) => Promise<ServiceActionResult>`, `redirectHref?:
  string` (default `/services`).
- **Responsabilidad:** formulario con campos nombre, descripción, categoría y
  precio base COP. Validación cliente antes de enviar. Muestra `fieldErrors`
  inline y `error` global. Toast de éxito/error. Redirige tras éxito.
- **Patrón:** igual que `CustomerForm`, con `useFormStatus` para el botón y
  `useState` para los campos.
- **Campo de precio:** `type="number"`, `min="0"`, `step="0.01"`,
  `inputMode="decimal"`. Validación cliente de no más de 2 decimales.

### `modules/services/components/ServiceList.tsx` (client)

- **Props:** `services: Service[]`, `statusToggleAction?: (formData: FormData)
  => Promise<ServiceActionResult>` (default `toggleServiceStatus`),
  `deleteAction?: (formData: FormData) => Promise<ServiceActionResult>`
  (default `deleteService`).
- **Responsabilidad:** búsqueda por nombre (cliente), interruptor "Mostrar
  inactivos", lista de servicios con badge de estado, botones "Editar",
  "Desactivar/Reactivar" y "Eliminar".
- **Patrón:** igual que `CustomerList`, con `useMemo` para el filtrado.
- **Estado vacío:** mensaje + CTA "Crear servicio" → `/services/new`.

### `modules/services/components/ServiceStatusToggle.tsx` (client)

- **Props:** `service: Service`, `action: (formData: FormData) =>
  Promise<ServiceActionResult>`.
- **Responsabilidad:** doble confirmación para desactivar/reactivar. Toast de
  éxito/error. `router.refresh()` tras éxito.
- **Patrón:** igual que `CustomerStatusToggle` (dos pasos, `role="dialog"`).

### `modules/services/components/ServiceDeleteButton.tsx` (client)

- **Props:** `service: Service`, `action: (formData: FormData) =>
  Promise<ServiceActionResult>`.
- **Responsabilidad:** doble confirmación para eliminación física. Toast de
  éxito/error. `router.refresh()` tras éxito. Mensaje de confirmación que
  advierte que la acción es irreversible.
- **Patrón:** igual que `CustomerStatusToggle` pero con etiquetas de
  eliminación y variante `danger`.

### `modules/services/components/ServiceReadOnlyList.tsx` (server o client)

- **Props:** `services: Service[]`.
- **Responsabilidad:** lista sin acciones, sin búsqueda, sin toggle. Muestra
  nombre, categoría (o "Sin categoría"), precio base formateado en COP y
  badge de estado.
- **Uso:** consumida por `AdminServiceReadOnlyList` en la vista admin.

### `modules/services/components/NotFoundNotice.tsx` (server)

- **Responsabilidad:** aviso "Servicio no encontrado." con enlace "Volver a
  la lista" → `/services`.
- **Patrón:** igual que `modules/clients/components/NotFoundNotice.tsx`.

### `modules/admin/workshops/components/AdminServiceReadOnlyList.tsx` (server)

- **Responsabilidad:** wrapper que recibe `services: Service[]` y renderiza
  `ServiceReadOnlyList`. No añade acciones.
- **Patrón:** igual que `AdminCustomerForm` / `AdminCustomerStatusToggle`
  como wrapper delgado.

---

## 17. Criterios de aceptación verificables

1. **Crear servicio:** un `CLIENT` puede crear un servicio con nombre,
   descripción, categoría y precio base; aparece en la lista.
2. **Editar servicio:** un `CLIENT` puede editar un servicio existente; los
   cambios se reflejan.
3. **Desactivar/reactivar:** un `CLIENT` puede desactivar y reactivar un
   servicio con doble confirmación; el badge cambia.
4. **Eliminar:** un `CLIENT` puede eliminar un servicio no referenciado con
   doble confirmación; desaparece de la lista.
5. **Eliminación bloqueada:** si el servicio está referenciado por
   `invoice_lines`, la eliminación falla con un mensaje que sugiere
   desactivarlo.
6. **Búsqueda:** la búsqueda por nombre filtra la lista correctamente.
7. **Toggle inactivos:** el interruptor muestra/oculta los servicios
   inactivos.
8. **Aislamiento CLIENT:** un `CLIENT` no puede acceder a ni mutar servicios
   de otro taller (RLS + validación server-side).
9. **Vista ADMIN:** un `ADMIN` puede ver los servicios de cualquier taller
   dentro de `/admin/workshops/[id]`.
10. **ADMIN sin mutación:** la vista admin de servicios no muestra botones de
    crear, editar, desactivar ni eliminar.
11. **Estados de UI:** las pantallas muestran estados de carga, vacío, error y
    éxito y funcionan primero en móvil.
12. **Toasts:** las notificaciones aparecen en `position: "top-right"` con
    `nextjs-toast-notify`.
13. **Navegación CLIENT:** "Servicios" aparece en el `PrivateHeader` y enlaza
    a `/services`.
14. **Consulta pública:** `listActiveServices` devuelve solo los servicios
    activos del taller del usuario.
15. **Build:** `pnpm lint` y `pnpm build` pasan sin errores.

---

## 18. Estrategia de pruebas

### Verificación manual en `pnpm dev`

- Crear, editar, desactivar, reactivar y eliminar servicios como `CLIENT`.
- Verificar que la búsqueda por nombre filtra correctamente.
- Verificar que el toggle de inactivos muestra/oculta correctamente.
- Verificar estados vacíos (sin servicios, sin resultados).
- Acceder a `/admin/workshops/[id]` como `ADMIN` y verificar el bloque de
  servicios de solo lectura.

### Validación de aislamiento

- Como `CLIENT`, intentar acceder a `/services/[id]` de un servicio de otro
  taller: debe renderizar `NotFoundNotice` (RLS bloquea la consulta).
- Intentar llamar `updateService` / `toggleServiceStatus` / `deleteService`
  con un `id` de otro taller: debe devolver error de pertenencia.

### Validación de eliminación bloqueada

- Insertar manualmente una fila en `invoice_lines` que referencie un servicio
  (o usar el módulo de facturas cuando esté implementado).
- Intentar eliminar el servicio: debe mostrar el toast de error que sugiere
  desactivarlo.

### Validación de permisos ADMIN

- Como `ADMIN`, verificar que no hay botones de acción en el bloque de
  servicios.
- Verificar que no existe ruta `/admin/services` (debe 404).

### Verificación de build

- `pnpm lint` sin errores.
- `pnpm build` sin errores de tipos ni de rutas.

---

## 19. Archivos a crear / modificar

### Crear

```
modules/services/
├── components/
│   ├── ServiceForm.tsx
│   ├── ServiceList.tsx
│   ├── ServiceStatusToggle.tsx
│   ├── ServiceDeleteButton.tsx
│   ├── ServiceReadOnlyList.tsx
│   └── NotFoundNotice.tsx
├── actions.ts
├── queries.ts
├── types.ts
└── validations.ts

modules/admin/workshops/components/
└── AdminServiceReadOnlyList.tsx

app/(private)/services/
├── new/
│   └── page.tsx
└── [id]/
    └── page.tsx
```

### Modificar

```
app/(private)/services/page.tsx          # reemplazar placeholder
app/(admin)/admin/workshops/[id]/page.tsx # añadir bloque de servicios
modules/auth/components/PrivateHeader.tsx # añadir enlace "Servicios"
docs/modules.md                           # actualizar estado de 4.3 y 4.7.4
```

---

## 20. Actualización de `docs/modules.md`

Tras la implementación, actualizar:

### 4.3 `modules/services/`

- **Estado actual:** IMPLEMENTADO.
- **Observaciones:** CRUD completo para `CLIENT` en `/services`, con búsqueda
  por nombre, filtro de inactivos, doble confirmación en desactivar/reactivar
  y eliminación física con doble confirmación. La eliminación se bloquea si
  el servicio está referenciado por `invoice_lines`. La consulta pública
  `listActiveServices` está disponible para el flujo de factura.

### 4.7.4 `modules/admin/services/`

- **Estado actual:** NO IMPLEMENTADO (solo lectura absorbida por 4.3).
- **Observaciones:** La gestión de servicios por `ADMIN` se limita a solo
  lectura dentro del detalle del taller (`/admin/workshops/[id]`). `ADMIN` no
  crea, edita, desactiva ni elimina servicios. No se requiere submódulo
  `modules/admin/services/` independiente ni migración de RLS de mutación;
  la política `services_select` existente ya permite la lectura. El
  submódulo `modules/admin/services/` del plan original queda descartado para
  el MVP.
